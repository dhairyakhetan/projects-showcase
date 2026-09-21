"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type Theme = "dark" | "light";

/**
 * The switch is one attribute on <html>; every colour reads off it, so nothing
 * here needs to know what's on the page. The layout's blocking script applies
 * the stored value before first paint — this only mirrors it once React runs,
 * which is why it reads the DOM on mount rather than guessing.
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
      // Blocked storage — the theme still switches, it just won't persist.
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
