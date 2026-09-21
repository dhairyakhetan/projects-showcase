"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/repos";

/**
 * The easter egg: flappy-bird, where every gap you fly through is one of my
 * projects and crashing tells you which one you hit (with a link to it).
 *
 * Kept behind a deliberate open so it never interrupts someone who just wants
 * to read the page. It runs on the same canvas-2D budget as everything else.
 *
 * Icons: a project with a live site gets its favicon fetched through a public
 * icon service; anything without one — or any fetch that fails — falls back to
 * a letter tile in that project's own tech colour. The fallback is the common
 * case, not an error path, so it's drawn to look intentional.
 */

const GRAVITY = 1500;
const FLAP = -420;
const SCROLL_SPEED = 152;
const GAP = 168;
const PIPE_WIDTH = 66;
const PIPE_SPACING = 260;
const BIRD_X = 96;
const BIRD_RADIUS = 13;

interface Pipe {
  x: number;
  gapCenter: number;
  project: Project;
  scored: boolean;
}

type Phase = "ready" | "playing" | "dead";

function iconUrlFor(project: Project): string | null {
  if (!project.homepage) return null;
  try {
    const { hostname } = new URL(project.homepage);
    return `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
  } catch {
    return null;
  }
}

export default function FlappyProjects({
  projects,
  onClose,
}: {
  projects: Project[];
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [hit, setHit] = useState<Project | null>(null);

  // The loop reads these without re-subscribing, so they live in refs and the
  // effect below runs exactly once.
  const phaseRef = useRef<Phase>("ready");
  const flapRef = useRef(false);

  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const flap = useCallback(() => {
    if (phaseRef.current === "ready") setPhaseBoth("playing");
    if (phaseRef.current === "dead") return;
    flapRef.current = true;
  }, [setPhaseBoth]);

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem("flappy-best") ?? 0));
    } catch {
      // No storage, no high score. The game still plays.
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || projects.length === 0) return;

    let width = 0;
    let height = 0;

    let birdY = 0;
    let velocity = 0;
    let pipes: Pipe[] = [];
    let nextProject = 0;
    let localScore = 0;
    let frame = 0;
    let last = performance.now();

    const icons = new Map<number, HTMLImageElement>();

    for (const project of projects) {
      const url = iconUrlFor(project);
      if (!url) continue;

      const image = new Image();
      image.crossOrigin = "anonymous";
      // Only registered once it has actually decoded — a broken icon then
      // simply never appears and the letter tile is drawn instead.
      image.onload = () => icons.set(project.id, image);
      image.src = url;
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      width = rect.width;
      height = rect.height;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawnPipe(x: number) {
      const project = projects[nextProject % projects.length];
      nextProject++;

      const margin = GAP / 2 + 42;
      pipes.push({
        x,
        gapCenter: margin + Math.random() * Math.max(1, height - margin * 2),
        project,
        scored: false,
      });
    }

    function reset() {
      birdY = height / 2;
      velocity = 0;
      pipes = [];
      nextProject = 0;
      localScore = 0;
      setScore(0);
      setHit(null);

      for (let i = 0; i < 4; i++) spawnPipe(width + 140 + i * PIPE_SPACING);
    }

    resize();
    reset();

    function styles() {
      const root = getComputedStyle(document.documentElement);
      return {
        accent: root.getPropertyValue("--accent").trim() || "#4ade80",
        ink: root.getPropertyValue("--text").trim() || "#e4e9f1",
        dim: root.getPropertyValue("--text-faint").trim() || "#565e6e",
        edge: root.getPropertyValue("--border-strong").trim() || "#2b3342",
      };
    }

    function drawPipe(pipe: Pipe, theme: ReturnType<typeof styles>) {
      const topHeight = pipe.gapCenter - GAP / 2;
      const bottomY = pipe.gapCenter + GAP / 2;
      const color = pipe.project.tech[0]?.color ?? theme.accent;

      ctx!.fillStyle = `${color}26`;
      ctx!.strokeStyle = color;
      ctx!.lineWidth = 1.5;

      for (const [y, h] of [
        [0, topHeight],
        [bottomY, height - bottomY],
      ] as const) {
        if (h <= 0) continue;
        ctx!.beginPath();
        ctx!.roundRect(pipe.x, y, PIPE_WIDTH, h, 7);
        ctx!.fill();
        ctx!.stroke();
      }

      // Identity marker sits in the gap, so you read the project name exactly
      // when you're threading through it.
      const icon = icons.get(pipe.project.id);
      const cx = pipe.x + PIPE_WIDTH / 2;

      if (icon) {
        ctx!.drawImage(icon, cx - 14, pipe.gapCenter - 14, 28, 28);
      } else {
        ctx!.fillStyle = color;
        ctx!.beginPath();
        ctx!.roundRect(cx - 15, pipe.gapCenter - 15, 30, 30, 8);
        ctx!.fill();

        ctx!.fillStyle = "#04060a";
        ctx!.font = "700 16px var(--font-jetbrains-mono), monospace";
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.fillText(pipe.project.name[0].toUpperCase(), cx, pipe.gapCenter + 1);
      }

      ctx!.fillStyle = theme.dim;
      ctx!.font = "500 10px var(--font-jetbrains-mono), monospace";
      ctx!.textAlign = "center";
      ctx!.textBaseline = "top";
      ctx!.fillText(pipe.project.name.slice(0, 18), cx, pipe.gapCenter + 22);
    }

    function die(project: Project | null) {
      setPhaseBoth("dead");
      setHit(project);

      setBest(previous => {
        const next = Math.max(previous, localScore);
        try {
          localStorage.setItem("flappy-best", String(next));
        } catch {
          // Score just isn't persisted. Nothing to recover from.
        }
        return next;
      });
    }

    function step(now: number) {
      // Clamped so a backgrounded tab doesn't resume with one enormous step
      // that teleports the bird through a pipe.
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;

      const theme = styles();
      ctx!.clearRect(0, 0, width, height);

      if (flapRef.current) {
        velocity = FLAP;
        flapRef.current = false;
      }

      if (phaseRef.current === "playing") {
        velocity += GRAVITY * dt;
        birdY += velocity * dt;

        for (const pipe of pipes) pipe.x -= SCROLL_SPEED * dt;

        if (pipes.length && pipes[0].x + PIPE_WIDTH < -40) {
          pipes.shift();
          spawnPipe((pipes.at(-1)?.x ?? width) + PIPE_SPACING);
        }

        for (const pipe of pipes) {
          const withinX = BIRD_X + BIRD_RADIUS > pipe.x && BIRD_X - BIRD_RADIUS < pipe.x + PIPE_WIDTH;
          const outsideGap =
            birdY - BIRD_RADIUS < pipe.gapCenter - GAP / 2 ||
            birdY + BIRD_RADIUS > pipe.gapCenter + GAP / 2;

          if (withinX && outsideGap) die(pipe.project);

          if (!pipe.scored && pipe.x + PIPE_WIDTH < BIRD_X - BIRD_RADIUS) {
            pipe.scored = true;
            localScore++;
            setScore(localScore);
          }
        }

        // The floor is lethal; the ceiling is a wall. Killing on the ceiling
        // punishes the exact panic-flapping a new player does in their first
        // few seconds, so it just clamps and bleeds off upward velocity.
        if (birdY - BIRD_RADIUS < 0) {
          birdY = BIRD_RADIUS;
          velocity = Math.max(velocity, 0);
        }

        if (birdY + BIRD_RADIUS > height) die(null);
      }

      for (const pipe of pipes) drawPipe(pipe, theme);

      ctx!.save();
      ctx!.translate(BIRD_X, Math.max(BIRD_RADIUS, Math.min(height - BIRD_RADIUS, birdY)));
      ctx!.rotate(Math.max(-0.5, Math.min(0.9, velocity / 700)));
      ctx!.fillStyle = theme.accent;
      ctx!.beginPath();
      ctx!.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = "#04060a";
      ctx!.beginPath();
      ctx!.arc(5, -4, 2.4, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.restore();

      ctx!.strokeStyle = theme.edge;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(0, height - 0.5);
      ctx!.lineTo(width, height - 0.5);
      ctx!.stroke();

      frame = requestAnimationFrame(step);
    }

    frame = requestAnimationFrame(step);

    function onResize() {
      resize();
      if (phaseRef.current !== "playing") reset();
    }

    // Restarting is handled here rather than in a React handler so it can reuse
    // the closure's `reset` without re-creating the whole loop.
    function onRestart() {
      reset();
      setPhaseBoth("ready");
    }

    canvas.addEventListener("flappy:restart", onRestart);
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("flappy:restart", onRestart);
      window.removeEventListener("resize", onResize);
    };
  }, [projects, setPhaseBoth]);

  // Keyboard: space/up to flap, Escape to leave. Bound at window level because
  // the canvas itself isn't focusable and shouldn't steal the tab order.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === " " || event.key === "ArrowUp") {
        event.preventDefault();
        if (phaseRef.current === "dead") {
          canvasRef.current?.dispatchEvent(new Event("flappy:restart"));
          return;
        }
        flap();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap, onClose]);

  function onPointer() {
    if (phase === "dead") {
      canvasRef.current?.dispatchEvent(new Event("flappy:restart"));
      return;
    }
    flap();
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-inset)]">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointer}
        className="h-full w-full touch-none"
        data-cursor-label={phase === "playing" ? "flap" : "play"}
      />

      <div className="pointer-events-none absolute left-4 top-3 font-mono text-xs text-[var(--text-dim)]">
        <span className="text-[var(--accent)]">{score}</span>
        {best > 0 ? <span className="ml-3 text-[var(--text-faint)]">best {best}</span> : null}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-2.5 font-mono text-xs text-[var(--text-faint)] transition-colors hover:text-[var(--accent)]"
      >
        close ✕
      </button>

      {phase !== "playing" ? (
        /* A light scrim rather than a solid cover: the board stays visible
           behind the message, so the pipes you just died on are still there
           to look at. The text sits on its own panel to stay readable. */
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center backdrop-blur-[1.5px]">
          <div className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--bg-overlay)] px-8 py-6 backdrop-blur-md">
            {phase === "ready" ? (
              <>
                <p className="font-display text-xl font-bold">fly through my projects</p>
                <p className="font-mono text-xs text-[var(--text-dim)]">
                  click or press space · esc to leave
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-xl font-bold">
                  {hit ? "crashed into" : "hit the floor"}
                </p>
                {hit ? (
                  <a
                    href={hit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pointer-events-auto font-mono text-sm text-[var(--accent)] underline underline-offset-4"
                  >
                    {hit.name}
                  </a>
                ) : null}
                <p className="font-mono text-xs text-[var(--text-dim)]">
                  scored {score} · space or click to retry
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
