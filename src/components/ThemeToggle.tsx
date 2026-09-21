"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type Theme = "dark" | "light";

/**
 * Switches the two themes and remembers the choice.
 *
 * The actual switch is one attribute on <html>; every colour in the site is a
 * custom property that reads off it, so nothing here needs to know what's on
 * the page. The blocking script in the layout applies the stored value before
 * first paint — this component only mirrors it once React is running, which is
 * why it renders a placeholder until mounted rather than guessing.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as Theme) ?? "dark");
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    setTheme(next);

    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private mode or blocked storage — the theme still switches, it just
      // won't survive a reload. Not worth surfacing.
    }
  }

  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      data-cursor="link"
      className="relative flex h-8 w-[58px] items-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-inset)] px-1 transition-colors"
    >
      {/* Until mounted, theme is null and the knob renders neutral rather than
          animating from a wrong position on first paint. */}
      <motion.span
        className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[11px]"
        animate={{ x: isLight ? 26 : 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
      >
        <motion.span
          key={isLight ? "sun" : "moon"}
          initial={{ scale: 0.4, opacity: 0, rotate: -45 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ duration: 0.28 }}
        >
          {isLight ? "☀" : "☾"}
        </motion.span>
      </motion.span>
    </button>
  );
}
