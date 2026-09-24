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

/** The project I'm proudest of that isn't mine alone, so it isn't in the repo list. */
export const favourite = {
  name: "terranotes",
  title: "Terranotes",
  url: "https://terranotes-testing.vercel.app",
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
      "them. My favourite so far is Terranotes, a magazine site where I built the mobile " +
      "version alongside a friend.",
  },

  /** Any file in `public/`. Missing means initials, not a broken image. */
  portrait: "/me.png",
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
      year: "always · self-taught",
      title: "Programming",
      status: "learning",
      detail:
        "No course certificate here — just docs, videos and breaking things until they " +
        "work. I learn by shipping small sites, and Terranotes is the proof.",
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
      name: "shoppy",
      title: "Shoppy",
      kind: "family business",
      blurb:
        "An online storefront for my mother's Tanjore art. The first thing I " +
        "built for a real person with real customers instead of for myself, " +
        "which quietly changes what \"finished\" means — nobody files a bug " +
        "report, they just stop being able to buy something.",
      tech: ["javascript"],
      homepage: null as string | null, // TODO the live URL — GitHub has one, I couldn't read it
      image: null as string | null,
    },
    {
      name: "omrakhi",
      title: "Om Rakhi Udyog",
      kind: "family business · wip",
      blurb:
        "The site for my father's business. Still a work in progress and I'm " +
        "not hiding that — it's up because a rough version people can actually " +
        "use beats a polished one that never ships.",
      tech: ["astro"],
      homepage: "https://omrakhi.vercel.app" as string | null,
      image: null as string | null,
    },
    {
      name: "GOAT-GPT",
      title: "GOAT GPT",
      kind: "ai · side project",
      blurb:
        "Settles the Messi–Ronaldo argument with numbers instead of volume. " +
        "Ask it anything about either career and it answers off their actual " +
        "stats, which makes it more useful and significantly less fun than how " +
        "that argument normally goes.",
      tech: ["python"],
      homepage: null as string | null,
      image: null as string | null,
    },
    {
      name: "mcu-watchlist",
      title: "MCU Watchlist",
      kind: "side project",
      blurb:
        "Every Marvel release from Phase 1 onward, in release order or " +
        "chronological order. The two disagree constantly and nobody can ever " +
        "remember which one they're halfway through.",
      tech: ["html"],
      homepage: null as string | null, // TODO the live URL — GitHub has one, I couldn't read it
      image: null as string | null,
    },
  ],

  /** Never shown in the full list either, by exact repo name. */
  exclude: ["projects-showcase", "Wisdom-Woods"] as string[], // TODO add any others

  /** Ordered first in the full list. */
  pinned: [] as string[],
} as const;

/** Order drives the tabs, the ⌘K palette and the terminal's `ls`. */
export const panels = [
  { id: "home", label: "Home", file: "home.js" },
  { id: "about", label: "About", file: "about.md" },
  { id: "qualification", label: "Qualification", file: "qualification.json" },
  { id: "projects", label: "Projects", file: "projects/" },
  { id: "contact", label: "Contact", file: "contact.sh" },
] as const;

export type PanelId = (typeof panels)[number]["id"];
