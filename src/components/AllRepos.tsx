"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ProjectCard from "@/components/ProjectCard";
import Variant from "@/components/Variant";
import { techIndex } from "@/lib/tech";
import type { ProjectsResult } from "@/lib/repos";

/**
 * The full public repo list, fetched only when asked for.
 *
 * Nothing else in the site calls the worker: the curated projects render from
 * content.ts, and so does the ⌘K palette. This component is the single point
 * where a network request for repo data happens, and only after a click.
 */
export default function AllRepos({ openSlot }: { openSlot: ReactNode }) {
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
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <button
          type="button"
          onClick={load}
          disabled={state === "loading"}
          data-cursor-label={state === "loading" ? "wait" : "load"}
          className="panel group flex min-h-[240px] flex-col justify-between gap-8 p-7 text-left transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-line-strong disabled:translate-y-0"
        >
          <span className="text-[11px] text-dim">
            <Variant
              dev={
                <>
                  <span className="text-accent">$</span> ls -a projects/
                </>
              }
              plain="everything else"
            />
          </span>

          <span className="font-display text-[2.25rem] leading-[1.05]">
            That&apos;s the curated set.
            <br />
            <span className="italic text-accent">The rest is public too.</span>
          </span>

          <span className={`text-xs ${state === "error" ? "text-err" : "text-dim"}`}>
            {state === "loading" ? (
              <>
                <Variant dev="pulling from github" plain="loading" />
                <span className="caret">…</span>
              </>
            ) : state === "error" ? (
              <>couldn&apos;t load that{error ? ` (${error})` : ""} — try again →</>
            ) : (
              <Variant
                dev={
                  <>
                    show all public repos → <span className="text-faint">· only fetched when you ask</span>
                  </>
                }
                plain="show every project →"
              />
            )}
          </span>
        </button>

        {openSlot}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div ref={headingRef} tabIndex={-1} className="outline-none">
        <p className="text-xs text-dim">
          <Variant
            dev={
              <>
                <span className="text-accent">$</span> ls -a projects/
              </>
            }
            plain="everything else"
          />
        </p>
        <h3 className="mt-3 font-display text-[2.6rem] leading-none">
          {data!.projects.length}{" "}
          <span className="italic">
            <Variant dev="repositories." plain="projects." />
          </span>
        </h3>
      </div>

      {data!.degraded ? (
        <p className="mt-6 border border-err/40 bg-err/10 px-4 py-3 text-xs text-ink-mute">
          <Variant
            dev={
              <>
                couldn&apos;t reach the worker{data!.error ? ` (${data!.error})` : ""} — showing
                sample data until the next sync
              </>
            }
            plain="Couldn't load the live list just now, so these are examples."
          />
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-4">
        <label className="flex items-center gap-3 border border-line bg-panel px-4 py-3 transition-colors focus-within:border-dim">
          <span className="text-xs text-accent">
            <Variant dev="grep" plain="search" />
          </span>
          <input
            ref={searchRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="search repos, tech, descriptions"
            aria-label="Search repositories"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-faint"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              aria-label="Clear search"
              data-cursor-label="clear"
              className="text-xs text-faint hover:text-accent"
            >
              ✕
            </button>
          ) : null}
        </label>

        <div role="group" aria-label="Filter by tech" className="flex flex-wrap gap-2">
          <FilterChip
            label="all"
            count={data!.projects.length}
            active={activeTech === null}
            onClick={() => setActiveTech(null)}
          />
          {techs.map(({ tech, count }) => (
            <FilterChip
              key={tech.slug}
              label={tech.label.toLowerCase()}
              count={count}
              color={tech.color}
              active={activeTech === tech.slug}
              onClick={() => setActiveTech(activeTech === tech.slug ? null : tech.slug)}
            />
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mt-12 text-sm text-err">
          <Variant dev="grep: nothing matches that." plain="Nothing matches that." />
        </p>
      ) : null}

      {/* Re-keyed on the filter so a changed result set replays the entrance
          stagger instead of snapping. The open slot always ends the grid. */}
      <div
        ref={gridRef}
        key={`${activeTech ?? "all"}:${deferredQuery}`}
        className="project-grid mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {visible.map((project, index) => (
          <ProjectCard key={project.id} project={project} index={index} />
        ))}
        {openSlot}
      </div>
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
      className="chip flex items-center gap-2"
    >
      {color ? <span className="h-1.5 w-1.5" style={{ background: color }} /> : null}
      {label}
      <span className="opacity-60">{count}</span>
    </button>
  );
}
