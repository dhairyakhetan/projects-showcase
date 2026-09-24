"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import FlappyProjects from "@/components/FlappyProjects";
import KineticName from "@/components/KineticName";
import Magnetic from "@/components/Magnetic";
import { Reveal } from "@/components/Reveal";
import Terminal from "@/components/Terminal";
import Variant from "@/components/Variant";
import { home, identity } from "@/lib/content";
import { featuredProjects } from "@/lib/featured";

const TICK = 75;
const HOLD_FULL = 26;
const HOLD_EMPTY = 4;

/** "I build …", typed out and backspaced one word at a time. */
function Typewriter({ words }: { words: readonly string[] }) {
  const [state, setState] = useState({ word: 0, chars: words[0].length });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let word = 0;
    let chars = words[0].length;
    let deleting = true;
    let hold = HOLD_FULL;

    const timer = setInterval(() => {
      if (hold > 0) {
        hold--;
        return;
      }

      if (deleting) {
        if (chars > 0) chars--;
        else {
          deleting = false;
          word = (word + 1) % words.length;
          hold = HOLD_EMPTY;
        }
      } else if (chars < words[word].length) {
        chars++;
      } else {
        deleting = true;
        hold = HOLD_FULL;
      }

      setState({ word, chars });
    }, TICK);

    return () => clearInterval(timer);
  }, [words]);

  return (
    <p className="min-h-[1.4em] text-[clamp(1.05rem,2.6vw,1.375rem)] leading-snug">
      <span className="sr-only">I build {words.join(", ")}.</span>
      <span aria-hidden>
        I build <span className="text-accent">{words[state.word].slice(0, state.chars)}</span>
        <span className="caret text-accent">▍</span>
      </span>
    </p>
  );
}

/** The simple view's stand-in for the terminal: the same places, as plain links. */
function StartHere({ onPlay }: { onPlay: () => void }) {
  const row =
    "row-link flex w-full items-center justify-between gap-4 border-b border-rule px-6 py-[18px] text-left";

  const links = [
    { href: "/about", title: "About me", note: "who I am, in short" },
    { href: "/projects", title: "Things I've made", note: "four projects, and why I built each" },
    { href: "/qualification", title: "Where I'm at", note: "school, JEE, and coding" },
    { href: "/contact", title: "Say hi", note: "email, socials, or a quick message" },
  ];

  return (
    <div className="panel shadow-[var(--shadow)]">
      <div className="panel-bar">
        <span>start here</span>
        <span>5 stops</span>
      </div>

      <ul>
        {links.map(link => (
          <li key={link.href}>
            <Link href={link.href} data-cursor-label="go" className={row}>
              <span className="flex flex-col gap-1">
                <span className="text-sm text-ink">{link.title}</span>
                <span className="text-[11px] text-dim">{link.note}</span>
              </span>
              <span aria-hidden className="text-dim">→</span>
            </Link>
          </li>
        ))}
        <li>
          <button type="button" onClick={onPlay} data-cursor-label="play" className={`${row} border-b-0`}>
            <span className="flex flex-col gap-1">
              <span className="text-sm text-ink">Play a little game</span>
              <span className="text-[11px] text-dim">fly a dot through my projects</span>
            </span>
            <span aria-hidden className="text-accent">▸</span>
          </button>
        </li>
      </ul>
    </div>
  );
}

export default function HomePanel() {
  const [playing, setPlaying] = useState(false);

  return (
    <section
      aria-label="Home"
      className="grid min-h-[calc(100svh-var(--header-h)-var(--status-h)-7rem)] items-center gap-14 xl:grid-cols-[minmax(0,1fr)_500px] xl:gap-[72px]"
    >
      <div className="flex flex-col gap-7">
        <Reveal>
          <p className="text-[13px] text-dim">
            <Variant
              dev={
                <>
                  <span className="text-accent">//</span> {home.greeting}
                </>
              }
              plain={
                <>
                  <span className="text-accent">●</span> hi, i&apos;m
                </>
              }
            />
          </p>
        </Reveal>

        <Reveal delay={80}>
          <h1 className="font-display text-[clamp(4rem,19vw,9.75rem)] font-normal leading-[0.86] tracking-[-0.03em] xl:text-[clamp(7rem,10.8vw,9.75rem)]">
            <KineticName name={identity.name} />
          </h1>
        </Reveal>

        <Reveal delay={180}>
          <Typewriter words={home.typed} />
        </Reveal>

        <Reveal delay={260}>
          <p className="max-w-[540px] text-sm leading-[1.8] text-dim [text-wrap:pretty]">
            {identity.blurb}
          </p>
        </Reveal>

        <Reveal delay={340}>
          <div className="flex flex-wrap items-center gap-3.5">
            <Magnetic strength={6}>
              <Link href="/projects" data-cursor-label="go" className="btn btn-primary">
                see projects <span aria-hidden>→</span>
              </Link>
            </Magnetic>
            <Magnetic strength={6}>
              <Link href="/contact" data-cursor-label="hi" className="btn btn-ghost">
                say hi
              </Link>
            </Magnetic>
          </div>
        </Reveal>
      </div>

      <Reveal delay={220} y={24}>
        <Variant
          block
          dev={<Terminal onPlay={() => setPlaying(true)} />}
          plain={<StartHere onPlay={() => setPlaying(true)} />}
        />
      </Reveal>

      {/* Opt-in from the terminal, so it never competes with the page. */}
      <AnimatePresence>
        {playing ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--bg-overlay)] p-4 backdrop-blur-sm sm:p-8"
          >
            <motion.div
              initial={{ scale: 0.96, y: 14 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 8 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className="h-[min(560px,80vh)] w-full max-w-3xl"
            >
              <FlappyProjects projects={featuredProjects} onClose={() => setPlaying(false)} />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
