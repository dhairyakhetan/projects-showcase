# CLAUDE.md — Japan 2026 planner

Everything about `/Japan2026`: the code, the data, how plans get made, and what
Dhairya wants from the trip. The main `CLAUDE.md` at the repo root only points
here. This file also covers `src/japan/` (the planner's code and data), the
`(japan)` route group, `public/japan-sw.js`, `public/japan2026*` and the
planner's link preview.

> **Edit the artifact only.** All itinerary changes go to his private artifact,
> https://claude.ai/artifact/5x3psKogRssTmXxeYFCVAg — **not** `data.ts`, and
> nothing is pushed to `main` until Dhairya explicitly says "push to main".
> Then copy only the days he names (see *Copying days to the site*).

---

## The trip

- **19–28 Oct 2026**, Tokyo → Kyoto → Osaka. Dhairya with Mum (Sweta) and Dad
  (Dilip). Dad flies on to China from Osaka; Dhairya and Mum fly home to Kolkata.
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
  Japan2026/[[...day]]/page.tsx   /Japan2026 and /Japan2026/day1 … day10
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
  design. Own fonts (Shippori Mincho, Zen Kaku Gothic New), colours and dark
  mode (follows the OS). Its Tailwind build scans only `src/japan`; the
  portfolio's skips it. It stays out of the sitemap and is `noindex`.
- `/Japan2026/day1` … `/day10` are prerendered; the planner renders client-only
  because it reads the date, URL and screen width.
- **Works offline.** `public/japan-sw.js`, registered by `App.tsx` with scope
  `/Japan2026` (the portfolio is never controlled by it). After one online visit
  the page posts every day's URL and the `/_next/static` files it loaded; the
  worker saves them. Pages are network-first with a 3.5 s timeout, static files
  cache-first; on a redeploy all pages are re-fetched before old files are
  dropped.
- "Today" is a `useSyncExternalStore` on the Japan date, rechecked every minute
  and on `visibilitychange`; when it changes the planner moves to the new day.
- Fonts have `preload: false`: next/font preloads every CJK unicode-range slice
  whatever `subsets` says (361 files). The page is Latin, so the browser fetches
  only the ~9 slices it draws.
- Desktop: a day highlight that **slides** between the date buttons; the day's
  content **fades** in place. Phone: one list with a sliding ring on the sticky
  date strip.
- **The dates stay pinned while scrolling** (he asked for it). Desktop: the date
  bar is sticky and the places column sticks under it (`--bar-h`); picking a day
  while scrolled down brings its top back under the bar. Phone: each day's big
  date pins under the strip (`--strip-h`) until the next day pushes it out.
- The `(japan)` OG image uses TTFs in `src/og-fonts`, subset to Latin.

### Data model (`src/japan/data.ts`)

- Each day is **one timeline** of `[time, text, kind, place?]`: kind `"i"` is from
  the agent's itinerary (filled dot), `"x"` is planned by Dhairya (hollow dot).
  An empty time means "part of the entry above".
- `place` points at a card in the day's `places` (`t`, `type`, `name`, `what`,
  `dist`, `hours`, `note`, `url` = directions link). Clicking the name scrolls to
  and rings the card. Desktop lists cards in a sticky side column; **phones don't
  list them** — the chip opens the card as a bottom sheet (tap outside, ✕ or
  Escape closes; a full-width button opens directions). Places the timeline
  doesn't name get an "Also:" chip.
- Card `type` is free text: Eat, Shop, See, Go, Ride, Game, Goshuin.
- `tips` are `[heading, text]`; a heading with "error" or "warning" turns red.
- Below the days: `FLIGHTS`, `HOTELS`, `SPOTS` (every goshuin temple/shrine near
  the route), `TODO` (questions for the agent), `GOSHUIN` and `METRO` notes.

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

The repo-wide steps in the main `CLAUDE.md` apply. For the planner also: check
`/Japan2026/day1` … `day10` at 1440 and 390, open a place sheet on the phone,
and watch for console errors. Offline: load a day, wait for `japan-pages-v1` to
hold 11 entries, then `context.setOffline(true)` and open other days. "Today":
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
- **Standing rule (10 Oct 2026):** work only in the artifact until he says
  "push to main". Then copy to the site only the days he names.

### Copying days to the site

1. Evaluate the artifact's script up to `const CITY` and take `DAYS`.
2. Map `tl` → `timeline`, keep `places` and `tips` as they are, strip booking
   refs from the gists.
3. Replace only the days asked for in `data.ts`; leave the rest.
4. `npx tsc --noEmit`, `npm run build`, check the days in Chromium, push to `main`.

### State of the site (10 Oct 2026)

- Days **1–5 (19–23 Oct)** match the artifact's new day-by-day plan.
- Days **6–10 (24–28 Oct)** are still the **older full plan** (his earlier
  additions). Known stale bits there: 25 Oct Den Den Town card says "you saw
  Mandarake in Akihabara and Shibuya" (only Akihabara now); 26 Oct Mugiwara card
  says Nintendo was "done in Shibuya" (it wasn't); 27 Oct HHN card says the ride
  home is 19:00 (the plan says ~21:00); timeline says Den Den 16:40, card 16:30.
- `GOSHUIN` notes still mention Uniqlo UT/Graniph on 23 Oct, which the new day 5
  no longer has.
- Branch `claude/practical-lamport-j9yvpu` holds an itinerary-only version of
  `data.ts` (with empty reference sections hidden). It was never merged; he moved
  that work to the artifact instead.

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
