"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import ArrowUpRight from "@/components/ArrowUpRight";
import { toggleTheme } from "@/components/ThemeToggle";
import { contact, panels } from "@/lib/content";
import { featuredProjects, openProject } from "@/lib/featured";
import { replayIntro } from "@/lib/intro";
import { SOUND_EVENT, soundEnabled, toggleSound } from "@/lib/sound";

const OPEN_EVENT = "palette:open";

/** For buttons elsewhere (the status bar) that open the palette. */
export function openPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

interface Command {
  id: string;
  label: string;
  hint: string;
  group: "Pages" | "Projects" | "Actions";
  /** Leaves the site: the hint gets the ↗. */
  external?: boolean;
  run: () => void;
}

/**
 * ⌘K palette over the pages, the curated projects and a few actions.
 * Everything in it is static content; opening it never makes a request.
 */
export default function CommandPalette() {
  const router = useRouter();
  const [sound, setSoundState] = useState(true);
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

      // "/" opens it too, but not while typing — it would hijack the search box.
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

    const onOpen = () => setOpen(true);
    const onSound = () => setSoundState(soundEnabled());
    onSound();
    window.addEventListener(SOUND_EVENT, onSound);

    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(SOUND_EVENT, onSound);
    };
  }, []);

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
      hint: panel.file,
      group: "Pages",
      run: () => router.push(`/${panel.id}`),
    }));

    // Curated only. Listing every public repo here would mean fetching them
    // on page load, which is exactly what this site no longer does.
    const projectCommands: Command[] = featuredProjects.map(project => ({
      id: `project-${project.name}`,
      label: project.title,
      hint: project.link.startsWith("/") ? "open" : project.homepage ? "visit" : "code",
      group: "Projects",
      external: !project.link.startsWith("/"),
      run: () => openProject(project.link),
    }));

    return [
      ...panelCommands,
      ...projectCommands,
      {
        id: "action-sound",
        label: sound ? "Turn sound off" : "Turn sound on",
        hint: sound ? "♪ on" : "♪ off",
        group: "Actions",
        run: () => void toggleSound(),
      },
      {
        id: "action-blackjack",
        label: "Play blackjack",
        hint: "a card game",
        group: "Actions",
        // A plain page load: /blackjack lives outside the app router.
        run: () => window.location.assign("/blackjack"),
      },
      {
        id: "action-intro",
        label: "Replay the intro",
        hint: "the loading dock",
        group: "Actions",
        run: replayIntro,
      },
      {
        id: "action-theme",
        label: "Toggle theme",
        hint: "dark ⇄ light",
        group: "Actions",
        run: () => void toggleTheme(),
      },
      {
        id: "action-email",
        label: "Copy email address",
        hint: contact.email,
        group: "Actions",
        run: () => void navigator.clipboard?.writeText(contact.email).catch(() => {}),
      },
    ];
  }, [router, sound]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      command =>
        command.label.toLowerCase().includes(q) || command.hint.toLowerCase().includes(q),
    );
  }, [commands, query]);

  // Clamped rather than reset, so narrowing the list doesn't throw the
  // selection back to the top mid-arrow.
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
            className="w-full max-w-lg overflow-hidden border border-line-strong bg-panel shadow-[var(--shadow)]"
          >
            <div className="panel-bar">
              <span>menu</span>
              <kbd className="text-faint">esc</kbd>
            </div>
            <div className="flex items-center gap-3 border-b border-rule px-4 py-3.5">
              <span className="text-xs text-accent">›</span>
              <input
                autoFocus
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={onInputKey}
                placeholder="jump to a page or a project"
                aria-label="Search commands"
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-faint"
              />
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
              {results.length === 0 ? (
                <p className="px-4 py-6 text-xs text-err">
                  Nothing matches that — try a page name.
                </p>
              ) : (
                results.map((command, index) => {
                  const showGroup = command.group !== lastGroup;
                  lastGroup = command.group;

                  return (
                    <div key={command.id}>
                      {showGroup ? (
                        <p className="px-4 pb-1.5 pt-3 text-[10px] text-faint">
                          {command.group.toLowerCase()}
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
                        className={`flex w-full items-center justify-between gap-4 border-l-2 px-4 py-2.5 text-left transition-colors ${
                          index === active ? "border-accent bg-panel-hi" : "border-transparent"
                        }`}
                      >
                        <span className={`truncate text-[13px] ${index === active ? "text-ink" : "text-ink-soft"}`}>
                          {command.label}
                        </span>
                        <span className="flex shrink-0 items-center gap-1 truncate text-[10px] text-faint">
                          {command.hint}
                          {command.external ? <ArrowUpRight /> : null}
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
