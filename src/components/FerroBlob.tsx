"use client";

import { useEffect, useRef, useState } from "react";
import { accentRGB, fullscreenProgram, getContext, isWebGL2, onThemeChange, spring, type GL } from "@/lib/gl";
import { INTRO_DONE, introShowing } from "@/lib/intro";
import { gloop } from "@/lib/sound";

/**
 * A drop of ferrofluid, raymarched live: the pointer is the magnet.
 *
 * Spikes sit on a spherical Fibonacci lattice, so finding the nearest one is
 * a constant-time lookup instead of a loop over every spike — that's what
 * makes a few hundred of them affordable per pixel. Each grows with how
 * squarely it faces the magnet, and the whole drop stretches toward it.
 * Clicking kicks the spikes; leaving lets them sink back.
 *
 * Like the background dots, it draws only while something is moving.
 */

const SHADER = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;
uniform vec3 uMag;
uniform float uBase;
uniform float uSpike;
uniform float uStretch;
uniform float uSpin;
uniform float uTime;
uniform vec3 uAccent;

const float PI = 3.14159265;
const float PHI = 1.61803399;
const float N = 220.0;
const float R = 0.6;
const float SHELL = R + 0.62;

vec3 rotY(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

// The lattice point nearest to unit vector p (Keinert et al., "Spherical
// Fibonacci Mapping"): invert the lattice locally, then test four neighbours.
vec3 nearestSF(vec3 p) {
  float m = 1.0 - 1.0 / N;
  float phi = min(atan(p.y, p.x), PI);
  float cosTheta = p.z;
  float k = max(2.0, floor(log(N * PI * sqrt(5.0) * (1.0 - cosTheta * cosTheta)) / log(PHI * PHI)));
  float Fk = pow(PHI, k) / sqrt(5.0);
  vec2 F = vec2(floor(Fk + 0.5), floor(Fk * PHI + 0.5));
  vec2 ka = 2.0 * F / N;
  vec2 kb = 2.0 * PI * (fract((F + 1.0) * PHI) - (PHI - 1.0));
  mat2 iB = mat2(ka.y, -ka.x, kb.y, -kb.x) / (ka.y * kb.x - ka.x * kb.y);
  vec2 c = floor(iB * vec2(phi, cosTheta - m));

  float best = 8.0;
  vec3 nearest = vec3(0.0, 0.0, 1.0);
  for (int s = 0; s < 4; s++) {
    vec2 uv = vec2(mod(float(s), 2.0), floor(float(s) / 2.0));
    float i = dot(F, uv + c);
    float ph = 2.0 * PI * fract(i * PHI);
    float ct = m - 2.0 * i / N;
    float st = sqrt(max(0.0, 1.0 - ct * ct));
    vec3 q = vec3(cos(ph) * st, sin(ph) * st, ct);
    float d = dot(q - p, q - p);
    if (d < best) { best = d; nearest = q; }
  }
  return nearest;
}

float surface(vec3 p) {
  float r = length(p);
  vec3 n = p / r;
  vec3 local = rotY(n, uSpin);
  vec3 q = nearestSF(local);
  vec3 magLocal = rotY(uMag, uSpin);

  float facing = smoothstep(-0.35, 1.0, dot(q, magLocal));
  float height = uBase + uSpike * facing * facing;
  float x = clamp(1.0 - length(local - q) / 0.17, 0.0, 1.0);
  float spike = height * x * x;

  float body = R
    + uStretch * pow(max(dot(n, uMag), 0.0), 3.0)
    + 0.02 * sin(n.x * 5.0 + uTime) * sin(n.y * 4.0 - uTime * 0.8);
  return r - body - spike;
}

vec3 normalAt(vec3 p) {
  const vec2 e = vec2(0.0015, -0.0015);
  return normalize(
    e.xyy * surface(p + e.xyy) + e.yyx * surface(p + e.yyx) +
    e.yxy * surface(p + e.yxy) + e.xxx * surface(p + e.xxx));
}

vec3 shade(vec3 p, vec3 n, vec3 rd) {
  float facing = max(dot(n, -rd), 0.0);
  float fresnel = 0.05 + 0.95 * pow(1.0 - facing, 4.0);
  vec3 r = reflect(rd, n);

  // A studio to reflect: a softbox overhead, a strip light to the left.
  float box = smoothstep(0.45, 0.8, r.y) * smoothstep(0.95, 0.15, abs(r.x + 0.15));
  float strip = smoothstep(0.7, 0.95, -r.x) * smoothstep(0.7, 0.05, abs(r.y - 0.1));
  vec3 env = vec3(1.0) * box * 1.15 + vec3(0.85) * strip * 0.7;

  vec3 L = normalize(vec3(-0.55, 0.8, 0.65));
  float spec = pow(max(dot(reflect(-L, n), -rd), 0.0), 140.0) * 2.2;

  // The valleys between spikes see less of the room.
  float cavity = clamp((length(p) - R) / 0.3, 0.0, 1.0);
  vec3 col = vec3(0.012, 0.013, 0.011)
    + env * (0.18 + 0.82 * fresnel) * mix(0.45, 1.0, cavity)
    + vec3(spec)
    + uAccent * pow(1.0 - facing, 2.6) * 0.6;
  return col;
}

void main() {
  vec2 uv = (2.0 * gl_FragCoord.xy - uRes) / uRes.y;
  vec3 ro = vec3(0.0, 0.0, 3.4);
  vec3 rd = normalize(vec3(uv * 0.36, -1.0));

  // Skip straight to the shell the spikes live in; most rays miss it.
  float b = dot(ro, rd);
  float h = b * b - dot(ro, ro) + SHELL * SHELL;
  if (h < 0.0) { FRAG = vec4(0.0); return; }
  float t = max(0.0, -b - sqrt(h));
  float tEnd = -b + sqrt(h);

  float closest = 1e5;
  float hit = -1.0;
  for (int i = 0; i < 110; i++) {
    vec3 p = ro + rd * t;
    float d = surface(p);
    closest = min(closest, d);
    if (d < 0.0012) { hit = t; break; }
    t += d * 0.32;
    if (t > tEnd) break;
  }

  if (hit < 0.0) {
    // A soft edge from how near the ray passed, instead of jaggies.
    float a = 1.0 - smoothstep(0.0, 3.0 / uRes.y, closest);
    FRAG = vec4(vec3(0.02) * a, a * 0.9);
    return;
  }

  vec3 p = ro + rd * hit;
  vec3 col = shade(p, normalAt(p), rd);
  FRAG = vec4(col, 1.0);
}
`;

function header(gl: GL) {
  return isWebGL2(gl)
    ? "#version 300 es\nout highp vec4 fragColor;\n#define FRAG fragColor\n"
    : "#define FRAG gl_FragColor\n";
}

const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export default function FerroBlob({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = getContext(canvas, true);
    const built = gl ? fullscreenProgram(gl, header(gl) + SHADER) : null;
    if (!gl || !built) {
      setFallback(true);
      return;
    }
    const { uniform } = built;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let accent = accentRGB();
    const pointer = { x: 0, y: 0, has: false, lastMove: 0 };
    // The magnet direction, each component on its own spring.
    const mx = { x: -0.35, v: 0 };
    const my = { x: 0.45, v: 0 };
    const mz = { x: 0.8, v: 0 };
    const strength = { x: 0, v: 0 };
    const kick = { x: 0, v: 0 };
    let spin = 0;
    let raf = 0;
    let last = performance.now();
    let visible = true;
    let awake = !introShowing();

    function resize() {
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      // Raymarching is per pixel: cap the resolution rather than the frame rate.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5, 760 / Math.max(w, 1));
      canvas!.width = Math.max(1, Math.round(w * dpr));
      canvas!.height = Math.max(1, Math.round(h * dpr));
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
    }

    function draw(time: number) {
      const len = Math.hypot(mx.x, my.x, mz.x) || 1;
      gl!.uniform2f(uniform("uRes"), canvas!.width, canvas!.height);
      gl!.uniform3f(uniform("uMag"), mx.x / len, my.x / len, mz.x / len);
      gl!.uniform1f(uniform("uBase"), 0.05 + 0.03 * strength.x);
      gl!.uniform1f(uniform("uSpike"), Math.max(0, 0.08 + 0.3 * strength.x + kick.x));
      gl!.uniform1f(uniform("uStretch"), Math.max(0, 0.04 + 0.16 * strength.x + kick.x * 0.4));
      gl!.uniform1f(uniform("uSpin"), spin);
      gl!.uniform1f(uniform("uTime"), time);
      gl!.uniform3f(uniform("uAccent"), accent[0], accent[1], accent[2]);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }

    function frame(now: number) {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const rect = canvas!.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = pointer.x - cx;
      const dy = pointer.y - cy;
      const dist = Math.hypot(dx, dy);
      const near = awake && pointer.has ? smooth(1100, 90, dist) : 0;

      // The magnet sits in front of the drop, under the pointer.
      const unit = 2.35 / rect.height;
      const tx = pointer.has ? dx * unit : -0.35;
      const ty = pointer.has ? -dy * unit : 0.45;
      const settled = [
        spring(mx, tx, dt, 60, 11),
        spring(my, ty, dt, 60, 11),
        spring(mz, 1.1, dt, 60, 11),
        spring(strength, awake ? 0.25 + near * 0.75 : 0, dt, 40, 7),
        spring(kick, 0, dt, 90, 6),
      ].every(Boolean);

      spin += dt * 0.12;
      draw(now / 1000);

      const moving = now - pointer.lastMove < 2500;
      if (visible && awake && (moving || !settled)) raf = requestAnimationFrame(frame);
    }

    function wake() {
      if (!raf && visible && awake && !still) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }

    function onMove(event: PointerEvent) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.has = true;
      pointer.lastMove = performance.now();
      wake();
    }

    function onDown(event: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) return;
      onMove(event);
      kick.v += 3.2;
      gloop();
      wake();
    }

    function onLeave() {
      pointer.has = false;
      pointer.lastMove = performance.now();
      wake();
    }

    function onIntroDone() {
      awake = true;
      strength.x = 0;
      kick.v += 1.5;
      pointer.lastMove = performance.now();
      wake();
    }

    const sizes = new ResizeObserver(() => {
      resize();
      draw(performance.now() / 1000);
    });
    sizes.observe(canvas);

    const sight = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake();
    });
    sight.observe(canvas);

    const offTheme = onThemeChange(() => {
      accent = accentRGB();
      draw(performance.now() / 1000);
    });

    resize();
    if (still) {
      strength.x = 0.5;
      awake = true;
    }
    draw(0);
    wake();

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener(INTRO_DONE, onIntroDone);
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      sizes.disconnect();
      sight.disconnect();
      offTheme();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener(INTRO_DONE, onIntroDone);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <div className={`relative aspect-square w-full ${className}`}>
      {/* Grounds the drop: a soft pool of light under it. */}
      <div
        aria-hidden
        className="absolute inset-x-[18%] bottom-[9%] h-[12%] rounded-[50%] bg-[radial-gradient(closest-side,var(--accent-soft),transparent)] blur-md"
      />
      {fallback ? (
        <div
          aria-hidden
          className="absolute inset-[22%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#3a3d36,#050605_55%)] shadow-[inset_-12px_-18px_40px_rgba(0,0,0,0.8)]"
        />
      ) : (
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="A drop of black ferrofluid whose spikes follow the pointer"
          className="relative h-full w-full"
        />
      )}
    </div>
  );
}
