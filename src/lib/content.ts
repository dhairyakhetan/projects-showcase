/**
 * Every piece of personal content on the site lives here.
 *
 * Nothing else in the codebase hardcodes a name, a link, a date or a sentence
 * about you — components read from this file. Edit here, the whole site updates.
 *
 * ⚠️  Anything marked `// TODO` is a guess or a gap waiting on the real thing.
 * Search this file for "TODO" to find them all.
 */

export const GITHUB_USERNAME = "dhairyakhetan";

/** The production address — link previews, the sitemap and robots.txt build on it. */
export const SITE_URL = "https://dhairyakhetan.vercel.app";

/** Used by the featured card and the About page, so a move is one edit. */
const TERRANOTES_URL = "https://terranotes-aq.vercel.app";

export const identity = {
  name: "Dhairya Khetan",
  handle: "dhairyakhetan",
  /** <title> and link previews. */
  tagline: "Class 11, preparing for JEE, building things in between",
  blurb:
    "Class 11 student in India, preparing for JEE. I learn to code the fun way — by " +
    "building things in my free time and putting them on the internet.",
} as const;

export const home = {
  greeting: "hello, world — i'm",
  /** Typed out after "I build", one at a time. */
  typed: [
    "websites",
    "side projects",
    "things between mock tests",
    "stuff I want to exist",
    "my place on the internet",
  ],
} as const;

/** The project I'm proudest of — also the one featured on the Projects page. */
export const favourite = {
  name: "terranotes",
  title: "TerraNotes",
  url: TERRANOTES_URL,
} as const;

export const about = {
  /** Two lines; the second is set in the accent italic. */
  heading: ["A student first.", "A programmer", "every other hour."],

  modes: {
    jee:
      "I'm in Class 11 with Physics, Chemistry and Maths, and most of my day belongs to JEE " +
      "prep — problem sets, mock tests and the occasional long argument with rotational " +
      "mechanics. It teaches me the thing coding needs most: sitting with a hard problem " +
      "until it gives in.",
    code:
      "When the books close, the editor opens. I don't have a stack of official projects " +
      "yet — I learn by building small sites and experiments, breaking them, and fixing " +
      "them. The one I'm proudest of is TerraNotes, the online magazine of a Kolkata NGO, " +
      "where I'm the tech lead and built the site end to end.",
  },

  /** Any file in `public/`. Missing means initials, not a broken image. */
  portrait: "/me.webp",
  portraitAlt: "Dhairya Khetan",

  /** The `dhairya.js` object on the About page. */
  facts: {
    based: "India",
    grade: 11,
    preparingFor: "JEE",
    writes: ["HTML", "Python"],
    learning: ["C++", "JavaScript"],
    status: "figuring it out",
  },
} as const;

export interface QualificationEntry {
  year: string;
  title: string;
  status: string;
  detail: string;
  tags: string[];
}

export const qualification = {
  /** Newest first. The first entry is open when the page loads. */
  entries: [
    {
      year: "2028 · upcoming",
      title: "JEE Main & Advanced",
      status: "in prep",
      detail:
        "The main quest. Physics, Chemistry and Maths, every single day — mock tests, " +
        "error logs, repeat.", // TODO add the target college / branch if you want it public
      tags: ["physics", "chemistry", "maths"],
    },
    {
      year: "2026 — now",
      title: "Class 11 · PCM",
      status: "ongoing",
      detail:
        "Science stream with Physics, Chemistry and Maths, running alongside JEE " +
        "preparation.", // TODO school name and board
      tags: ["science stream", "pcm"],
    },
    {
      year: "2026 — now",
      title: "TerraNotes · tech lead",
      status: "live",
      detail:
        "Tech lead for the online magazine of Aquaterra, a Kolkata NGO with more than 1,300 " +
        "members. I built the site end to end — concept, design system and code — and " +
        "Edition 01 went live in September 2026.",
      tags: ["tech lead", "design system", "react"],
    },
    {
      year: "always · self-taught",
      title: "Programming",
      status: "learning",
      detail:
        "No course certificate here — just docs, videos and breaking things until they " +
        "work. I learn by shipping sites, and TerraNotes is the proof.",
      tags: ["html", "python", "c++ · learning", "javascript · learning"],
    },
    {
      year: "2026",
      title: "Class 10",
      status: "completed",
      detail: "Board exams, done. Next stop: the science stream.", // TODO school, board, score
      tags: ["boards"],
    },
  ] as QualificationEntry[],
} as const;

export const contact = {
  intro:
    "Want to build something together, have feedback on a project, or just want to say " +
    "hi? I reply after homework — usually.",
  email: "dhairyaplayz97@proton.me", // TODO confirm this is the address you want public

  /**
   * `note` says what the platform is FOR — never the handle. On a page with my
   * name at the top, printing "@dhairyakhetan" four times says nothing.
   */
  links: [
    {
      label: "github",
      note: "everything on this site comes from here",
      href: "https://github.com/dhairyakhetan",
    },
    {
      label: "linkedin",
      note: "the one with a collar on",
      href: "https://www.linkedin.com/in/dhairya-khetan-aa6392364/",
    },
    {
      label: "leetcode",
      note: "very much a beginner, not hiding it",
      href: "https://leetcode.com/u/anWtedW7Hw/",
    },
    {
      label: "instagram",
      note: "proof I occasionally leave the editor",
      href: "https://instagram.com/dhairyakhetan",
    },
  ],
} as const;

