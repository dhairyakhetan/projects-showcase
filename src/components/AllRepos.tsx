"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import ProjectCard from "@/components/ProjectCard";
import { techIndex } from "@/lib/tech";
import type { ProjectsResult } from "@/lib/repos";

/**
 * The full public repo list, fetched only when asked for.
 *
 * Nothing else in the site calls the worker: the curated projects render from
 * content.ts, and so does the ⌘K palette. This component is the single point
 * where a network request for repo data happens, and only after a click.
 */
export default function AllRepos() {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [data, setData] = useState<ProjectsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [activeTech, setActiveTech] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  // Typing stays responsive while the grid below re-lays out.
  const deferredQuery = useDeferredValue(query);

  const load = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const response = await fetch("/api/repos");
      const payload = (await response.json()) as ProjectsResult;

      // A degraded payload is still a payload — it carries fixtures and says
      // so. Only a malformed response counts as a failure.
      if (!Array.isArray(payload?.projects)) throw new Error("unexpected response");

      setData(payload);
      setState("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "request failed");
      setState("error");
    }
  }, []);

  // Move focus to the results once they exist, so the click has an outcome for
  // keyboard and screen-reader users too, not just a visual one.
  useEffect(() => {
    if (state === "ready") headingRef.current?.focus();
  }, [state]);

  /**
   * Feeds --mx/--my to whichever card the pointer is over, driving the radial
   * wash in globals.css. One delegated listener, batched into a single frame:
   * pointermove fires far faster than paint, and writing a custom property per
   * event would thrash style recalculation across every card on screen.
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
  }, [state]);

  const techs = useMemo(() => (data ? techIndex(data.projects) : []), [data]);

  const visible = useMemo(() => {
    if (!data) return [];
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
  }, [data, deferredQuery, activeTech]);

  if (state === "idle" || state === "loading" || state === "error") {
    return (
      <div className="mt-16 border-t border-[var(--border)] pt-10 text-center">
        <p className="mb-5 text-sm text-[var(--text-dim)]">
          That&apos;s the curated set. The rest is public too.
        </p>

        <button
          type="button"
          onClick={load}
          disabled={state === "loading"}
          data-cursor-label={state === "loading" ? "wait" : "load"}
          className="rounded-[var(--radius)] border border-[var(--border-strong)] px-6 py-3 font-mono text-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
        >
          {state === "loading" ? "pulling from github..." : "show all public repos →"}
        </button>

        {state === "error" ? (
          <p className="mt-4 font-mono text-xs text-[var(--accent-3)]">
            couldn&apos;t load that{error ? ` (${error})` : ""} — try again?
          </p>
        ) : (
          <p className="mt-4 font-mono text-[11px] text-[var(--text-faint)]">
            pulled live, only when you ask
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-16 border-t border-[var(--border)] pt-10">
      <div ref={headingRef} tabIndex={-1} className="outline-none">
        <p className="kicker mb-2">everything public</p>
        <h3 className="font-display text-2xl font-bold">
          {data!.projects.length} repositories
        </h3>
      </div>

      {data!.degraded ? (
        <p className="mt-6 rounded-[var(--radius)] border border-[var(--accent-3)]/40 bg-[var(--accent-3)]/10 px-4 py-3 font-mono text-xs text-[var(--text-dim)]">
          couldn&apos;t reach the worker{data!.error ? ` (${data!.error})` : ""} — showing sample
          data until the next sync
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-raised)] px-4 py-2.5 focus-within:border-[var(--accent)]">
          <span className="font-mono text-xs text-[var(--text-faint)]">/</span>
          <input
            ref={searchRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="search repos, tech, descriptions..."
            aria-label="Search repositories"
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
            count={data!.projects.length}
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

      {visible.length === 0 ? (
        <p className="mt-16 text-center font-mono text-sm text-[var(--text-faint)]">
          nothing matches that.
        </p>
      ) : (
        /* Re-keyed on the filter so a changed result set replays the entrance
           stagger instead of snapping. */
        <div
          ref={gridRef}
          key={`${activeTech ?? "all"}:${deferredQuery}`}
          className="project-grid mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
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
      {color ? <span className="h-2 w-2 rounded-full" style={{ background: color }} /> : null}
      {label}
      <span className="text-[var(--text-faint)]">{count}</span>
    </button>
  );
}
