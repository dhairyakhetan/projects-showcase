/**
 * GitHub's `language` is a byte-count guess and it lies constantly: an Astro
 * site reports "HTML", a Next.js app reports "JavaScript" off one config file.
 * Tags are built from three sources instead, most trustworthy first:
 *
 *   1. OVERRIDES — hand-written, always wins
 *   2. GitHub topics — set by hand, so treated as intentional
 *   3. `language` + heuristics — the fallback, and the one that's often wrong
 */

export type TechCategory = "language" | "framework" | "styling" | "platform" | "tool";

export interface Tech {
  slug: string;
  label: string;
  category: TechCategory;
  color: string;
}

/** Anything not in here still renders, just without a colour. */
const REGISTRY: Record<string, Omit<Tech, "slug">> = {
  typescript: { label: "TypeScript", category: "language", color: "#3178C6" },
  javascript: { label: "JavaScript", category: "language", color: "#F7DF1E" },
  python: { label: "Python", category: "language", color: "#3572A5" },
  html: { label: "HTML", category: "language", color: "#E34F26" },
  css: { label: "CSS", category: "styling", color: "#2965F1" },
  java: { label: "Java", category: "language", color: "#B07219" },
  cpp: { label: "C++", category: "language", color: "#F34B7D" },
  c: { label: "C", category: "language", color: "#7C8894" },
  csharp: { label: "C#", category: "language", color: "#178600" },
  go: { label: "Go", category: "language", color: "#00ADD8" },
  rust: { label: "Rust", category: "language", color: "#DEA584" },
  php: { label: "PHP", category: "language", color: "#4F5D95" },
  ruby: { label: "Ruby", category: "language", color: "#CC342D" },
  shell: { label: "Shell", category: "language", color: "#89E051" },
  lua: { label: "Lua", category: "language", color: "#6A6AE0" },
  dart: { label: "Dart", category: "language", color: "#00B4AB" },
  kotlin: { label: "Kotlin", category: "language", color: "#A97BFF" },
  swift: { label: "Swift", category: "language", color: "#F05138" },
  jupyter: { label: "Jupyter", category: "tool", color: "#DA5B0B" },

  react: { label: "React", category: "framework", color: "#61DAFB" },
  nextjs: { label: "Next.js", category: "framework", color: "#A0A0A0" },
  astro: { label: "Astro", category: "framework", color: "#FF5D01" },
  vue: { label: "Vue", category: "framework", color: "#41B883" },
  svelte: { label: "Svelte", category: "framework", color: "#FF3E00" },
  vite: { label: "Vite", category: "tool", color: "#BD34FE" },
  node: { label: "Node.js", category: "platform", color: "#5FA04E" },
  express: { label: "Express", category: "framework", color: "#8D9199" },
  flask: { label: "Flask", category: "framework", color: "#7B8794" },
  django: { label: "Django", category: "framework", color: "#2E9E75" },
  gatsby: { label: "Gatsby", category: "framework", color: "#663399" },

  tailwind: { label: "Tailwind", category: "styling", color: "#38BDF8" },
  sass: { label: "Sass", category: "styling", color: "#CF649A" },

  cloudflare: { label: "Cloudflare", category: "platform", color: "#F6821F" },
  vercel: { label: "Vercel", category: "platform", color: "#8E8E8E" },
  firebase: { label: "Firebase", category: "platform", color: "#FFCA28" },
  supabase: { label: "Supabase", category: "platform", color: "#3ECF8E" },
  discord: { label: "Discord", category: "platform", color: "#5865F2" },

  canvas: { label: "Canvas", category: "tool", color: "#E8A33D" },
  webgl: { label: "WebGL", category: "tool", color: "#E24B4B" },
  threejs: { label: "Three.js", category: "tool", color: "#B0B0B0" },
  api: { label: "API", category: "tool", color: "#8B8FA3" },
  bot: { label: "Bot", category: "tool", color: "#9B8AFB" },
  game: { label: "Game", category: "tool", color: "#EC4899" },
  cli: { label: "CLI", category: "tool", color: "#94A3B8" },
};

/**
 * Keyed by exact repo name, case-insensitive. Listing a repo here REPLACES
 * everything inferred for it — exactly the tags you write, in that order.
 *
 *   "my-astro-site": ["astro", "typescript", "tailwind"],
 */
export const OVERRIDES: Record<string, string[]> = {
  // TODO populate as you spot wrong tags on the live site.
};

