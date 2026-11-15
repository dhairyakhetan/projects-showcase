"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FerroBlob from "@/components/FerroBlob";
import Ferrofluid from "@/components/Ferrofluid";
import KineticName from "@/components/KineticName";
import Magnetic from "@/components/Magnetic";
import { Reveal } from "@/components/Reveal";
import Roll, { HoverRoll } from "@/components/Roll";
import { home, identity } from "@/lib/content";

/** "I build …", the last word rolling over to the next every couple of seconds. */
function Building({ words }: { words: readonly string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex(current => (current + 1) % words.length), 2400);
    return () => clearInterval(timer);
  }, [words]);

  return (
    <p className="min-h-[1.4em] text-[clamp(1.05rem,2.6vw,1.375rem)] leading-snug">
      <span className="sr-only">I build {words.join(", ")}.</span>
      <span aria-hidden>
        I build <Roll text={words[index]} className="text-accent" />
      </span>
    </p>
  );
}

export default function HomePanel() {
  return (
    <section
      aria-label="Home"
      className="grid min-h-[calc(100svh-var(--header-h)-var(--status-h)-7rem)] items-center gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] xl:gap-[72px]"
    >
      <div className="flex flex-col gap-7">
        <Reveal>
          <p className="text-[13px] text-dim">
            <span className="text-accent">●</span> {home.greeting}
          </p>
        </Reveal>

        <Reveal delay={80}>
          <h1 className="font-display text-[clamp(4rem,19vw,9.75rem)] font-normal leading-[0.86] tracking-[-0.03em] xl:text-[clamp(7rem,10.8vw,9.75rem)]">
            <KineticName name={identity.name} />
          </h1>
        </Reveal>

        <Reveal delay={180}>
          <Building words={home.typed} />
        </Reveal>

        <Reveal delay={260}>
          <p className="max-w-[540px] text-sm leading-[1.8] text-dim [text-wrap:pretty]">
            {identity.blurb}
          </p>
        </Reveal>

        <Reveal delay={340}>
          <div className="flex flex-wrap items-center gap-3.5">
            {/* The one button the ferrofluid guards. */}
            <Ferrofluid reach={220}>
              <Link href="/projects" data-cursor-label="go" className="btn btn-primary">
                <HoverRoll text="see projects" /> <span aria-hidden className="nudge">→</span>
              </Link>
            </Ferrofluid>
            <Magnetic strength={6}>
              <Link href="/contact" data-cursor-label="hi" className="btn btn-ghost">
                <HoverRoll text="say hi" />
              </Link>
            </Magnetic>
          </div>
        </Reveal>
      </div>

      <Reveal delay={220} y={24}>
        <figure className="mx-auto flex w-full max-w-[520px] flex-col items-center gap-2">
          <FerroBlob />
          <figcaption className="text-center text-[11px] text-faint">
            <span className="text-accent">fig. 01</span> — ferrofluid, simulated live. go on, poke it.
          </figcaption>
        </figure>
      </Reveal>
    </section>
  );
}
