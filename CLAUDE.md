# CLAUDE.md

Personal portfolio of **Dhairya Khetan**, live at **https://dhairyakhetan.vercel.app**.
Read this before changing anything. It records who the site is for, how every part
is meant to behave, and the decisions behind it — including the ones that look
odd until you know what broke last time.

---

## Who this is about

- **Dhairya Khetan** — Class 11 (PCM) student in India, preparing for **JEE Main &
  Advanced (2028)**. Class 10 boards done in 2026. GitHub: `dhairyakhetan`.
- Codes in his free time, self-taught. **Knows HTML and Python. Learning C++ and
  JavaScript.** Never describe him as "writing" C++/JS — he corrected this once.
- No degree, no job title, no stack of official projects — the site is honest
  about that rather than padding it.
- **Main project: TerraNotes** — the monthly online magazine of Aquaterra, a Kolkata
  NGO with 1,300+ members, run by its Digital Magazine department. He is **tech
  lead** and built the whole site (concept, design system, all code). Edition 01
  launched September 2026: 6 pieces, 18 team profiles. Live at
  `https://terranotes-testing.vercel.app` (no public repo — link the site only, and
  don't list its features on the card).
- **Japan 2026** — a day-by-day planner he built for a family trip (Tokyo, Kyoto,
  Osaka, 19–28 Oct 2026). Hosted on this site at `/Japan2026`.
- Older repos (secondary, pinned at the top of the full repo list):
  - `shoppy` — storefront for his mother's Tanjore art
  - `omrakhi` — his father's business, Om Rakhi Udyog (WIP), `https://omrakhi.vercel.app`
  - `GOAT-GPT` — AI that answers Messi/Ronaldo questions from their stats
  - `mcu-watchlist` — every Marvel release from Phase 1, release vs chronological order
- Contacts: email `dhairyaplayz97@proton.me` · GitHub `dhairyakhetan` ·
  LinkedIn `https://www.linkedin.com/in/dhairya-khetan-aa6392364/` ·
  LeetCode `https://leetcode.com/u/anWtedW7Hw/` (a beginner, and fine saying so) ·
  Instagram `dhairyakhetan`.

All of this lives in `src/lib/content.ts`. Components never hardcode personal
content — edit that file. Anything marked `// TODO` there is a known gap.

---

## How to work on this repo

- **Push straight to `main`.** He asked for that from the start; Vercel deploys
  `main` to production. Don't open PRs unless asked.
- **He checks on the Vercel domain, never localhost.** Test locally yourself before
  pushing (see *Testing*), then say what changed in plain words.
- **Keep the root clean.** He objected loudly to clutter. Root holds only config
  files plus `cloudflare/`, `public/`, `src/`. Static files go in `public/`. No
  wrangler config, no stray READMEs in subfolders.
- **Keep comments to the ones that explain a non-obvious decision.** No narration.
- Commit messages: imperative subject, a body explaining *why*.
- Stack: Next.js 15 (App Router), React 19, TypeScript, Tailwind v4,
  framer-motion. Deployed on Vercel. Node fetches the repo list server-side.

---

## Site structure

```
src/app/
  globals.css                 design tokens, both themes, all CSS animations
  (site)/                     the portfolio — its own root layout
    layout.tsx                fonts, metadata, pre-paint scripts, <Chrome>
    page.tsx                  "/" → redirect to /home
    [panel]/page.tsx          /home /about /qualification /projects /contact
    opengraph-image.tsx       link preview for every portfolio page
  (japan)/                    the trip planner — a separate root layout
    layout.tsx
    Japan2026/[[...day]]/page.tsx   /Japan2026 and /Japan2026/day1 … day10
    Japan2026/opengraph-image.tsx
  api/repos/route.ts          same-origin JSON for the full repo list
src/middleware.ts             hard refresh → re-ask the audience question
src/lib/                      content, audience, featured, repos, tech, og
src/components/               Chrome, panels/, Terminal, cursor, etc.
src/japan/                    planner code, data and its own stylesheet
src/og-fonts/                 TTFs for the OG images
cloudflare/worker.js          committed copy of the deployed worker (+ tests)
public/                       me.png, favicon.svg, card images
```

### Routing decisions

- Every panel is a real URL (`/home`, `/about`, …) but it reads as one page. The
  persistent chrome lives in the **root layout of the `(site)` group**, not in
  `[panel]/layout.tsx` — a layout under a dynamic segment remounts whenever the
  param changes, which rebuilt the cursor, dots and palette on every click.
- `[panel]` has `dynamicParams = false`; anything else 404s.
- `/Japan2026` is a separate site with its **own root layout** (route group
  `(japan)`). Moving between it and the portfolio is a full page load, by design.

---

## Design

An editor, not a brochure. Based on a Claude Design canvas he provided.

- Fonts: **Instrument Serif** (big statements, italic accents) + **Martian Mono**
  (everything else). Font variable classes go on `<html>`, not `<body>` — the
  `--font-mono` token is declared on `:root` and must resolve there (it once
  silently fell back to a system font because of this).
- **Dark is the default.** Warm near-black `#0b0c0a`, one acid accent `#c8f55a`,
  sharp corners everywhere (radius 0). Light theme is the same system on paper
  (`#f3f1e9`, amber accent `#b35900`). Theme lives on `<html data-theme>`, applied
  by a blocking script before paint; toggle in the header, ⌘K, or `theme` in the
  terminal.
- Header: `dk_` logo, numbered editor tabs (`01 home.js`, `02 about.md`,
  `03 qualification.json`, `04 projects/`, `05 contact.sh`), IST clock, theme
  toggle. Below `lg` the tabs get their own scrollable row.
- Footer is an IDE status bar (open to collabs, branch, class 11 · jee prep,
  current file, ⌘K). On phones the `menu` button there is the only way into ⌘K.
- **Background dots** (`ShaderField`) sit behind every page: square dots that part
  around the pointer and turn accent-coloured. He explicitly wanted the dots kept
  when the design changed. The loop stops once nothing moves — an idle page costs
  zero frames. Off for touch; static under reduced motion.
- Images are greyscale at rest and colour on hover (hover devices only — on phones
  they stay in colour). Featured cards with a finished image (`imageBackground`
  set) show it whole and in full colour.

### Motion and feedback

- Entrance animations are **CSS, visible by default**. Never start content at
  `opacity: 0` with JS — that once left pages blank when an animation didn't run.
- Page swaps fade/rise in (`.panel-enter`).
- Objects respond, not just the cursor: buttons and chips rise onto a hard shadow
  and press in; cards lift; arrows nudge. Hover movement only where hover exists
  and reduced motion isn't requested.
- **Cursor**: small 28px ring + dot. Over links the ring widens to 40px with a
  translucent tint; labels (`data-cursor-label`) sit in a tag **beside** the
  pointer — he complained the old 78px disc covered what it pointed at. I-beam on
  text fields. Off on touch and under reduced motion.
- Magnetic CTAs on Home; kinetic name letters react to the pointer (idle-stops).

---

## Two audiences: developer view and simple view

First visit asks **"do you write code?"**.

- **Yes → developer view**: file-name tabs, the terminal, the bio as `dhairya.js`,
  `--name` form labels, `ls`/`grep` wording.
- **No → simple view**: page names, a "start here" link list instead of the
  terminal, the bio as a plain fact list next to the photo, plain form labels.
- Switch any time from ⌘K ("mode"), `mode` in the terminal, or the status-bar menu.
- **A hard refresh asks again**; a normal refresh keeps the answer.

How it works: the answer is in `localStorage` + `<html data-audience>`, set by a
blocking script before paint. Pages render **both** versions via
`<Variant dev plain>` and CSS hides one — no flash of the wrong view. The prompt is
in the server HTML and shown only while the attribute is `unset`. Hard refresh is
detected by `middleware.ts` (request has `Cache-Control: no-cache`; Next's own RSC
and prefetch fetches are excluded) which sets a short cookie the pre-paint script
reads. The middleware matcher only fires on that header, so normal loads never
invoke it.

When adding UI copy that's jargon (file names, shell commands), give it a plain
twin with `<Variant>`.

---

## Pages

- **Home** — serif name (`Dhairya` / *Khetan.*), typewriter "I build …", blurb,
  CTAs. Right side: a working terminal (dev) or "start here" (simple). Terminal
  commands: `help whoami ls [projects] cd <page> jee open <project> play theme mode
  echo clear sudo hire-me`, ↑/↓ history. `play` opens the Flappy game (regular
  pipes — he asked for plain obstacles, not project names).
- **About** — "A student first. A programmer *every other hour.*", jee_mode /
  code_mode toggle, `dhairya.js` + `me.png` tabs (dev) or photo + fact list (simple).
- **Qualification** — master/detail: JEE (2028, in prep), Class 11 PCM (ongoing),
  Programming (self-taught), Class 10 (2026). Arrow-key navigable tabs.
- **Projects** — featured cards, then "show all public repos" (fetched only on
  click), then the open-slot card. One featured project renders as a single card;
  two or more stack on scroll (sticky; covered cards recede). Currently featured:
  **TerraNotes**, then **Japan 2026**.
- **Contact** — "Let's *talk.*", rows that say what each platform is for (**never
  print the handle** — it's his name on all of them). Note text is a size smaller
  than the label. Email row copies on click. The form opens the visitor's own mail
  app with the message filled in — it never pretends to send.

### Projects data

- Featured entries are hand-written in `content.ts` (`projects.featured`). A
  featured project may have `repo: null` (no source button; links go to the site)
  and a relative `homepage` like `/Japan2026` (opens in place, not a new tab).
- **Zero network calls on page load.** Everything renders from `content.ts`; only
  `AllRepos` calls `/api/repos`, after a click.
- Repo grid: 4 columns at xl (he hates 3-card layouts), lift + pointer wash +
  sibling dim on hover.
- Tech tags come from `src/lib/tech.ts`: `OVERRIDES` → GitHub topics → `language`
  heuristic. GitHub's `language` is wrong constantly (Astro sites report HTML).
- **No live stats** (stars, commit counts). He called them "public humiliation".

---

## The Cloudflare Worker (repo list)

`logger.dhairyaplayz97.workers.dev`, deployed by hand from the Cloudflare
dashboard (KV already bound — no wrangler). `cloudflare/worker.js` is a committed
copy; editing it deploys nothing.

- Only allowed origin: `https://dhairyakhetan.vercel.app`. The site fetches it
  **server-side** (`src/lib/repos.ts`) with that `Origin`, so the worker URL never
  reaches the browser and it works locally too.
- Request path never writes KV (one KV read per request). Upstream GitHub calls are
  conditional (ETag → 304 is free). Updates arrive by HMAC-signed webhook
  (`POST /hooks/github`), with cron + lazy sync as fallback. Rate limit 120/min per
  IP (traffic comes from Vercel's few IPs). `/admin-panel` is plain text.
- No Messi/Ronaldo "trophies" project — stripped on request.
- If unreachable, the site shows `src/lib/fixtures.ts`, labelled as sample data.
- `npm run test:worker` — 91 assertions on counted KV/upstream ops. Run after any
  worker edit.

---

## Japan 2026 (`/Japan2026`)

- Originally a separate Vite app; ported into `src/japan/`. Its own fonts (Shippori
  Mincho, Zen Kaku Gothic New), colours and dark mode (follows the OS). Its
  Tailwind build scans only `src/japan`; the portfolio's skips it.
- `/Japan2026/day1` … `/day10` are prerendered; the planner itself renders
  client-only because it reads the date, URL and screen width.
- Desktop: a day highlight that **slides** between the date buttons; the day's
  content **fades** in place (no slide — the layout doesn't move). Phone: one list
  with a sliding ring on the sticky date strip.
- **Privacy rules — keep them:**
  - No booking references, PNRs, e-ticket numbers or booking IDs, ever. A reference
    plus a surname opens a booking on most airline sites. Flight numbers and times
    are fine.
  - The agent's PDFs are context only — never put them in `public/`.
  - The page is `noindex`; its OG image shows dates and cities only.
- Each day is **one timeline** of `[time, text, kind, place?]` entries: kind `"i"` is
  from the agent's itinerary (filled dot), `"x"` is planned by Dhairya (hollow dot).
  `place` points at a card in the day's `places` (time, type, what, distance, hours,
  note, directions link); clicking the name in the timeline scrolls to and rings
  the card. Desktop shows the places in a sticky side column; phones list them
  under each day. Day buttons show each day's `short` line.
- Updates come from his private claude.ai artifact
  (`https://claude.ai/artifact/5x3psKogRssTmXxeYFCVAg`). Save its `index.html`,
  evaluate the `DAYS` array literal as data, regenerate `DAYS` in `data.ts`, and
  strip booking refs from the gists (they're in there every time). Compare the
  flights, hotels and to-check sections by hand — they live in the HTML, not `DAYS`.
  The artifact's format has changed between pulls — check its render script, not
  just the data.
- **Corrections to re-apply on every pull** (the artifact still has them wrong):
  on 20 Oct, **Kabukiza and the National Diet Building are drive-bys, not photo
  stops**, and the tour line shouldn't say "all sightseeing are photo stops".

---

## Link previews

`next/og` images built at build time: `(site)/opengraph-image.tsx` (the editor
look; shared by every portfolio page, each keeping its own `og:title`) and
`(japan)/Japan2026/opengraph-image.tsx`. A page that sets its own `openGraph`
replaces the inherited image, so `[panel]/page.tsx` passes the parent's images
through explicitly. Fonts are TTFs in `src/og-fonts`; the Japanese ones are
subset to Latin. `metadataBase` is the production domain.

---

## Testing

There's no test runner in the repo beyond the worker suite. Before pushing:

1. `npx tsc --noEmit` and `npm run build`.
2. `npx next start -p <port>` and drive it with Playwright (install with
   `npm install --no-save playwright`; Chromium is at
   `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` in Claude's sandbox).
   Pre-answer the audience prompt with `localStorage.setItem("audience", "dev")`
   or the modal covers the page.
3. Check desktop (1440) and phone (390), both themes, reduced motion, and that no
   `/api/` request happens on load.

Sandbox gotchas: GitHub OG images, the worker and `*.vercel.app` are unreachable
from Claude's sandbox, so thumbnails fall back to letter tiles and `/api/repos`
returns fixtures (503) — that's expected. Use a fresh port per server run, and
never `pkill -f "next start"` (it matches and kills the calling shell).

---

## Still open

- Live URLs for `shoppy` and `mcu-watchlist`.
- Confirm `dhairyaplayz97@proton.me` should be public.
- School name, board, Class 10 score, JEE target — only if he wants them shown.
- Whether `Wisdom-Woods` stays excluded from the repo list.
- TerraNotes is on its `-testing` domain; update `homepage` if it moves.
