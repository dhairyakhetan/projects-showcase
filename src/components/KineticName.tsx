"use client";

import { useEffect, useRef } from "react";

/**
 * The name at display scale, with each letter reacting to pointer proximity.
 *
 * Letters are written to directly inside one rAF loop rather than each being a
 * motion component — with ~15 characters updating every frame, per-letter
 * spring instances cost far more than the effect is worth, and a shared loop
 * lets a single pass compute all of them.
 *
 * Every letter is still a real character in the DOM, so the name remains
 * selectable text and reads correctly to a screen reader.
 */

const RADIUS = 160;

export default function KineticName({ name, className }: { name: string; className?: string }) {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (still || !fine) return;

    const letters = Array.from(container.querySelectorAll<HTMLElement>("[data-letter]"));
    // Cached so the hot loop never triggers layout; refreshed on resize only.
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

    function loop() {
      for (let i = 0; i < letters.length; i++) {
        const center = centers[i];
        const dist = Math.hypot(center.x - pointerX, center.y - pointerY);
        const target = dist < RADIUS ? (1 - dist / RADIUS) ** 2 : 0;

        energies[i] += (target - energies[i]) * 0.14;
        const energy = energies[i];

        if (energy < 0.002) {
          letters[i].style.transform = "";
          letters[i].style.color = "";
          continue;
        }

        letters[i].style.transform = `translateY(${(-energy * 14).toFixed(2)}px) scale(${(1 + energy * 0.14).toFixed(3)})`;
        letters[i].style.color = energy > 0.12 ? "var(--accent)" : "";
      }

      frame = requestAnimationFrame(loop);
    }

    function onMove(event: PointerEvent) {
      pointerX = event.clientX;
      pointerY = event.clientY;
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [name]);

  return (
    <span ref={containerRef} className={className} aria-label={name}>
      {name.split("").map((char, index) => (
        <span
          key={`${char}-${index}`}
          data-letter
          aria-hidden
          className="inline-block will-change-transform"
          style={{ transition: "color 200ms ease" }}
        >
          {char === " " ? " " : char}
        </span>
      ))}
    </span>
  );
}
