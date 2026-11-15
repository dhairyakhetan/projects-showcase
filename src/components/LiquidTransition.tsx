"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { panels } from "@/lib/content";
import { introShowing } from "@/lib/intro";
import { slosh } from "@/lib/sound";

/**
 * Page changes as a flood of black ferrofluid: a click on a link to another
 * page sends a wave up over the screen (spiking as it rises, the way the
 * fluid stands up when it moves), the route changes underneath it, and the
 * wave carries on up and off, dripping, to show the new page.
 *
 * It intercepts only plain left-clicks on links to one of the five pages;
 * anything else — new-tab clicks, outside links, the back button — behaves
 * normally. Off entirely under reduced motion.
 */

const COVER = 430;
const DRAIN = 620;
const HOLD_LIMIT = 2500;
const PAGES = new Set(panels.map(panel => `/${panel.id}`));

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};
const tri = (x: number) => 1 - Math.abs(2 * (x - Math.floor(x)) - 1);

type Phase = "idle" | "cover" | "hold" | "drain";

export default function LiquidTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const control = useRef<{ arrived: () => void } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let phase: Phase = "idle";
    let phaseStart = 0;
    let arrived = false;
    let raf = 0;
    let seed = 0;
    let width = 0;
    let height = 0;
    let accent = "#c8f55a";

    function size() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width;
      canvas!.height = height;
    }

    function setPhase(next: Phase, now: number) {
      phase = next;
      phaseStart = now;
    }

    /** Where the rising front is, and how spiky: spikes stand up while it moves fast. */
    function leadingEdge(x: number, base: number, spikes: number, time: number) {
      const wave = Math.sin(x * 0.011 + time * 6) * 14 + Math.sin(x * 0.027 - time * 9) * 6;
      const cell = x / 26;
      const spike = Math.pow(tri(cell + 0.5), 3) * (0.35 + 0.65 * hash(Math.floor(cell + 0.5) + seed));
      return base + wave - spike * spikes;
    }

    /** The trailing edge as it leaves: a wavy hem with drips hanging off it. */
    function trailingEdge(x: number, base: number, drip: number, time: number) {
      const wave = Math.sin(x * 0.013 - time * 5) * 10 + Math.sin(x * 0.031 + time * 7) * 4;
      let hang = 0;
      for (let i = 0; i < 7; i++) {
        const dx = (x - hash(i + seed) * width) / (14 + hash(i + seed + 9) * 18);
        hang = Math.max(hang, Math.exp(-dx * dx) * drip * (0.4 + hash(i + seed + 3) * 0.9));
      }
      return base + wave + hang;
    }

    function draw(top: (x: number) => number, bottom: (x: number) => number) {
      ctx!.clearRect(0, 0, width, height);
      const step = 6;

      ctx!.beginPath();
      ctx!.moveTo(0, top(0));
      for (let x = step; x <= width + step; x += step) ctx!.lineTo(x, top(x));
      for (let x = width + step; x >= -step; x -= step) ctx!.lineTo(x, bottom(x));
      ctx!.closePath();
      ctx!.fillStyle = "#050605";
      ctx!.fill();

      // The rim: a glow of the accent where the surface curves away, and a
      // thin white glint just inside it — what makes black read as wet.
      for (const [edge, offset] of [
        [top, 3],
        [bottom, -3],
      ] as const) {
        ctx!.beginPath();
        ctx!.moveTo(0, edge(0) + offset);
        for (let x = step; x <= width + step; x += step) ctx!.lineTo(x, edge(x) + offset);
        ctx!.strokeStyle = accent;
        ctx!.lineWidth = 2;
        ctx!.shadowColor = accent;
        ctx!.shadowBlur = 16;
        ctx!.stroke();
        ctx!.shadowBlur = 0;

        ctx!.beginPath();
        ctx!.moveTo(0, edge(0) + offset * 3.5);
        for (let x = step; x <= width + step; x += step) ctx!.lineTo(x, edge(x) + offset * 3.5);
        ctx!.strokeStyle = "rgba(255,255,255,0.28)";
        ctx!.lineWidth = 1;
        ctx!.stroke();
      }
    }

    function frame(now: number) {
      raf = 0;
      const elapsed = now - phaseStart;
      const time = now / 1000;
      const below = height + 60;
      const above = -90;

      if (phase === "cover") {
        const t = Math.min(1, elapsed / COVER);
        const base = below + (above - below) * easeInOut(t);
        const speed = Math.sin(Math.PI * t);
        draw(
          x => leadingEdge(x, base, 12 + 46 * speed, time),
          () => below,
        );
        if (t >= 1) setPhase(arrived ? "drain" : "hold", now);
      } else if (phase === "hold") {
        draw(
          x => leadingEdge(x, above, 10, time),
          () => below,
        );
        if (arrived || elapsed > HOLD_LIMIT) setPhase("drain", now);
      } else if (phase === "drain") {
        const t = Math.min(1, elapsed / DRAIN);
        const base = below + (above - 180 - below) * easeInOut(t);
        const drip = 30 + 90 * Math.sin(Math.PI * Math.min(1, t * 1.2));
        draw(
          x => leadingEdge(x, above - 200, 0, time),
          x => trailingEdge(x, base, drip, time),
        );
        if (t >= 1) {
          phase = "idle";
          canvas!.style.display = "none";
          return;
        }
      }

      raf = requestAnimationFrame(frame);
    }

    function start(href: string) {
      seed = Math.random() * 100;
      accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || accent;
      arrived = false;
      size();
      canvas!.style.display = "block";
      setPhase("cover", performance.now());
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
      slosh();
      setTimeout(() => router.push(href), COVER * 0.85);
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || !PAGES.has(url.pathname)) return;
      if (url.pathname === window.location.pathname || phase !== "idle" || introShowing()) return;

      event.preventDefault();
      start(url.pathname + url.search + url.hash);
    }

    control.current = {
      arrived: () => {
        arrived = true;
      },
    };

    window.addEventListener("click", onClick, true);
    window.addEventListener("resize", size);
    return () => {
      control.current = null;
      cancelAnimationFrame(raf);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("resize", size);
    };
  }, [router]);

  useEffect(() => {
    control.current?.arrived();
  }, [pathname]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[90] hidden h-full w-full"
    />
  );
}
