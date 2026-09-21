"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal, RevealWords } from "@/components/Reveal";
import { about, identity } from "@/lib/content";

/**
 * Optional photo. Missing means initials, not a broken image icon.
 *
 * The markup is server-rendered, so a missing file fires `error` while the
 * HTML is still parsing — before React has attached onError. That event is
 * gone for good, so the miss is also detected on mount: a browser reports a
 * failed image as complete with zero natural width.
 */
function Portrait() {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  return (
    <figure className="w-full max-w-[280px]">
      <div className="aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-inset)]">
        {failed ? (
          <div className="flex h-full w-full items-center justify-center font-display text-5xl font-bold text-[var(--text-faint)]">
            {identity.name
              .split(" ")
              .map(part => part[0])
              .join("")}
          </div>
        ) : (
          /* Plain <img>: one local file, nothing to optimise remotely, and
             next/image would swallow the missing-file fallback. */
          <img
            ref={ref}
            src={about.portrait}
            alt={about.portraitAlt}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <figcaption className="mt-3 font-mono text-[11px] leading-relaxed text-[var(--text-faint)]">
        {about.portraitCaption}
      </figcaption>
    </figure>
  );
}

export default function AboutPanel() {
  return (
    <div>
      <Reveal>
        <p className="kicker mb-3">01 — who</p>
      </Reveal>

      <h2 className="font-display text-[clamp(2rem,6vw,3.4rem)] font-bold leading-tight">
        <RevealWords text={about.heading} delay={80} />
      </h2>

      {/* The lead carries the panel; body copy supports it. */}
      <Reveal delay={160}>
        <p className="mt-7 max-w-3xl font-display text-[clamp(1.15rem,3vw,1.75rem)] font-medium leading-snug">
          {about.lead}
        </p>
      </Reveal>

      <div className="mt-12 grid gap-10 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-14">
        <Reveal delay={240} className="order-1">
          <Portrait />
        </Reveal>

        <div className="order-2 max-w-[58ch] space-y-5 text-[1.02rem] leading-relaxed text-[var(--text-dim)]">
          {about.paragraphs.map((paragraph, index) => (
            <Reveal key={index} delay={300 + index * 80}>
              <p>{paragraph}</p>
            </Reveal>
          ))}

          <Reveal delay={300 + about.paragraphs.length * 80}>
            <ul className="space-y-3 pt-3">
              {about.principles.map((principle, index) => (
                <li key={index} className="flex gap-4">
                  <span className="shrink-0 pt-[3px] font-mono text-[11px] text-[var(--text-faint)]">
                    0{index + 1}
                  </span>
                  <span className="text-[0.97rem] leading-relaxed text-[var(--text)]">
                    {principle}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>

      {/* A snapshot rather than a CV table — the live dot marks it as current. */}
      <Reveal delay={620}>
        <div className="mt-14 border-t border-[var(--border)] pt-6">
          <p className="mb-5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            </span>
            right now
          </p>

          <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {about.now.map(item => (
              <div key={item.label}>
                <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
                  {item.label}
                </dt>
                <dd className="mt-1.5 font-display text-base font-bold">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Reveal>
    </div>
  );
}
