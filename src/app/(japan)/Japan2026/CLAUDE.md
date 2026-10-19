# CLAUDE.md — Japan 2026 planner

Everything about `/Japan2026`: the code, the data, how plans get made, and what
Dhairya wants from the trip. The main `CLAUDE.md` at the repo root only points
here. This file also covers `src/japan/` (the planner's code and data), the
`(japan)` route group, `public/japan-sw.js`, `public/japan2026*` and the
planner's link preview.

> **Edit the site, not the artifact (since 18 Oct 2026, the trip is on).** All
> itinerary changes go straight into `src/japan/data.ts` and are pushed to
> `main`. The artifact (https://claude.ai/artifact/5x3psKogRssTmXxeYFCVAg) is
> frozen and now behind the site; don't edit it or copy from it.

---

## The trip

- **19–28 Oct 2026**, Tokyo → Kyoto → Osaka. Dhairya with Mum (Sweta) and Dad
  (Dilip). All three fly home to Kolkata together (Dad's China leg was dropped).
- Package by **Capricorn Tours LLP** (the agent): flights, hotels, transfers,
  tours, the two park tickets, teamLab, the bullet trains, hotel breakfasts.
- Hotels: **Citadines Shinjuku** (20–22), **Miyako Hotel Kyoto Hachijo** (23–24,
  2 min from Kyoto Station's Hachijo exit — *not* RIHGA Royal, whatever older
  copies say), **Osaka View Hotel Honmachi** (25–27).
- On the portfolio it's the second featured project on `/projects`
  (`projects.featured` in `src/lib/content.ts`, `repo: null`, relative
  `homepage`, so it opens in place with a → arrow, not ↗).

---

## Code

```
src/app/(japan)/
  layout.tsx                      its own root layout: fonts, colours, manifest
  Japan2026/[[...day]]/page.tsx   /Japan2026 and /Japan2026/countdown
  Japan2026/opengraph-image.tsx   link preview: dates and cities only
src/japan/
  App.tsx                         the planner (desktop + phone)
  JapanTrip.tsx                   client-only wrapper
  data.ts                         every word on the page
  japan.css                       its Tailwind build (scans only src/japan)
public/japan-sw.js                offline service worker
public/japan2026.webmanifest      + japan2026-icon-*.png, "Add to Home Screen"
```

- Originally a separate Vite app, ported in. Its own **root layout** (route group
  `(japan)`), so moving between it and the portfolio is a full page load, by
  design. Own fonts (Shippori Mincho, Zen Kaku Gothic New) and colours.
  **Always dark** (he asked, 19 Oct 2026): `japan.css` sets the dark tokens on
  `:root` with no light variant; theme-color and the manifest match. Its Tailwind build scans only `src/japan`; the
  portfolio's skips it. It stays out of the sitemap and is `noindex`.
- **No per-day URLs** (he asked, 18 Oct 2026): picking a day swaps it in place
  and the address stays `/Japan2026`; `/Japan2026/dayN` 404s. Only `/Japan2026`
  and `/Japan2026/countdown` are prerendered; the planner renders client-only
  because it reads the date, URL and screen width.
- **Works offline.** `public/japan-sw.js`, registered by `App.tsx` with scope
  `/Japan2026` (the portfolio is never controlled by it). After one online visit
  the page posts both URLs and the `/_next/static` files it loaded; the
  worker saves them. Pages are network-first with a 3.5 s timeout, static files
  cache-first; on a redeploy all pages are re-fetched before old files are
  dropped. **Only the latest version is kept** (he asked, 19 Oct 2026): the
  cache names carry a version (`v2`) and activate deletes every other cache,
  so bump it whenever old copies must go; "save" also deletes saved pages the
  build doesn't list (the old `/dayN`); and if slow data made a saved page
  answer first and the fresh one differs, the worker posts `updated` and the
  page reloads onto it.
- "Today" is a `useSyncExternalStore` on the Japan date, rechecked every minute
  and on `visibilitychange`; when it changes the planner moves to the new day.
- **Trip timer** (he asked for it, 16 Oct 2026): a pill in the header next to
  "N days to go", and the same timer big and centred at `/Japan2026/countdown`
  with "← Go back" top left. Before: "Time left till Japan trip", d/h/m/s to
  leaving home, 19 Oct 10:00 IST (he set it on the day; day 1's timeline
  matches). During: "Time left in Japan trip", to VZ 770 landing in
  Kolkata, 28 Oct 23:50 IST. After: "Days from Japan trip 2026", years and days
  only. Clicking the pill opens the countdown; "Go back" goes to `/Japan2026`. Both swap the view in place
  (`pushState`), no reload. `TripTimer`/`Countdown` in `App.tsx`.
- **Fonts are local subsets** (19 Oct 2026): `src/japan/fonts/*.woff2`, each
  weight cut with `pyftsubset --text-file` to the characters the planner uses
  (about 60 KB for all five). From Google they came as ~600 unicode-range
  slices: ~460 KB of render-blocking @font-face CSS. A new character outside
  the set falls back to the system font; re-run the subset over
  `src/japan/*.ts*` if one shows.
- **Speed on slow phones** (he asked, 19 Oct 2026; measured at 6× CPU
  throttle: phone ready 2.2–2.9 s → ~1.1 s, blocked time ~1.3 s → ~0.3 s):
  - No `backdrop-blur` on the sticky bars (solid `bg-paper`).
  - Static parts are `memo` components (`TripInfo`, `MobileDays`,
    `MobileInfo`), so day switches, scrolling and the place sheet don't
    redraw them.
  - Phone days are `.day-lazy` (`content-visibility: auto`): off-screen days
    skip layout and paint. Their placeholders change height when drawn, so
    every jump to a day goes through `pinDay`, which re-aims each frame until
    the day holds still under the strip. Strip taps use `glideTo`, a
    hand-driven rAF glide that re-reads the day's position each frame, then
    `pinDay`. Not scrollIntoView smooth: iOS 15 cut it short (the strip
    scrolls sideways at the same time) and has no `scrollend`. Both aim with
    `dayTop()` (the `--strip-h` offset), not scroll-margin.
- **Must work on an iPad mini 4 (iOS 15.8 Safari, A8, 2 GB)** — his tablet
  for the trip (19 Oct 2026). Rules that follow from it:
  - No translucent Tailwind colours (`bg-ink/40`, `text-x/80` …): Tailwind 4
    builds them with `color-mix()`, which iOS 15 lacks, and falls back to the
    solid colour (a near-white scrim). Use `bg-[rgba(…)]`.
  - No `behavior: "instant"` (iOS 15 throws); use `instantly(() => …)`, which
    turns off `html`'s smooth scrolling for the call.
  - Dates come from `ymd()` (formatToParts), not `en-CA` `format()`.
  - No `content-visibility` there, so `MobileDays` builds only the days near
    the screen (`drawn`, an IntersectionObserver 1500 px ahead); others are
    placeholders sized from their row count. `MobileDay` is memoised.
  - `JapanTrip.tsx` imports `App` statically and renders it after mount
    (`useSyncExternalStore`), so its code downloads with the page instead of
    after React starts (next/dynamic did that, an extra round trip).
  - Sideways it's 1024 px wide, the desktop layout's lower edge: below `xl`
    the desktop uses less padding, smaller headings, 84 px date buttons and
    hides "Flights & hotels" so the header stays on one line. Upright (768)
    the phone layout widens to 768 px and the date tiles fill the strip.
- **Blank patches while scrolling** on the iPad mini 4 (19 Oct 2026): it ran
  out of GPU memory. Keep the page's layer count low (measured with Chromium's
  LayerTree at 768 and 1024 wide: 7 and 3 layers, ~16 and ~5 Mpx):
  - No fades or animated wrappers around page-sized content (`day-fade` is
    gone; a page-wide fade could stay a page-sized layer).
  - The places column is sticky with its own scroll only from `xl`; below it,
    it scrolls with the page (a scroller inside a sticky box is extra layers).
  - No big blurred shadows on moving parts (the date highlight has none).
  - Each phone day's pinned date has `z-[1]`: drawn above the day, so the
    timeline beside it isn't promoted to a day-tall layer for overlapping it.
  - Phone days not built at first are built in the background (nearest
    first, one every 150 ms from 600 ms), so none is built mid-scroll.
- **Taps answer at once** (19 Oct 2026): `touch-action: manipulation`, no
  tap highlight and a `:active` dim on links and buttons (`japan.css`; App
  adds the empty `touchstart` listener iOS needs for `:active`). On desktop the
  tile highlight follows `sel` and the day's content `useDeferredValue(sel)`
  inside the memoised `DayPanel`, so a tap paints the tile before the day.
  On the phone layout a date tap moves the strip's ring at once and holds it
  there (`steering`) while the smooth scroll passes other days.
- **Desktop ↔ phone switch** (crossing 1024 px, e.g. turning a tablet):
  `shownDay` carries the day across and the new layout opens on it.
- Desktop: a day highlight that **slides** between the date buttons; the day's
  content swaps in place (no fade: see *Blank patches* below). Phone: one list with a sliding ring on the sticky
  date strip.
- **The dates stay pinned while scrolling** (he asked for it). Desktop: the date
  bar is sticky and the places column sticks under it (`--bar-h`); picking a day
  while scrolled down brings its top back under the bar. Phone: each day's big
  date pins under the strip (`--strip-h`) until the next day pushes it out.
- The `(japan)` OG image uses TTFs in `src/og-fonts`, subset to Latin.

### Data model (`src/japan/data.ts`)

- Each day is **one timeline** of `[time, text, kind, cat, place?]`: kind `"i"` is
  from the agent's itinerary (solid dot), `"x"` is planned by Dhairya (hollow
  dot); a row whose text starts with "Optional" gets a dashed dot. `cat` (he
  asked, 18 Oct 2026) is the icon in the dot: train, car (taxi/car/bus), walk,
  fly, eat, shop, see, ride, shrine, stay, note. The legend lists only the ones
  the day uses. Eat and Shop cards get the same symbol on their chip and card.
  An empty time means "part of the entry above".
- Every move says how: metro rows name the line and its colour, the direction,
  stops, exit, and the walk from the hotel to the station.
- `place` points at a card in the day's `places` (`t`, `type`, `name`, `what`,
  `dist`, `hours`, `note`, `url` = directions link). Clicking the name scrolls to
  and rings the card. Desktop lists cards in a sticky side column; **phones don't
  list them** — the chip opens the card as a bottom sheet (tap outside, ✕ or
  Escape closes; a full-width button opens directions). Places the timeline
  doesn't name get an "Also:" chip.
