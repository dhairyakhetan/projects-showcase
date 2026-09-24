"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

/**
 * The switch is one attribute on <html>; every colour reads off it, so nothing
 * here needs to know what's on the page. The layout's blocking script applies
 * the stored value before first paint — this only mirrors it once React runs,
 * which is why it reads the DOM on mount rather than guessing.
 */
export function toggleTheme(): Theme {
  const root = document.documentElement;
  const next: Theme = root.dataset.theme === "light" ? "dark" : "light";
  root.dataset.theme = next;

  try {
    localStorage.setItem("theme", next);
  } catch {
    // Blocked storage — the theme still switches, it just won't persist.
  }

  return next;
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.dataset.theme === "light" ? "light" : "dark");
    read();

    // The terminal and the palette can flip it too.
    const watcher = new MutationObserver(read);
    watcher.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => watcher.disconnect();
  }, []);

  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(toggleTheme())}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      data-cursor-label={isLight ? "dark" : "light"}
      className={`group flex items-center justify-center gap-2.5 text-[11px] text-dim transition-colors hover:text-ink ${className}`}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="transition-transform duration-500 group-hover:rotate-180">
        <rect x="0.75" y="0.75" width="12.5" height="12.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d={isLight ? "M7 0.75V13.25H0.75V0.75Z" : "M7 0.75V13.25H13.25V0.75Z"} fill="var(--accent)" />
      </svg>
      <span className="hidden sm:inline">{theme}</span>
    </button>
  );
}
