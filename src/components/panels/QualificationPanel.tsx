"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Reveal } from "@/components/Reveal";
import { qualification } from "@/lib/content";

/**
 * A list of entries and one open in detail — tabs, semantically, so arrow keys
 * move through the list the way they would in any tab strip.
 */
export default function QualificationPanel() {
  const { entries } = qualification;
  const [current, setCurrent] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const entry = entries[current];

  function onKeyDown(event: KeyboardEvent) {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    const jump = event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : null;
    if (step === undefined && jump === null) return;

    event.preventDefault();
    const next = jump ?? (current + step! + entries.length) % entries.length;
    setCurrent(next);
    tabs.current[next]?.focus();
  }

  return (
    <section aria-label="Qualification" className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-3.5">
          <Reveal>
            <p className="text-xs text-dim">
              <span className="text-accent">03</span> / qualification.json
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="font-display text-[clamp(2.9rem,8vw,4.5rem)] font-normal leading-none tracking-[-0.02em]">
              Where I&apos;m <span className="italic">at.</span>
            </h2>
          </Reveal>
        </div>
        <Reveal delay={140}>
          <p className="text-xs text-dim">click an entry to open it</p>
        </Reveal>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[480px_minmax(0,1fr)]">
        <Reveal delay={180}>
          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label="Entries"
            onKeyDown={onKeyDown}
            className="flex flex-col border-l border-line bg-bg/60"
          >
            {entries.map((item, index) => {
              const on = index === current;

              return (
                <button
                  key={item.title}
                  ref={node => {
                    tabs.current[index] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`qual-tab-${index}`}
                  aria-selected={on}
                  aria-controls="qual-detail"
                  tabIndex={on ? 0 : -1}
                  onClick={() => setCurrent(index)}
                  data-cursor-label="open"
                  className={`relative flex flex-col gap-2 border-b border-line-soft py-[22px] pl-8 pr-6 text-left transition-colors ${
                    on ? "bg-panel-hi" : "hover:bg-panel-hi/60"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`absolute -left-[6px] top-7 h-[11px] w-[11px] rounded-full border transition-colors ${
                      on ? "border-accent bg-accent" : "border-ghost bg-bg"
                    }`}
                  />
                  <span className={`text-[11px] ${on ? "text-accent" : "text-dim"}`}>{item.year}</span>
                  <span className="text-[17px] font-medium">{item.title}</span>
                </button>
              );
            })}
          </div>
        </Reveal>

        <Reveal delay={240} y={24}>
          {/* Re-keyed so each entry arrives rather than swapping in place. */}
          <div
            key={current}
            id="qual-detail"
            role="tabpanel"
            aria-labelledby={`qual-tab-${current}`}
            className="panel panel-enter flex h-full min-h-[340px] flex-col gap-[26px] p-7 sm:p-12"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-dim">{entry.year}</span>
              <span className="border border-accent px-3 py-1.5 text-[11px] text-accent">{entry.status}</span>
            </div>

            <h3 className="font-display text-[clamp(2.4rem,6vw,4rem)] font-normal leading-none tracking-[-0.02em]">
              {entry.title}
            </h3>

            <p className="max-w-[620px] text-[15px] leading-[1.85] text-ink-soft [text-wrap:pretty]">
              {entry.detail}
            </p>

            <ul className="mt-auto flex flex-wrap gap-2">
              {entry.tags.map(tag => (
                <li key={tag} className="tag">
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
