"use client";

import { motion } from "framer-motion";
import { Reveal, RevealWords } from "@/components/Reveal";
import { qualification } from "@/lib/content";

export default function QualificationPanel() {
  return (
    <div className="max-w-3xl">
      <Reveal>
        <p className="kicker mb-3">02 — on paper</p>
      </Reveal>

      <h2 className="font-display text-[clamp(2rem,6vw,3.4rem)] font-bold leading-tight">
        <RevealWords text={qualification.heading} delay={0.08} />
      </h2>

      <ol className="mt-12 space-y-0">
        {qualification.entries.map((entry, index) => (
          <Reveal key={`${entry.title}-${index}`} delay={0.16 + index * 0.1}>
            {/* Border on the list item draws the spine; the last item stops it
                so the timeline ends rather than trailing into nothing. */}
            <li
              className={`relative pb-10 pl-8 ${
                index === qualification.entries.length - 1
                  ? ""
                  : "border-l border-[var(--border)]"
              }`}
            >
              <span className="absolute -left-[5px] top-1 flex h-2.5 w-2.5">
                {entry.ongoing ? (
                  <motion.span
                    className="absolute inline-flex h-full w-full rounded-full bg-[var(--accent)]"
                    animate={{ scale: [1, 2.1, 1], opacity: [0.65, 0, 0.65] }}
                    transition={{ duration: 2.1, repeat: Infinity, ease: "easeOut" }}
                  />
                ) : null}
                <span
                  className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                    entry.ongoing
                      ? "bg-[var(--accent)]"
                      : "border border-[var(--border-strong)] bg-[var(--bg)]"
                  }`}
                />
              </span>

              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-faint)]">
                {entry.period}
              </p>

              <h3 className="mt-2 font-display text-xl font-bold">
                {entry.title}
                {entry.ongoing ? (
                  <span className="ml-2.5 align-middle font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--accent)]">
                    ongoing
                  </span>
                ) : null}
              </h3>

              <p className="mt-1 text-sm text-[var(--text-dim)]">{entry.org}</p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-dim)]">{entry.detail}</p>
            </li>
          </Reveal>
        ))}
      </ol>

      {qualification.footnote ? (
        <Reveal delay={0.5}>
          <p className="mt-2 border-l-2 border-[var(--accent)] py-1 pl-4 font-mono text-xs leading-relaxed text-[var(--text-faint)]">
            {qualification.footnote}
          </p>
        </Reveal>
      ) : null}
    </div>
  );
}
