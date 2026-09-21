"use client";

import { useState } from "react";
import Magnetic from "@/components/Magnetic";
import { Reveal, RevealWords } from "@/components/Reveal";
import { contact } from "@/lib/content";

export default function ContactPanel() {
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(contact.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (insecure context, denied permission) — the address
      // is displayed in full right there, so there's nothing to fall back to.
    }
  }

  // A link still pointing at "#" is a placeholder I haven't filled in yet.
  // Better to drop it than to ship a dead link.
  const links = contact.links.filter(link => link.href !== "#");

  return (
    <div className="max-w-3xl">
      <Reveal>
        <p className="kicker mb-3">04 — say hi</p>
      </Reveal>

      <h2 className="font-display text-[clamp(2rem,6vw,3.4rem)] font-bold leading-tight">
        <RevealWords text={contact.heading} delay={0.08} />
      </h2>

      <Reveal delay={0.18}>
        <p className="mt-5 text-[1.02rem] leading-relaxed text-[var(--text-dim)]">{contact.intro}</p>
      </Reveal>

      <Reveal delay={0.28}>
        <button
          type="button"
          onClick={copyEmail}
          data-cursor-label={copied ? "copied" : "copy"}
          className="group mt-10 flex w-full items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-raised)] px-6 py-6 text-left transition-colors hover:border-[var(--accent)]"
        >
          <span className="min-w-0">
            <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-faint)]">
              email
            </span>
            <span className="mt-1.5 block truncate font-display text-[clamp(1.05rem,3.5vw,1.6rem)] font-bold">
              {contact.email}
            </span>
          </span>

          <span className="shrink-0 font-mono text-xs text-[var(--accent)]">
            {copied ? "copied ✓" : "copy"}
          </span>
        </button>
      </Reveal>

      {links.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {links.map((link, index) => (
            <Reveal key={link.label} delay={0.36 + index * 0.06}>
              <Magnetic strength={5}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-cursor-label="open"
                  className="group flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-raised)] px-5 py-4 transition-colors hover:border-[var(--accent)]"
                >
                  <span className="min-w-0">
                    <span className="block font-display text-sm font-bold">{link.label}</span>
                    <span className="mt-0.5 block truncate font-mono text-xs text-[var(--text-dim)]">
                      {link.handle}
                    </span>
                  </span>
                  <span className="shrink-0 text-[var(--text-faint)] transition-[transform,color] duration-300 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]">
                    ↗
                  </span>
                </a>
              </Magnetic>
            </Reveal>
          ))}
        </div>
      ) : null}
    </div>
  );
}
