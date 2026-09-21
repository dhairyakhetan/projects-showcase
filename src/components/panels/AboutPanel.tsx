"use client";

import { Reveal, RevealWords } from "@/components/Reveal";
import { about } from "@/lib/content";

export default function AboutPanel() {
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-16">
      <div>
        <Reveal>
          <p className="kicker mb-3">01 — who</p>
        </Reveal>

        <h2 className="font-display text-[clamp(2rem,6vw,3.4rem)] font-bold leading-tight">
          <RevealWords text={about.heading} delay={0.08} />
        </h2>

        <div className="mt-8 space-y-5 text-[1.02rem] leading-relaxed text-[var(--text-dim)]">
          {about.paragraphs.map((paragraph, index) => (
            <Reveal key={index} delay={0.16 + index * 0.08}>
              <p>{paragraph}</p>
            </Reveal>
          ))}
        </div>
      </div>

      <Reveal delay={0.3} className="lg:pt-20">
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
  );
}
