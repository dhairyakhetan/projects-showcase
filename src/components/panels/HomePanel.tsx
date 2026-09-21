"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import KineticName from "@/components/KineticName";
import ShaderField from "@/components/ShaderField";
import FlappyProjects from "@/components/FlappyProjects";
import Magnetic from "@/components/Magnetic";
import { Reveal, RevealWords } from "@/components/Reveal";
import { identity } from "@/lib/content";
import type { Project } from "@/lib/repos";
import type { PanelId } from "@/lib/content";

export default function HomePanel({
  projects,
  onNavigate,
}: {
  projects: Project[];
  onNavigate: (panel: PanelId) => void;
}) {
  const [roleIndex, setRoleIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(
      () => setRoleIndex(current => (current + 1) % identity.roles.length),
      2600,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative flex min-h-[calc(100vh-160px)] flex-col justify-center">
      <ShaderField className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-70" />

      <div className="max-w-4xl">
        <Reveal delay={0.05}>
          <p className="kicker mb-5">
            <span className="text-[var(--accent)]">●</span> available for collabs
          </p>
        </Reveal>

        <h1 className="font-display text-[clamp(2.6rem,10vw,6.5rem)] font-bold leading-[0.95] tracking-tight">
          <KineticName name={identity.name} />
        </h1>

        <div className="mt-6 max-w-2xl font-display text-[clamp(1.1rem,3.4vw,1.85rem)] font-medium leading-snug">
          <RevealWords text={identity.tagline} delay={0.28} />
        </div>

        {/* Fixed height so the cycling word can't shift the layout under it. */}
        <Reveal delay={0.5}>
          <div className="mt-4 flex h-7 items-center gap-2 font-mono text-sm text-[var(--text-dim)]">
            <span className="text-[var(--text-faint)]">$</span>
            <span>whoami →</span>
            <span className="relative inline-flex min-w-[13ch]">
              <AnimatePresence mode="wait">
                <motion.span
                  key={identity.roles[roleIndex]}
                  initial={{ opacity: 0, y: 9 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -9 }}
                  transition={{ duration: 0.3 }}
                  className="text-[var(--accent)]"
                >
                  {identity.roles[roleIndex]}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>
        </Reveal>

        <Reveal delay={0.6}>
          <p className="mt-7 max-w-xl text-[0.95rem] leading-relaxed text-[var(--text-dim)]">
            {identity.blurb}
          </p>
        </Reveal>

        <Reveal delay={0.72}>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Magnetic strength={7}>
              <button
                type="button"
                onClick={() => onNavigate("projects")}
                data-cursor-label="go"
                className="rounded-[var(--radius)] bg-[var(--accent)] px-6 py-3 font-mono text-sm font-semibold text-[#06070a] transition-opacity hover:opacity-85"
              >
                see the projects →
              </button>
            </Magnetic>

            <Magnetic strength={7}>
              <button
                type="button"
                onClick={() => setPlaying(true)}
                data-cursor-label="play"
                className="rounded-[var(--radius)] border border-[var(--border-strong)] px-6 py-3 font-mono text-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                ...or play with them ▸
              </button>
            </Magnetic>
          </div>
        </Reveal>
      </div>

      {/* Opt-in, so it never competes with the hero for attention. */}
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
              initial={{ scale: 0.95, y: 14 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.97, y: 8 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className="h-[min(560px,80vh)] w-full max-w-3xl"
            >
              <FlappyProjects projects={projects} onClose={() => setPlaying(false)} />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
