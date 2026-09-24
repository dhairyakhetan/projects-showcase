import { GITHUB_USERNAME, projects } from "./content";
import { techFromSlugs, type Tech } from "./tech";

/**
 * The curated projects, resolved for rendering.
 *
 * Entirely derived from `content.ts` — no worker, no fetch, no server work.
 * The Projects page, the ⌘K palette and the terminal all render from this,
 * so the site makes no network call for project data until someone clicks
 * through to the full repo list.
 *
 * A project needn't have a public repo: `source` is then null and everything
 * links to the live site instead.
 */
export interface FeaturedProject {
  name: string;
  title: string;
  subtitle: string | null;
  kind: string;
  blurb: string;
  outcome: string | null;
  tech: Tech[];
  source: string | null;
  homepage: string | null;
  /** Where a click on the project goes: the live site if there is one, else the repo. */
  link: string;
  /** Null means no picture to show — the card draws a typographic cover. */
  thumbnail: string | null;
}

export const featuredProjects: FeaturedProject[] = projects.featured.map(entry => {
  const source = entry.repo ? `https://github.com/${GITHUB_USERNAME}/${entry.repo}` : null;

  return {
    name: entry.name,
    title: entry.title,
    subtitle: entry.subtitle ?? null,
    kind: entry.kind,
    blurb: entry.blurb,
    outcome: entry.outcome ?? null,
    tech: techFromSlugs(entry.tech),
    source,
    homepage: entry.homepage,
    link: entry.homepage ?? source ?? `https://github.com/${GITHUB_USERNAME}`,
    thumbnail:
      entry.image ??
      (entry.repo ? `https://opengraph.githubassets.com/1/${GITHUB_USERNAME}/${entry.repo}` : null),
  };
});
