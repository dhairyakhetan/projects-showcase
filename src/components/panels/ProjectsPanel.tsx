"use client";

import Link from "next/link";
import AllRepos from "@/components/AllRepos";
import FeaturedStack from "@/components/FeaturedStack";
import { Reveal } from "@/components/Reveal";
import Variant from "@/components/Variant";
import { featuredProjects } from "@/lib/featured";

function OpenSlot() {
  return (
    <Link
      href="/contact"
      data-cursor-label="hi"
      className="flex min-h-[240px] flex-col justify-between gap-8 border border-dashed border-line-strong bg-bg/60 p-7 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-dim"
    >
      <span className="text-[11px] text-dim">open slot</span>
      <span className="font-display text-[2.25rem] leading-[1.05]">
        Got an idea?
        <br />
        <span className="italic text-accent">Let&apos;s build it.</span>
      </span>
      <span className="text-xs text-dim">
        <Variant dev="contact.sh" plain="get in touch" /> →
      </span>
    </Link>
  );
}

export default function ProjectsPanel() {
  return (
    <section aria-label="Projects">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-3.5">
          <Reveal>
            <p className="text-xs text-dim">
              <span className="text-accent">04</span> / <Variant dev="projects/" plain="Projects" />
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="font-display text-[clamp(2.9rem,8vw,4.5rem)] font-normal leading-none tracking-[-0.02em]">
              Things I&apos;ve <span className="italic">made.</span>
            </h2>
          </Reveal>
        </div>

        <Reveal delay={140}>
          <p className="max-w-sm text-xs leading-[1.8] text-dim">
            The ones worth your time, with the reasons I built them. Scroll — they stack.
          </p>
        </Reveal>
      </div>

      <FeaturedStack projects={featuredProjects} />

      <AllRepos openSlot={<OpenSlot />} />
    </section>
  );
}
