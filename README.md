# Portfolio

Personal site for [@dhairyakhetan](https://github.com/dhairyakhetan). Next.js App
Router, TypeScript, Tailwind v4, framer-motion. Deployed on Vercel.

One page, five panels (Home / About / Qualification / Projects / Contact) that
swap in place. The active panel is mirrored into the URL hash, so back/forward,
deep links and reloads all behave like a normal multi-page site.

## Structure

```
.
├── cloudflare/                 # the worker — deployed separately, not by Vercel
│   ├── worker.js               # syncs upstream → KV daily, serves with ETag
│   ├── wrangler.toml           # KV binding + the daily cron trigger
│   └── README.md               # deploy steps
│
├── src/
│   ├── app/
│   │   ├── layout.tsx          # fonts + the blocking theme script
│   │   ├── page.tsx            # server component: fetches + classifies repos
│   │   ├── globals.css         # both themes, as CSS custom properties
│   │   └── api/repos/route.ts  # same-origin JSON endpoint
│   │
│   ├── lib/
│   │   ├── content.ts          # ⭐ ALL personal content — edit this one
│   │   ├── repos.ts            # server-side worker fetch + normalise
│   │   ├── tech.ts             # tech tags + OVERRIDES (ignores GitHub's guess)
│   │   └── fixtures.ts         # stand-in data when the worker is unreachable
│   │
│   └── components/
│       ├── Shell.tsx           # panel state, nav, hash routing, footer
│       ├── CommandPalette.tsx  # ⌘K over panels + live repos
│       ├── CustomCursor.tsx    # dot + lagging ring, opt-in via data attrs
│       ├── Magnetic.tsx        # pulls a child toward the pointer
│       ├── Reveal.tsx          # staggered entry animations
│       ├── ThemeToggle.tsx     # dark ⇄ light
│       ├── KineticName.tsx     # hero name, per-letter pointer reaction
│       ├── ShaderField.tsx     # cursor-reactive canvas field
│       ├── FlappyProjects.tsx  # the easter egg
│       ├── ProjectCard.tsx     # one repo
│       └── panels/             # Home / About / Qualification / Projects / Contact
│
├── next.config.ts
├── postcss.config.mjs
└── tsconfig.json
```

## Editing content

All personal content lives in **`src/lib/content.ts`** — name, tagline, bio,
timeline entries, contact links, excluded and pinned repos. No component
hardcodes any of it. Anything still marked `// TODO` there is placeholder text
waiting to be replaced.

## Where the projects come from

The repo grid is pulled live from the Cloudflare Worker in `cloudflare/`, which
syncs the GitHub API into KV once a day and resolves each project's `og:image`
off its live site.

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
npm run lint
```
