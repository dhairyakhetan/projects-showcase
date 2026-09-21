/**
 * Stand-in repo data.
 *
 * Used in exactly one situation: the worker fetch in `repos.ts` failed, so the
 * page renders these instead of an error screen and flags itself as degraded.
 * They are never merged with live data and never shown alongside it.
 *
 * They also carry the build's test load, because the sandbox this was written
 * in cannot reach the worker or the GitHub API. So they're deliberately shaped
 * around the cases the classifier has to get right rather than being pretty:
 *
 *   - an Astro site GitHub reports as "HTML"          → must not tag as HTML
 *   - a TypeScript app GitHub reports as "JavaScript" → topics must win
 *   - a repo with no language at all                  → must not render empty
 *   - a repo with no description, no topics, no site  → minimum viable card
 *   - long names and long descriptions                → layout stress
 */

interface FixtureRepo {
  id: number;
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics: string[];
  fork: boolean;
  archived: boolean;
  created_at: string;
  pushed_at: string;
  ogImage: string | null;
}

export const FIXTURE_PROJECTS: FixtureRepo[] = [
  {
    id: 1,
    name: "trophies",
    description: "Every Messi and Ronaldo match, scraped nightly and made browsable.",
    html_url: "https://github.com/dhairyakhetan/trophies",
    homepage: "https://example.com/trophies",
    language: "HTML", // GitHub's guess — the repo is actually Astro
    topics: ["astro", "typescript", "tailwindcss"],
    fork: false,
    archived: false,
    created_at: "2024-03-11T09:00:00Z",
    pushed_at: "2025-08-02T18:24:00Z",
    ogImage: null,
  },
  {
    id: 2,
    name: "hosting-opengraphs",
    description: "Resolves and caches og:image for any URL you throw at it.",
    html_url: "https://github.com/dhairyakhetan/hosting-opengraphs",
    homepage: "https://example.com/og",
    language: "JavaScript", // one config file outweighed the whole src/ tree
    topics: ["typescript", "cloudflare-workers", "api"],
    fork: false,
    archived: false,
    created_at: "2024-11-02T12:30:00Z",
    pushed_at: "2025-09-14T07:12:00Z",
    ogImage: null,
  },
  {
    id: 3,
    name: "flappy-favicon",
    description:
      "A very long description on purpose, to make sure a card with three lines of text " +
      "still lines up with the two-line card sitting next to it in the grid.",
    html_url: "https://github.com/dhairyakhetan/flappy-favicon",
    homepage: null,
    language: "JavaScript",
    topics: ["game", "canvas"],
    fork: false,
    archived: false,
    created_at: "2025-01-19T22:05:00Z",
    pushed_at: "2025-06-30T03:41:00Z",
    ogImage: null,
  },
  {
    id: 4,
    name: "jee-question-scraper",
    description: "Pulls past-year papers into structured JSON. Mostly for my own revision.",
    html_url: "https://github.com/dhairyakhetan/jee-question-scraper",
    homepage: null,
    language: "Python",
    topics: ["python", "cli"],
    fork: false,
    archived: false,
    created_at: "2025-02-08T16:45:00Z",
    pushed_at: "2025-07-21T11:03:00Z",
    ogImage: null,
  },
  {
    id: 5,
    name: "dotfiles",
    description: null, // no description — card must still hold its shape
    html_url: "https://github.com/dhairyakhetan/dotfiles",
    homepage: null,
    language: "Shell",
    topics: [],
    fork: false,
    archived: false,
    created_at: "2024-06-01T08:00:00Z",
    pushed_at: "2025-04-17T09:55:00Z",
    ogImage: null,
  },
  {
    id: 6,
    name: "an-experiment-with-an-unreasonably-long-repository-name",
    description: "Name overflow test.",
    html_url: "https://github.com/dhairyakhetan/an-experiment",
    homepage: null,
    language: null, // GitHub reports nothing at all
    topics: [],
    fork: false,
    archived: false,
    created_at: "2025-05-22T14:20:00Z",
    pushed_at: "2025-05-23T14:20:00Z",
    ogImage: null,
  },
  {
    id: 7,
    name: "discord-study-bot",
    description: "Pomodoro timers and streak tracking for a server full of people avoiding work.",
    html_url: "https://github.com/dhairyakhetan/discord-study-bot",
    homepage: null,
    language: "Python",
    topics: ["discord-bot", "python", "bot"],
    fork: false,
    archived: false,
    created_at: "2024-09-14T19:30:00Z",
    pushed_at: "2025-09-01T20:15:00Z",
    ogImage: null,
  },
  {
    id: 8,
    name: "shader-sketches",
    description: "Fragment shaders I wrote while failing to understand fragment shaders.",
    html_url: "https://github.com/dhairyakhetan/shader-sketches",
    homepage: "https://example.com/shaders",
    language: "JavaScript",
    topics: ["webgl", "threejs", "canvas"],
    fork: false,
    archived: false,
    created_at: "2025-03-30T10:10:00Z",
    pushed_at: "2025-08-25T13:47:00Z",
    ogImage: null,
  },
];