- Card `type` is free text: Eat, Shop, See, Go, Ride, Game, Goshuin.
- `tips` are `[heading, text]`; a heading with "error" or "warning" turns red.
- Below the days: `FLIGHTS`, `HOTELS`, `SPOTS` (every goshuin temple/shrine near
  the route; the first 4 show, the rest sit behind "Show more"), `TODO` (questions for the agent), `GOSHUIN` and `METRO` notes.

### Privacy rules — keep them

- No booking references, PNRs, e-ticket numbers or booking IDs on the site, ever.
  A reference plus a surname opens a booking on most airline sites. Flight
  numbers and times are fine. **The artifact contains them** (FXBCFC, 46SCFY,
  the e-ticket number) — strip them on every copy to the site.
- The agent's PDFs and hotel vouchers are context only — never in `public/`.
- Hotels show name, address, check-in/out and room only. Never voucher booking
  or confirmation numbers, or the agent's phone and email.
- The page is `noindex`; its OG image shows dates and cities only.

### Testing

The repo-wide steps in the main `CLAUDE.md` apply. For the planner also: click
through all ten days at 1440 and 390 (the URL must stay `/Japan2026`), open a place sheet on the phone,
and watch for console errors. Offline: load a day, wait for `japan-pages-v2` to
hold `/Japan2026` and `/Japan2026/countdown`, then `context.setOffline(true)` and reload. "Today":
`page.clock.install` just before midnight JST, then `clock.fastForward`.

