"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { setPull } from "@/lib/cursor-pull";
import { accentRGB, isLightTheme, onThemeChange } from "@/lib/gl";
import { INTRO_DONE, introShowing } from "@/lib/intro";
import { Liquid, SUBSTEPS_PER_SECOND, type Box } from "@/lib/liquid";

/**
 * Real liquid around a button: a few hundred particles of simulated fluid
 * (lib/liquid.ts) that pour round the button's edge in a slow current, sag a
 * little under gravity, and — when the pointer comes near — stream out to it,
 * gather into a drop on the cursor and drag it toward the button. Click and it
 * splashes.
 *
 * Drawing it: every particle is splatted as a soft blob into an offscreen
 * float texture, adding up into one smooth field; a second pass cuts that
 * field at a threshold to get the surface, takes its slope as the surface
 * normal, and shades it as glossy black with a rim of the accent. Merging,
 * necking and beading all come out of that for free.
 *
 * The canvas overhangs the button by `reach` on every side and sits behind
 * it. It runs continuously while on screen — that's the point of it — and
 * pauses when scrolled away, in a background tab, or behind the intro.
 */

const SPLAT_VS = `#version 300 es
in vec2 a_pos;
uniform vec2 uView;
uniform float uSize;
void main() {
  vec2 c = a_pos / uView * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
  gl_PointSize = uSize;
}`;

const SPLAT_FS = `#version 300 es
precision highp float;
out vec4 o;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  o = vec4(exp(-r2 * 3.2) - 0.0408, 0.0, 0.0, 1.0);
}`;

const SURFACE_VS = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const SURFACE_FS = `#version 300 es
precision highp float;
uniform sampler2D uField;
uniform vec2 uRes;
uniform float uDpr;
uniform float uThreshold;
uniform vec3 uAccent;
uniform float uLight;
out vec4 o;

float F(vec2 p) { return texture(uField, p / uRes).r; }

void main() {
  vec2 p = gl_FragCoord.xy;
  float f = F(p);

  float w = max(fwidth(f), 0.0001);
  float body = smoothstep(uThreshold - w, uThreshold + w, f);
  float halo = smoothstep(uThreshold * 0.3, uThreshold, f);
  halo = halo * halo * (1.0 - body);
  if (body <= 0.0 && halo <= 0.003) { o = vec4(0.0); return; }

  // The field's slope is the surface's tilt: steep at the rim, flat inside.
  float e = 1.5 * uDpr;
  vec2 g = vec2(F(p + vec2(e, 0.0)) - F(p - vec2(e, 0.0)), F(p + vec2(0.0, e)) - F(p - vec2(0.0, e))) / (2.0 * e);
  vec3 n = normalize(vec3(-g * (14.0 * uDpr) / max(f, uThreshold), 1.0));

  vec3 L = normalize(vec3(-0.5, 0.78, 0.62));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float nh = max(dot(n, H), 0.0);
  float spec = pow(nh, 110.0) * 1.6 + pow(nh, 16.0) * 0.1;
  vec3 L2 = normalize(vec3(0.7, -0.3, 0.5));
  float spec2 = pow(max(dot(n, normalize(L2 + vec3(0.0, 0.0, 1.0))), 0.0), 60.0) * 0.35;
  float fresnel = pow(1.0 - n.z, 2.0);
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  float sky = smoothstep(0.25, 0.85, r.y) * 0.2;
  float depth = smoothstep(uThreshold, uThreshold * 5.0, f);

  vec3 col = vec3(0.016, 0.018, 0.014) * (1.0 - depth * 0.5)
    + vec3(spec + spec2 + sky)
    + uAccent * fresnel * 0.9;

  vec4 glow = uLight > 0.5
    ? vec4(0.0, 0.0, 0.0, halo * 0.22)
    : vec4(uAccent * halo * 0.3, halo * 0.3);

  o = vec4(col * body, body) + glow * (1.0 - body);
}`;

