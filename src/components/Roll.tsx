"use client";

import { useEffect, useState, type CSSProperties } from "react";

const DURATION = 520;
const STAGGER = 32;

/**
 * Text that changes by rolling: each character that differs slides up and out
 * while its replacement rolls up from below, one after another, like a split
 * flap or an odometer. Characters that stay the same don't move, so a clock
 * only rolls the digit that ticked.
 *
 * Between changes it's plain text — the per-character boxes only exist while
 * a roll is running.
 */
export default function Roll({ text, className = "" }: { text: string; className?: string }) {
  const [roll, setRoll] = useState({ from: text, to: text, id: 0 });

  useEffect(() => {
    setRoll(current => (current.to === text ? current : { from: current.to, to: text, id: current.id + 1 }));
  }, [text]);

  // Once it has finished, drop the outgoing text, which collapses any extra
  // characters a longer old string left behind.
  useEffect(() => {
    if (roll.from === roll.to) return;
    const length = Math.max(roll.from.length, roll.to.length);
    const timer = setTimeout(
      () => setRoll(current => (current.id === roll.id ? { ...current, from: current.to } : current)),
      DURATION + length * STAGGER,
    );
    return () => clearTimeout(timer);
  }, [roll]);

  if (roll.from === roll.to) {
    return <span className={className}>{roll.to}</span>;
  }

  const length = Math.max(roll.from.length, roll.to.length);
  let changed = 0;

  return (
    <span className={className}>
      <span className="sr-only">{roll.to}</span>
      <span aria-hidden className="roll">
        {Array.from({ length }, (_, index) => {
          const before = roll.from[index] ?? "";
          const after = roll.to[index] ?? "";

          if (before === after) {
            return (
              <span key={`${roll.id}-${index}`} className="roll-slot">
                {show(after)}
              </span>
            );
          }

          const style = { "--roll-delay": `${changed++ * STAGGER}ms` } as CSSProperties;

          return (
            <span key={`${roll.id}-${index}`} className="roll-slot roll-moving" style={style}>
              <span className="roll-out">{show(before)}</span>
              <span className="roll-in">{show(after)}</span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

/** A space would collapse to nothing inside its own inline-block. */
function show(char: string) {
  return char === " " ? " " : char;
}

/**
 * A label that rolls over itself when its link or button is hovered: every
 * letter flips up and is replaced by the same letter from below, in a wave.
 * Pure CSS — see .hroll in globals.css.
 */
export function HoverRoll({ text }: { text: string }) {
  return (
    <span className="hroll">
      <span className="sr-only">{text}</span>
      <span aria-hidden className="hroll-chars">
        {Array.from(text).map((char, index) => (
          <span
            key={index}
            className="hroll-c"
            data-c={show(char)}
            style={{ "--i": index } as CSSProperties}
          >
            {show(char)}
          </span>
        ))}
      </span>
    </span>
  );
}
