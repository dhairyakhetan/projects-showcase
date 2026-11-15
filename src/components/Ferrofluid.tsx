"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { setPull } from "@/lib/cursor-pull";
import { accentRGB, fullscreenProgram, getContext, isLightTheme, isWebGL2, onThemeChange, spring, type GL } from "@/lib/gl";
import { introShowing } from "@/lib/intro";

/**
 * Black venom pooled under a button, alive like ferrofluid near a magnet.
 *
 * Bring the pointer close and spikes rise on the side facing it; closer still
 * and strands of liquid reach out, grab the cursor and drag it toward the
 * button. Press, and it splashes. All of it is one signed-distance field —
 * the pool, its spikes, three tapering strands and a drop on the cursor,
 * smooth-unioned so they merge like liquid — shaded as glossy black with a
 * rim of the accent colour.
 *
 * The canvas reaches `reach` px past the button on every side and sits behind
 * it. It only draws while something is moving: far from the pointer and
 * settled, an idle button costs nothing.
 */

const SHADER = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;
uniform float uDpr;
uniform vec4 uBox;
uniform float uPad;
uniform float uRound;
uniform vec2 uCursor;
uniform float uSpike;
uniform float uHover;
uniform float uTime;
uniform vec3 uAccent;
uniform float uLight;
uniform vec2 uA[3];
uniform vec2 uC[3];
uniform vec2 uB[3];
uniform float uW[3];
uniform float uTip;
uniform vec4 uBounds;

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float roundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float tri(float x) { return 1.0 - abs(2.0 * fract(x) - 1.0); }

float field(vec2 p) {
  vec2 r = p - uBox.xy;
  vec2 b = uBox.zw + uPad;
  float d = roundBox(r, b, min(uRound, min(b.x, b.y)));
  d += sin(p.x * 0.07 + uTime * 1.3) * sin(p.y * 0.09 - uTime * 1.1) * 1.6;

  // Spikes run along x on the long edges and along y on the short ones,
  // blended at the corners; tallest on the side facing the pointer.
  vec2 a = abs(r) / b;
  float onLong = smoothstep(-0.12, 0.12, a.y - a.x);
  float cx = r.x / 15.0 + 0.5;
  float cy = r.y / 15.0 + 0.5;
  float sx = pow(tri(cx), 3.0) * (0.5 + 0.5 * hash(floor(cx) + 3.1 * sign(r.y)));
  float sy = pow(tri(cy), 3.0) * (0.5 + 0.5 * hash(floor(cy) + 7.7 * sign(r.x)));
  vec2 toCursor = uCursor - uBox.xy;
  float facing = max(dot(normalize(r + 0.0001), normalize(toCursor + 0.0001)), 0.0);
  d -= mix(sy, sx, onLong) * (uSpike * (3.0 + 22.0 * facing * facing) + uHover * 8.0);

  for (int i = 0; i < 3; i++) {
    if (uW[i] > 0.0) {
      float strand = 1e5;
      vec2 prev = uA[i];
      for (int j = 1; j <= 8; j++) {
        float t = float(j) / 8.0;
        vec2 q = mix(mix(uA[i], uC[i], t), mix(uC[i], uB[i], t), t);
        vec2 pa = p - prev;
        vec2 ba = q - prev;
        float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.001), 0.0, 1.0);
        float along = (float(j) - 1.0 + h) / 8.0;
        strand = min(strand, length(pa - ba * h) - mix(uW[i], 1.5, pow(along, 0.7)));
        prev = q;
      }
      d = smin(d, strand, 14.0);
    }
  }

  if (uTip > 0.0) d = smin(d, length(p - uCursor) - uTip, 10.0);
  return d;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  // Most of the canvas is empty overhang: skip it before doing any work.
  if (p.x < uBounds.x || p.y < uBounds.y || p.x > uBounds.z || p.y > uBounds.w) { FRAG = vec4(0.0); return; }

  float d = field(p);
#ifdef DERIVATIVES
  vec2 g = vec2(dFdx(d), -dFdy(d)) * uDpr;
#else
  vec2 g = vec2(field(p + vec2(0.75, 0.0)) - d, field(p + vec2(0.0, 0.75)) - d) / 0.75;
