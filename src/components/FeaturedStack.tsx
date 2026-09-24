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
function Card({ project, index, total }: { project: FeaturedProject; index: number; total: number }) {
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
      <article className="stack-card group relative grid overflow-hidden border border-line bg-panel shadow-[var(--shadow)] md:min-h-[min(30rem,64vh)] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative aspect-[16/10] overflow-hidden border-b border-line bg-chip md:aspect-auto md:border-b-0 md:border-r">
          {failed ? (
            <div
              className="flex h-full w-full items-center justify-center font-display text-7xl text-faint"
              style={{ background: `${accent}1f` }}
            >
              {project.title.slice(0, 2)}
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
              className="stack-media thumb h-full w-full object-cover"
            />
          )}
        </div>

        <div className="stack-body flex flex-col justify-center gap-5 p-6 sm:p-10">
          <div className="flex items-center justify-between gap-4 text-[11px] text-dim">
            <span className="flex items-center gap-2">
              {project.homepage ? <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" /> : null}
              {project.kind}
            </span>
            <span>
              {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
          </div>

          <h3 className="font-display text-[clamp(2.2rem,4.4vw,3rem)] font-normal leading-none tracking-[-0.01em]">
            {project.title}
          </h3>

          <p className="max-w-[46ch] text-[13px] leading-[1.8] text-ink-mute [text-wrap:pretty] sm:text-sm">
            {project.blurb}
          </p>

          {project.tech.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {project.tech.map(tech => (
                /* Colour in the dot, never the label — tech palettes run from
                   pure yellow to near-black and fail contrast as text in one
                   theme or the other. */
                <li key={tech.slug} className="tag gap-2">
                  <span className="h-1.5 w-1.5" style={{ background: tech.color }} />
                  {tech.label.toLowerCase()}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-1">
            {project.homepage ? (
              <a
                href={project.homepage}
                target="_blank"
                rel="noopener noreferrer"
                data-cursor-label="visit"
                className="btn btn-primary h-11 px-5 text-xs"
              >
                visit <ArrowUpRight />
              </a>
            ) : null}
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor-label="code"
              className="btn btn-ghost h-11 px-5 text-xs"
            >
              source
            </a>
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
    <ul ref={rootRef} className="stack mt-12">
      {projects.map((project, index) => (
        <Card key={project.name} project={project} index={index} total={projects.length} />
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
