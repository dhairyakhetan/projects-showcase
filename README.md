# Portfolio

Personal site for [@dhairyakhetan](https://github.com/dhairyakhetan). Next.js App
Router, TypeScript, Tailwind v4, framer-motion. Deployed on Vercel.

Five panels — Home / About / Qualification / Projects / Contact — each a real
route (`/home`, `/about`, …), all statically prerendered.

## Routing

It reads as one page but every panel has a clean URL, because the persistent
chrome and the swapping content live at different levels of the tree:

- `src/app/layout.tsx` renders **Chrome** (background, cursor, nav, palette,
  footer) and never unmounts
- `src/app/[panel]/page.tsx` renders just the active panel, and is the only
  thing that changes on navigation

Chrome has to sit in the **root** layout, not in `[panel]/layout.tsx`. Those
look equivalent but a layout underneath a dynamic segment is remounted whenever
that segment's value changes — which rebuilt the whole background and cursor on
every click. Moving it one level up fixed it.

Navigation is ordinary `next/link`, so prefetching, back/forward and deep links
all work with no custom history handling.

## Animations never hide content

Entrance animations are CSS, not JS. A JS reveal starts an element at
`opacity: 0` and depends on a script reaching the end state; if that animation
is throttled (background tab), interrupted (fast navigation), or never starts,
the element stays invisible forever — a blank page caused by decoration.

Every animated element here is *visible* in its un-animated state; the keyframes
only describe the arrival. Verified against reduced-motion, a tab that loads
while backgrounded, and twelve navigations that each interrupt the one before.

## Structure

```
.
├── cloudflare/
│   └── worker.js               # committed copy of the deployed worker
│
├── public/
│   ├── favicon.svg             # adapts to light/dark
│   └── me.jpg                  # About photo (optional — falls back to initials)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx          # fonts, metadata, theme script — and Chrome
│   │   ├── page.tsx            # "/" → redirects to /home
│   │   ├── globals.css         # both themes + CSS entrance animations
│   │   ├── [panel]/
│   │   │   └── page.tsx        # /home /about /qualification /projects /contact
│   │   └── api/repos/route.ts  # same-origin JSON endpoint
│   │
│   ├── lib/
│   │   ├── content.ts          # ⭐ ALL personal content — edit this one
│   │   ├── repos.ts            # server-side worker fetch + normalise
│   │   ├── tech.ts             # tech tags + OVERRIDES (ignores GitHub's guess)
│   │   └── fixtures.ts         # stand-in data when the worker is unreachable
│   │
│   └── components/
│       ├── Chrome.tsx          # persistent shell: nav, cursor, palette, footer
│       ├── CommandPalette.tsx  # ⌘K over panels + live repos
│       ├── CustomCursor.tsx    # dot + lagging ring, opt-in via data attrs
│       ├── Magnetic.tsx        # pulls a child toward the pointer
│       ├── Reveal.tsx          # CSS entrance animations
│       ├── ThemeToggle.tsx     # dark ⇄ light
│       ├── KineticName.tsx     # hero name, per-letter pointer reaction
│       ├── ShaderField.tsx     # cursor-reactive canvas field
│       ├── FlappyProjects.tsx  # the easter egg
│       ├── ProjectCard.tsx     # one repo
│       └── panels/             # Home / About / Qualification / Projects / Contact
│
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

## Editing content

All personal content lives in **`src/lib/content.ts`** — name, tagline, bio,
timeline entries, contact links, excluded and pinned repos. No component
hardcodes any of it. Anything still marked `// TODO` there is placeholder text
waiting to be replaced.

## Where the projects come from

The repo grid is pulled live from the Cloudflare Worker at
`logger.dhairyaplayz97.workers.dev`, which syncs the GitHub API into KV once a
day and resolves each project's `og:image` off its live site.

`cloudflare/worker.js` is a **committed copy** of what's deployed there, kept in
the repo so the logic is readable alongside the site that consumes it. Editing
it here deploys nothing — the worker lives in the Cloudflare dashboard.

The worker's CORS allowlist only contains production origins, so the browser
can't call it from localhost or a preview deployment — and a plain server-side
fetch sends no `Origin` at all, which it also rejects. Instead of widening that
allowlist, the site fetches it **server-side** (`src/lib/repos.ts`) with a
matching `Origin` header. Consequences worth knowing:

- the worker URL never reaches the client
- the worker's per-IP rate limit stops being user-facing — one Next.js cache
  entry serves every visitor
- it behaves identically on localhost and in production

If the worker is unreachable, the page renders `src/lib/fixtures.ts` instead of
an error and labels itself as sample data.

## Tech tags are not GitHub's `language` field

GitHub reports one language by byte count, and it is wrong constantly: an Astro
site reports `HTML`, a TypeScript app reports `JavaScript` because of one config
file. Filtering on that produces junk categories.

`src/lib/tech.ts` derives tags from three sources instead, most trustworthy
first:

1. **`OVERRIDES`** — hand-written per repo, always wins
2. **GitHub topics** — set by hand, so treated as intentional
3. **`language` + heuristics** — the fallback, and only when the topics didn't
   already answer the question

To correct a mislabelled repo, add one line to `OVERRIDES`:

```ts
export const OVERRIDES: Record<string, string[]> = {
  "my-astro-site": ["astro", "typescript", "tailwind"],
};
```

## Themes

Two, meant to feel like different places rather than a palette inversion: dark
is a late-night terminal (near-black, phosphor green, grid texture), light is
warm cream with multi-hue sun washes. Both are the same CSS custom properties on
`[data-theme]`, so components never branch on theme. A blocking script in
`src/app/layout.tsx` applies the stored choice before first paint.

## Commands

```bash
npm run dev     # dev server
npm run build   # production build
npm start       # serve the production build
```
