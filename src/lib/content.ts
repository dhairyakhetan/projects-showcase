/**
 * Every piece of personal content on the site lives here.
 *
 * Nothing else in the codebase hardcodes a name, a link, a date or a sentence
 * about you — components read from this file. Edit here, the whole site updates.
 *
 * ⚠️  PLACEHOLDERS: anything marked `// TODO` is invented filler standing in
 * until the real thing lands. Search this file for "TODO" to find them all.
 */

export const GITHUB_USERNAME = "dhairyakhetan";

export const identity = {
  /** Shown at full size in the hero. Kept short — it gets set very large. */
  name: "Dhairya Khetan", // TODO confirm spelling / preferred display form
  /** Used in <title>, the command palette, and the footer. */
  handle: "dhairyakhetan",
  /** One line under the name. Swap freely — the hero adapts to its length. */
  tagline: "Building things I wasn't asked to build.", // TODO your call
  /** Rotating words the hero cycles through after the tagline. */
  roles: ["self-taught developer", "IIT aspirant", "perpetual tinkerer", "still learning"], // TODO
  /** Two or three sentences. Shown on Home under the tagline. */
  blurb:
    "No degree yet, no job title yet — just a long list of things I got curious about and " +
    "decided to build instead of bookmark. Most of what's here started at 2am as a bad idea " +
    "and somehow shipped.", // TODO
} as const;

export const about = {
  heading: "About",

  /**
   * Any file in `public/`. If it's missing the panel shows initials instead,
   * so a wrong path degrades rather than breaking.
   */
  portrait: "/me.png",
  portraitAlt: "Dhairya Khetan",
  portraitCaption: "somewhere between a mock test and a merge conflict", // TODO

  /** One sentence, set large. This is the line people actually read. */
  lead:
    "I'm seventeen, preparing for an exam that decides a lot, and building things " +
    "at every hour that exam prep leaves over.", // TODO your words

  /** Body copy. Add or remove freely. */
  paragraphs: [
    "None of this is coursework. Every project here started because I wanted the thing to " +
      "exist and nobody was going to build it for me.",
    "I learn by making the whole thing badly first, then rebuilding until it stops " +
      "embarrassing me. This site is on its second life for exactly that reason.",
  ], // TODO replace with your actual words

  /**
   * A snapshot of right now, shown with a live dot. Keep values short — this
   * is the section most worth keeping current.
   */
  now: [
    { label: "preparing for", value: "JEE" },
    { label: "writing", value: "C++ and JavaScript" },
    { label: "based in", value: "India" }, // TODO city if you want it public
    { label: "open to", value: "collabs & freelance" }, // TODO
  ],

  /** Short declarative lines. Opinions, not credentials. */
  principles: [
    "Ship it ugly, then make it good. Nothing gets better in a planning doc.",
    "If I can't explain how it works, I haven't finished building it.",
    "Being early is the only real advantage I have, so I'd rather be wrong loudly than quiet.",
  ], // TODO make these yours — they're the most personal thing on the site
} as const;

export const qualification = {
  heading: "Qualification",
  /**
   * Rendered as a vertical timeline. `ongoing: true` gets a live pulse dot.
   * Order matters — newest first reads best.
   */
  entries: [
    {
      period: "2024 — present", // TODO
      title: "JEE Preparation", // TODO
      org: "Self-study + coaching", // TODO
      detail:
        "Physics, Chemistry and Mathematics at the depth the exam demands. The long game.", // TODO
      ongoing: true,
    },
    {
      period: "2023 — present", // TODO
      title: "Self-taught Web Development", // TODO
      org: "Documentation, failure, and repetition",
      detail:
        "Started with plain HTML and CSS, worked through JavaScript, and now spend most of " +
        "my build time in TypeScript and React. Everything in Projects is the coursework.", // TODO
      ongoing: true,
    },
    {
      period: "TODO", // TODO school / board / class + year
      title: "Higher Secondary",
      org: "TODO — school name",
      detail: "TODO — board, stream, anything worth noting.",
      ongoing: false,
    },
  ],
  /** Honest framing note shown at the end of the timeline. Set to null to hide. */
  footnote:
    "Short list on purpose. The credentials are still in progress — the projects aren't.",
} as const;

export const contact = {
  heading: "Contact",
  intro: "Email is the one I actually check. Everything else, take your chances.",
  email: "dhairyaplayz97@proton.me", // TODO confirm this is the address you want public

  /** Drives the local-time line. Any IANA zone. */
  timezone: "Asia/Kolkata",

  /**
   * `note` says what the platform is FOR — never the handle. On a page with my
   * name at the top, printing "@dhairyakhetan" four times says nothing.
   */
  links: [
    {
      label: "GitHub",
      note: "everything on this site comes from here",
      href: "https://github.com/dhairyakhetan",
    },
    {
      label: "LinkedIn",
      note: "the one with a collar on",
      href: "https://www.linkedin.com/in/dhairya-khetan-aa6392364/",
    },
    {
      label: "LeetCode",
      note: "very much a beginner, and not hiding it",
      href: "https://leetcode.com/u/anWtedW7Hw/",
    },
    {
      label: "Instagram",
      note: "proof I occasionally leave the editor",
      href: "https://instagram.com/dhairyakhetan",
    },
  ],
} as const;

export const projects = {
  heading: "Projects",
  intro:
    "Pulled live from GitHub through my own Cloudflare Worker — no hardcoded list, " +
    "no manual updates. What's here is what's actually on the account.",
  /** Repos never shown, by exact name. */
  exclude: ["projects-showcase", "Wisdom-Woods"] as string[], // TODO add any others
  /** Repos pinned to the front, in this order, regardless of sort. */
  pinned: [] as string[], // TODO name your best work here
} as const;

/** Panel order drives the nav, the ⌘K palette and the keyboard arrows. */
export const panels = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "qualification", label: "Qualification" },
  { id: "projects", label: "Projects" },
  { id: "contact", label: "Contact" },
] as const;

export type PanelId = (typeof panels)[number]["id"];