---

## Where planning happens: the artifact

His private claude.ai artifact is the working copy:
`https://claude.ai/artifact/5x3psKogRssTmXxeYFCVAg` (private; it keeps the
booking refs, which is fine there).

- **10 Oct 2026:** he had it stripped to **only the agent's itinerary**, then
  started rebuilding it **day by day** with Claude. Days 1–5 are planned; days
  6–10 are still itinerary-only there.
- Read it with the Artifact tool (`action: "read"`), read every line of the saved
  file, edit a copy of the inner page (drop the outer wrapper the read adds:
  first and last line), and republish with `url` set. Test it in Chromium
  (click every day, no console errors) before publishing.
- The artifact page draws from a `DAYS` array of
  `{date, city, title, short, gist, sleep, tl, places, tips}`; `tl` is the same
  `[time, text, "i"|"x", place?]`. Card URLs are built with helpers
  (`mp`, `hot`, `HT/HK/HO`), so evaluate the script to get plain data.
- The artifact now has the corrections applied (Kabukiza and the Diet Building
  are drive-bys, no "all sightseeing are photo stops", no PARCO Nintendo stop on
  23 Oct, Kyoto is Miyako Hachijo). If an older copy ever comes back, re-apply them.
- The artifact-first rule (10 Oct 2026) is retired: from 18 Oct the site is
  the only copy. Everything below is history.

