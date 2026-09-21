"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ProjectCard from "@/components/ProjectCard";
import { Reveal, RevealWords } from "@/components/Reveal";
import { projects as projectsContent } from "@/lib/content";
import { techIndex } from "@/lib/tech";
import type { ProjectsResult } from "@/lib/repos";

export default function ProjectsPanel({ data }: { data: ProjectsResult }) {
  const [query, setQuery] = useState("");
  const [activeTech, setActiveTech] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Typing stays responsive even when the grid below is re-laying out.
  const deferredQuery = useDeferredValue(query);

  // Filter chips are built from derived tech, never from GitHub's `language`,
  // so "Astro" is a real category here and "HTML" doesn't swallow every site.
  const techs = useMemo(() => techIndex(data.projects), [data.projects]);

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();

    return data.projects.filter(project => {
      if (activeTech && !project.tech.some(tech => tech.slug === activeTech)) return false;
      if (!q) return true;

      return (
        project.name.toLowerCase().includes(q) ||
        project.title.toLowerCase().includes(q) ||
        (project.description?.toLowerCase().includes(q) ?? false) ||
        project.tech.some(tech => tech.label.toLowerCase().includes(q))
      );
    });
  }, [data.projects, deferredQuery, activeTech]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Reveal>
            <p className="kicker mb-3">03 — the work</p>
          </Reveal>

          <h2 className="font-display text-[clamp(2rem,6vw,3.4rem)] font-bold leading-tight">
            <RevealWords text={projectsContent.heading} delay={0.08} />
          </h2>
        </div>

        <Reveal delay={0.2}>
          <p className="max-w-sm text-sm leading-relaxed text-[var(--text-dim)]">
            {projectsContent.intro}
          </p>
        </Reveal>
      </div>

      {/* Honest about a failed fetch rather than passing fixtures off as real. */}
      {data.degraded ? (
        <Reveal delay={0.26}>
          <p className="mt-8 rounded-[var(--radius)] border border-[var(--accent-3)]/40 bg-[var(--accent-3)]/10 px-4 py-3 font-mono text-xs text-[var(--text-dim)]">
            couldn&apos;t reach the worker{data.error ? ` (${data.error})` : ""} — showing sample
            data until the next sync
          </p>
        </Reveal>
      ) : null}

      <Reveal delay={0.3}>
        <div className="mt-10 flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-raised)] px-4 py-2.5 focus-within:border-[var(--accent)]">
            <span className="font-mono text-xs text-[var(--text-faint)]">/</span>
            <input
              ref={searchRef}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="search projects, tech, descriptions..."
              aria-label="Search projects"
              className="w-full bg-transparent font-mono text-sm outline-none placeholder:text-[var(--text-faint)]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                aria-label="Clear search"
                className="font-mono text-xs text-[var(--text-faint)] hover:text-[var(--accent)]"
              >
                ✕
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="all"
              count={data.projects.length}
              active={activeTech === null}
              onClick={() => setActiveTech(null)}
            />
            {techs.map(({ tech, count }) => (
              <FilterChip
                key={tech.slug}
                label={tech.label}
                count={count}
                color={tech.color}
                active={activeTech === tech.slug}
                onClick={() => setActiveTech(activeTech === tech.slug ? null : tech.slug)}
              />
            ))}
          </div>
        </div>
      </Reveal>

      {visible.length === 0 ? (
        <p className="mt-16 text-center font-mono text-sm text-[var(--text-faint)]">
          nothing matches that.
        </p>
      ) : (
        <motion.div
          layout
          className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
        >
          <AnimatePresence mode="popLayout">
            {visible.map((project, index) => (
              <ProjectCard key={project.id} project={project} index={index} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-xs transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
      }`}
    >
      {color ? (
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      ) : null}
      {label}
      <span className="text-[var(--text-faint)]">{count}</span>
    </button>
  );
}
