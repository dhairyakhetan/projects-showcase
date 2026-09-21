"use client";

import { useEffect, useState } from "react";
import ArrowUpRight from "@/components/ArrowUpRight";
import { Reveal, RevealWords } from "@/components/Reveal";
import { contact } from "@/lib/content";

/**
 * My local time, so anyone deciding whether to message knows what they're
 * interrupting. Renders nothing until mounted: the server has no idea what
 * time it is for the visitor's render, and a mismatch would be a hydration
 * error.
 */
function LocalTime() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!now) {
    // Reserve the line so nothing shifts when the clock arrives.
    return <span className="inline-block h-4" aria-hidden />;
  }

  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: contact.timezone,
  }).format(now);

  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: contact.timezone,
    }).format(now),
  );

  const status =
    hour >= 1 && hour < 6
      ? "almost certainly still awake"
      : hour < 9
        ? "asleep, probably"
        : hour < 17
          ? "buried in prep"
          : "around";

  return (
    <span className="font-mono text-xs text-[var(--text-faint)]">
      <span className="text-[var(--accent)]">{time}</span> where I am — {status}
    </span>
  );
}

export default function ContactPanel() {
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(contact.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Blocked clipboard — the address is displayed in full anyway.
    }
  }

  return (
    <div className="max-w-4xl">
      <Reveal>
        <p className="kicker mb-3">04 — say hi</p>
      </Reveal>

      <h2 className="font-display text-[clamp(2rem,6vw,3.4rem)] font-bold leading-tight">
        <RevealWords text={contact.heading} delay={80} />
      </h2>

      <Reveal delay={180}>
        <p className="mt-5 max-w-xl text-[1.02rem] leading-relaxed text-[var(--text-dim)]">
          {contact.intro}
        </p>
      </Reveal>

      <Reveal delay={260}>
        <button
          type="button"
          onClick={copyEmail}
          data-cursor-label={copied ? "copied" : "copy"}
          className="group mt-10 flex w-full flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-[var(--border-strong)] pb-5 text-left transition-colors hover:border-[var(--accent)]"
        >
          <span className="min-w-0">
            <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-faint)]">
              email
            </span>
            <span className="mt-2 block truncate font-display text-[clamp(1.3rem,4.5vw,2.3rem)] font-bold leading-none transition-colors group-hover:text-[var(--accent)]">
              {contact.email}
            </span>
          </span>

          <span className="shrink-0 font-mono text-xs text-[var(--accent)]">
            {copied ? "copied ✓" : "click to copy"}
          </span>
        </button>
      </Reveal>

      {/* Each row says what the platform is for. The handle is my name on all
          four of them, which this page already establishes. */}
      <ul className="mt-2">
        {contact.links.map((link, index) => (
          <Reveal key={link.label} delay={340 + index * 70}>
            <li>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                data-cursor-label="open"
                className="group flex items-baseline gap-4 border-b border-[var(--border)] py-5 transition-colors hover:border-[var(--accent)] sm:gap-6"
              >
                <span className="shrink-0 font-mono text-[11px] text-[var(--text-faint)]">
                  0{index + 1}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="font-display text-[clamp(1.15rem,3.4vw,1.7rem)] font-bold leading-tight transition-colors group-hover:text-[var(--accent)]">
                    {link.label}
                  </span>
                  <span className="mt-1 block text-sm text-[var(--text-dim)] sm:hidden">
                    {link.note}
                  </span>
                </span>

                <span className="hidden max-w-[42%] text-right text-sm text-[var(--text-dim)] sm:block">
                  {link.note}
                </span>

                <ArrowUpRight className="shrink-0 text-[var(--text-faint)] transition-[transform,color] duration-300 group-hover:translate-x-1 group-hover:text-[var(--accent)]" />
              </a>
            </li>
          </Reveal>
        ))}
      </ul>

      <Reveal delay={640}>
        <p className="mt-8">
          <LocalTime />
        </p>
      </Reveal>
    </div>
  );
}