/** Topic → slug, covering the spellings people actually use. */
const TOPIC_ALIASES: Record<string, string> = {
  ts: "typescript", typescript: "typescript",
  js: "javascript", javascript: "javascript", vanillajs: "javascript",
  py: "python", python: "python", python3: "python",
  html: "html", html5: "html",
  css: "css", css3: "css",
  "c++": "cpp", cpp: "cpp", cplusplus: "cpp",
  "c#": "csharp", csharp: "csharp", dotnet: "csharp",
  c: "c", golang: "go", go: "go", rust: "rust", java: "java",
  php: "php", ruby: "ruby", shell: "shell", bash: "shell", lua: "lua",
  dart: "dart", kotlin: "kotlin", swift: "swift",

  react: "react", reactjs: "react",
  next: "nextjs", nextjs: "nextjs", "next-js": "nextjs",
  astro: "astro", astrojs: "astro",
  vue: "vue", vuejs: "vue", svelte: "svelte", sveltekit: "svelte",
  vite: "vite", node: "node", nodejs: "node", express: "express",
  flask: "flask", django: "django", gatsby: "gatsby", gatsbyjs: "gatsby",

  tailwind: "tailwind", tailwindcss: "tailwind", sass: "sass", scss: "sass",

  cloudflare: "cloudflare", "cloudflare-workers": "cloudflare", workers: "cloudflare",
  vercel: "vercel", firebase: "firebase", supabase: "supabase",
  discord: "discord", "discord-bot": "discord",

  canvas: "canvas", "canvas-api": "canvas",
  webgl: "webgl", three: "threejs", threejs: "threejs", "three-js": "threejs",
  api: "api", "rest-api": "api",
  bot: "bot", game: "game", gamedev: "game", cli: "cli",
};

const LANGUAGE_MAP: Record<string, string> = {
  TypeScript: "typescript", JavaScript: "javascript", Python: "python",
  HTML: "html", CSS: "css", SCSS: "sass", Sass: "sass",
  Java: "java", "C++": "cpp", C: "c", "C#": "csharp",
  Go: "go", Rust: "rust", PHP: "php", Ruby: "ruby",
  Shell: "shell", Lua: "lua", Dart: "dart", Kotlin: "kotlin", Swift: "swift",
  "Jupyter Notebook": "jupyter", Astro: "astro", Vue: "vue", Svelte: "svelte",
};

function toTech(slug: string): Tech {
  const entry = REGISTRY[slug];
  if (entry) return { slug, ...entry };

  return {
    slug,
    label: slug.replace(/-/g, " "),
    category: "tool",
    color: "#8B8FA3",
  };
}

/** Identity of a project reads first: framework → language → rest. */
const CATEGORY_ORDER: TechCategory[] = ["framework", "language", "styling", "platform", "tool"];

export interface ClassifiableRepo {
  name: string;
  language: string | null;
  topics?: string[];
  homepage?: string | null;
  description?: string | null;
}

export function deriveTech(repo: ClassifiableRepo): Tech[] {
  const override = OVERRIDES[repo.name.toLowerCase()];
  if (override) return override.map(toTech);

  const slugs = new Set<string>();

  for (const topic of repo.topics ?? []) {
    const slug = TOPIC_ALIASES[topic.toLowerCase()];
    if (slug) slugs.add(slug);
  }

  // A topic naming a language beats the byte-count guess outright: a repo
  // tagged `typescript` that GitHub calls "JavaScript" is TypeScript, and
  // showing both puts the wrong answer next to the right one. Likewise a
  // framework topic plus markup — the HTML *is* the Astro output.
  const languageSlug = repo.language ? LANGUAGE_MAP[repo.language] : null;

  const topicsNamedLanguage = [...slugs].some(s => REGISTRY[s]?.category === "language");
  const topicsNamedFramework = [...slugs].some(s => REGISTRY[s]?.category === "framework");
  const isMarkup = languageSlug === "html" || languageSlug === "css";

  const guessIsRedundant = topicsNamedLanguage || (topicsNamedFramework && isMarkup);

  if (languageSlug && !guessIsRedundant) {
    slugs.add(languageSlug);
  }

  // Last resort: a live homepage at least means it's a site.
  if (slugs.size === 0 && repo.homepage) slugs.add("html");

  return [...slugs]
    .map(toTech)
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
        a.label.localeCompare(b.label),
    );
}

/** All distinct tech across a repo set, ordered by frequency. */
export function techIndex(repos: { tech: Tech[] }[]): { tech: Tech; count: number }[] {
  const counts = new Map<string, { tech: Tech; count: number }>();

  for (const repo of repos) {
    for (const tech of repo.tech) {
      const existing = counts.get(tech.slug);
      if (existing) existing.count++;
      else counts.set(tech.slug, { tech, count: 1 });
    }
  }

  return [...counts.values()].sort((a, b) => b.count - a.count || a.tech.label.localeCompare(b.tech.label));
}