export const projects = {
  /**
   * Hand-picked, hand-written, and rendered without touching the worker — the
   * Projects page makes no network call until someone asks for the full list.
   *
   * `name` must match the GitHub repo exactly: it builds the source link and,
   * when `image` is null, the thumbnail (GitHub's own repo preview, which is a
   * plain image URL and costs no API call).
   *
   * `tech` are slugs from src/lib/tech.ts — an unknown slug still renders, just
   * without a colour.
   */
  featured: [
    {
      name: "terranotes",
      title: "TerraNotes",
      /** Shown under the title on the card. */
      subtitle: "A digital magazine for Aquaterra",
      kind: "tech lead · 2026",
      blurb:
        "The monthly online magazine of Aquaterra, a Kolkata NGO with more than 1,300 " +
        "members, run by its Digital Magazine department. I led the tech side and built " +
        "the site end to end — the concept, the design system and every line of code. The " +
        "idea was to make reading feel like walking past a corkboard, not scrolling a blog.",
      outcome:
        "Edition 01 went live in September 2026 with six pieces from the writing team " +
        "and profiles for 18 team members.",
      tech: ["react", "vite", "canvas"],
      /** No public repo — the card links to the live site only. */
      repo: null as string | null,
      homepage: TERRANOTES_URL as string | null,
      image: "/terranotes.webp" as string | null,
      /**
       * Set for a finished image (a mockup, a screenshot): it's shown whole, in
       * full colour, on this background, instead of cropped and muted like
       * GitHub's preview cards. Match it to the image's own edges.
       */
      imageBackground: "#f4ede1" as string | null,
    },
    {
      name: "japan2026",
      title: "Japan 2026",
      subtitle: "A day-by-day planner for a family trip",
      kind: "personal · 2026",
      blurb:
        "Our family trip to Tokyo, Kyoto and Osaka arrived as a travel agent's PDFs. I " +
        "turned them into something we can actually use on the road: every day has its " +
        "own page with the schedule, where we're sleeping and vegetarian food within " +
        "walking distance. On a laptop it's a timeline you flip through; on a phone it's " +
        "one list that opens on today.",
      outcome:
        "Building it caught two mistakes in the agent's itinerary — a transfer to the " +
        "wrong airport and a night count that didn't add up — before we flew.",
      tech: ["react", "typescript", "tailwind"],
      repo: null as string | null,
      /** Lives on this site — see src/app/(japan). */
      homepage: "/Japan2026" as string | null,
      image: "/japan2026.webp" as string | null,
      imageBackground: "#f6f7f5" as string | null,
    },
  ],

  /** Never shown in the full list either, by exact repo name. */
  exclude: ["projects-showcase", "Wisdom-Woods"] as string[], // TODO add any others

  /**
   * The older repos, written out by hand and pinned first in the full list,
   * in this order. When the worker can't be reached these are the list — real
   * work, just not all of it — and the terminal's `open` knows them too.
   * `name` must match the GitHub repo exactly.
   */
  older: [
    {
      name: "shoppy",
      description: "A storefront for my mum's Tanjore art.",
      homepage: null, // TODO live URL
    },
    {
      name: "omrakhi",
      description: "The site for my dad's business, Om Rakhi Udyog. Still a work in progress.",
      homepage: "https://omrakhi.vercel.app",
    },
    {
      name: "GOAT-GPT",
      description: "An AI that answers Messi and Ronaldo questions from their actual stats.",
      homepage: null,
    },
    {
      name: "mcu-watchlist",
      description: "Every Marvel release since Phase 1, in release or chronological order.",
      homepage: null, // TODO live URL
    },
  ] as { name: string; description: string; homepage: string | null }[],
} as const;

/**
 * Order drives the tabs, the ⌘K palette and the terminal's `ls`.
 * `description` is what search results and link previews show for the page.
 */
export const panels = [
  { id: "home", label: "Home", file: "home.js", description: identity.blurb },
  {
    id: "about",
    label: "About",
    file: "about.md",
    description:
      "A student first, a programmer every other hour. Class 11 in India, preparing for JEE. " +
      "I know HTML and Python, and I'm learning C++ and JavaScript.",
  },
  {
    id: "qualification",
    label: "Qualification",
    file: "qualification.json",
    description:
      "Where I'm at: JEE Main & Advanced in 2028, Class 11 with Physics, Chemistry and Maths, " +
      "tech lead at TerraNotes, and programming I taught myself.",
  },
  {
    id: "projects",
    label: "Projects",
    file: "projects/",
    description:
      "Things I've made: TerraNotes, the online magazine of a Kolkata NGO where I'm tech lead, " +
      "a day-by-day planner for a family trip to Japan, and everything else on GitHub.",
  },
  {
    id: "contact",
    label: "Contact",
    file: "contact.sh",
    description:
      "Email, GitHub, LinkedIn, LeetCode and Instagram — or send a quick message. I reply " +
      "after homework, usually.",
  },
] as const;

export type PanelId = (typeof panels)[number]["id"];
