"use client";

import { useEffect, useRef } from "react";

/**
 * The name at display scale — first name upright, surname in italic, then an
 * accent full stop — each letter reacting to pointer proximity.
 *
 * One shared rAF loop writing to the DOM directly, rather than a motion
 * component per letter — at ~15 characters a frame, per-letter spring
 * instances cost more than the effect is worth.
 *
 * Letters stay real characters, so the name is still selectable text.
 */

const RADIUS = 170;

export default function KineticName({ name, className }: { name: string; className?: string }) {
  const [first, ...rest] = name.split(" ");
  const last = rest.join(" ");

  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (still || !fine) return;

    const letters = Array.from(container.querySelectorAll<HTMLElement>("[data-letter]"));
    // Cached so the loop never triggers layout; refreshed on resize and scroll.
    let centers: { x: number; y: number }[] = [];

    function measure() {
      centers = letters.map(letter => {
        const rect = letter.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      });
    }

    measure();

    let pointerX = -9999;
    let pointerY = -9999;
    const energies = new Float32Array(letters.length);
    let frame = 0;
    let running = false;

    // Runs only while a letter is disturbed; the next pointermove restarts it.
    function loop() {
      let busy = false;

      for (let i = 0; i < letters.length; i++) {
        const center = centers[i];
        const dist = Math.hypot(center.x - pointerX, center.y - pointerY);
        const target = dist < RADIUS ? (1 - dist / RADIUS) ** 2 : 0;

        energies[i] += (target - energies[i]) * 0.14;
        const energy = energies[i];
        if (Math.abs(target - energy) > 0.002) busy = true;

        if (energy < 0.002) {
          letters[i].style.transform = "";
          letters[i].style.color = "";
          continue;
        }

        letters[i].style.transform = `translateY(${(-energy * 18).toFixed(2)}px) scale(${(1 + energy * 0.1).toFixed(3)})`;
        letters[i].style.color = energy > 0.12 ? "var(--accent)" : "";
      }

      if (busy) frame = requestAnimationFrame(loop);
      else running = false;
    }

    function onMove(event: PointerEvent) {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (running) return;
      running = true;
      frame = requestAnimationFrame(loop);
    }

    // Coalesced to one measurement per frame: scroll fires far more often
    // than that, and each raw call forces a synchronous layout per letter.
    let measureQueued = false;
    function queueMeasure() {
      if (measureQueued) return;
      measureQueued = true;
      requestAnimationFrame(() => {
        measure();
        measureQueued = false;
      });
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", queueMeasure);
    window.addEventListener("scroll", queueMeasure, { passive: true });

    // The first measurement lands mid-entrance and possibly before the serif
    // has loaded; both shift the letters, so measure again once each settles.
    document.fonts?.ready.then(queueMeasure);
    const settle = setTimeout(queueMeasure, 900);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", queueMeasure);
      window.removeEventListener("scroll", queueMeasure);
    };
  }, [name]);

  const letters = (text: string, offset: number) =>
    text.split("").map((char, index) => (
      <span
        key={offset + index}
        data-letter
        aria-hidden
        className="inline-block will-change-transform"
        style={{ transition: "color 200ms ease" }}
      >
        {char === " " ? "\u00a0" : char}
      </span>
    ));

  return (
    <span ref={containerRef} className={className}>
      <span className="sr-only">{name}</span>
      <span className="block">{letters(first, 0)}</span>
      <span className="block italic">
        {letters(last, first.length)}
        <span aria-hidden className="text-accent">.</span>
      </span>
    </span>
  );
}
