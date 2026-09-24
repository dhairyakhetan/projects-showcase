"use client";

import { useEffect, useRef } from "react";

/**
 * The background: a fixed grid of dots behind every page, warping away from
 * the pointer and brightening from --dot-rest to --accent as it passes.
 *
 * Canvas 2D rather than WebGL: it's a per-point displacement and a colour
 * ramp, which the CPU handles fine at this density, and it avoids shader
 * compilation, context loss and flaky-driver failure modes entirely. Dots are
 * squares — fillRect is far cheaper than arc, and square suits the design.
 *
 * The loop runs only while something is moving. Once the pointer is still and
 * every dot has settled it stops, and the next pointermove starts it again —
 * so a reader sitting on a page costs nothing. Under reduced motion the field
 * is drawn once and never animates.
 */

const SPACING = 28;
const RADIUS = 180;
const PUSH = 22;
const SETTLED = 0.004;

type Rgb = [number, number, number];

function parseColor(raw: string, fallback: Rgb): Rgb {
  const value = raw.trim();
  const hex = value.replace("#", "");

  if (/^[0-9a-f]{6}$/i.test(hex)) {
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const parts = value.match(/\d+/g);
  if (parts && parts.length >= 3) return [Number(parts[0]), Number(parts[1]), Number(parts[2])];

  return fallback;
}

export default function ShaderField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Flat typed arrays: one entry per dot, no per-dot objects to allocate.
    let homeX = new Float32Array(0);
    let homeY = new Float32Array(0);
    let posX = new Float32Array(0);
    let posY = new Float32Array(0);
    let energy = new Float32Array(0);
    let count = 0;

    let width = 0;
    let height = 0;
    let rest: Rgb = [38, 42, 32];
    let accent: Rgb = [200, 245, 90];

    // Eased toward rather than set, so the disturbance trails the cursor.
    let pointerX = -9999;
    let pointerY = -9999;
    let targetX = -9999;
    let targetY = -9999;

    function readColors() {
      const style = getComputedStyle(document.documentElement);
      rest = parseColor(style.getPropertyValue("--dot-rest"), rest);
      accent = parseColor(style.getPropertyValue("--accent"), accent);
    }

    let builtDpr = 0;

    /** Sized from CSS (100lvh), so a mobile URL bar sliding away isn't a resize. */
    function build(): boolean {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (rect.width === width && rect.height === height && dpr === builtDpr) return false;

      width = rect.width;
      height = rect.height;
      builtDpr = dpr;

      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cols = Math.ceil(width / SPACING);
      const rows = Math.ceil(height / SPACING);
      count = cols * rows;

      homeX = new Float32Array(count);
      homeY = new Float32Array(count);
      posX = new Float32Array(count);
      posY = new Float32Array(count);
      energy = new Float32Array(count);

      let i = 0;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          homeX[i] = posX[i] = col * SPACING + SPACING / 2;
          homeY[i] = posY[i] = row * SPACING + SPACING / 2;
          i++;
        }
      }

      return true;
    }

    /** Advances the simulation one step. Returns whether anything is still moving. */
    function step(): boolean {
      pointerX += (targetX - pointerX) * 0.16;
      pointerY += (targetY - pointerY) * 0.16;

      let moving = Math.abs(targetX - pointerX) + Math.abs(targetY - pointerY) > 0.5;

      for (let i = 0; i < count; i++) {
        const dx = homeX[i] - pointerX;
        const dy = homeY[i] - pointerY;

        // Cheap reject before the square root: most dots are nowhere near.
        if (Math.abs(dx) < RADIUS && Math.abs(dy) < RADIUS) {
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < RADIUS && dist > 0.001) {
            // Squared falloff gives the disturbance a soft edge.
            const falloff = (1 - dist / RADIUS) ** 2;
            const stepX = (homeX[i] + (dx / dist) * PUSH * falloff - posX[i]) * 0.16;
            const stepY = (homeY[i] + (dy / dist) * PUSH * falloff - posY[i]) * 0.16;
            const stepE = (falloff - energy[i]) * 0.16;
            posX[i] += stepX;
            posY[i] += stepY;
            energy[i] += stepE;
            // A resting pointer leaves these displaced but still — that's settled too.
            if (Math.abs(stepX) + Math.abs(stepY) > 0.02 || Math.abs(stepE) > 0.001) moving = true;
            continue;
          }
        }

        if (energy[i] > SETTLED || posX[i] !== homeX[i] || posY[i] !== homeY[i]) {
          posX[i] += (homeX[i] - posX[i]) * 0.1;
          posY[i] += (homeY[i] - posY[i]) * 0.1;
          energy[i] *= 0.9;

          if (energy[i] <= SETTLED && Math.abs(posX[i] - homeX[i]) < 0.05 && Math.abs(posY[i] - homeY[i]) < 0.05) {
            energy[i] = 0;
            posX[i] = homeX[i];
            posY[i] = homeY[i];
          } else {
            moving = true;
          }
        }
      }

      return moving;
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);

      // Resting dots share one colour, so they go in a single batch; only the
      // few near the pointer need a colour each.
      ctx!.fillStyle = `rgb(${rest[0]},${rest[1]},${rest[2]})`;
      for (let i = 0; i < count; i++) {
        if (energy[i] === 0) ctx!.fillRect(homeX[i] - 1, homeY[i] - 1, 2, 2);
      }

      for (let i = 0; i < count; i++) {
        const e = energy[i];
        if (e === 0) continue;

        const t = Math.min(1, e * 1.6);
        const r = Math.round(rest[0] + (accent[0] - rest[0]) * t);
        const g = Math.round(rest[1] + (accent[1] - rest[1]) * t);
        const b = Math.round(rest[2] + (accent[2] - rest[2]) * t);
        const size = 2 + e * 3;

        ctx!.fillStyle = `rgb(${r},${g},${b})`;
        ctx!.fillRect(posX[i] - size / 2, posY[i] - size / 2, size, size);
      }
    }

    readColors();
    build();
    draw();

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    let frame = 0;
    let running = false;

    function loop() {
      const moving = step();
      draw();

      if (moving && !document.hidden) {
        frame = requestAnimationFrame(loop);
      } else {
        running = false;
      }
    }

    function start() {
      if (running || still) return;
      running = true;
      frame = requestAnimationFrame(loop);
    }

    function onPointerMove(event: PointerEvent) {
      // Touch drags scroll the page; a field chasing the finger just flickers.
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      targetX = event.clientX;
      targetY = event.clientY;
      // Snap on first contact so it doesn't sweep in from off-screen.
      if (pointerX < -9000) {
        pointerX = targetX;
        pointerY = targetY;
      }
      start();
    }

    function onPointerLeave() {
      targetX = targetY = -9999;
      start();
    }

    let resizeQueued = false;
    function onResize() {
      if (resizeQueued) return;
      resizeQueued = true;
      requestAnimationFrame(() => {
        resizeQueued = false;
        if (build()) draw();
      });
    }

    // Colours follow the theme. Redrawn immediately, running or not.
    const themeWatcher = new MutationObserver(() => {
      readColors();
      draw();
    });
    themeWatcher.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    if (fine) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onPointerLeave);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      themeWatcher.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
