"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import ArrowUpRight from "@/components/ArrowUpRight";
import Variant from "@/components/Variant";
import type { Project } from "@/lib/repos";

/**
 * One project, built for a four-across grid — so the card is compact and the
 * actions only take space while they're wanted.
 *
 * Motion lives in CSS (see .project-card in globals.css): lift, pointer-tracked
 * wash, sibling dim, thumbnail push-in, actions rising. Nothing here starts an
 * element hidden in a way that a stalled animation could make permanent.
 */

/** "#3178C6" → "49 120 198", for rgb(... / alpha) in the hover styles. */
function toRgbChannels(hex: string): string {
  const value = parseInt(hex.replace("#", ""), 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

function timeAgo(iso: string): string {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;

  if (days < 1) return "today";
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30.44)}mo`;
  return `${Math.round(days / 365.25)}y`;
}

export default function ProjectCard({ project, index }: { project: Project; index: number }) {
  // Two chances: the worker's scraped og:image, then GitHub's repo preview.
  const [src, setSrc] = useState(project.thumbnail);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const accent = project.tech[0]?.color ?? "#8B8FA3";

  // A thumbnail that 404s does so while the server HTML parses, before React
  // attaches onError — so the miss is also caught on mount.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth === 0) handleError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleError() {
    setSrc(current => {
      if (current !== project.fallbackThumbnail) return project.fallbackThumbnail;
      setFailed(true);
      return current;
    });
  }

  const style = {
    "--reveal-delay": `${Math.min(index, 11) * 40}ms`,
    "--card-rgb": toRgbChannels(accent),
  } as CSSProperties;

  return (
    <div className="reveal" style={style}>
      <article
        data-card
        className="project-card group relative flex h-full flex-col overflow-hidden border border-line bg-panel"
      >
        <div className="relative aspect-[16/10] overflow-hidden border-b border-line bg-chip">
          {failed ? (
            <div
              className="flex h-full w-full items-center justify-center font-display text-4xl text-faint"
              style={{ background: `${accent}1f` }}
            >
              {project.title.slice(0, 2)}
            </div>
          ) : (
            /* Plain <img>, not next/image: og:image URLs resolve to arbitrary
               third-party hosts the optimizer can't be allowlisted for, and a
               failed optimization would lose the fallback chain above. */
            <img
              ref={imgRef}
              src={src}
              alt=""
              loading="lazy"
              decoding="async"
              onError={handleError}
              className="thumb h-full w-full object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
            />
          )}

          <div className="absolute inset-x-0 top-0 z-[2] flex items-start justify-between gap-2 p-2.5 text-[9px]">
            {project.isPinned ? (
              <span className="bg-accent px-2 py-1 font-bold text-on-accent">pinned</span>
            ) : (
              <span />
            )}

            {project.isLive ? (
              <span className="flex items-center gap-1.5 bg-bg/80 px-2 py-1 text-ink backdrop-blur-sm">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" />
                live
              </span>
            ) : null}
          </div>

          {/* Overlaid so the card stays short at four-across. */}
          <div className="card-actions absolute inset-x-0 bottom-0 z-[2] flex gap-1.5 p-2.5">
            {project.homepage ? (
              <a
                href={project.homepage}
                target="_blank"
                rel="noopener noreferrer"
                data-cursor-label="visit"
                className="flex flex-1 items-center justify-center gap-1 bg-accent py-2 text-[11px] font-bold text-on-accent transition-opacity hover:opacity-85"
              >
                visit <ArrowUpRight className="nudge" />
              </a>
            ) : null}
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor-label="code"
              className="flex-1 border border-line-strong bg-bg/85 py-2 text-center text-[11px] text-ink backdrop-blur-sm transition-colors hover:border-dim"
            >
              <Variant dev="source" plain="code" />
            </a>
          </div>
        </div>

        <div className="relative z-[2] flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-baseline justify-between gap-2 text-[10px] text-dim">
            <span className="truncate">{project.name}</span>
            <span className="shrink-0">{timeAgo(project.pushedAt)}</span>
          </div>

          <h3 className="truncate font-display text-[1.7rem] leading-none">{project.title}</h3>

          <p className="line-clamp-2 min-h-[2.6rem] text-xs leading-[1.75] text-ink-mute">
            {project.description ?? "No description yet."}
          </p>

          {project.tech.length ? (
            <ul className="mt-auto flex flex-wrap gap-1">
              {project.tech.slice(0, 3).map(tech => (
                /* Colour in the dot, never the label — tech palettes run from
                   pure yellow to near-black and fail contrast as text in one
                   theme or the other. */
                <li key={tech.slug} className="tag gap-1.5 px-2 py-1 text-[10px]">
                  <span className="h-1.5 w-1.5" style={{ background: tech.color }} />
                  {tech.label.toLowerCase()}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </article>
    </div>
  );
}
