"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Project } from "@/lib/repos";

/**
 * One project.
 *
 * Deliberately restrained motion: the card lifts and its border warms on
 * hover, and that's it. No 3D tilt, no cursor-tracked light sweep — with a
 * grid of these on screen, anything more turns the page into noise, and the
 * thumbnail is the thing worth looking at.
 */

function timeAgo(iso: string): string {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;

  if (days < 1) return "today";
  if (days < 30) return `${Math.round(days)}d ago`;
  if (days < 365) return `${Math.round(days / 30.44)}mo ago`;

  const years = Math.round(days / 365.25);
  return `${years}y ago`;
}

export default function ProjectCard({ project, index }: { project: Project; index: number }) {
  // Two chances at a thumbnail: whatever the worker scraped off the live site,
  // then GitHub's generated repo preview. After that, a tech-coloured panel —
  // which is a fine outcome, not a broken one.
  const [src, setSrc] = useState(project.thumbnail);
  const [failed, setFailed] = useState(false);

  const accent = project.tech[0]?.color ?? "var(--accent)";

  function onImageError() {
    if (src !== project.fallbackThumbnail) {
      setSrc(project.fallbackThumbnail);
      return;
    }
    setFailed(true);
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.045, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6 }}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-raised)] transition-[border-color,box-shadow] duration-300 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow)]"
      style={{ ["--card-accent" as string]: accent }}
    >
      {/* Identity stripe — the one place each card's tech colour is loud. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 z-10 h-[2px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
        style={{ background: accent }}
      />

      <div className="relative aspect-[16/9] overflow-hidden border-b border-[var(--border)] bg-[var(--bg-inset)]">
        {failed ? (
          /* Tint from the tech colour, letters from the theme — a light accent
             like JavaScript yellow is invisible as text on a cream card, and a
             dark one like WebGL red is invisible on a black one. */
          <div
            className="flex h-full w-full items-center justify-center font-display text-4xl font-bold text-[var(--text-faint)]"
            style={{ background: `${accent}1f` }}
          >
            {project.name.slice(0, 2).toUpperCase()}
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element --
             og:image URLs resolve to arbitrary third-party hosts that the
             optimizer can't be allowlisted for ahead of time, and a failed
             optimization would lose the two-stage fallback above. */
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={onImageError}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}

        {project.isLive ? (
          <span className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-overlay)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            </span>
            live
          </span>
        ) : null}

        {project.isPinned ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-[var(--accent)] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#06070a]">
            pinned
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="truncate font-display text-base font-bold">{project.title}</h3>
          <span className="shrink-0 font-mono text-[10px] text-[var(--text-faint)]">
            {timeAgo(project.pushedAt)}
          </span>
        </div>

        <p className="line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-[var(--text-dim)]">
          {project.description ?? "No description yet."}
        </p>

        {project.tech.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {project.tech.slice(0, 4).map(tech => (
              /* The tech colour lives in the dot and the border, never in the
                 label. Tech palettes span pure yellow to near-black, so using
                 them as text colour fails contrast in one theme or the other
                 no matter which shade is picked. */
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

        <div className="mt-auto flex items-center gap-2 pt-1">
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor-label="code"
            className="flex-1 rounded-[var(--radius)] border border-[var(--border-strong)] py-2 text-center font-mono text-xs transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            source
          </a>

          {project.homepage ? (
            <a
              href={project.homepage}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor-label="visit"
              className="flex-1 rounded-[var(--radius)] bg-[var(--accent)] py-2 text-center font-mono text-xs font-semibold text-[#06070a] transition-opacity hover:opacity-85"
            >
              visit ↗
            </a>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}
