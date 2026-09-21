"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import CustomCursor from "@/components/CustomCursor";
import CommandPalette from "@/components/CommandPalette";
import ThemeToggle from "@/components/ThemeToggle";
import HomePanel from "@/components/panels/HomePanel";
import AboutPanel from "@/components/panels/AboutPanel";
import QualificationPanel from "@/components/panels/QualificationPanel";
import ProjectsPanel from "@/components/panels/ProjectsPanel";
import ContactPanel from "@/components/panels/ContactPanel";
import { identity, panels, type PanelId } from "@/lib/content";
import type { ProjectsResult } from "@/lib/repos";

const PANEL_IDS = panels.map(panel => panel.id) as PanelId[];

function isPanelId(value: string): value is PanelId {
  return (PANEL_IDS as string[]).includes(value);
}

/**
 * The whole site is one page; panels swap in place rather than scrolling past
 * each other.
 *
 * The active panel is mirrored into the URL hash, which buys back the things a
 * single page usually loses: back/forward work, a panel can be linked to, and
 * a reload lands where you were. It's `replaceState` on first mount (so we
 * don't push an entry for simply arriving) and a real hash change after that.
 */
export default function Shell({ data }: { data: ProjectsResult }) {
  const [active, setActive] = useState<PanelId>("home");

  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    if (isPanelId(fromHash)) setActive(fromHash);

    function onHashChange() {
      const next = window.location.hash.slice(1);
      setActive(isPanelId(next) ? next : "home");
    }

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((panel: PanelId) => {
    setActive(panel);
    window.history.pushState(null, "", panel === "home" ? "#home" : `#${panel}`);
  }, []);

  // Left/right arrows walk the panels, but only when nothing is focused that
  // would want those keys for itself.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const index = PANEL_IDS.indexOf(active);
      const next =
        event.key === "ArrowRight"
          ? PANEL_IDS[(index + 1) % PANEL_IDS.length]
          : PANEL_IDS[(index - 1 + PANEL_IDS.length) % PANEL_IDS.length];

      navigate(next);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, navigate]);

  const toggleTheme = useCallback(() => {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Not persisted; the switch itself still applied.
    }
  }, []);

  return (
    <>
      <div className="texture" aria-hidden />
      <CustomCursor />
      <CommandPalette projects={data.projects} onNavigate={navigate} onToggleTheme={toggleTheme} />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 sm:px-8">
        <header className="flex items-center justify-between gap-4 py-6">
          <button
            type="button"
            onClick={() => navigate("home")}
            className="font-mono text-sm font-semibold tracking-tight"
          >
            <span className="text-[var(--accent)]">~/</span>
            {identity.handle}
          </button>

          <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
            {panels.map(panel => (
              <button
                key={panel.id}
                type="button"
                onClick={() => navigate(panel.id)}
                aria-current={active === panel.id ? "page" : undefined}
                className={`relative rounded-full px-3.5 py-1.5 font-mono text-xs transition-colors ${
                  active === panel.id
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-dim)] hover:text-[var(--text)]"
                }`}
              >
                {/* One shared element slides between tabs instead of each tab
                    fading its own background in and out. */}
                {active === panel.id ? (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-[var(--accent-soft)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <span className="relative">{panel.label.toLowerCase()}</span>
              </button>
            ))}
          </nav>

          <ThemeToggle />
        </header>

        <main className="flex-1 py-8 sm:py-12">
          <AnimatePresence mode="wait">
            <motion.section
              key={active}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            >
              {active === "home" ? <HomePanel projects={data.projects} onNavigate={navigate} /> : null}
              {active === "about" ? <AboutPanel /> : null}
              {active === "qualification" ? <QualificationPanel /> : null}
              {active === "projects" ? <ProjectsPanel data={data} /> : null}
              {active === "contact" ? <ContactPanel /> : null}
            </motion.section>
          </AnimatePresence>
        </main>

        {/* Mobile nav. Sits at the bottom because that's where thumbs are, and
            scrolls horizontally rather than wrapping onto two rows. */}
        <nav
          aria-label="Sections"
          className="sticky bottom-0 z-20 -mx-5 flex gap-1 overflow-x-auto border-t border-[var(--border)] bg-[var(--bg-overlay)] px-5 py-3 backdrop-blur md:hidden"
        >
          {panels.map(panel => (
            <button
              key={panel.id}
              type="button"
              onClick={() => navigate(panel.id)}
              aria-current={active === panel.id ? "page" : undefined}
              className={`shrink-0 rounded-full px-3.5 py-1.5 font-mono text-xs transition-colors ${
                active === panel.id
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-dim)]"
              }`}
            >
              {panel.label.toLowerCase()}
            </button>
          ))}
        </nav>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] py-5 font-mono text-[11px] text-[var(--text-faint)]">
          <span>
            © {new Date().getFullYear()} {identity.name}
          </span>

          <span className="hidden items-center gap-3 sm:flex">
            <span>
              <kbd className="rounded border border-[var(--border)] px-1 py-0.5">⌘K</kbd> search
            </span>
            <span>
              <kbd className="rounded border border-[var(--border)] px-1 py-0.5">←</kbd>
              <kbd className="ml-1 rounded border border-[var(--border)] px-1 py-0.5">→</kbd> panels
            </span>
          </span>

          <span className={data.degraded ? "text-[var(--accent-3)]" : ""}>
            {data.degraded ? "sample data" : `${data.projects.length} repos · live`}
          </span>
        </footer>
      </div>
    </>
  );
}
