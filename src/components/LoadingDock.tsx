"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Ferrofluid from "@/components/Ferrofluid";
import Roll, { HoverRoll } from "@/components/Roll";
import { INTRO_DONE, INTRO_REPLAY, SEEN_KEY } from "@/lib/intro";
import { unlockSound, woosh } from "@/lib/sound";

/**
 * The loading dock: a big, theatrical "loading" screen on the first visit of
 * a session, as if something enormous were being shipped in. Nothing here is
 * really loading — the site is already there underneath — and the lines say
 * so, more or less. It ends on one giant button; pressing it sends the button
 * falling into the screen with a woosh and opens the site from that point.
 *
 * Shown by CSS off <html data-intro> (see lib/intro.ts), so it's in the very
 * first paint. This component only runs the sequence and the exit.
 */

const STEPS: { at: number; pct: number; line: string; value: string }[] = [
  { at: 250, pct: 6, line: "waking up the ferrofluid", value: "ok" },
  { at: 650, pct: 19, line: "loading physics, chemistry and maths", value: "all of it" },
  { at: 1050, pct: 31, line: "solving six shell arcs to land at once", value: "6/6" },
  { at: 1450, pct: 48, line: "printing edition 01 of a magazine", value: "1,300 readers" },
  { at: 1850, pct: 63, line: "lining up the background dots", value: "every one" },
  { at: 2250, pct: 77, line: "synthesising every sound from scratch", value: "0 files" },
  { at: 2650, pct: 92, line: "checking it was built by a class 11 student", value: "yes" },
  { at: 3000, pct: 99, line: "nearly there", value: "…" },
  { at: 3700, pct: 100, line: "done. that was nothing, honestly", value: "100%" },
];
const READY_AT = 4100;
const SEGMENTS = 36;
const EXIT_MS = 1300;

type Stage = "loading" | "ready" | "leaving" | "gone";

/** A made-up transfer rate, rolling, for the top bar while it "receives". */
function Throughput() {
  const [rate, setRate] = useState("812.4");

  useEffect(() => {
    let value = 812.4;
    const timer = setInterval(() => {
      value = Math.min(999.9, Math.max(380, value + (Math.random() - 0.45) * 160));
      setRate(value.toFixed(1).padStart(5, "0"));
    }, 220);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="tabular-nums">
      ↓ <Roll text={rate} /> MB/s
    </span>
  );
}

export default function LoadingDock() {
  const [stage, setStage] = useState<Stage>("loading");
  const [step, setStep] = useState(-1);
  const [run, setRun] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const holeRef = useRef<HTMLDivElement>(null);

  // The sequence, from the top — on mount, and again on a replay.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.introReady = "1";
    if (root.dataset.intro !== "on") {
      setStage("gone");
      return;
    }

    setStage("loading");
    setStep(-1);

    const site = document.querySelectorAll<HTMLElement>("header, main, footer");
    site.forEach(el => el.setAttribute("inert", ""));

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = still
      ? [setTimeout(() => (setStep(STEPS.length - 1), setStage("ready")), 50)]
      : [
          ...STEPS.map((entry, index) => setTimeout(() => setStep(index), entry.at)),
          setTimeout(() => setStage("ready"), READY_AT),
        ];

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [run]);

  useEffect(() => {
    const onReplay = () => setRun(current => current + 1);
    window.addEventListener(INTRO_REPLAY, onReplay);
    return () => window.removeEventListener(INTRO_REPLAY, onReplay);
  }, []);

  useEffect(() => {
    if (stage === "ready") buttonRef.current?.focus({ preventScroll: true });
  }, [stage]);

  function go() {
    if (stage === "leaving" || stage === "gone") return;
    unlockSound();
    woosh();

    const root = document.documentElement;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect && holeRef.current) {
      holeRef.current.style.setProperty("--hole-x", `${rect.left + rect.width / 2}px`);
      holeRef.current.style.setProperty("--hole-y", `${rect.top + rect.height / 2}px`);
    }

    setStage("leaving");
    root.dataset.intro = "leaving";

    setTimeout(() => {
      delete root.dataset.intro;
      document.querySelectorAll("header, main, footer").forEach(el => el.removeAttribute("inert"));
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        // Blocked storage: it plays again next load, which is survivable.
      }
      setStage("gone");
      window.dispatchEvent(new Event(INTRO_DONE));
    }, EXIT_MS);
  }

  // Escape skips straight to the exit, once there's something to exit to.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && document.documentElement.dataset.intro === "on") go();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const current = step >= 0 ? STEPS[step] : null;
  const pct = current?.pct ?? 0;
  const filled = Math.round((pct / 100) * SEGMENTS);
  const loading = stage === "loading";
  // The counter is a tank: it fills as things "load", then drains away into
  // the button's liquid once everything has.
  const level = loading ? pct / 100 : 0;
  const digits = (
    <>
      <Roll text={String(pct).padStart(3, "0")} />
      <span className="dock-pct">%</span>
    </>
  );

  return (
    <div
      ref={holeRef}
      role="dialog"
      aria-modal="true"
      aria-label="Loading the site"
      className="loading-dock"
      data-stage={stage}
    >
      <div className="dock-top">
        <span>
          dk<span className="text-accent">_</span> loading dock
        </span>
        <span className="hidden sm:inline">bay 01 · inbound</span>
        <span className="text-accent">{loading ? <Throughput /> : "ready"}</span>
      </div>

      {/* A scan line sweeping the bay while it loads. */}
      <span aria-hidden className="dock-scan" />

      <div className="dock-body">
        <div className="dock-count" aria-live="polite" style={{ "--level": level } as CSSProperties}>
          <span className="sr-only">{pct}% loaded</span>
          <span aria-hidden className="dock-count-empty">
            {digits}
          </span>
          <span aria-hidden className="dock-count-fill">
            {digits}
          </span>
        </div>

        <ol className="dock-log">
          {STEPS.slice(0, step + 1).map((entry, index) => {
            const done = index < step || !loading;
            const next = STEPS[index + 1]?.at ?? READY_AT;
            return (
              <li key={entry.line} className={index === step && loading ? "is-current" : ""}>
                <span className="dock-line">{entry.line}</span>
                <span className="dock-leader" aria-hidden />
                <span className="dock-value">
                  {done ? null : (
                    <span
                      aria-hidden
                      className="dock-meter"
                      style={{ "--meter-ms": `${next - entry.at}ms` } as CSSProperties}
                    />
                  )}
                  <Roll text={done ? entry.value : ""} />
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="dock-bar" aria-hidden>
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <span key={index} className={index < filled ? "is-on" : ""} />
        ))}
      </div>

      <div className="dock-go">
        <p className="dock-go-note">everything&apos;s loaded. probably.</p>
        <div className="dock-go-button">
          <Ferrofluid reach={320} volume={2} pour>
            <button
              ref={buttonRef}
              type="button"
              onClick={go}
              tabIndex={stage === "ready" ? 0 : -1}
              data-cursor-label="go"
              className="btn btn-primary dock-button"
            >
              <HoverRoll text="let's go" /> <span aria-hidden className="nudge">→</span>
            </button>
          </Ferrofluid>
        </div>
      </div>
    </div>
  );
}
