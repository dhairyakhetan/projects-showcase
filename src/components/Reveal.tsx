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
