import type { CSSProperties, ReactNode } from "react";

/**
 * Entrance animations, driven by CSS rather than JS.
 *
 * The un-animated state of everything here is visible — the keyframes only
 * describe the arrival. That means content can never get stuck invisible
 * because an animation was throttled, interrupted, or never ran. See the
 * `rise` keyframes in globals.css.
 *
 * `delay` is what staggers a panel: give successive blocks 0, 60, 120.
 */

interface RevealProps {
  children: ReactNode;
  /** Milliseconds. */
  delay?: number;
  /** Distance travelled on the way in, in px. Negative comes from above. */
  y?: number;
  className?: string;
}

export function Reveal({ children, delay = 0, y = 18, className }: RevealProps) {
  const style = {
    "--reveal-delay": `${delay}ms`,
    "--rise-from": `${y}px`,
  } as CSSProperties;

  return (
    <div className={`reveal${className ? ` ${className}` : ""}`} style={style}>
      {children}
    </div>
  );
}

interface RevealWordsProps {
  text: string;
  /** Milliseconds. */
  delay?: number;
  /** Milliseconds between consecutive words. */
  stagger?: number;
  className?: string;
}

/**
 * Reveals a line word by word. The inline-block spans still wrap and justify
 * like normal text, and aria-label keeps it one announcement rather than one
 * per word.
 */
export function RevealWords({ text, delay = 0, stagger = 30, className }: RevealWordsProps) {
  const words = text.split(" ");

  return (
    <span className={className} aria-label={text}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} aria-hidden className="inline-block overflow-hidden align-bottom">
          <span
            className="reveal-word"
            style={{ "--reveal-delay": `${delay + index * stagger}ms` } as CSSProperties}
          >
            {word}
            {index < words.length - 1 ? " " : ""}
          </span>
        </span>
      ))}
    </span>
  );
}