const PARTICLE_RADIUS = 11;
const THRESHOLD = 0.72;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const v = compile(gl, gl.VERTEX_SHADER, vs);
  const f = compile(gl, gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const program = gl.createProgram()!;
  gl.attachShader(program, v);
  gl.attachShader(program, f);
  gl.bindAttribLocation(program, 0, "a_pos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

function boxDistance(box: Box, x: number, y: number) {
  const qx = Math.abs(x - box.cx) - box.hx;
  const qy = Math.abs(y - box.cy) - box.hy;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
}

const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

let instances = 0;

export default function Ferrofluid({
  children,
  reach = 240,
  className = "",
}: {
  children: ReactNode;
  /** How far, in px, the liquid will reach for the cursor. */
  reach?: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const target = host?.querySelector<HTMLElement>(":scope > :not(canvas)");
    if (!host || !canvas || !target) return;

    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return;

    const splat = link(gl, SPLAT_VS, SPLAT_FS);
    const surface = link(gl, SURFACE_VS, SURFACE_FS);
    if (!splat || !surface) return;

    // Half floats if the GPU can render to them; plain bytes otherwise.
    const floats = Boolean(gl.getExtension("EXT_color_buffer_float") ?? gl.getExtension("EXT_color_buffer_half_float"));
    const fieldTexture = gl.createTexture();
    const fieldBuffer = gl.createFramebuffer();

    const pointBuffer = gl.createBuffer();
    const pointVao = gl.createVertexArray();
    gl.bindVertexArray(pointVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const quadVao = gl.createVertexArray();
    gl.bindVertexArray(quadVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const u = (program: WebGLProgram, name: string) => gl.getUniformLocation(program, name);
    const splatView = u(splat, "uView");
    const splatSize = u(splat, "uSize");
    const surfaceField = u(surface, "uField");
    const surfaceRes = u(surface, "uRes");
    const surfaceDpr = u(surface, "uDpr");
    const surfaceThreshold = u(surface, "uThreshold");
    const surfaceAccent = u(surface, "uAccent");
    const surfaceLight = u(surface, "uLight");
    const maxPoint = (gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array)[1] || 64;

    const id = `ferro-${instances++}`;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const inDock = Boolean(host.closest(".loading-dock"));
    const blocked = () => !inDock && introShowing();

    let accent = accentRGB();
    let light = isLightTheme() ? 1 : 0;
    let dpr = 1;
    let width = 1;
    let height = 1;

    const pointer = { x: -1e4, y: -1e4, has: false, touchUntil: 0 };
    const pull = { x: 0, y: 0 };
    let liquid: Liquid | null = null;
    let points = new Float32Array(0);
    let raf = 0;
    let last = performance.now();
    let carry = 0;
    // Until the observer says otherwise: a hidden button has no size to pour round.
    let visible = false;
    let seededFor: Box | null = null;

    function resize() {
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.max(1, Math.round(width * dpr));
      canvas!.height = Math.max(1, Math.round(height * dpr));

      gl!.bindTexture(gl!.TEXTURE_2D, fieldTexture);
      gl!.texImage2D(
        gl!.TEXTURE_2D,
        0,
        floats ? gl!.RGBA16F : gl!.RGBA8,
        canvas!.width,
        canvas!.height,
        0,
        gl!.RGBA,
        floats ? gl!.HALF_FLOAT : gl!.UNSIGNED_BYTE,
        null,
      );
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, fieldBuffer);
      gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, fieldTexture, 0);
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    }

    /** The button, in the canvas's own unscaled pixels. */
    function measure() {
      const cr = canvas!.getBoundingClientRect();
      const br = target!.getBoundingClientRect();
      const scale = cr.width / (width || 1) || 1;
      const box: Box = {
        cx: (br.left - cr.left + br.width / 2) / scale,
        cy: (br.top - cr.top + br.height / 2) / scale,
        hx: br.width / 2 / scale,
        hy: br.height / 2 / scale,
      };
      return { box, cr, scale, br };
    }

    function ensureLiquid(box: Box) {
      // A button that changed size a lot (a resize, a new layout) gets fresh
      // liquid; otherwise particles left inside it would be shoved out at once.
      if (liquid && seededFor) {
        const grew = Math.abs(box.hx - seededFor.hx) + Math.abs(box.hy - seededFor.hy);
        if (grew < 0.2 * (seededFor.hx + seededFor.hy)) return liquid;
      }
      seededFor = { ...box };
      const perimeter = 4 * (box.hx + box.hy);
      liquid = new Liquid(Math.round(Math.min(1100, Math.max(220, perimeter * 0.85))), box);
      points = new Float32Array(liquid.count * 2);
      // Let the first few jostles happen before anyone sees them.
      for (let s = 0; s < 40; s++) liquid.step({ box, magnet: null, excite: 0, width, height });
      return liquid;
    }

    function draw(sim: Liquid) {
      for (let i = 0; i < sim.count; i++) {
        points[i * 2] = sim.x[i];
        points[i * 2 + 1] = sim.y[i];
      }

      // Pass 1: every particle adds a soft blob to the field.
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, fieldBuffer);
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.enable(gl!.BLEND);
      gl!.blendFunc(gl!.ONE, gl!.ONE);
      gl!.useProgram(splat);
      gl!.uniform2f(splatView, width, height);
      gl!.uniform1f(splatSize, Math.min(maxPoint, PARTICLE_RADIUS * 2 * dpr));
      gl!.bindVertexArray(pointVao);
      gl!.bindBuffer(gl!.ARRAY_BUFFER, pointBuffer);
      gl!.bufferData(gl!.ARRAY_BUFFER, points, gl!.DYNAMIC_DRAW);
      gl!.drawArrays(gl!.POINTS, 0, sim.count);
      gl!.disable(gl!.BLEND);

      // Pass 2: cut the field into a surface and light it.
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      gl!.useProgram(surface);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, fieldTexture);
      gl!.uniform1i(surfaceField, 0);
      gl!.uniform2f(surfaceRes, canvas!.width, canvas!.height);
      gl!.uniform1f(surfaceDpr, dpr);
      gl!.uniform1f(surfaceThreshold, floats ? THRESHOLD : THRESHOLD * 0.5);
      gl!.uniform3f(surfaceAccent, accent[0], accent[1], accent[2]);
      gl!.uniform1f(surfaceLight, light);
      gl!.bindVertexArray(quadVao);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      gl!.bindVertexArray(null);
    }

    function frame(now: number) {
      raf = 0;
      const { box, cr, scale } = measure();
      if (box.hx < 4 || box.hy < 4 || width < 8) return;
      const sim = ensureLiquid(box);

      if (pointer.touchUntil && now > pointer.touchUntil) {
        pointer.has = false;
        pointer.touchUntil = 0;
      }

      const live = pointer.has && !blocked();
      const px = (pointer.x - cr.left) / scale;
      const py = (pointer.y - cr.top) / scale;
      const over = live && boxDistance(box, px, py) < 0;
      const strength = live && !over ? smooth(reach, reach * 0.25, boxDistance(box, px, py)) : 0;

      // The drop on the cursor drags it toward the button, harder the more
      // liquid it holds.
      const mx = px + pull.x;
      const my = py + pull.y;
      if (strength > 0.01) {
        const grip = Math.min(1, sim.gripAt(mx, my, 20) / (sim.count * 0.06));
        const ex = Math.max(box.cx - box.hx, Math.min(box.cx + box.hx, px)) - px;
        const ey = Math.max(box.cy - box.hy, Math.min(box.cy + box.hy, py)) - py;
        const gap = Math.hypot(ex, ey) || 1;
        const drag = grip * strength * Math.min(26, gap * 0.2);
        pull.x += ((ex / gap) * drag - pull.x) * 0.15;
        pull.y += ((ey / gap) * drag - pull.y) * 0.15;
      } else {
        pull.x *= 0.85;
        pull.y *= 0.85;
      }
      setPull(id, Math.round(pull.x * 10) / 10, Math.round(pull.y * 10) / 10);

      // Fixed-size substeps, as many as the time that passed calls for.
      const elapsed = Math.min(0.05, (now - last) / 1000);
      last = now;
      carry += elapsed * SUBSTEPS_PER_SECOND;
      const steps = Math.min(4, Math.max(1, Math.floor(carry)));
      carry = Math.max(0, carry - steps);
      for (let s = 0; s < steps; s++) {
        sim.step({
          box,
          magnet: strength > 0.01 ? { x: mx, y: my, strength } : null,
          excite: over ? 1 : 0,
          width,
          height,
        });
      }

      draw(sim);

      if (visible && !blocked() && document.visibilityState === "visible") {
        raf = requestAnimationFrame(frame);
      } else {
        setPull(id, 0, 0);
      }
    }

    function wake() {
      if (still) {
        // Let it settle out of sight once, then show still frames only.
        const { box } = measure();
        if (box.hx < 4 || box.hy < 4 || width < 8) return;
        if (!liquid) {
          const sim = ensureLiquid(box);
          for (let s = 0; s < 240; s++) sim.step({ box, magnet: null, excite: 0, width, height });
        }
        draw(liquid!);
        return;
      }
      if (!raf && visible && !blocked() && document.visibilityState === "visible") {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }

    function onMove(event: PointerEvent) {
      if (event.pointerType === "touch" && !pointer.touchUntil) return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.has = true;
      if (pointer.touchUntil) pointer.touchUntil = performance.now() + 700;
    }

    function onDown(event: PointerEvent) {
      const rect = target!.getBoundingClientRect();
      const dx = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right);
      const dy = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom);
      if (Math.hypot(dx, dy) > reach) return;

      // A finger is the only "pointer" a phone has: while it's down near the
      // button, the liquid reaches for it.
      if (event.pointerType === "touch") {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.has = true;
        pointer.touchUntil = performance.now() + 900;
      }
      if (dx === 0 && dy === 0 && liquid) liquid.splash(measure().box);
    }

    function onLeave() {
      pointer.has = false;
    }

    const sizes = new ResizeObserver(() => {
      resize();
      if (liquid) draw(liquid);
      wake();
    });
    sizes.observe(canvas);

    const sight = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      wake();
    });
    sight.observe(canvas);

    const offTheme = onThemeChange(() => {
      accent = accentRGB();
      light = isLightTheme() ? 1 : 0;
      if (liquid) draw(liquid);
    });

    resize();
    wake();

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener(INTRO_DONE, wake);
    document.addEventListener("visibilitychange", wake);
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      setPull(id, 0, 0);
      sizes.disconnect();
      sight.disconnect();
      offTheme();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener(INTRO_DONE, wake);
      document.removeEventListener("visibilitychange", wake);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [reach]);

  return (
    <span ref={hostRef} className={`ferro ${className}`} style={{ "--reach": `${reach}px` } as CSSProperties}>
      <canvas ref={canvasRef} aria-hidden className="ferro-canvas" />
      {children}
    </span>
  );
}