#endif
  if (d > 36.0) { FRAG = vec4(0.0); return; }

  // A dome: steep at the rim, flat across the middle.
  float rim = 1.0 - smoothstep(0.0, 13.0, -d);
  vec3 n = normalize(vec3(g * (0.06 + 2.2 * rim), 1.0));

  vec3 L = normalize(vec3(-0.5, -0.8, 0.55));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float nh = max(dot(n, H), 0.0);
  float spec = pow(nh, 80.0) * 1.4 + pow(nh, 10.0) * 0.07;
  float fresnel = pow(1.0 - n.z, 2.2);
  vec3 refl = reflect(vec3(0.0, 0.0, -1.0), n);
  float sky = smoothstep(0.25, 0.8, -refl.y) * 0.16;

  vec3 col = vec3(0.02, 0.022, 0.018) + vec3(spec + sky) + uAccent * fresnel * 0.95;
  float alpha = clamp(0.5 - d * uDpr, 0.0, 1.0);

  float outside = max(d, 0.0);
  float glow = exp(-outside / 9.0) * 0.3 * (1.0 - uLight);
  float shadow = exp(-outside / 7.0) * 0.2 * uLight;
  vec4 halo = vec4(uAccent * glow, glow + shadow);

  FRAG = vec4(col * alpha, alpha) + halo * (1.0 - alpha);
}
`;

function header(gl: GL) {
  return isWebGL2(gl)
    ? "#version 300 es\nout highp vec4 fragColor;\n#define FRAG fragColor\n#define DERIVATIVES 1\n"
    : "#define FRAG gl_FragColor\n";
}

const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

function boxDistance(x: number, y: number, bx: number, by: number) {
  const qx = Math.abs(x) - bx;
  const qy = Math.abs(y) - by;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
}

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

    const gl = getContext(canvas, true);
    if (!gl) return;
    const built = fullscreenProgram(gl, header(gl) + SHADER);
    if (!built) return;
    const { uniform } = built;

    const id = `ferro-${instances++}`;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const inDock = Boolean(host.closest(".loading-dock"));
    const blocked = () => !inDock && introShowing();

    let accent = accentRGB();
    let light = isLightTheme() ? 1 : 0;
    let dpr = 1;

    const pointer = { x: -1e4, y: -1e4, has: false, touchUntil: 0 };
    const reachS = { x: 0, v: 0 };
    const spikeS = { x: 0, v: 0 };
    const hoverS = { x: 0, v: 0 };
    const padS = { x: 9, v: 0 };
    const tipS = { x: 0, v: 0 };
    const pull = { x: 0, y: 0 };

    let raf = 0;
    let last = performance.now();
    const born = last;
    let visible = true;

    // Layout size, not getBoundingClientRect: the button may be mid-way
    // through a scale animation, and the buffer must match the unscaled box.
    function resize() {
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.75, Math.sqrt(2_400_000 / Math.max(1, w * h)));
      canvas!.width = Math.max(1, Math.round(w * dpr));
      canvas!.height = Math.max(1, Math.round(h * dpr));
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
    }

    function frame(now: number) {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Screen positions back into the canvas's own (unscaled) pixels.
      const cr = canvas!.getBoundingClientRect();
      const br = target!.getBoundingClientRect();
      const scale = cr.width / (canvas!.clientWidth || 1) || 1;
      const cx = (br.left - cr.left + br.width / 2) / scale;
      const cy = (br.top - cr.top + br.height / 2) / scale;
      const hx = br.width / 2 / scale;
      const hy = br.height / 2 / scale;

      if (pointer.touchUntil && now > pointer.touchUntil) {
        pointer.has = false;
        pointer.touchUntil = 0;
      }

      const px = (pointer.x - cr.left) / scale;
      const py = (pointer.y - cr.top) / scale;
      const pad = padS.x;
      const dist = boxDistance(px - cx, py - cy, hx + pad, hy + pad);
      const over =
        pointer.has && pointer.x >= br.left && pointer.x <= br.right && pointer.y >= br.top && pointer.y <= br.bottom;
      const live = pointer.has && !blocked() && !still;

      const settled = [
        spring(reachS, live && !over ? smooth(reach, reach * 0.45, dist) : 0, dt, 130, 15),
        spring(spikeS, live ? smooth(reach * 1.3, 0, dist) : 0, dt, 70, 7),
        spring(hoverS, live && over ? 1 : 0, dt, 160, 14),
        spring(padS, 9 + (live && over ? 5 : 0) + reachS.x * 3, dt, 120, 12),
      ].every(Boolean);

      // Strands: from the nearest stretch of pool edge toward the cursor.
      const bx = hx + pad;
      const by = hy + pad;
      const ax = Math.max(-bx, Math.min(bx, px - cx));
      const ay = Math.max(-by, Math.min(by, py - cy));
      const onLongEdge = Math.abs(ay) / by >= Math.abs(ax) / bx;
      const strength = Math.max(0, Math.min(1.15, reachS.x));

      // The cursor itself is dragged toward the button as the liquid takes hold.
      const toX = cx + ax - px;
      const toY = cy + ay - py;
      const gap = Math.hypot(toX, toY) || 1;
      const drag = strength * strength * Math.min(28, gap * 0.22);
      pull.x = (toX / gap) * drag;
      pull.y = (toY / gap) * drag;
      setPull(id, Math.round(pull.x * 10) / 10, Math.round(pull.y * 10) / 10);

      const endX = px + pull.x;
      const endY = py + pull.y;
      const time = (now - born) / 1000;
      const spread = Math.min(1, (onLongEdge ? hx : hy) / 40);
      const offsets = [0, -24 * spread, 22 * spread];
      const lengths = [1, 0.8, 0.66];
      const widths = [10, 6, 5];
      const sags = [0, 0.2, -0.18];

      const A: number[] = [];
      const B: number[] = [];
      const C: number[] = [];
      const W: number[] = [];

      for (let i = 0; i < 3; i++) {
        let sx = cx + ax + (onLongEdge ? offsets[i] : 0);
        let sy = cy + ay + (onLongEdge ? 0 : offsets[i]);
        sx = cx + Math.max(-bx, Math.min(bx, sx - cx));
        sy = cy + Math.max(-by, Math.min(by, sy - cy));
        // Start just inside the pool so the strand grows out of it.
        sx -= Math.sign(px - cx) * (onLongEdge ? 0 : 5);
        sy -= Math.sign(py - cy) * (onLongEdge ? 5 : 0);

        const reachOut = Math.min(1, strength) * lengths[i];
        const ex = sx + (endX - sx) * reachOut;
        const ey = sy + (endY - sy) * reachOut;
        const len = Math.hypot(ex - sx, ey - sy);
        const nx = -(ey - sy) / (len || 1);
        const ny = (ex - sx) / (len || 1);
        const bend = (sags[i] + Math.sin(time * 2.3 + i * 2.1) * 0.08) * len;

        A.push(sx, sy);
        B.push(ex, ey);
        C.push((sx + ex) / 2 + nx * bend, (sy + ey) / 2 + ny * bend);
        W.push(strength > 0.03 ? widths[i] * Math.sqrt(Math.min(1, strength)) : 0);
      }

      spring(tipS, strength > 0.92 ? 7 : 0, dt, 200, 18);

      // Everything the liquid could touch this frame, plus room for the glow.
      let minX = cx - bx - 40;
      let minY = cy - by - 40;
      let maxX = cx + bx + 40;
      let maxY = cy + by + 40;
      for (let i = 0; i < 6; i += 2) {
        if (!W[i / 2]) continue;
        for (const [x, y] of [
          [B[i], B[i + 1]],
          [C[i], C[i + 1]],
        ]) {
          minX = Math.min(minX, x - 52);
          minY = Math.min(minY, y - 52);
          maxX = Math.max(maxX, x + 52);
          maxY = Math.max(maxY, y + 52);
        }
      }
      // Spikes stand out past the pool on the side facing the pointer.
      const spikeRoom = 30 * Math.max(0, spikeS.x) + 12;
      minX -= spikeRoom;
      minY -= spikeRoom;
      maxX += spikeRoom;
      maxY += spikeRoom;

      gl!.uniform2f(uniform("uRes"), canvas!.width, canvas!.height);
      gl!.uniform1f(uniform("uDpr"), dpr);
      gl!.uniform4f(uniform("uBox"), cx, cy, hx, hy);
      gl!.uniform1f(uniform("uPad"), pad);
      gl!.uniform1f(uniform("uRound"), 16);
      gl!.uniform2f(uniform("uCursor"), endX, endY);
      gl!.uniform1f(uniform("uSpike"), Math.max(0, spikeS.x));
      gl!.uniform1f(uniform("uHover"), Math.max(0, hoverS.x));
      gl!.uniform1f(uniform("uTime"), still ? 0 : time);
      gl!.uniform3f(uniform("uAccent"), accent[0], accent[1], accent[2]);
      gl!.uniform1f(uniform("uLight"), light);
      gl!.uniform2fv(uniform("uA"), A);
      gl!.uniform2fv(uniform("uB"), B);
      gl!.uniform2fv(uniform("uC"), C);
      gl!.uniform1fv(uniform("uW"), W);
      gl!.uniform1f(uniform("uTip"), Math.max(0, tipS.x));
      gl!.uniform4f(uniform("uBounds"), minX, minY, maxX, maxY);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);

      // Keep breathing while the pointer is near; rest once it's gone.
      const near = live && dist < reach * 1.4;
      if (visible && (near || !settled)) {
        raf = requestAnimationFrame(frame);
      } else {
        setPull(id, 0, 0);
      }
    }

    function wake() {
      if (!raf && visible) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }

    function onMove(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.has = true;
      const rect = target!.getBoundingClientRect();
      const dx = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right);
      const dy = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom);
      if (Math.hypot(dx, dy) < reach * 1.5 || raf) wake();
    }

    function onDown(event: PointerEvent) {
      const rect = target!.getBoundingClientRect();
      const dx = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right);
      const dy = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom);
      const d = Math.hypot(dx, dy);
      if (d > reach) return;

      // A tap on a phone is the only "hover" there is: the liquid lunges for it.
      if (event.pointerType === "touch") {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.has = true;
        pointer.touchUntil = performance.now() + 900;
      }
      if (d === 0) spikeS.v += 9;
      wake();
    }

    function onLeave() {
      pointer.has = false;
      wake();
    }

    const sizes = new ResizeObserver(() => {
      resize();
      wake();
    });
    sizes.observe(canvas);

    const sight = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake();
    });
    sight.observe(canvas);

    const offTheme = onThemeChange(() => {
      accent = accentRGB();
      light = isLightTheme() ? 1 : 0;
      wake();
    });

    resize();
    wake();

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("scroll", wake, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      setPull(id, 0, 0);
      sizes.disconnect();
      sight.disconnect();
      offTheme();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", wake);
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
