"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Panels mount when they become active, so these animate on mount — no scroll
 * observers. Stagger a panel by giving successive blocks 0, 0.06, 0.12.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

interface RevealProps {
  children: ReactNode;
  delay?: number;
  /** Distance travelled on the way in, in px. Negative comes from above. */
  y?: number;
  className?: string;
}

export function Reveal({ children, delay = 0, y = 18, className }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.62, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

interface RevealWordsProps {
  text: string;
  delay?: number;
  /** Gap between consecutive words, in seconds. */
  stagger?: number;
  className?: string;
}

/**
 * Reveals a line word by word. The inline-block spans still wrap and justify
 * like normal text, and aria-label keeps it one announcement rather than
 * thirty.
 */
export function RevealWords({ text, delay = 0, stagger = 0.03, className }: RevealWordsProps) {
  const words = text.split(" ");

  return (
    <span className={className} aria-label={text}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} aria-hidden className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "110%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            transition={{ duration: 0.66, delay: delay + index * stagger, ease: EASE }}
          >
            {word}
            {index < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
