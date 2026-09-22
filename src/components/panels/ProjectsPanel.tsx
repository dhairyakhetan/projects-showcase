"use client";

import AllRepos from "@/components/AllRepos";
import FeaturedStack from "@/components/FeaturedStack";
import { Reveal, RevealWords } from "@/components/Reveal";
import { projects as projectsContent } from "@/lib/content";
import { featuredProjects } from "@/lib/featured";

export default function ProjectsPanel() {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Reveal>
            <p className="kicker mb-3">03 — the work</p>
          </Reveal>

          <h2 className="font-display text-[clamp(2rem,6vw,3.4rem)] font-bold leading-tight">
            <RevealWords text={projectsContent.heading} delay={80} />
          </h2>
        </div>

        <Reveal delay={200}>
          <p className="max-w-sm text-sm leading-relaxed text-[var(--text-dim)]">
            {projectsContent.intro}
          </p>
        </Reveal>
      </div>

      <FeaturedStack projects={featuredProjects} />

      <AllRepos />
    </div>
  );
}
