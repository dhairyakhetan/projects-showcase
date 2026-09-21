"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { panels, type PanelId } from "@/lib/content";
import type { Project } from "@/lib/repos";

interface Command {
  id: string;
  label: string;
  hint: string;
  group: "Panels" | "Projects" | "Actions";
  run: () => void;
}

/**
 * ⌘K / Ctrl+K palette over the panels, the live project list and a couple of
 * actions.
 *
 * The project entries come from the same fetched data the grid renders, so the
 * palette can't drift out of sync with what's actually on the site.
 */
export default function CommandPalette({
  projects,
  onNavigate,
  onToggleTheme,
}: {
  projects: Project[];
  onNavigate: (panel: PanelId) => void;
  onToggleTheme: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(current => !current);
        return;
      }

      // Bare "/" is a shortcut too, but only when the user isn't already typing
      // somewhere — otherwise it would hijack the projects search box.
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.key === "/" && !typing) {
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset between openings so it never reopens mid-search from last time.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setCursor(0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const panelCommands: Command[] = panels.map(panel => ({
      id: `panel-${panel.id}`,
      label: panel.label,
      hint: "go to panel",
      group: "Panels",
      run: () => onNavigate(panel.id),
    }));

    const projectCommands: Command[] = projects.map(project => ({
      id: `project-${project.id}`,
      label: project.title,
      hint: project.tech.map(tech => tech.label).join(" · ") || "repository",
      group: "Projects",
      run: () => window.open(project.homepage ?? project.url, "_blank", "noopener,noreferrer"),
    }));

    return [
      ...panelCommands,
      ...projectCommands,
      {
        id: "action-theme",
        label: "Toggle theme",
        hint: "dark ⇄ light",
        group: "Actions",
        run: onToggleTheme,
      },
    ];
  }, [projects, onNavigate, onToggleTheme]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      command =>
        command.label.toLowerCase().includes(q) || command.hint.toLowerCase().includes(q),
    );
  }, [commands, query]);

  // Clamp rather than reset, so narrowing the list doesn't jump the selection
  // back to the top while the user is still arrowing through it.
  const active = Math.min(cursor, Math.max(0, results.length - 1));

  function onInputKey(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor(current => (current + 1) % Math.max(1, results.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor(current => (current - 1 + results.length) % Math.max(1, results.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = results[active];
      if (command) {
        command.run();
        setOpen(false);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    } else {
      setCursor(0);
    }
  }

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let lastGroup: string | null = null;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[110] flex items-start justify-center bg-[var(--bg-overlay)] p-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            onClick={event => event.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-raised)] shadow-[var(--shadow)]"
          >
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
              <span className="font-mono text-xs text-[var(--accent)]">⌘</span>
              <input
                autoFocus
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={onInputKey}
                placeholder="jump to a panel or a project..."
                aria-label="Search commands"
                className="w-full bg-transparent font-mono text-sm outline-none placeholder:text-[var(--text-faint)]"
              />
              <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-faint)]">
                esc
              </kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
              {results.length === 0 ? (
                <p className="px-4 py-6 text-center font-mono text-xs text-[var(--text-faint)]">
                  no matches
                </p>
              ) : (
                results.map((command, index) => {
                  const showGroup = command.group !== lastGroup;
                  lastGroup = command.group;

                  return (
                    <div key={command.id}>
                      {showGroup ? (
                        <p className="px-4 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
                          {command.group}
                        </p>
                      ) : null}

                      <button
                        type="button"
                        data-index={index}
                        onMouseEnter={() => setCursor(index)}
                        onClick={() => {
                          command.run();
                          setOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left transition-colors ${
                          index === active ? "bg-[var(--accent-soft)]" : ""
                        }`}
                      >
                        <span
                          className={`truncate font-display text-sm font-medium ${
                            index === active ? "text-[var(--accent)]" : ""
                          }`}
                        >
                          {command.label}
                        </span>
                        <span className="shrink-0 truncate font-mono text-[10px] text-[var(--text-faint)]">
                          {command.hint}
                        </span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
