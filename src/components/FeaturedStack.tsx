"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import ArrowUpRight from "@/components/ArrowUpRight";
import type { FeaturedProject } from "@/lib/featured";

/**
 * The curated projects, as a stack you scroll through.
 *
 * Each card sticks slightly lower than the one before it (see .stack in
 * globals.css), so scrolling slides the next card over the last and leaves a
 * sliver of each previous one visible. The whole effect is position:sticky —
 * no scroll handler — so it stays smooth regardless of how many cards there
 * are or how heavy their images get.
 */
function Card({ project, index }: { project: FeaturedProject; index: number }) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const accent = project.tech[0]?.color ?? "#8B8FA3";

  // A thumbnail that 404s does so while the server HTML parses, before React
  // attaches onError — so the miss is also caught on mount.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  const style = {
    "--stack-index": index,
    "--card-rgb": (() => {
      const value = parseInt(accent.replace("#", ""), 16);
      return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
    })(),
  } as CSSProperties;

  return (
    <li className="stack-item mb-8 last:mb-0" style={style}>
      {/* Tall on purpose. A stacked-scroll card that only fills a third of the
          viewport lets you see the whole stack at once, which leaves almost no
          scroll distance for cards to travel — they never visibly stack. Each
          card owning most of the viewport is what makes the effect read. */}
      <article className="stack-card relative grid overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-raised)] shadow-[var(--shadow)] md:min-h-[min(30rem,64vh)] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative aspect-[16/10] overflow-hidden bg-[var(--bg-inset)] md:aspect-auto">
          {failed ? (
            <div
              className="flex h-full w-full items-center justify-center font-display text-5xl font-bold text-[var(--text-faint)]"
              style={{ background: `${accent}1f` }}
            >
              {project.name.slice(0, 2).toUpperCase()}
            </div>
          ) : (
            /* Plain <img>: GitHub's preview endpoint and any override live on
               hosts the optimizer can't be allowlisted for ahead of time. */
            <img
              ref={imgRef}
              src={project.thumbnail}
              alt=""
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
              onError={() => setFailed(true)}
              className="stack-media h-full w-full object-cover"
            />
          )}

          <span
            aria-hidden
            className="absolute inset-y-0 right-0 hidden w-px bg-[var(--border)] md:block"
          />
        </div>

        <div className="stack-body flex flex-col justify-center gap-4 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-[var(--text-faint)]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span
              aria-hidden
              className="h-px flex-1"
              style={{ background: `${accent}55` }}
            />
            {project.homepage ? (
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                </span>
                live
              </span>
            ) : null}
          </div>

          <h3 className="font-display text-[clamp(1.4rem,3.5vw,2rem)] font-bold leading-tight">
            {project.title}
          </h3>

          <p className="max-w-[46ch] text-[0.95rem] leading-relaxed text-[var(--text-dim)]">
            {project.blurb}
          </p>

          {project.tech.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {project.tech.map(tech => (
                /* Colour in the dot and border, never the label — tech palettes
                   run from pure yellow to near-black and fail contrast as text
                   in one theme or the other whichever shade is picked. */
                <li
                  key={tech.slug}
                  className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] text-[var(--text-dim)]"
                  style={{ borderColor: `${tech.color}55`, background: `${tech.color}12` }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: tech.color }} />
                  {tech.label}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor-label="code"
              className="rounded-[var(--radius)] border border-[var(--border-strong)] px-5 py-2.5 font-mono text-xs transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              source
            </a>

            {project.homepage ? (
              <a
                href={project.homepage}
                target="_blank"
                rel="noopener noreferrer"
                data-cursor-label="visit"
                className="flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--accent)] px-5 py-2.5 font-mono text-xs font-semibold text-[#06070a] transition-opacity hover:opacity-85"
              >
                visit <ArrowUpRight />
              </a>
            ) : null}
          </div>
        </div>
        {/* Fades in as the next card covers this one. */}
        <span aria-hidden className="stack-veil" />
      </article>
    </li>
  );
}

export default function FeaturedStack({ projects }: { projects: FeaturedProject[] }) {
  const rootRef = useRef<HTMLUListElement>(null);

  /**
   * Writes --covered and --parallax onto each card as you scroll.
   *
   * `covered` is how far the *following* card has slid over this one: 0 when
   * its top is still at this card's bottom edge, 1 when it has reached this
   * card's top. CSS maps that onto a scale-down and a veil, so a covered card
   * sinks back instead of just being obscured — without it the stack reads as
   * flat panels swapping places.
   *
   * One listener for the whole stack, rAF-batched: scroll fires far more often
   * than paint, and measuring every card per event would force layout on the
   * scroll thread. Both properties feed transform and opacity only, so the
   * browser composites them.
   */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const items = Array.from(root.querySelectorAll<HTMLElement>(".stack-item"));
    if (items.length === 0) return;

    // Each card's parked offset, read once rather than every frame — a
    // getComputedStyle call per card per scroll event would force a style
    // recalculation on the scroll thread, which is the whole cost this is
    // trying to avoid.
    let restTops: number[] = [];
    function measureRestTops() {
      restTops = items.map(item => parseFloat(getComputedStyle(item).top) || 0);
    }

    let queued = false;

    function update() {
      queued = false;
      const viewport = window.innerHeight;

      const rects = items.map(item => item.getBoundingClientRect());

      items.forEach((item, index) => {
        const rect = rects[index];
        const next = rects[index + 1];

        const covered = next
          ? Math.min(1, Math.max(0, (rect.bottom - next.top) / rect.height))
          : 0;

        // Drift the media against the card's travel across the viewport.
        const offCentre = (rect.top + rect.height / 2 - viewport / 2) / viewport;

        // 0 while the card is still well below its parked position, 1 once it
        // has settled — so the copy rises into place instead of arriving
        // pre-composed.
        const arrived = Math.min(
          1,
          Math.max(0, 1 - (rect.top - restTops[index]) / (viewport * 0.55)),
        );

        item.style.setProperty("--covered", covered.toFixed(3));
        item.style.setProperty("--parallax", `${(offCentre * -20).toFixed(1)}px`);
        item.style.setProperty("--arrived", arrived.toFixed(3));
      });
    }

    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    }

    function onResize() {
      measureRestTops();
      onScroll();
    }

    measureRestTops();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [projects.length]);

  if (projects.length === 0) return null;

  return (
    <ul ref={rootRef} className="stack mt-10">
      {projects.map((project, index) => (
        <Card key={project.name} project={project} index={index} />
      ))}

      {/* A real element, not padding.
          A sticky child is confined to its containing block's CONTENT box, and
          padding-bottom grows only the padding box — so padding on the <ul>
          made the page taller without extending how long the cards could
          stick, and they all unstuck and visibly collapsed together at the same
          scroll position regardless of how much was added. This spacer adds
          content height, which is what actually gives the last card room to
          arrive at its offset and hold there. */}
      <li aria-hidden className="h-[55vh]" />
    </ul>
  );
}
