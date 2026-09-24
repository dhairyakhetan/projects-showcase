"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

type Mode = "idle" | "link" | "label" | "text";

const TEXT_INPUT = "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea";

/**
 * A dot that tracks the pointer exactly and a ring that trails on a spring.
 *
 * Elements opt in to what the ring says: `data-cursor-label="open"` turns it
 * into a filled disc with that word inside. Unlabelled links and buttons just
 * widen the ring, and text fields swap it for a blinking I-beam — so nothing
 * here keeps a selector list in sync with the pages.
 *
 * Never renders on touch or coarse-pointer devices, or under reduced motion.
 */
export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [label, setLabel] = useState("");
  const [pressed, setPressed] = useState(false);
  const [visible, setVisible] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);

  const ringX = useSpring(x, { stiffness: 420, damping: 34, mass: 0.4 });
  const ringY = useSpring(y, { stiffness: 420, damping: 34, mass: 0.4 });

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

      const el = event.target as HTMLElement | null;

      if (el?.closest(TEXT_INPUT)) {
        setMode("text");
        return;
      }

      // Deepest declaring element wins, so a label on a card still applies
      // when the pointer is over the text inside it.
      const target = el?.closest<HTMLElement>("[data-cursor-label], a, button, [role=tab]");
      const text = target?.dataset.cursorLabel;

      if (text) {
        setMode("label");
        setLabel(text);
      } else {
        setMode(target ? "link" : "idle");
      }
    }

    const onLeave = () => setVisible(false);
    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);

    return () => {
      delete document.body.dataset.cursor;
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, [x, y]);

  if (!enabled) return null;

  const shape =
    mode === "text"
      ? { width: 3, height: 26, borderRadius: 1, backgroundColor: "var(--accent)" }
      : mode === "label"
        ? { width: 78, height: 78, borderRadius: 39, backgroundColor: "var(--accent)" }
        : mode === "link"
          ? { width: 46, height: 46, borderRadius: 23, backgroundColor: "var(--accent-soft)" }
          : { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0)" };

  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[120] rounded-full bg-accent"
        style={{ x, y, width: 6, height: 6, translateX: "-50%", translateY: "-50%" }}
        animate={{ opacity: visible && (mode === "idle" || mode === "link") ? 1 : 0 }}
        transition={{ duration: 0.15 }}
      />

      <motion.div
        aria-hidden
        className={`pointer-events-none fixed left-0 top-0 z-[120] flex items-center justify-center overflow-hidden whitespace-nowrap border-[1.5px] border-accent text-[10px] font-bold uppercase tracking-[0.08em] text-on-accent ${
          mode === "text" ? "caret" : ""
        }`}
        style={{ x: ringX, y: ringY, translateX: "-50%", translateY: "-50%" }}
        animate={{ ...shape, opacity: visible ? 1 : 0, scale: pressed ? 0.8 : 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
      >
        {mode === "label" ? label : null}
      </motion.div>
    </>
  );
}
