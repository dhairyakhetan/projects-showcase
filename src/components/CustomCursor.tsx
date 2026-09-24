"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

type Mode = "idle" | "link" | "text";

const TEXT_INPUT = "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea";

/** How far the label sits from the pointer, so it never covers the target. */
const LABEL_OFFSET = 22;

/**
 * A dot that tracks the pointer exactly and a ring that trails on a spring.
 *
 * The ring only ever outlines — over a link it widens and takes a faint tint,
 * never an opaque fill, so whatever it's hovering stays readable through it.
 * `data-cursor-label="open"` adds a small tag beside the pointer rather than
 * on top of it; text fields swap the ring for a blinking I-beam.
 *
 * Never renders on touch or coarse-pointer devices, or under reduced motion.
 */
export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [label, setLabel] = useState("");
  const [labelled, setLabelled] = useState(false);
  const [flip, setFlip] = useState({ x: false, y: false });
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

      // Near the right or bottom edge the tag moves to the other side of the
      // pointer instead of running off-screen.
      const nextFlip = {
        x: event.clientX > window.innerWidth - 140,
        y: event.clientY > window.innerHeight - 80,
      };
      setFlip(current => (current.x === nextFlip.x && current.y === nextFlip.y ? current : nextFlip));

      const el = event.target as HTMLElement | null;

      if (el?.closest(TEXT_INPUT)) {
        setMode("text");
        setLabelled(false);
        return;
      }

      // Deepest declaring element wins, so a label on a card still applies
      // when the pointer is over the text inside it.
      const target = el?.closest<HTMLElement>("[data-cursor-label], a, button, [role=tab]");
      const text = target?.dataset.cursorLabel;
      setMode(target ? "link" : "idle");
      setLabelled(Boolean(text));
      // The old text stays put while the tag fades, rather than blanking first.
      if (text) setLabel(text);
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
      ? { width: 3, height: 24, borderRadius: 1, backgroundColor: "var(--accent)" }
      : mode === "link"
        ? { width: 40, height: 40, borderRadius: 20, backgroundColor: "var(--accent-soft)" }
        : { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0)" };

  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[120] rounded-full bg-accent"
        style={{ x, y, width: 6, height: 6, translateX: "-50%", translateY: "-50%" }}
        animate={{ opacity: visible && mode !== "text" ? 1 : 0 }}
        transition={{ duration: 0.15 }}
      />

      <motion.div
        aria-hidden
        className={`pointer-events-none fixed left-0 top-0 z-[120] border-[1.5px] border-accent ${
          mode === "text" ? "caret" : ""
        }`}
        style={{ x: ringX, y: ringY, translateX: "-50%", translateY: "-50%" }}
        animate={{ ...shape, opacity: visible ? 1 : 0, scale: pressed ? 0.8 : 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
      />

      {/* Beside the pointer, not on it. */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[121]"
        style={{ x: ringX, y: ringY }}
      >
        <motion.span
          className="absolute whitespace-nowrap bg-accent px-2 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.08em] text-on-accent"
          style={{
            left: flip.x ? undefined : LABEL_OFFSET,
            right: flip.x ? LABEL_OFFSET : undefined,
            top: flip.y ? undefined : LABEL_OFFSET - 6,
            bottom: flip.y ? LABEL_OFFSET - 6 : undefined,
          }}
          animate={{ opacity: visible && labelled ? 1 : 0, scale: visible && labelled ? 1 : 0.85 }}
          transition={{ duration: 0.15 }}
        >
          {label}
        </motion.span>
      </motion.div>
    </>
  );
}
