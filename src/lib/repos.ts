import { deriveTech, type Tech } from "./tech";
import { projects as projectsContent, GITHUB_USERNAME } from "./content";

/**
 * The worker's CORS allowlist only contains production origins, so the browser
 * can't call it from localhost or a preview deployment — and a server-side
 * fetch sends no Origin at all, which it also rejects. Fetching it here with a
 * matching Origin avoids widening that allowlist, keeps the worker URL off the
 * client, and makes its per-IP rate limit irrelevant since one cache entry
 * serves everyone.
 */
const WORKER_URL = "https://logger.dhairyaplayz97.workers.dev?project=showcase";
/**
 * Must exactly match an entry in the worker's ALLOWED_ORIGINS. The worker
 * compares Origin as a plain string, and a browser never sends a trailing
 * slash — so the allowlist entry must not have one either.
 */
const WORKER_ORIGIN = "https://dhairyakhetan.vercel.app";

/** Matches the worker's own sync interval — refetching faster just returns KV. */
const REVALIDATE_SECONDS = 60 * 60 * 24;

interface WorkerRepo {
  id: number;
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics?: string[];
  fork: boolean;
  archived?: boolean;
  created_at: string;
  pushed_at: string;
  ogImage?: string | null;
}

export interface Project {
  id: number;
  name: string;
  title: string;
  description: string | null;
  url: string;
  homepage: string | null;
  tech: Tech[];
  thumbnail: string;
  fallbackThumbnail: string;
  isLive: boolean;
  isPinned: boolean;
  createdAt: string;
  pushedAt: string;
}

function titleize(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b[a-z]/g, c => c.toUpperCase());
}

function normalize(repo: WorkerRepo): Project {
  const fallbackThumbnail = `https://opengraph.githubassets.com/1/${GITHUB_USERNAME}/${repo.name}`;

  return {
    id: repo.id,
    name: repo.name,
    title: titleize(repo.name),
    description: repo.description,
    url: repo.html_url,
    homepage: repo.homepage || null,
    tech: deriveTech(repo),
    thumbnail: repo.ogImage || fallbackThumbnail,
    fallbackThumbnail,
    isLive: Boolean(repo.homepage),
    isPinned: projectsContent.pinned.includes(repo.name),
    createdAt: repo.created_at,
    pushedAt: repo.pushed_at,
  };
}

const excluded = new Set(projectsContent.exclude.map(n => n.toLowerCase()));

function isShown(repo: WorkerRepo): boolean {
  return !repo.fork && !repo.archived && !excluded.has(repo.name.toLowerCase());
}

function order(a: Project, b: Project): number {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;

  if (a.isPinned && b.isPinned) {
    return projectsContent.pinned.indexOf(a.name) - projectsContent.pinned.indexOf(b.name);
  }

  return new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime();
}

export interface ProjectsResult {
  projects: Project[];
  /** True when the worker couldn't be reached and fixtures are standing in. */
  degraded: boolean;
  error?: string;
  fetchedAt: string;
}

export async function getProjects(): Promise<ProjectsResult> {
  try {
    const response = await fetch(WORKER_URL, {
      headers: {
        Origin: WORKER_ORIGIN,
        "User-Agent": "portfolio-ssr",
      },
      next: { revalidate: REVALIDATE_SECONDS, tags: ["projects"] },
    });

    if (!response.ok) {
      throw new Error(`worker responded ${response.status}`);
    }

    const raw: unknown = await response.json();

    if (!Array.isArray(raw)) {
      throw new Error("worker returned a non-array payload");
    }

    const projects = (raw as WorkerRepo[]).filter(isShown).map(normalize).sort(order);

    return { projects, degraded: false, fetchedAt: new Date().toISOString() };
  } catch (error) {
    const { FIXTURE_PROJECTS } = await import("./fixtures");

    return {
      projects: FIXTURE_PROJECTS.filter(isShown).map(normalize).sort(order),
      degraded: true,
      error: error instanceof Error ? error.message : "unknown error",
      fetchedAt: new Date().toISOString(),
    };
  }
}
