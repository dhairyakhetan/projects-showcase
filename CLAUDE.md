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
  `https://terranotes-aq.vercel.app` (no public repo — link the site only, and
  don't list its features on the card). The URL is one constant in `content.ts`.
- **Second featured: Archer MRSI** (solo, 2026, added 14 Nov 2026) — a three.js
  simulation of the Archer 155 mm howitzer firing MRSI, physics built from BAE's
  published figures. Live at `https://archer-mrsi.vercel.app`; no repo button. The
  card copy and the image's alt text are his, word for word.
- Older repos (secondary, pinned at the top of the full repo list; written out in
  `projects.older`, which is also the fallback list):
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

- **Always push to `main`** — every change, as soon as it's tested, without asking
  first. He asked for that from the start and repeated it on 14 Nov 2026; Vercel
  deploys `main` to production. This holds even when a session is set up with its
  own `claude/...` branch: pushing that branch as well is fine, but the work isn't
  done until it's on `main`. Don't open PRs unless asked.
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
  global-not-found.tsx        the 404 for any URL, in the portfolio's chrome
  sitemap.ts, robots.ts       the five pages
  (site)/                     the portfolio — its own root layout
    layout.tsx                metadata, theme-color, pre-paint scripts, <Chrome>
    page.tsx                  "/" → redirect to /home
    [panel]/page.tsx          /home /about /qualification /projects /contact
    opengraph-image.tsx       link preview for every portfolio page
  api/repos/route.ts          same-origin JSON for the full repo list
  product-funny/              STRATA fridge concept: strata.html served as-is
src/middleware.ts             hard refresh → replay the loading dock
src/lib/                      content, featured, repos, tech, og, theme, fonts, metadata,
                              intro (dock flags), prepaint, sound (Web Audio), gl (shader
                              helpers), cursor-pull
src/components/               Chrome, panels/, LoadingDock, LiquidTransition, Ferrofluid,
                              FerroBlob, Roll, cursor, etc.
src/og-fonts/                 TTFs for the OG images
cloudflare/worker.js          committed copy of the deployed worker (+ tests)
public/                       me.webp, favicons, card images
next.config.ts                only to switch on experimental.globalNotFound
```

### Routing decisions

- Every panel is a real URL (`/home`, `/about`, …) but it reads as one page. The
  persistent chrome lives in the **root layout of the `(site)` group**, not in
  `[panel]/layout.tsx` — a layout under a dynamic segment remounts whenever the
  param changes, which rebuilt the cursor, dots and palette on every click.
- `[panel]` has `dynamicParams = false`; anything else 404s.
- `/blackjack` is his blackjack game, added 20 Nov 2026 (the earlier JS version,
  home terminal and flappy game were removed on 15 Nov). It began as his
  Python/tkinter program and was **ported to plain JavaScript** the same day
  (the Pyodide version was slow to load and heavy on phones). `src/app/blackjack/`
  is a static HTML shell (like `/product-funny`, outside the portfolio chrome,
  **unlisted** from the nav and sitemap; reachable from the ⌘K menu as "Play
  blackjack"), and `public/blackjack/` holds the game: `js/` (ES modules),
  `assets/` (his pre-rendered artwork and sounds), `manifest.webmanifest` + icons.
  - **Engine** (`engine.js`, `strategy.js`) is a line-by-line port: a round is a
    generator that yields events and asks. The shoe shuffles with
    `crypto.getRandomValues` (Fisher-Yates, rejection sampling). With no hole
    card (European) a dealer blackjack takes only the original bet. Strategy EVs
    are computed, not tabled. Verified against his Python: all 1,750 chart cells
    across the five presets match exactly, and simulated edges are Classic −0.33%
    (theory ≈ −0.35%), Double Deck −0.46%, Single Deck 6:5 −1.8%, European −0.65%.
    Rerun a Node simulation (play N rounds with `Strategy.bestAction`) after any
    change to either file.
  - **Win rate setting** (Settings → Gameplay: Normal, 60, 80, 90, 100%), added at his
    request. Normal never touches the shoe. Otherwise `luck.js` stacks some rounds
    (the dealer picks his cards from the shoe: a stiff hand that then draws to a
    bust, and player hits that don't bust) at a rate set by the gap between the
    target and the share of rounds won since the setting last changed
    (`store.luck`). Measured over 100k rounds each: 60/80/90% land on the target for
    both a basic-strategy and a random player; 100% is perfect unless the player
    surrenders (counts as a loss). The table shows `WIN RATE n%` and Statistics says
    it, so it is never hidden. `Shoe.draw(inPlay, ctx)` is the only engine hook.
  - **Drawing** is one `<canvas>` in a 1600×900 design space (`core.js`: letterboxed
    with the felt filling the rest, one transform, so resize/rotate just work).
    Input is immediate-mode: every frame, buttons call `button()`/`app.hit()`, and
    pointer events use the last frame's hit list (touch gets 9 design px of extra
    reach). Tweens are awaitable (`await app.tween(...)`); the "game" clock follows
    the animation-speed setting. Scenes: `menu`, `intro` (walk-in), `table`,
    `stats`, `settings`. The table's HUD is laid out from the visible window
    (`TableScene.hud()`), so phones get ×1.5 buttons and the layout stays centred.
  - **Saves** use `localStorage["bj-save"]` in the same JSON shape as the old Python
    game, so old saves load. Defaults are a **$100,000 start with a $10,000 max bet**; saves still on an old default ($1,000 or $10,000 start, $1,000 max) are moved to it (balances are never touched). The tab
    closing mid-hand finishes it with basic strategy (`emergencyFinish`).
  - **Sound** is Web Audio on his wav files (`sound.js`); the context is created on
    the first gesture.
  - **Loading**: a loading screen with a steady ~2.2 s bar that follows the real
    downloads; **"Skip loading?"** appears at the halfway mark and opens the menu at
    once while the rest of the artwork streams in (scenes draw nothing for an image
    that hasn't arrived, and Play waits for the artwork it needs).
  - **Top bar** (in `page.html`): `dk_` tile, bordered "back to the site", an
    active-tab chip (`06 Blackjack.js`, the portfolio header's look), and working
    sound and fullscreen buttons. He asked for it to be improved twice, so it is
    **never hidden** (only in real fullscreen): on a short landscape screen it
    shrinks to 36 px and drops the labels.
  - **Phone / app**: `manifest.webmanifest` makes it installable (fullscreen,
    landscape); `public/blackjack-sw.js` (scope `/blackjack`) caches the page, code and
    art for repeat visits and offline — bump `CACHE` there if an asset changes
    without its filename changing. Link preview: `src/app/blackjack/og.png/route.tsx`
    using `table.jpg` (retake it if the game's look changes).
  - The menu shows no keyboard-shortcut letters (they still work: P, S, E, Q); the
    table shows key hints under its buttons on devices with a keyboard.
  - Test by driving `/blackjack` with Playwright; `window.BJ` is the app (`BJ.scene`,
    `BJ.store`, `BJ.hits`) and a scripted shoe is `BJ.scene.shoe.stack.push(Card.parse("10S"), ...)`
    (player, dealer up, player, dealer hole, then draws).
- `/Japan2026` (a trip planner) was taken down on 22 Oct 2026 at his request; it
  now 404s. `public/japan-sw.js` is a kill switch for its old offline worker:
  it deletes the saved copy on devices and unregisters. Delete it after a few
  weeks.
- `/product-funny` is the STRATA drink-fridge concept site (his side project), added
  1 Nov 2026. It's his single self-contained HTML file, served byte-for-byte by a
  static route handler, outside the portfolio's chrome. **Deliberately unlisted**:
  nothing on the portfolio links to it, it's not in the sitemap, and it sends
  `X-Robots-Tag: noindex`. To update it, replace `strata.html` with his new copy.
- The only root layout is in the `(site)` group, so a wrong URL matches no layout
  and Next served its bare white 404. `global-not-found.tsx` (needs `experimental.globalNotFound`) repeats the
  portfolio's `<html>` — fonts, pre-paint scripts, `<Chrome>` — around a 404 panel.
  Chrome shows `404` in the status bar when the path isn't a panel.

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
  by a blocking script before paint; toggle in the header or ⌘K. The `theme-color` meta (the phone's browser bar) follows the site's
  theme, not the OS — `src/lib/theme.ts`.
- The palette shortcut reads ⌘K on Apple devices and Ctrl K elsewhere:
  `<ShortcutKey>` renders both and CSS shows one off `<html data-mod>`, set before
  paint.
- Header: `dk_` logo, numbered tabs with a plain name and a faint file tag
  (`01 Home.js`, `02 About.md`, `03 Qualification.json`, `04 Projects/`,
  `05 Contact.sh` — `fileTag()` in `Eyebrow.tsx`), a rolling IST clock, theme
  toggle. Below `lg` the tabs get their own scrollable row. Each page opens with
  the same `0N / Name.ext` eyebrow.
- Footer looks like an IDE status bar, and **every item in it works** (he called
  out "shell buttons" that did nothing): open to collabs → /contact, ⎇ view source
  → this repo (`SITE_SOURCE`), class 11 · jee prep → /qualification, the page name
  → copies a link to the page, ♪ sound on/off, ⌘K menu, © → /about. Never add an
  inert item there. On phones `menu` is the only way into ⌘K (sound lives there too).
- **Background dots** (`ShaderField`) sit behind every page: square dots that part
  around the pointer and turn accent-coloured. He explicitly wanted the dots kept
  when the design changed. The loop stops once nothing moves — an idle page costs
  zero frames. Off for touch; static under reduced motion.
- Images are greyscale at rest and colour on hover (hover devices only — on phones
  they stay in colour). A featured card's own image (`image` + `imageAlt` set) is
  always in full colour: a mockup with `imageBackground` is shown whole on that
  colour (TerraNotes); a scene fills the frame, cropped around `imagePosition`
  (Archer: `23% 0%` — the howitzer and impact stay in a tall frame, and only the
  bottom is ever cropped, never the top; he asked for that. Its phone frame is
  7:6 so that bottom crop takes empty ground, not the truck). Hover zoom grows
  from the same point.
- **Image loading** (`lib/image.ts`). He reported the photo and both project
  images not showing after clicking into About/Projects. The components used to
  decide an image had failed if it was "complete with no width" on mount — but a
  freshly inserted image can read that way for a moment before its request
  starts (and some browsers report lazy ones like that), so real pictures got
  swapped for initials/title covers. `confirmFailure()` now waits on `decode()`
  before giving up. All three are eager (`fetchPriority` high where above the
  fold), `prefetchImages()` warms them on idle from Chrome, and their frames
  (`.img-frame`) show a soft sheen until the picture paints.

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
- Kinetic name letters react to the pointer (idle-stops); "say hi" is magnetic.
- **Rolling text** (`Roll.tsx`): text that changes rolls each changed character
  up and out while the new one rolls in from below — the clock, the "I build …"
  words, the dock's counter, copy-link and sound labels. `<HoverRoll>` flips a
  label over itself on hover (tabs, CTAs). Plain text between rolls.
- **Liquid button** (`Ferrofluid.tsx` + `lib/liquid.ts`) — only on *one main
  button* per view (home's "see projects", the dock's "let's go"). He asked for
  *actual* liquid, "very smooth", and said not to conserve — so it's a real
  particle fluid (Clavet et al. double-density relaxation: pressure, surface
  tension, viscosity), ~0.85 particles per px of button perimeter (cap 1100),
  run at 120 fixed substeps a second, continuously while on screen. `volume`
  scales the amount; `pour` lets it fall in from above as one stream on first
  appearance instead of starting coated (each batch fills exactly the gap the
  last fell, or it froths). Phones cap at 1300 particles, desktop 2200. Extra forces:
  a spring to a band just outside the button's edge, a clockwise current round
  it, a little gravity (drips), the button as a solid, and the cursor as a magnet
  that holds its drop but stops recruiting once the drop has ~8% of the liquid
  (otherwise the whole pool follows). Click splashes it. The drop drags the drawn
  cursor toward the button (`lib/cursor-pull.ts` → `CustomCursor`).
  Rendering (WebGL2): each particle is splatted as a gaussian into a half-float
  texture, then one pass thresholds that field into the surface (anti-aliased
  with `fwidth`), takes its slope as the normal, and shades glossy black with an
  accent rim. Tune it offline: the sim is pure TS, so step it in Node and render
  frames with numpy/PIL — headless Chromium's software GPU runs it ~15× slow-mo.
  Gotchas that broke it once: never step it while the canvas or button has no
  size (the dock's button is `display: none` until ready — it seeded around a
  zero box and exploded); size from `clientWidth`, not the transformed rect;
  re-seed if the button changes size a lot. Its canvas overhangs the button by
  `reach`, which is why `<main>` is `overflow-x: clip` (not hidden — hidden would
  break the sticky stack).
- **Ferrofluid blob** (`FerroBlob.tsx`) — the home page's right column: a
  raymarched drop whose spikes (a spherical Fibonacci lattice, nearest spike in
  O(1)) lean toward the pointer; click to kick it (with a sound). Waits for the
  dock to finish, then wakes. Idle-stops; static under reduced motion; CSS sphere
  if WebGL is missing.
- **Liquid page transitions** (`LiquidTransition.tsx`) — a plain left-click on a
  link to one of the five pages floods the screen with black ferrofluid (spiky as
  it rises), changes route underneath, then drains upward with drips. It works by
  `preventDefault` in a capture listener, which Next's `<Link>` respects. Skipped
  for new-tab clicks, outside links, back/forward and reduced motion.
- **Sound** (`lib/sound.ts`) — every sound is synthesised with Web Audio, no
  files: a click on presses, a woosh + sub boom for "let's go", a slosh for page
  floods, a gloop for poking the blob. The AudioContext is only created inside a
  user gesture (otherwise Chrome warns). On by default once allowed; mute is
  remembered (`localStorage.sound`).

---

## One view for everyone (no modes)

Until 15 Nov 2026 the site asked "do you write code?" and showed a developer or a
simple version. **He hated the two modes**; they were merged into one middle
ground that programmers relate to and everyone understands. Don't bring modes,
`<Variant>` or an audience prompt back.

The rule for copy: **plain words carry the meaning, code is flavour.** A page is
"About", with a faint `.md` beside it; form labels say "your name"; buttons say
"send", "see the code". Mono type, file tags, the status bar and lines like
"packing your message ...... done" keep it nerdy without anyone needing to know
what `ls` means.

## Loading dock (the intro)

A big, theatrical loading screen (`LoadingDock.tsx`) — hazard tape, a scan line,
a rolling fake transfer rate, a giant percentage that's also a **tank** (outlined
digits filling with liquid, a wave rolling on its surface — two copies of the
number, the top one masked to `--level`, a registered `@property` so it
transitions), a log where each line runs a tiny meter then rolls to its result,
and a segment meter. At 100% the tank drains while the liquid **pours** onto one
giant **let's go** button (`volume={2}` — he asked for more liquid there). Pressing it: woosh,
the button sinks into the screen, everything warps outward, and the site opens
through a hole where the button went (`--hole` is a registered `@property`).

- **Once per visit**: the first load in a tab (`sessionStorage["intro-seen"]`),
  and again on a **hard refresh** — `middleware.ts` sees `Cache-Control: no-cache`
  on a document request (Next's RSC/prefetch fetches excluded) and sets a
  short cookie that the pre-paint script reads. Normal refreshes skip it.
  ⌘K → "Replay the intro" brings it back on demand.
- It's in the server HTML and shown by CSS off `<html data-intro>`, set by the
  blocking script in `lib/intro.ts` — so it's there at first paint, and no-JS
  visitors and crawlers never get it. If the page never hydrates, the script
  lifts it after 15 s rather than leaving a wall up.
- While it's up, header/main/footer are `inert`. Enter or Escape works the button.
- Nothing is really loading; the lines say so, more or less. Keep them tied to
  real things on the site (the magazine, the six shell arcs, the dots…), not
  generic jokes.

## Pages

- **Home** — serif name (`Dhairya` / *Khetan.*), "I build …" with the last word
  rolling between `home.typed`, blurb, then the ferrofluid "see projects" button
  and a magnetic "say hi". Right side: the ferrofluid blob, captioned "fig. 01".
- **About** — "A student first. A programmer *every other hour.*", a JEE mode /
  code mode toggle (opens on JEE), and the photo beside a plain fact list (no
  "favourite project" row — removed at his request, 15 Nov 2026).
- **Qualification** — master/detail: JEE (2028, in prep), Class 11 PCM (ongoing),
  TerraNotes tech lead (live), Programming (self-taught), Class 10 (2026).
  Arrow-key navigable tabs.
- Every page has exactly one `<h1>` (its big serif heading) and its own meta
  description (`panels[].description` in `content.ts`). `lib/metadata.ts` builds
  each page's metadata; Home must *omit* `title` to inherit the layout's —
  `title: undefined` left `/home` with no `<title>` at all.
- **Projects** — featured cards, then "show all public repos" (fetched only on
  click), then the open-slot card. One featured project renders as a single card;
  two or more stack on scroll (sticky; covered cards recede). A card taller than
  the room below its sticky slot parks with its bottom edge in view instead
  (`--item-h`, measured in `FeaturedStack`) — otherwise the next card covered its
  visit button before it was ever on screen (Archer is ~710px; 1366×768 laptops).
  Copy measure is 56ch so both cards fit with the stack sliver at 1440×900.
  Currently featured: **TerraNotes**, then **Archer MRSI**.
- **Contact** — "Let's *talk.*", rows that say what each platform is for (**never
  print the handle** — it's his name on all of them). Note text is a size smaller
  than the label. Email row copies on click. The form opens the visitor's own mail
  app with the message filled in — it never pretends to send.

### Projects data

- Featured entries are hand-written in `content.ts` (`projects.featured`). A
  featured project may have `repo: null` (no source button; links go to the site)
  and a relative `homepage` (opens in place, not a new tab).
- **Zero network calls on page load.** Everything renders from `content.ts`; only
  `AllRepos` calls `/api/repos`, after a click.
- Repo grid: 4 columns at xl (he hates 3-card layouts), lift + pointer wash +
  sibling dim on hover.
- Tech tags come from `src/lib/tech.ts`: `OVERRIDES` → GitHub topics → `language`
  heuristic. GitHub's `language` is wrong constantly (Astro sites report HTML).
- **No live stats** (stars, commit counts, "last pushed" ages). He called them
  "public humiliation".
- Featured-card arrows: ↗ (the SVG `ArrowUpRight`, never the ↗ character, which
  some browsers draw as an emoji) only for links that leave the site; on-site
  links get →.

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
- If unreachable, the list falls back to `projects.older` (his real older repos)
  and says so. Never sample data — it would sit under his name. A degraded
  `/api/repos` is `no-store` so a blip isn't cached for a day.
- `npm run test:worker` — 91 assertions on counted KV/upstream ops. Run after any
  worker edit.

---

## Link previews

`next/og` images built at build time: `(site)/opengraph-image.tsx` (the editor
look; shared by every portfolio page, each keeping its own `og:title`). A page that sets its own `openGraph`
replaces the inherited image, so `[panel]/page.tsx` passes the parent's images
through explicitly. Fonts are TTFs in `src/og-fonts`. `metadataBase` is the production domain.

---

## Testing

There's no test runner in the repo beyond the worker suite. Before pushing:

1. `npx tsc --noEmit` and `npm run build`.
2. `npx next start -p <port>` and drive it with Playwright (install with
   `npm install --no-save playwright`; Chromium is at
   `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` in Claude's sandbox).
   Skip the loading dock with `sessionStorage.setItem("intro-seen", "1")` in an
   init script, or it covers the page for ~4 s and waits for a click.
   The shaders need WebGL: launch Chromium with
   `--use-angle=swiftshader --enable-unsafe-swiftshader`. That's a software GPU
   and very slow — a screenshot can time out while a shader is animating, so
   move the mouse, wait, then shoot; real GPUs are fine.
3. Check desktop (1440) and phone (390), both themes, reduced motion, that no
   `/api/` request happens on load, and that `documentElement.scrollWidth` on a
   phone is 390 (anything overhanging the viewport makes the page pan sideways).
4. Repo fallback: the worker is sometimes reachable from the sandbox. To force the
   fallback, delete `.next/cache/fetch-cache` and start the server with
   `NODE_OPTIONS=--require <file>` where the file wraps `globalThis.fetch` to
   reject `workers.dev` URLs.

Sandbox gotchas: GitHub OG images, the worker and `*.vercel.app` are unreachable
from Claude's sandbox, so thumbnails fall back to letter tiles and `/api/repos`
returns the fallback list (503) — that's expected. Use a fresh port per server
run, and never `pkill -f "next start"` or loop over `/proc` matching "next start"
(both match and kill the calling shell). Start it as
`node node_modules/next/dist/bin/next start -p <port> & echo $! > pidfile` and kill
that PID.

---

## Still open

- Live URLs for `shoppy` and `mcu-watchlist`.
- Confirm `dhairyaplayz97@proton.me` should be public.
- School name, board, Class 10 score, JEE target — only if he wants them shown.
- Whether `Wisdom-Woods` stays excluded from the repo list.