### Copying days to the site

1. Evaluate the artifact's script up to `const CITY` and take `DAYS`.
2. Map `tl` → `timeline`, keep `places` and `tips` as they are, strip booking
   refs from the gists.
3. Replace only the days asked for in `data.ts`; leave the rest.
4. `npx tsc --noEmit`, `npm run build`, check the days in Chromium, push to `main`.

### State of the site (18 Oct 2026)

- All ten days are planned and live; the site is ahead of the artifact.
- Every voucher is in (he confirmed it is the whole trip): tour meeting points (20, 21, 24 Oct), Disney and
  Kyoto transfers, Thunderbird 18 plus the van on 25 Oct. Universal Studios is
  **26 Oct**; 27 Oct is a private 4-hour MagicalTrip tour from the hotel at 08:00 (not the SIC walking tour); airport car 28 Oct 08:00.
- USJ (26 Oct): he said to assume the car leaves the hotel at 06:30 and the
  park at 21:30; the voucher prints 06:30 for both (`TODO`).

---

## What Dhairya wants (learned while planning, 10 Oct 2026)

**How to work with him**
- Plan **one day at a time**: propose, he picks, then add exactly that.
  Don't add things he hasn't agreed to; "leave" means drop it.
- He likes a **few options with a recommendation**, in a short table with hours,
  distance and rough prices — not one answer, and not an essay.
- Explain places he doesn't know in plain words (he asked "what exactly is
  Akihabara").
- Casual tone; he writes fast and lowercase. Keep replies tight.
- Give realistic numbers that count eating, shopping and wandering — he pushed
  back on a ride count that assumed queues only.
- Cost matters: say what things roughly cost.

**Food**
- **Parents are vegetarian.** Not yet known: eggs, onion/garlic, how strict about
  dashi (fish stock). Breakfast on arrival day is unresolved — he'll decide; the
  plan just says "Breakfast at 7-Eleven" with no item named (he asked for that).
- **None of them like health-café food** ("Buddha bowls or whatever").
- Good picks: **Indian** (ZEERA Akihabara, Partik in Kyoto, Gonguru in Aoyama),
  **local Japanese curry rice** (CoCo Ichibanya, vegetarian menu), vegan ramen
  is fine (T's Tantan). Avoid beef-bowl chains, takoyaki, most ramen/udon broths.
- Fully vegetarian Indian in Kyoto: **Shama** (Higashiyama, Jain-capable) — kept
  in mind for 24 Oct evening.

**Interests**
- Doesn't watch cartoons and doesn't know Disney characters. Likes **Star Wars**,
  **Pirates of the Caribbean**, **every roller coaster**, **shooting games**.
- **Anime: enough after Akihabara on day 2.** Don't plan more anime shopping.
- Likes **shopping streets**: walkable areas packed with stores (Shibuya →
  Cat Street → Omotesando → Takeshita walk on 23 Oct).
- Prefers **"walk the road and explore"** over store-by-store lists; fix only
  what has a closing time or is a meal.
- **Goshuin**: he's collecting stamps. Put shrines in the **main timeline** as
  `"Optional goshuin: …"` with a card (type `Goshuin`); "if I can I will".
- Interested in **everyday Japan**: konbini, vending machines, gachapon, Daiso,
  Don Quijote, souvenir shops. Ideas offered but **not added** (he said leave):
  AEON Mall Kyoto (Daiso, arcade, 5 min from the Kyoto hotel), Don Quijote
  Shinjuku after Disney, gachapon in Akihabara, a "local things to try" tip, a
  konbini run near the Kyoto hotel.
- Wanted a lightsaber: Tokyo Disneyland has no build-your-own workshop; Akihabara
  toy shops are the better bet.

**Still to plan:** days 6–10 (24–28 Oct) in the artifact, then on the site when
he asks. Agent questions are in `TODO` in `data.ts`.
