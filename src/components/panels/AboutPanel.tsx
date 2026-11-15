"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Reveal } from "@/components/Reveal";
import Eyebrow from "@/components/Eyebrow";
import { about, identity } from "@/lib/content";
import { confirmFailure, markLoaded } from "@/lib/image";

type Mode = "jee" | "code";

/**
 * The photo. Muted at rest like every image on the site; colour comes back on
 * hover.
 *
 * A missing file means initials, not a broken-image icon (see
 * confirmFailure for why that's checked carefully).
 */
function Portrait({ className = "p-6 sm:p-8" }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    markLoaded(ref.current);
    confirmFailure(ref.current, () => setFailed(true));
  }, []);

  return (
    <div className={`group flex items-center justify-center ${className}`}>
      <div className="img-frame aspect-[577/636] w-full max-w-[300px] overflow-hidden border border-line bg-chip">
        {failed ? (
          <div className="flex h-full w-full items-center justify-center font-display text-7xl text-faint">
            {identity.name
              .split(" ")
              .map(part => part[0])
              .join("")}
          </div>
        ) : (
          /* Plain <img>: one local file, and next/image would swallow the
             missing-file fallback. */
          <img
            ref={ref}
            src={about.portrait}
            alt={about.portraitAlt}
            fetchPriority="high"
            onLoad={event => markLoaded(event.currentTarget)}
            onError={() => setFailed(true)}
            className="thumb h-full w-full object-cover"
          />
        )}
      </div>
    </div>
  );
}

/** The facts beside the photo — what used to be an object literal, in words. */
function Facts() {
  const { facts } = about;

  const rows: [string, ReactNode][] = [
    ["lives in", facts.based],
    ["school", `Class ${facts.grade}`],
    ["preparing for", facts.preparingFor],
    ["knows", facts.writes.join(", ")],
    ["learning", facts.learning.join(", ")],
    ["status", facts.status],
  ];

  return (
    <div className="panel">
      <div className="panel-bar">
        <span>in short</span>
      </div>

      <div className="grid items-center gap-2 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <Portrait className="p-6 pb-0 sm:pb-6 sm:pr-0" />

        <dl className="px-6 py-5 sm:py-6">
          {rows.map(([term, value]) => (
            <div key={term} className="flex flex-col gap-1 border-b border-line-soft py-2.5 last:border-b-0">
              <dt className="text-[11px] text-dim">{term}</dt>
              <dd className="text-sm text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export default function AboutPanel() {
  // School first, like the heading says.
  const [mode, setMode] = useState<Mode>("jee");

  return (
    <section
      aria-label="About"
      className="grid min-h-[calc(100svh-var(--header-h)-var(--status-h)-7rem)] items-center gap-14 xl:grid-cols-[minmax(0,1fr)_560px] xl:gap-20"
    >
      <div className="flex flex-col gap-8">
        <Reveal>
          <Eyebrow id="about" />
        </Reveal>

        <Reveal delay={80}>
          <h1 className="font-display text-[clamp(2.9rem,8.5vw,5rem)] font-normal leading-[0.98] tracking-[-0.02em]">
            {about.heading[0]}
            <br />
            {about.heading[1]} <span className="italic text-accent">{about.heading[2]}</span>
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <div role="group" aria-label="Mode" className="flex w-max border border-line">
            {(["jee", "code"] as const).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                data-cursor-label="switch"
                className={`h-11 px-[22px] text-xs font-medium transition-[color,background-color,transform] active:scale-95 ${
                  mode === value ? "bg-accent text-on-accent" : "text-dim hover:text-ink"
                }`}
              >
                {value === "jee" ? "JEE mode" : "code mode"}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={220}>
          {/* Re-keyed so switching modes replays the page-in. */}
          <p
            key={mode}
            className="panel-enter max-w-[580px] text-[15px] leading-[1.85] text-ink-soft [text-wrap:pretty]"
          >
            {about.modes[mode]}
          </p>
        </Reveal>
      </div>

      <Reveal delay={200} y={24}>
        <Facts />
      </Reveal>
    </section>
  );
}
