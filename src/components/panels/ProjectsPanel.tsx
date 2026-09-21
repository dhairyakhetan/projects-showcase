"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import ProjectCard from "@/components/ProjectCard";
import { Reveal, RevealWords } from "@/components/Reveal";
import { projects as projectsContent } from "@/lib/content";
import { techIndex } from "@/lib/tech";
import type { ProjectsResult } from "@/lib/repos";

export default function ProjectsPanel({ data }: { data: ProjectsResult }) {
  const [query, setQuery] = useState("");
  const [activeTech, setActiveTech] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  /**
   * Feeds --mx/--my to whichever card the pointer is over, which drives the
   * radial wash in globals.css.
   *
   * One delegated listener on the grid rather than one per card, and batched
   * into a single frame — pointermove fires far faster than paint, and writing
   * a custom property per event would thrash style recalculation across every
   * card on screen.
   */
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let queued = false;
    let latest: { card: HTMLElement; x: number; y: number } | null = null;

    function onMove(event: PointerEvent) {
      const card = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-card]");
      if (!card) return;

      const rect = card.getBoundingClientRect();
      latest = { card, x: event.clientX - rect.left, y: event.clientY - rect.top };

      if (queued) return;
      queued = true;

      requestAnimationFrame(() => {
        if (latest) {
          latest.card.style.setProperty("--mx", `${latest.x}px`);
          latest.card.style.setProperty("--my", `${latest.y}px`);
        }
        queued = false;
      });
    }

    grid.addEventListener("pointermove", onMove, { passive: true });
    return () => grid.removeEventListener("pointermove", onMove);
  }, []);

  // Typing stays responsive while the grid below re-lays out.
  const deferredQuery = useDeferredValue(query);

  // Built from derived tech, never GitHub's `language`, so "Astro" is a real
  // category and "HTML" doesn't swallow every site.
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
            <RevealWords text={projectsContent.heading} delay={80} />
          </h2>
        </div>

        <Reveal delay={200}>
          <p className="max-w-sm text-sm leading-relaxed text-[var(--text-dim)]">
            {projectsContent.intro}
          </p>
        </Reveal>
      </div>

      {/* Say so, rather than passing fixtures off as real data. */}
      {data.degraded ? (
        <Reveal delay={260}>
          <p className="mt-8 rounded-[var(--radius)] border border-[var(--accent-3)]/40 bg-[var(--accent-3)]/10 px-4 py-3 font-mono text-xs text-[var(--text-dim)]">
            couldn&apos;t reach the worker{data.error ? ` (${data.error})` : ""} — showing sample
            data until the next sync
          </p>
        </Reveal>
      ) : null}

      <Reveal delay={300}>
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
        /* Four across on wide screens. Re-keyed on the filter so a changed
           result set replays the entrance stagger instead of snapping. */
        <div
          ref={gridRef}
          key={`${activeTech ?? "all"}:${deferredQuery}`}
          className="project-grid mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {visible.map((project, index) => (
            <ProjectCard key={project.id} project={project} index={index} />
          ))}
        </div>
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
