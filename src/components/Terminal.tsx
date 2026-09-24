"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { toggleTheme } from "@/components/ThemeToggle";
import { favourite, panels } from "@/lib/content";
import { featuredProjects } from "@/lib/featured";

interface Line {
  id: number;
  kind: "in" | "out" | "err";
  text: string;
}

const CHIPS = ["help", "whoami", "ls", "jee", "play", "sudo hire-me"];
const PAGES: string[] = panels.map(panel => panel.id);
const VISIBLE_LINES = 9;

/** Everything `open` accepts: the featured repos plus the one that isn't mine alone. */
const OPENABLE = [
  ...featuredProjects.map(project => ({
    key: project.name.toLowerCase(),
    url: project.homepage ?? project.url,
  })),
  { key: favourite.name, url: favourite.url },
];

let nextId = 0;
const line = (kind: Line["kind"], text: string): Line => ({ id: nextId++, kind, text });

/**
 * A tiny shell on the home page. It only knows a dozen commands, and every one
 * of them does something real: moves between pages, opens a project, flips the
 * theme, or launches the game.
 */
export default function Terminal({ onPlay }: { onPlay: () => void }) {
  const router = useRouter();
  const [log, setLog] = useState<Line[]>(() => [
    line("out", 'dhairya-os v11 — type "help", or tap a command below.'),
  ]);
  const [command, setCommand] = useState("");
  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function later(fn: () => void, ms: number) {
    clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  }

  function respond(raw: string): Line[] {
    const input = raw.trim().replace(/\s+/g, " ");
    const lower = input.toLowerCase();
    const [name, ...args] = lower.split(" ");
    const arg = args.join(" ");

    switch (name) {
      case "help":
        return [
          line("out", "whoami · ls · cd <page> · jee · open <project> · play · theme · clear"),
          line("out", "tip: typing a page name works too. ↑ recalls history."),
        ];

      case "whoami":
        return [line("out", "dhairya khetan — class 11, india. codes after homework.")];

      case "ls":
        if (arg.replace(/\/$/, "") === "projects") {
          return [line("out", OPENABLE.map(entry => entry.key).join("  "))];
        }
        return [line("out", PAGES.filter(page => page !== "home").map(page => `${page}/`).join("  "))];

      case "jee":
        return [
          line("out", "physics ▲  chemistry ▲  maths ▲  sleep ▼"),
          line("out", "status: preparing. do not disturb (unless it is about code)."),
        ];

      case "open": {
        const target = OPENABLE.find(entry => entry.key === arg);
        if (!target) {
          return [
            line("err", arg ? `open: no such project: ${arg}` : "usage: open <project>"),
            line("out", `try: ${OPENABLE.map(entry => entry.key).join(" · ")}`),
          ];
        }
        window.open(target.url, "_blank", "noopener,noreferrer");
        return [line("out", `opening ${target.key} in a new tab…`)];
      }

      case "play":
      case "flappy":
        later(onPlay, 350);
        return [line("out", "launching flappy-projects… space to flap, esc to quit.")];

      case "theme": {
        const next = toggleTheme();
        return [line("out", `theme → ${next}`)];
      }

      case "echo":
        return [line("out", input.slice(5))];

      case "sudo":
        return [
          line("err", "permission denied: user is in class 11."),
          line("out", "try again in a few years :)"),
        ];

      default: {
        const target = name === "cd" ? arg.replace(/[/.~]/g, "") || "home" : lower;

        if (PAGES.includes(target)) {
          later(() => router.push(`/${target}`), 420);
          return [line("out", `cd ~/${target} …`)];
        }

        return [line("err", `command not found: ${input} — try "help"`)];
      }
    }
  }

  function run(raw: string) {
    const input = raw.trim();
    setCommand("");
    historyIndex.current = -1;
    if (!input) return;

    history.current = [input, ...history.current.filter(entry => entry !== input)].slice(0, 20);

    if (input.toLowerCase() === "clear") {
      setLog([]);
      return;
    }

    const output = respond(input);
    setLog(current => [...current, line("in", input), ...output].slice(-VISIBLE_LINES));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      run(command);
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const entries = history.current;
      if (entries.length === 0) return;
      event.preventDefault();

      const step = event.key === "ArrowUp" ? 1 : -1;
      const index = Math.max(-1, Math.min(entries.length - 1, historyIndex.current + step));
      historyIndex.current = index;
      setCommand(index === -1 ? "" : entries[index]);
    }
  }

  return (
    <div className="panel flex flex-col shadow-[var(--shadow)]">
      <div className="panel-bar">
        <span className="flex gap-[7px]" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
        </span>
        <span>~/dhairya — zsh</span>
        <span className="w-11" />
      </div>

      <div
        role="log"
        aria-live="polite"
        aria-label="Terminal output"
        className="flex h-[250px] flex-col justify-end gap-2 overflow-hidden px-5 py-[18px] text-xs leading-relaxed"
      >
        {log.map(entry => (
          <div
            key={entry.id}
            className={`whitespace-pre-wrap break-words ${
              entry.kind === "in" ? "text-ink" : entry.kind === "err" ? "text-err" : "text-dim"
            }`}
          >
            {entry.kind === "in" ? <span className="text-accent">$ </span> : null}
            {entry.text}
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2.5 border-t border-rule px-5 py-3.5 text-[13px] transition-colors focus-within:bg-panel-hi">
        <span className="text-accent">$</span>
        <input
          value={command}
          onChange={event => setCommand(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="type a command, hit enter"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Terminal command"
          className="w-full bg-transparent py-1 text-[13px] outline-none placeholder:text-faint"
        />
      </label>

      <div className="flex flex-wrap gap-2 px-5 pb-[18px]">
        {CHIPS.map(chip => (
          <button key={chip} type="button" onClick={() => run(chip)} data-cursor-label="run" className="chip">
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
