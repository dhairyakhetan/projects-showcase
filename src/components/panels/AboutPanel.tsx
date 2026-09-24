"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Reveal } from "@/components/Reveal";
import { about, favourite, identity } from "@/lib/content";

type Mode = "jee" | "code";
type File = "dhairya.js" | "me.png";

const str = (value: string) => <span className="text-accent">&quot;{value}&quot;</span>;
const list = (values: readonly string[]) => (
  <>
    [
    {values.map((value, index) => (
      <span key={value}>
        {str(value)}
        {index < values.length - 1 ? ", " : ""}
      </span>
    ))}
    ]
  </>
);

/**
 * The photo, as a file open in the editor. Muted at rest like every image on
 * the site; colour comes back on hover.
 *
 * A missing file means initials, not a broken-image icon. The markup is
 * server-rendered, so a 404 can fire before React attaches onError — the
 * mount check catches that case (a failed image is complete with no width).
 */
function Portrait() {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  return (
    <div className="group flex items-center justify-center p-6 sm:p-8">
      <div className="aspect-[577/636] w-full max-w-[300px] overflow-hidden border border-line bg-chip">
        {failed ? (
          <div className="flex h-full w-full items-center justify-center font-display text-7xl text-faint">
            {identity.name
              .split(" ")
              .map(part => part[0])
              .join("")}
          </div>
        ) : (
          /* Plain <img>: one local file, and next/image would swallow the
             missing-file fallback. */
          <img
            ref={ref}
            src={about.portrait}
            alt={about.portraitAlt}
            onError={() => setFailed(true)}
            className="thumb h-full w-full object-cover"
          />
        )}
      </div>
    </div>
  );
}

function Code({ onOpenPhoto }: { onOpenPhoto: () => void }) {
  const { facts } = about;

  const lines: ReactNode[] = [
    <>
      <span className="text-syn-key">const</span> dhairya = {"{"}
    </>,
    <>  name: {str(identity.name)},</>,
    <>  based: {str(facts.based)},</>,
    <>
      {"  "}grade: <span className="text-syn-num">{facts.grade}</span>,
    </>,
    <>  preparingFor: {str(facts.preparingFor)},</>,
    <>  writes: {list(facts.writes)},</>,
    <>  learning: {list(facts.learning)},</>,
    <>
      {"  "}finest:{" "}
      <a
        href={favourite.url}
        target="_blank"
        rel="noopener noreferrer"
        data-cursor-label="visit"
        className="text-accent underline decoration-1 underline-offset-4"
      >
        &quot;{favourite.name}&quot;
      </a>
      ,
    </>,
    <>
      {"  "}face:{" "}
      <button
        type="button"
        onClick={onOpenPhoto}
        data-cursor-label="view"
        className="text-accent underline decoration-1 underline-offset-4"
      >
        &quot;me.png&quot;
      </button>
      ,
    </>,
    <>  status: {str(facts.status)}</>,
    <>{"};"}</>,
    <span className="text-faint">{"// last updated: always"}</span>,
  ];

  return (
    <div className="overflow-x-auto py-[18px] text-xs leading-[2.4] sm:text-sm sm:leading-[2.05]">
      {lines.map((content, index) => (
        <div key={index} className="grid grid-cols-[44px_minmax(0,1fr)] sm:grid-cols-[56px_minmax(0,1fr)]">
          <span aria-hidden className="select-none pr-[18px] text-right text-xs text-ghost">
            {index + 1}
          </span>
          <span className="whitespace-pre pl-1.5 pr-5">{content}</span>
        </div>
      ))}
    </div>
  );
}

export default function AboutPanel() {
  const [mode, setMode] = useState<Mode>("code");
  const [file, setFile] = useState<File>("dhairya.js");
  const files: File[] = ["dhairya.js", "me.png"];

  return (
    <section
      aria-label="About"
      className="grid min-h-[calc(100svh-var(--header-h)-var(--status-h)-7rem)] items-center gap-14 xl:grid-cols-[minmax(0,1fr)_560px] xl:gap-20"
    >
      <div className="flex flex-col gap-8">
        <Reveal>
          <p className="text-xs text-dim">
            <span className="text-accent">02</span> / about.md
          </p>
        </Reveal>

        <Reveal delay={80}>
          <h2 className="font-display text-[clamp(2.9rem,8.5vw,5rem)] font-normal leading-[0.98] tracking-[-0.02em]">
            {about.heading[0]}
            <br />
            {about.heading[1]} <span className="italic text-accent">{about.heading[2]}</span>
          </h2>
        </Reveal>

        <Reveal delay={160}>
          <div role="group" aria-label="Mode" className="flex w-max border border-line">
            {(["jee", "code"] as const).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                data-cursor-label="switch"
                className={`h-11 px-[22px] text-xs font-medium transition-colors ${
                  mode === value ? "bg-accent text-on-accent" : "text-dim hover:text-ink"
                }`}
              >
                {value}_mode
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={220}>
          {/* Re-keyed so switching modes replays the page-in. */}
          <p
            key={mode}
            className="panel-enter max-w-[580px] text-[15px] leading-[1.85] text-ink-soft [text-wrap:pretty]"
          >
            {about.modes[mode]}
          </p>
        </Reveal>
      </div>

      <Reveal delay={200} y={24}>
        <div className="panel">
          <div className="panel-bar pl-0">
            <div role="tablist" aria-label="Open files" className="flex h-full items-stretch">
              {files.map(name => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={file === name}
                  onClick={() => setFile(name)}
                  data-cursor-label="open"
                  className={`relative border-r border-rule px-[18px] transition-colors ${
                    file === name ? "bg-panel-hi text-ink" : "hover:text-ink"
                  }`}
                >
                  {file === name ? <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-accent" /> : null}
                  {name}
                </button>
              ))}
            </div>
            <span>{file === "me.png" ? "577 × 636" : "readonly"}</span>
          </div>

          <div role="tabpanel" aria-label={file}>
            {file === "dhairya.js" ? (
              <Code onOpenPhoto={() => setFile("me.png")} />
            ) : (
              <div key="photo" className="panel-enter">
                <Portrait />
              </div>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
