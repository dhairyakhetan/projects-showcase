"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * Replaces the system cursor with a two-part one: a small dot that tracks the
 * pointer exactly, and a ring that lags behind on a spring.
 *
 * Any element can change its appearance without this component knowing about
 * that element — set `data-cursor="link"` for the expanded ring, or
 * `data-cursor-label="open"` to print a word inside it. That keeps the cursor
 * from accumulating a list of selectors it has to stay in sync with.
 *
 * Never renders on touch or coarse-pointer devices; there's nothing to track.
 */
export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [variant, setVariant] = useState<"default" | "link">("default");
  const [label, setLabel] = useState<string | null>(null);
  const [pressed, setPressed] = useState(false);
  const [visible, setVisible] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);

  const ringX = useSpring(x, { stiffness: 340, damping: 30, mass: 0.42 });
  const ringY = useSpring(y, { stiffness: 340, damping: 30, mass: 0.42 });

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || still.matches) return;

    setEnabled(true);
    document.body.dataset.cursor = "custom";

    function onMove(event: PointerEvent) {
      x.set(event.clientX);
      y.set(event.clientY);
      setVisible(true);

      // Read state off the deepest element that declares it, so a label on a
      // card still applies when the pointer is over the text inside it.
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-cursor], [data-cursor-label], a, button",
      );

      if (!target) {
        setVariant("default");
        setLabel(null);
        return;
      }

      setLabel(target.dataset.cursorLabel ?? null);
      setVariant(
        target.dataset.cursor === "link" || target.tagName === "A" || target.tagName === "BUTTON"
          ? "link"
          : "default",
      );
    }

    const onLeave = () => setVisible(false);
    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);

    return () => {
      delete document.body.dataset.cursor;
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, [x, y]);

  if (!enabled) return null;

  const ringSize = label ? 58 : variant === "link" ? 40 : 26;

  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[120] rounded-full bg-[var(--accent)]"
        style={{ x, y, width: 5, height: 5, translateX: "-50%", translateY: "-50%" }}
        animate={{ opacity: visible && !label ? 1 : 0 }}
        transition={{ duration: 0.15 }}
      />

      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[120] flex items-center justify-center rounded-full border border-[var(--accent)] font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--accent)]"
        style={{ x: ringX, y: ringY, translateX: "-50%", translateY: "-50%" }}
        animate={{
          width: ringSize,
          height: ringSize,
          opacity: visible ? 1 : 0,
          scale: pressed ? 0.82 : 1,
          backgroundColor: label ? "var(--accent-soft)" : "rgba(0,0,0,0)",
        }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
      >
        {label}
      </motion.div>
    </>
  );
}
