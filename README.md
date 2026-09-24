# Portfolio

Personal site for [@dhairyakhetan](https://github.com/dhairyakhetan). Next.js App
Router, TypeScript, Tailwind v4, framer-motion. Deployed on Vercel.

Five pages — Home / About / Qualification / Projects / Contact — each a real
route (`/home`, `/about`, …), all statically prerendered. The site is styled as
an editor: the pages are tabs (`home.js`, `about.md`, `qualification.json`,
`projects/`, `contact.sh`), there's a status bar along the bottom, and the home
page has a working terminal (`help` lists what it knows). Behind every page is a
fixed field of dots that parts around the pointer.

## The site makes no network calls on load

Every page renders from `src/lib/content.ts`. The curated projects, the ⌘K
palette, the terminal and the flappy easter egg all read the same hand-written
list, so visiting any page costs zero requests for project data.

The full public repo list is fetched **only when someone clicks "show all
public repos"** — `src/components/AllRepos.tsx` is the one place in the app
that calls `/api/repos`, and it does so after a click, never on mount.

Projects therefore has two halves:

- **Featured** (`projects.featured` in content.ts) — hand-picked and
  hand-written, rendered as a stack you scroll through. Each card sticks
  slightly lower than the last, so the next slides over the previous and leaves
  its edge showing. The stacking itself is pure `position: sticky`.

  The depth on top of it is scroll-driven: a covered card scales back and a
  veil painted in the page background fades over it, its image drifts against
  the card's travel, and its copy rises into place as the card settles. One
  rAF-batched scroll listener for the whole stack writes three custom
  properties (`--covered`, `--parallax`, `--arrived`); CSS maps them onto
  transform and opacity only, so the browser composites them. Measured at
  61fps while scrolling continuously, and the whole layer is inert under
  `prefers-reduced-motion`.
- **Everything else** — the live grid, on demand.

Two things about the stack are worth knowing before editing it. Each card must
own most of the viewport, or the whole stack is visible at once and there is no
scroll distance for cards to travel through. And the spacer `<li>` at the end
is load-bearing: a sticky child is confined to its containing block's *content*
box, so `padding-bottom` on the `<ul>` does nothing for it — without real
content height the last card never reaches its offset and every card unsticks
at once at the bottom of the scroll.

## Two views

First-time visitors get one question: do you write code? **Yes** keeps the
editor look — file-name tabs, the terminal, the bio as `dhairya.js`. **No**
shows the same content in plain words: page names, a "start here" list instead
of the terminal, the bio as a short list next to the photo. Either can switch
later from the ⌘K menu (the `menu` button in the status bar on phones), or
with `mode` in the terminal.

The answer lives in `localStorage` and on `<html data-audience>`, set by a
blocking script before first paint. Pages render **both** versions through
`src/components/Variant.tsx` and CSS shows one, so the right view is there at
first paint instead of swapping in after hydration. The question itself is in
the server HTML too, shown only while the attribute is `unset`.

## Routing

It reads as one page but every panel has a clean URL, because the persistent
chrome and the swapping content live at different levels of the tree:

- `src/app/layout.tsx` renders **Chrome** (dot field, cursor, tabs, palette,
  status bar) and never unmounts
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
│   ├── favicon.svg             # "dk_", adapts to light/dark
│   └── me.png                  # About photo (optional — falls back to initials)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx          # fonts, metadata, theme script — and Chrome
│   │   ├── page.tsx            # "/" → redirects to /home
│   │   ├── globals.css         # design tokens, both themes, CSS animations
│   │   ├── [panel]/
│   │   │   └── page.tsx        # /home /about /qualification /projects /contact
│   │   └── api/repos/route.ts  # same-origin JSON endpoint
│   │
│   ├── lib/
│   │   ├── content.ts          # ⭐ ALL personal content — edit this one
│   │   ├── audience.ts         # dev / plain view: read, set, pre-paint script
│   │   ├── repos.ts            # server-side worker fetch + normalise
│   │   ├── tech.ts             # tech tags + OVERRIDES (ignores GitHub's guess)
│   │   └── fixtures.ts         # stand-in data when the worker is unreachable
│   │
│   └── components/
│       ├── Chrome.tsx          # persistent shell: tabs, dot field, palette, status bar
│       ├── CommandPalette.tsx  # ⌘K over pages, projects, a few actions
│       ├── CustomCursor.tsx    # dot + lagging ring, labels via data-cursor-label
│       ├── Magnetic.tsx        # pulls a child toward the pointer
│       ├── Reveal.tsx          # CSS entrance animations
│       ├── ThemeToggle.tsx     # dark ⇄ light
│       ├── AudiencePrompt.tsx  # "do you write code?" on first visit
│       ├── Variant.tsx         # renders the dev and plain version of something
│       ├── Terminal.tsx        # the shell on the home page
│       ├── KineticName.tsx     # hero name, per-letter pointer reaction
│       ├── ShaderField.tsx     # the background dot field, idle when nothing moves
│       ├── FlappyProjects.tsx  # the easter egg (`play` in the terminal)
│       ├── FeaturedStack.tsx   # the curated projects, stacked on scroll
│       ├── AllRepos.tsx        # the full repo list, fetched on click
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

The full repo list is pulled from the Cloudflare Worker at
`logger.dhairyaplayz97.workers.dev`. `cloudflare/worker.js` is a **committed
copy** of what's deployed there — editing it here deploys nothing.

The worker is built around three rules:

**The request path never writes to KV.** Serving a visitor costs one KV read.
An earlier version wrote twice per request (a rate counter and a request
counter); on the free tier's 1,000 writes/day that meant roughly 500 visitors
before the worker started failing.

**Upstream calls are conditional.** Every sync sends `If-None-Match` with the
ETag GitHub returned last time. A 304 costs no GitHub rate-limit quota,
transfers no body, and skips the KV write — so checking often is nearly free,
and real work only happens when something actually changed.

**Updates arrive by push.** `POST /hooks/github` takes an HMAC-signed GitHub
webhook and syncs within seconds. Cron is the safety net, and the request path
has a slow lazy fallback if neither is configured.

`GET /admin-panel` is a plain-text status page — state, last sync, repo count,
payload size, og coverage, both ETags, and whether the webhook and token are
configured. Text rather than HTML so it renders instantly and `curl | grep`
works on it, which is how a status page for one service actually gets used.

It serves exactly one dataset. It previously carried a second project with two
upstream paths, which required assembling payloads from parts and reconciling
per-path ETags; that consumer is gone and so is all of that machinery.

Steady state: a visitor costs one KV read; an hour in which nothing was pushed
costs one conditional request that 304s; a push costs one full fetch and one
KV write.

To enable instant updates, add a repository or org webhook pointing at
`/hooks/github` (content type `application/json`) and set
`GITHUB_WEBHOOK_SECRET` to the same secret. Without it the worker still works,
just on cron and lazy-sync timing.

### Testing the worker

```bash
npm run test:worker
```

91 assertions, no dependencies, no network. Each scenario builds its own
in-memory KV, stubs `fetch`, and asserts on **counted operations** — KV reads,
KV writes, upstream requests — since the design is entirely about keeping those
numbers low. Covers the cheap paths (50 requests → 0 writes, 0 upstream calls)
and the nasty ones: a 304 with an empty cache, an og entry expiring while
upstream reports no change, a corrupt cached body, GitHub answering 200 with an
error object, KV itself failing, unicode payloads, hostile project sites that
hang until the abort fires, and every webhook signature edge.

Run it after any edit to `worker.js` — the worker is deployed by hand, so this
suite is the only thing standing between a typo and production.

### Connecting to it

The worker's CORS allowlist only contains production origins, so the browser
can't call it from localhost or a preview deployment — and a plain server-side
fetch sends no `Origin` at all, which it also rejects. Instead of widening that
allowlist, the site fetches it **server-side** (`src/lib/repos.ts`) with a
matching `Origin` header. Consequences worth knowing:

- the worker URL never reaches the client
- the worker's rate limit stops being user-facing — one Next.js cache entry
  serves every visitor
- it behaves identically on localhost and in production

Because requests arrive from a handful of Vercel egress IPs rather than from
end users, the worker's per-IP limit is deliberately loose. It exists to stop a
flood, not to shape normal traffic.

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

## Design

Instrument Serif for statements, Martian Mono for everything else, sharp
corners throughout. Dark is the default: warm near-black with one acid-green
accent. Light is the same system on paper — cream, ink, and an amber accent
dark enough to carry text. Both are CSS custom properties on `[data-theme]`,
mapped into Tailwind in `globals.css`, so components never branch on theme. A
blocking script in `src/app/layout.tsx` applies a stored choice before first
paint.

The dot field and the kinetic name only animate while something is moving:
once the pointer is still and every dot has settled, their loops stop, so a
reader sitting on a page costs no frames at all.

## Commands

```bash
npm run dev     # dev server
npm run build   # production build
npm start       # serve the production build
```
