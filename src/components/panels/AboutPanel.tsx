"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal, RevealWords } from "@/components/Reveal";
import { about, identity } from "@/lib/content";

export default function AboutPanel() {
  // The photo is optional; missing means initials, not a broken image icon.
  const [portraitFailed, setPortraitFailed] = useState(false);
  const portraitRef = useRef<HTMLImageElement>(null);

  // The markup is server-rendered, so a missing file fires `error` while the
  // HTML is still parsing — before React has attached onError. That event is
  // gone for good, so the miss has to be detected on mount as well: a browser
  // reports a failed image as complete with zero natural width.
  useEffect(() => {
    const img = portraitRef.current;
    if (img?.complete && img.naturalWidth === 0) setPortraitFailed(true);
  }, []);

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-16">
      <div>
        <Reveal>
          <p className="kicker mb-3">01 — who</p>
        </Reveal>

        <h2 className="font-display text-[clamp(2rem,6vw,3.4rem)] font-bold leading-tight">
          <RevealWords text={about.heading} delay={80} />
        </h2>

        <div className="mt-8 space-y-5 text-[1.02rem] leading-relaxed text-[var(--text-dim)]">
          {about.paragraphs.map((paragraph, index) => (
            <Reveal key={index} delay={160 + index * 80}>
              <p>{paragraph}</p>
            </Reveal>
          ))}
        </div>
      </div>

      <div className="lg:pt-20">
        <Reveal delay={240}>
          <figure className="mb-4 aspect-[4/5] w-full max-w-[300px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-inset)]">
            {portraitFailed ? (
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
                ref={portraitRef}
                src={about.portrait}
                alt={about.portraitAlt}
                onError={() => setPortraitFailed(true)}
                className="h-full w-full object-cover"
              />
            )}
          </figure>
        </Reveal>

        <Reveal delay={320}>
          <dl className="divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-raised)]">
            {about.facts.map(fact => (
              <div key={fact.label} className="flex items-baseline justify-between gap-4 px-5 py-4">
                <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-faint)]">
                  {fact.label}
                </dt>
                <dd className="text-right font-display text-sm font-semibold">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </div>
  );
}
