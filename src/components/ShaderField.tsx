"use client";

import { useEffect, useRef } from "react";

/**
 * A field of points that warps around the pointer.
 *
 * Canvas 2D rather than WebGL: it's a per-point displacement and a brightness
 * ramp, which the CPU handles fine at this density, and it avoids shader
 * compilation, context loss, and flaky-driver failure modes entirely.
 *
 * The loop stops on tab hide and when the hero scrolls out, and never starts
 * under reduced motion — one static frame is drawn so the hero isn't empty.
 */

const SPACING = 30;
const RADIUS = 190;
const PUSH = 26;

interface Point {
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  energy: number;
}

/** Reads --accent as [r, g, b] so it can be drawn with alpha. */
function readAccent(): [number, number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();

  const hex = raw.replace("#", "");
  if (hex.length === 6) {
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const parts = raw.match(/\d+/g);
  if (parts && parts.length >= 3) {
    return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
  }

  return [74, 222, 128];
}

export default function ShaderField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let points: Point[] = [];
    let accent = readAccent();
    let width = 0;
    let height = 0;

    // Eased toward rather than set, so the field trails the cursor slightly.
    let pointerX = -9999;
    let pointerY = -9999;
    let targetX = -9999;
    let targetY = -9999;

    function build() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      width = rect.width;
      height = rect.height;

      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      points = [];
      for (let y = SPACING / 2; y < height; y += SPACING) {
        for (let x = SPACING / 2; x < width; x += SPACING) {
          points.push({ homeX: x, homeY: y, x, y, energy: 0 });
        }
      }
    }

    function draw(interactive: boolean) {
      ctx!.clearRect(0, 0, width, height);

      const [r, g, b] = accent;

      for (const point of points) {
        if (interactive) {
          const dx = point.homeX - pointerX;
          const dy = point.homeY - pointerY;
          const dist = Math.hypot(dx, dy);

          if (dist < RADIUS && dist > 0.001) {
            // Squared falloff gives the disturbance a soft edge.
            const falloff = (1 - dist / RADIUS) ** 2;
            const targetPointX = point.homeX + (dx / dist) * PUSH * falloff;
            const targetPointY = point.homeY + (dy / dist) * PUSH * falloff;

            point.x += (targetPointX - point.x) * 0.16;
            point.y += (targetPointY - point.y) * 0.16;
            point.energy += (falloff - point.energy) * 0.16;
          } else {
            point.x += (point.homeX - point.x) * 0.08;
            point.y += (point.homeY - point.y) * 0.08;
            point.energy += (0 - point.energy) * 0.08;
          }
        }

        const size = 1 + point.energy * 2.1;
        const alpha = 0.16 + point.energy * 0.7;

        ctx!.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx!.beginPath();
        ctx!.arc(point.x, point.y, size, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    build();

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      draw(false);
      return;
    }

    let frame = 0;
    let running = false;

    function loop() {
      pointerX += (targetX - pointerX) * 0.14;
      pointerY += (targetY - pointerY) * 0.14;
      draw(true);
      frame = requestAnimationFrame(loop);
    }

    function start() {
      if (running) return;
      running = true;
      frame = requestAnimationFrame(loop);
    }

    function stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(frame);
    }

    function onPointerMove(event: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      targetX = event.clientX - rect.left;
      targetY = event.clientY - rect.top;
    }

    function onResize() {
      build();
    }

    function onVisibility() {
      if (document.hidden) stop();
      else if (visible) start();
    }

    let visible = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !document.hidden) start();
        else stop();
      },
      { threshold: 0 },
    );
    observer.observe(canvas);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    // The field draws in the accent colour, which changes with the theme.
    const themeWatcher = new MutationObserver(() => {
      accent = readAccent();
    });
    themeWatcher.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    start();

    return () => {
      stop();
      observer.disconnect();
      themeWatcher.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
