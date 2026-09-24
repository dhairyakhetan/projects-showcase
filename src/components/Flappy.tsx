"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Plain Flappy Bird, drawn in the site's colours. */

const GRAVITY = 1500;
const FLAP = -420;
const SCROLL_SPEED = 152;
const GAP = 168;
const PIPE_WIDTH = 66;
const PIPE_SPACING = 260;
const BIRD_X = 96;
const BIRD_RADIUS = 13;
/** The lip at each pipe's mouth: how far it overhangs and how deep it is. */
const LIP_OVERHANG = 5;
const LIP_HEIGHT = 18;

interface Pipe {
  x: number;
  gapCenter: number;
  scored: boolean;
}

type Phase = "ready" | "playing" | "dead";

export default function Flappy({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [hitPipe, setHitPipe] = useState(false);

  // Read by the rAF loop without re-subscribing, so the effect runs once.
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
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;

    let birdY = 0;
    let velocity = 0;
    let pipes: Pipe[] = [];
    let localScore = 0;
    let frame = 0;
    let last = performance.now();

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
      const margin = GAP / 2 + 42;
      pipes.push({
        x,
        gapCenter: margin + Math.random() * Math.max(1, height - margin * 2),
        scored: false,
      });
    }

    function reset() {
      birdY = height / 2;
      velocity = 0;
      pipes = [];
      localScore = 0;
      setScore(0);
      setHitPipe(false);

      for (let i = 0; i < 4; i++) spawnPipe(width + 140 + i * PIPE_SPACING);
    }

    resize();
    reset();

    function styles() {
      const root = getComputedStyle(document.documentElement);
      return {
        accent: root.getPropertyValue("--accent").trim() || "#c8f55a",
        onAccent: root.getPropertyValue("--on-accent").trim() || "#0b0c0a",
        pipe: root.getPropertyValue("--chip").trim() || "#181a15",
        edge: root.getPropertyValue("--line-strong").trim() || "#3a3e33",
      };
    }

    function drawPipe(pipe: Pipe, theme: ReturnType<typeof styles>) {
      const topHeight = pipe.gapCenter - GAP / 2;
      const bottomY = pipe.gapCenter + GAP / 2;

      ctx!.fillStyle = theme.pipe;
      ctx!.strokeStyle = theme.edge;
      ctx!.lineWidth = 1.5;

      const block = (x: number, y: number, w: number, h: number) => {
        if (h <= 0) return;
        ctx!.fillRect(x, y, w, h);
        ctx!.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
      };

      // Body, then a wider lip at the mouth facing the gap.
      block(pipe.x, 0, PIPE_WIDTH, topHeight - LIP_HEIGHT);
      block(pipe.x - LIP_OVERHANG, topHeight - LIP_HEIGHT, PIPE_WIDTH + LIP_OVERHANG * 2, LIP_HEIGHT);
      block(pipe.x, bottomY + LIP_HEIGHT, PIPE_WIDTH, height - bottomY - LIP_HEIGHT);
      block(pipe.x - LIP_OVERHANG, bottomY, PIPE_WIDTH + LIP_OVERHANG * 2, LIP_HEIGHT);
    }

    function die(byPipe: boolean) {
      setPhaseBoth("dead");
      setHitPipe(byPipe);

      setBest(previous => {
        const next = Math.max(previous, localScore);
        try {
          localStorage.setItem("flappy-best", String(next));
        } catch {
          // Score just isn't persisted.
        }
        return next;
      });
    }

    function step(now: number) {
      // Clamped so a backgrounded tab can't resume with one step large enough
      // to teleport the bird straight through a pipe.
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
          // The lip overhangs, so it counts toward the hit box.
          const withinX =
            BIRD_X + BIRD_RADIUS > pipe.x - LIP_OVERHANG &&
            BIRD_X - BIRD_RADIUS < pipe.x + PIPE_WIDTH + LIP_OVERHANG;
          const outsideGap =
            birdY - BIRD_RADIUS < pipe.gapCenter - GAP / 2 ||
            birdY + BIRD_RADIUS > pipe.gapCenter + GAP / 2;

          if (withinX && outsideGap) die(true);

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

        if (birdY + BIRD_RADIUS > height) die(false);
      }

      for (const pipe of pipes) drawPipe(pipe, theme);

      ctx!.save();
      ctx!.translate(BIRD_X, Math.max(BIRD_RADIUS, Math.min(height - BIRD_RADIUS, birdY)));
      ctx!.rotate(Math.max(-0.5, Math.min(0.9, velocity / 700)));
      ctx!.fillStyle = theme.accent;
      ctx!.beginPath();
      ctx!.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = theme.onAccent;
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

    // Lives here rather than in a React handler so it can reuse the closure's
    // `reset` without re-creating the loop.
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
  }, [setPhaseBoth]);

  // Bound at window level because the canvas isn't focusable and shouldn't
  // take a place in the tab order.
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
    <div className="relative h-full w-full overflow-hidden border border-line-strong bg-bg shadow-[var(--shadow)]">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointer}
        className="h-full w-full touch-none"
        data-cursor-label={phase === "playing" ? "flap" : "play"}
      />

      <div className="pointer-events-none absolute left-4 top-3 text-xs text-dim">
        <span className="text-accent">{score}</span>
        {best > 0 ? <span className="ml-3 text-faint">best {best}</span> : null}
      </div>

      <button
        type="button"
        onClick={onClose}
        data-cursor-label="quit"
        className="absolute right-3 top-2.5 text-xs text-faint transition-colors hover:text-accent"
      >
        close ✕
      </button>

      {phase !== "playing" ? (
        /* A scrim, not a cover — the pipes you just died on stay visible. */
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center backdrop-blur-[1.5px]">
          <div className="panel flex flex-col items-center gap-3 px-8 py-6">
            {phase === "ready" ? (
              <>
                <p className="font-display text-3xl">
                  flap<span className="italic text-accent">.</span>
                </p>
                <p className="text-xs text-dim">
                  click or press space · esc to leave
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-3xl">
                  hit the <span className="italic text-accent">{hitPipe ? "pipe." : "floor."}</span>
                </p>
                <p className="text-xs text-dim">
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
