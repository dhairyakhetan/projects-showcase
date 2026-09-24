import { GITHUB_USERNAME, projects } from "./content";
import { techFromSlugs, type Tech } from "./tech";

/**
 * The curated projects, resolved for rendering.
 *
 * Entirely derived from `content.ts` — no worker, no fetch, no server work.
 * That is the point: the Projects panel and the ⌘K palette both render from
 * this, so the site makes no network call for project data until someone
 * clicks through to the full repo list.
 *
 * The thumbnail falls back to GitHub's generated repo preview, which is a
 * plain image URL and costs no API call.
 */
export interface FeaturedProject {
  name: string;
  title: string;
  kind: string;
  blurb: string;
  tech: Tech[];
  url: string;
  homepage: string | null;
  thumbnail: string;
}

export const featuredProjects: FeaturedProject[] = projects.featured.map(entry => ({
  name: entry.name,
  title: entry.title,
  kind: entry.kind,
  blurb: entry.blurb,
  tech: techFromSlugs(entry.tech),
  url: `https://github.com/${GITHUB_USERNAME}/${entry.name}`,
  homepage: entry.homepage,
  thumbnail: entry.image ?? `https://opengraph.githubassets.com/1/${GITHUB_USERNAME}/${entry.name}`,
}));
