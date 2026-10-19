"use client";

import { Fragment, memo, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { DAYS, FLIGHTS, GOSHUIN, HOTELS, METRO, SPOTS, TODO, type Cat, type City, type Entry, type Place, type Row, type SpotStatus } from "./data";

/** Where this lives on the portfolio. Every day has its own URL under it. */
const BASE = "/Japan2026";

/* ---------- helpers ---------- */

const CITY: Record<City, { text: string; bg: string; soft: string; border: string; name: string }> = {
  tokyo: { text: "text-tokyo", bg: "bg-tokyo", soft: "bg-tokyo-soft", border: "border-tokyo", name: "Tokyo" },
  kyoto: { text: "text-kyoto", bg: "bg-kyoto", soft: "bg-kyoto-soft", border: "border-kyoto", name: "Kyoto" },
  osaka: { text: "text-osaka", bg: "bg-osaka", soft: "bg-osaka-soft", border: "border-osaka", name: "Osaka" },
  travel: { text: "text-travel", bg: "bg-travel", soft: "bg-travel-soft", border: "border-travel", name: "Flight" },
};

const jst = (d: string) => new Date(d + "T00:00:00+09:00");
const weekday = (d: string) => jst(d).toLocaleDateString("en-GB", { weekday: "short", timeZone: "Asia/Tokyo" });
const weekdayLong = (d: string) => jst(d).toLocaleDateString("en-GB", { weekday: "long", timeZone: "Asia/Tokyo" });
const dayNum = (d: string) => Number(d.slice(8, 10));
const dayId = (i: number) => "day" + (i + 1);
/**
 * YYYY-MM-DD in a time zone. Built from parts: older Safari (the iPad mini 4
 * is on iOS 15) doesn't promise en-CA's dashed order from format().
 */
const ymd = (fmt: Intl.DateTimeFormat, t: number | Date) => {
  const p = Object.fromEntries(fmt.formatToParts(t).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};
const JAPAN_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
/** Today in Japan, YYYY-MM-DD. */
const japanToday = () => ymd(JAPAN_DATE, new Date());
const dayIndexOf = (date: string) => DAYS.findIndex((d) => d.date === date);
const START = DAYS[0].date;
const END = DAYS[DAYS.length - 1].date;
const isWarn = (h: string) => /error|warning/i.test(h);

/**
 * Scrolls without animating. iOS 15 Safari rejects behavior "instant", and
 * "auto" follows html's smooth scrolling, so that is switched off for the call.
 */
function instantly(scroll: () => void) {
  const style = document.documentElement.style;
  const before = style.scrollBehavior;
  style.scrollBehavior = "auto";
  scroll();
  style.scrollBehavior = before;
}

function cx(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

function useMedia(q: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(q);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(q).matches,
  );
}

/** Renders text with [label](https://…) links. */
function Rich({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https:[^)\s]+)\)/g;
  let last = 0;
  for (let m; (m = re.exec(text)); ) {
    parts.push(text.slice(last, m.index));
    parts.push(
      <a key={m.index} href={m[2]} target="_blank" rel="noopener">
        {m[1]}
      </a>,
    );
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <span className="rich">{parts}</span>;
}

/** City segments for the rail: consecutive days in the same city. */
const SEGMENTS = DAYS.reduce<{ city: City; span: number; nights: number }[]>((acc, d) => {
  const prev = acc[acc.length - 1];
  if (prev && prev.city === d.city) prev.span++;
  else acc.push({ city: d.city, span: 1, nights: 0 });
  return acc;
}, []).map((s) => ({ ...s, nights: HOTELS.find((h) => h.city === s.city)?.nights.split(",").length ?? 0 }));

const subscribeToday = (onChange: () => void) => {
  const timer = setInterval(onChange, 60_000);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onChange);
  };
};

/**
 * Today in Japan, rechecked once a minute and whenever the page comes back
 * into view — a tab left open overnight moves on to the new day by itself.
 */
function useToday() {
  return useSyncExternalStore(subscribeToday, japanToday);
}

/**
 * Saves the planner for use with no signal (public/japan-sw.js). A first
 * visit isn't controlled by the worker yet, so this hands it both URLs
 * and the files this visit loaded — once the fonts are in, the last of them.
 */
function useOffline() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/japan-sw.js", { scope: BASE }).catch(() => {});
    // Slow data made the worker show a saved, older copy and a newer one has
    // now arrived: reload onto it, so only the latest version is ever used.
    const onMessage = (e: MessageEvent) => e.data?.type === "updated" && location.reload();
    navigator.serviceWorker.addEventListener("message", onMessage);

    let cancelled = false;
    Promise.all([navigator.serviceWorker.ready, document.fonts.ready]).then(([registration]) => {
      if (cancelled) return;
      const assets = performance
        .getEntriesByType("resource")
        .map((entry) => new URL(entry.name))
        .filter((url) => url.origin === location.origin && url.pathname.startsWith("/_next/static/"))
        .map((url) => url.pathname + url.search);
      registration.active?.postMessage({
        type: "save",
        pages: [BASE, COUNTDOWN],
        assets: [...new Set(assets)],
      });
    });
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);
}

function countdownText(today: string) {
  const daysToGo = Math.round((jst(START).getTime() - jst(today).getTime()) / 86400000);
  if (today < START) return daysToGo === 1 ? "Starts tomorrow" : `${daysToGo} days to go`;
  if (today <= END) return "Trip in progress";
  return "Trip complete";
}

/** Leaving home for Kolkata airport: about 2 hours before AI 1874 departs at 12:55 IST. */
const LEAVE_HOME = Date.parse("2026-10-19T10:55:00+05:30");
/** VZ 770 lands in Kolkata. */
const TRIP_END = Date.parse("2026-10-28T23:50:00+05:30");
const COUNTDOWN = BASE + "/countdown";
const pad = (n: number) => String(n).padStart(2, "0");

const IST_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
/** A moment as its calendar date in India, at UTC midnight so dates subtract cleanly. */
const istDay = (t: number) => Date.parse(ymd(IST_DATE, t) + "T00:00:00Z");

type Unit = [value: number, name: "year" | "day" | "hour" | "minute" | "second"];

function until(ms: number): Unit[] {
  const left = Math.ceil(ms / 1000);
  return [
    [Math.floor(left / 86400), "day"],
    [Math.floor((left % 86400) / 3600), "hour"],
    [Math.floor((left % 3600) / 60), "minute"],
    [left % 60, "second"],
  ];
}

/** Whole years since the trip, then the days since the last anniversary of it. */
function since(now: number): Unit[] {
  const end = new Date(istDay(TRIP_END));
  const today = istDay(now);
  const anniversary = (y: number) => Date.UTC(end.getUTCFullYear() + y, end.getUTCMonth(), end.getUTCDate());
  let years = new Date(today).getUTCFullYear() - end.getUTCFullYear();
  if (anniversary(years) > today) years--;
  const days = Math.round((today - anniversary(years)) / 86400000);
  return years ? [[years, "year"], [days, "day"]] : [[days, "day"]];
}

/** Before the trip, counting down to leaving home; during it, to landing back home; after, counting up. */
function tripPhase(now: number) {
  if (now < LEAVE_HOME) return { label: "Time left till Japan trip", units: until(LEAVE_HOME - now), note: "Leaving home Mon 19 Oct, 10:55 IST" };
  if (now < TRIP_END) return { label: "Time left in Japan trip", units: until(TRIP_END - now), note: "Landing in Kolkata Wed 28 Oct, 23:50 IST" };
  return { label: "Days from Japan trip 2026", units: since(now), note: "19–28 October 2026 · Tokyo, Kyoto, Osaka" };
}

/** The time, every second until the trip is over, then every minute. */
function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      timer = window.setTimeout(tick, t < TRIP_END ? 1000 - (t % 1000) : 60_000);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);
  return now;
}

const subscribePath = (onChange: () => void) => {
  addEventListener("popstate", onChange);
  addEventListener("japan-navigate", onChange);
  return () => {
    removeEventListener("popstate", onChange);
    removeEventListener("japan-navigate", onChange);
  };
};
const onCountdown = () => location.pathname.replace(/\/+$/, "") === COUNTDOWN;

/**
 * A link between the planner and the countdown page that swaps the view
 * without a reload. Coming back opens /Japan2026 as a fresh visit would.
 */
function PageLink({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        history.pushState(null, "", to);
        instantly(() => scrollTo(0, 0));
        dispatchEvent(new Event("japan-navigate"));
      }}
    >
      {children}
    </a>
  );
}

/** The pill in the header: the same timer, small. It opens the countdown page. */
function TripTimer({ className }: { className?: string }) {
  const { label, units } = tripPhase(useNow());
  return (
    <PageLink to={COUNTDOWN} className={cx("rounded-full border border-line bg-surface text-sm hover:border-muted", className)}>
      <span className="text-muted">{label}</span>{" "}
      <b className="tabular-nums">{units.map(([n, u]) => (u === "day" || u === "year" ? n : pad(n)) + u[0]).join(" ")}</b>
    </PageLink>
  );
}

/** /Japan2026/countdown: the timer alone, in the middle of the screen. */
function Countdown() {
  const { label, units, note } = tripPhase(useNow());
  const counting = units.length === 4;
  return (
    <main className="flex min-h-dvh flex-col px-4 pt-[calc(env(safe-area-inset-top,0px)+20px)] pb-10 md:px-10 md:pt-9">
      <div>
        <PageLink to={BASE} className="inline-block rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold hover:border-muted">
          ← Go back
        </PageLink>
      </div>
      <div role="timer" className="day-fade flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="text-sm font-bold tracking-[.22em] text-muted uppercase md:text-base">{label}</h1>
        <div className="mt-6 flex gap-3 sm:gap-8 md:mt-8 md:gap-12">
          {units.map(([n, u]) => (
            <div key={u} className="flex flex-col items-center">
              {/* Each number gets a fixed-width box: the serif's digits aren't all the same width. */}
              <span className={cx("font-serif text-[clamp(3rem,14vw,10rem)] leading-none font-extrabold", counting && "w-[1.3em]")}>
                {counting ? pad(n) : n}
              </span>
              <span className="mt-2 text-xs font-bold tracking-[.18em] text-muted uppercase md:mt-3 md:text-sm">
                {u}
                {n === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-8 text-muted md:mt-10 md:text-lg">{note}</p>
      </div>
    </main>
  );
}

/**
 * Measures where the active item sits inside a container, so a highlight can
 * slide to it instead of jumping. `null` until the first measurement — the
 * highlight stays hidden then, and lands without animating the first time.
 */
function useSlide(container: React.RefObject<HTMLElement | null>, active: number) {
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number; first: boolean } | null>(null);

  useEffect(() => {
    const root = container.current;
    if (!root) return;

    const measure = () => {
      const el = root.querySelector<HTMLElement>(`[data-slot="${active}"]`);
      if (!el) return;
      setBox(prev => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, first: prev === null }));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [container, active]);

  return box;
}

/** Publishes an element's height as a CSS variable, so things can stick just below it. */
function useHeightVar(ref: React.RefObject<HTMLElement | null>, name: string, gap = 0) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty(name, `${el.offsetHeight + gap}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty(name);
    };
  }, [ref, name, gap]);
}

/* ---------- shared pieces ---------- */

/** The card for a place, by day and id — the timeline links to it. */
const placeId = (date: string, id: string) => `place-${date}-${id}`;

/** Scrolls a place card into view and rings it briefly, so the eye lands on it. */
function showPlace(date: string, id: string) {
  const el = document.getElementById(placeId(date, id));
  if (!el) return;
  el.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  el.dataset.hl = "1";
  clearTimeout(Number(el.dataset.hlTimer));
  el.dataset.hlTimer = String(window.setTimeout(() => delete el.dataset.hl, 2200));
}

/** What each kind of timeline row is called, and the line icon drawn in its dot. */
const CATS: Record<Cat, { label: string; icon: ReactNode }> = {
  train: { label: "Train or metro", icon: <><rect x="5" y="3" width="14" height="13" rx="3" /><path d="M5 10h14M9 16l-2 5M15 16l2 5M8.5 13h.01M15.5 13h.01" /></> },
  car: { label: "Taxi, car or bus", icon: <><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2M9 17h6" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></> },
  walk: { label: "Walk", icon: <><path d="M7 3c2 0 3 2.5 3 5.5S9 13 7 13s-3-1.5-3-4.5S5 3 7 3ZM5 16h4v1.5a2 2 0 0 1-4 0ZM17 7c2 0 3 2.5 3 5.5S19 17 17 17s-3-1.5-3-4.5S15 7 17 7ZM15 20h4v.5a2 2 0 0 1-4 0Z" /></> },
  fly: { label: "Flight", icon: <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z" /> },
  eat: { label: "Food", icon: <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" /> },
  shop: { label: "Shopping", icon: <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0" /> },
  see: { label: "Sightseeing", icon: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z" /><circle cx="12" cy="13" r="3" /></> },
  ride: { label: "Rides and games", icon: <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2ZM13 5v2M13 17v2M13 11v2" /> },
  shrine: { label: "Shrine or temple", icon: <path d="M3 5.5c6 1.3 12 1.3 18 0M5 9.5h14M7 6.5V21M17 6.5V21M12 6.8v2.7" /> },
  stay: { label: "Hotel and rest", icon: <path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9" /> },
  note: { label: "Reminder", icon: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></> },
};
const CAT_ORDER = Object.keys(CATS) as Cat[];
/** Optional rows get a dashed dot. */
const isOptional = (t: string, x: string) => /optional/i.test(t) || /^(optional|bonus)/i.test(x);
/** A card type that gets a symbol beside its name. */
const typeCat = (type: string): Cat | undefined => (type === "Eat" ? "eat" : type === "Shop" ? "shop" : undefined);

function CatIcon({ cat, className }: { cat: Cat; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      {CATS[cat].icon}
    </svg>
  );
}

/** A row's dot: the icon for what it is, solid if booked, hollow if planned, dashed if optional. */
function Dot({ cat, planned, optional, city, className }: { cat: Cat; planned: boolean; optional?: boolean; city: City; className?: string }) {
  const c = CITY[city];
  return (
    <span
      title={CATS[cat].label}
      className={cx(
        "flex size-[22px] shrink-0 items-center justify-center rounded-full",
        planned ? cx("border-[1.5px] bg-surface", c.border, c.text, optional && "border-dashed") : cx(c.bg, "text-paper"),
        className,
      )}
    >
      <CatIcon cat={cat} className="size-3" />
      <span className="sr-only">{CATS[cat].label}</span>
    </span>
  );
}

/**
 * A day as one line: what the agent booked (solid dot) and what Dhairya
 * planned around it (hollow dot), in time order, each dot showing what kind
 * of thing the row is. An entry that names a place
 * gets a button that jumps to its card.
 */
function Timeline({
  day,
  compact,
  onPlace,
}: {
  day: (typeof DAYS)[number];
  compact?: boolean;
  /** Phones open the card as a popup; by default it's scrolled to beside the day. */
  onPlace?: (place: Place, trigger: HTMLElement) => void;
}) {
  const c = CITY[day.city];
  const entries: Entry[] = day.timeline;
  return (
    <ol className={cx("relative", compact && "ml-1.5 border-l-2 border-line")}>
      {entries.map(([t, x, kind, cat, ref], i) => {
        const planned = kind === "x";
        const place = ref ? day.places.find((p) => p.id === ref) : undefined;
        const chipCat = place && typeCat(place.type);
        const dot = <Dot cat={cat} planned={planned} optional={isOptional(t, x)} city={day.city} />;
        const body = (
          <span className={cx(planned ? "text-ink" : "font-medium")}>
            <Rich text={x} />
            {place && (
              <button
                type="button"
                onClick={(e) => (onPlace ? onPlace(place, e.currentTarget) : showPlace(day.date, place.id))}
                aria-haspopup={onPlace ? "dialog" : undefined}
                className={cx(
                  "ml-1.5 inline rounded-md border border-line px-2 py-px text-left text-[.85rem] font-bold transition-colors hover:border-current",
                  c.soft,
                  c.text,
                )}
              >
                {chipCat && <CatIcon cat={chipCat} className="mr-1 inline size-3.5 -translate-y-px align-middle" />}
                {place.name} →
              </button>
            )}
          </span>
        );

        if (compact)
          return (
            <li key={i} className="relative grid grid-cols-[64px_minmax(0,1fr)] gap-2.5 py-1.5 pb-2.5 pl-5">
              <span className="absolute top-[5px] -left-[12px] rounded-full ring-2 ring-paper">{dot}</span>
              <span className="pt-px text-[.82rem] font-bold text-muted tabular-nums">{t}</span>
              <span className="min-w-0">{body}</span>
            </li>
          );

        return (
          <li key={i} className="grid grid-cols-[96px_44px_minmax(0,1fr)] items-start">
            <span className="pt-[3px] text-right text-sm font-bold text-muted tabular-nums">{t}</span>
            <span className="relative flex h-full justify-center">
              {i < entries.length - 1 && <span className="absolute top-3 bottom-0 w-px bg-line" />}
              <span className="relative mt-px rounded-full ring-4 ring-surface">{dot}</span>
            </span>
            <span className="min-w-0 pb-3.5">{body}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** A place to eat, shop, see or get to, with the link to directions. */
function PlaceCard({ place, date, city, popup }: { place: Place; date: string; city: City; popup?: boolean }) {
  const c = CITY[city];
  return (
    <div
      id={popup ? undefined : placeId(date, place.id)}
      className="place scroll-mt-24 rounded-2xl lg:scroll-mt-4 border border-line bg-surface px-4.5 py-3.5"
      style={{ ["--hl" as string]: `var(--${city})` }}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className={cx("text-[.85rem] font-bold tabular-nums", c.text)}>{place.t}</span>
        <span className="flex items-center gap-1 rounded border border-line px-1.5 text-[.68rem] font-bold tracking-wide text-muted uppercase">
          {typeCat(place.type) && <CatIcon cat={typeCat(place.type)!} className="size-3" />}
          {place.type}
        </span>
      </div>
      <a href={place.url} target="_blank" rel="noopener" className={cx("text-[1.05rem] leading-snug font-bold underline decoration-1 underline-offset-[3px]", c.text)}>
        {place.name}
      </a>
      <p className="mt-0.5 mb-1.5 text-[.95rem]">{place.what}</p>
      <div className="flex flex-col gap-0.5 text-[.85rem] text-muted">
        {place.dist && <span>📍 {place.dist}</span>}
        {place.hours && <span>🕒 {place.hours}</span>}
        {place.note && <span>{place.note}</span>}
      </div>
    </div>
  );
}

/**
 * Phones: a place opens as a sheet from the bottom instead of sitting in a
 * list under the day — the timeline stays short, and the details come up only
 * when asked for. Tap outside, ✕ or Escape closes it; focus goes back to the
 * button that opened it.
 */
function PlaceSheet({
  open,
  onClose,
}: {
  open: { place: Place; day: (typeof DAYS)[number]; trigger: HTMLElement } | null;
  onClose: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    const trigger = open.trigger;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      removeEventListener("keydown", onKey);
      trigger.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;
  const { place, day } = open;

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="presentation">
      <div className="sheet-scrim absolute inset-0 bg-[rgba(0,0,0,.6)]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={place.name}
        className="sheet relative w-full rounded-t-3xl bg-paper px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />
        <button
          ref={close}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full border border-line bg-surface text-muted"
        >
          ✕
        </button>
        <PlaceCard place={place} date={day.date} city={day.city} popup />
        <a
          href={place.url}
          target="_blank"
          rel="noopener"
          className={cx("mt-3 block rounded-xl py-3 text-center font-bold text-paper", CITY[day.city].bg)}
        >
          Open directions in Google Maps
        </a>
      </div>
    </div>
  );
}

function Places({ day }: { day: (typeof DAYS)[number] }) {
  if (!day.places.length) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="mx-1 mt-1 flex items-baseline justify-between gap-3">
        <b className="text-xs tracking-[.16em] text-muted uppercase">Places today</b>
        <span className="text-sm text-muted">{day.places.length} · tap a name for directions</span>
      </div>
      {day.places.map((p) => (
        <PlaceCard key={p.id} place={p} date={day.date} city={day.city} />
      ))}
    </div>
  );
}

/** Which dot means what. */
function Legend({ city = "tokyo" as City, cats, className }: { city?: City; cats?: Cat[]; className?: string }) {
  const shown = CAT_ORDER.filter((k) => !cats || cats.includes(k));
  return (
    <div className={cx("flex flex-col gap-1.5 text-sm text-muted", className)}>
      <p className="flex flex-wrap gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">
          <Dot cat="see" planned={false} city={city} className="scale-[.8]" />
          Booked by the agent
        </span>
        <span className="flex items-center gap-1.5">
          <Dot cat="see" planned city={city} className="scale-[.8]" />
          Planned by you
        </span>
        <span className="flex items-center gap-1.5">
          <Dot cat="see" planned optional city={city} className="scale-[.8]" />
          Optional
        </span>
      </p>
      <p className="flex flex-wrap gap-x-3.5 gap-y-1">
        {shown.map((k) => (
          <span key={k} className="flex items-center gap-1">
            <CatIcon cat={k} className="size-3.5" />
            {CATS[k].label}
          </span>
        ))}
      </p>
    </div>
  );
}

function Tip({ head, text }: { head: string; text: string }) {
  const warn = isWarn(head);
  return (
    <div className={cx("rounded-xl px-4 py-3 text-[.95rem]", warn ? "bg-alert-soft" : "border border-line bg-surface")}>
      <strong className={cx("mb-0.5 block", warn && "text-alert")}>{head}</strong>
      <Rich text={text} />
    </div>
  );
}

function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h3 id={id} className="mb-4 font-serif text-2xl font-extrabold lg:text-[1.7rem]">
      {children}
    </h3>
  );
}

function Flights() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {FLIGHTS.map((f) => (
        <div key={f.route} className="rounded-2xl border border-line bg-surface p-5">
          <div className="text-xs font-bold tracking-[.14em] text-muted uppercase">{f.when}</div>
          <div className="mt-1 font-serif text-xl font-extrabold">{f.route}</div>
          <ul className="mt-2 space-y-1 text-[.95rem]">
            {f.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">{f.who}</p>
        </div>
      ))}
    </div>
  );
}

function Hotels() {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {HOTELS.map((h) => (
        <div key={h.name} className="flex gap-4 p-4">
          <span className={cx("mt-1.5 h-10 w-1 shrink-0 rounded-full", CITY[h.city].bg)} />
          <div className="min-w-0">
            <div className="font-bold">{h.name}</div>
            <div className="text-sm text-muted">
              {h.nights} · {h.room}
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${h.name} ${h.address}`)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-sm underline underline-offset-2"
            >
              {h.address}
            </a>
            <div className="mt-1 text-sm">
              Check-in {h.checkIn} · check-out {h.checkOut}
            </div>
            <p className="mt-1 text-sm text-muted">{h.note}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const SPOT_STATUS: Record<SpotStatus, { label: string; cls: string }> = {
  plan: { label: "In your plan", cls: "bg-[rgba(236,238,240,.1)] text-ink" },
  tour: { label: "May be on the tour", cls: "border border-ink text-ink" },
  fit: { label: "Fits a gap", cls: "bg-travel-soft text-ink" },
  detour: { label: "Only as a detour", cls: "border border-line text-muted" },
};

/** How many temples and shrines show before "Show more" — the full list ran past 5,000 px on a phone. */
const SPOTS_SHOWN = 4;

/** Every temple and shrine that gives a goshuin, grouped by area. */
function Goshuin() {
  const [all, setAll] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const shown = all ? SPOTS : SPOTS.slice(0, SPOTS_SHOWN);
  const areas = [...new Set(shown.map((s) => s.area))];
  return (
    <div ref={top} className="space-y-8">
      {areas.map((area) => (
        <div key={area}>
          <h4 className="mb-3 font-serif text-lg font-extrabold">{area}</h4>
          <div className="grid gap-3 md:grid-cols-2">
            {shown.filter((s) => s.area === area).map((s) => {
              const c = CITY[s.city];
              const st = SPOT_STATUS[s.status];
              return (
                <div key={s.name} className="rounded-2xl border border-line bg-surface p-4.5">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={cx("rounded-full px-2 py-0.5 text-[.7rem] font-bold", st.cls)}>{st.label}</span>
                    <span className="rounded border border-line px-1.5 text-[.68rem] font-bold tracking-wide text-muted uppercase">{s.kind}</span>
                  </div>
                  <a href={s.url} target="_blank" rel="noopener" className={cx("text-[1.05rem] leading-snug font-bold underline decoration-1 underline-offset-[3px]", c.text)}>
                    {s.name}
                  </a>
                  <p className="mt-0.5 mb-1.5 text-[.95rem]">{s.when}</p>
                  <div className="flex flex-col gap-0.5 text-[.85rem] text-muted">
                    <span>🏷 {s.price}</span>
                    <span>🕒 {s.hours}</span>
                    <span>📍 {s.where}</span>
                    <span>{s.note}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <button
        type="button"
        aria-expanded={all}
        onClick={() => {
          setAll(!all);
          // Folding the list back up from its end would leave you far below it.
          if (all) requestAnimationFrame(() => top.current?.parentElement?.scrollIntoView({ block: "start" }));
        }}
        className="w-full cursor-pointer rounded-full border border-line bg-surface px-5 py-3 text-sm font-bold hover:border-muted md:w-auto md:py-2"
      >
        {all ? "Show less ↑" : <>Show more ↓ <span className="font-normal text-muted">· {SPOTS.length - SPOTS_SHOWN} more</span></>}
      </button>
    </div>
  );
}

function Todo() {
  return (
    <ol className="space-y-2.5">
      {TODO.map((t, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-alert-soft text-xs font-bold text-alert">
            {i + 1}
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ol>
  );
}

function Tips({ rows }: { rows: Row[] }) {
  return (
    <ul className="space-y-2.5 rounded-2xl border border-line bg-surface p-5 text-[.95rem]">
      {rows.map(([lead, rest]) => (
        <li key={lead}>
          <b>{lead}:</b> {rest}
        </li>
      ))}
    </ul>
  );
}

/* ---------- desktop ---------- */

function Desktop() {
  const today = useToday();
  const [sel, setSel] = useState(() => shownDay ?? Math.max(0, dayIndexOf(japanToday())));
  shownDay = sel;
  const day = DAYS[sel];
  const c = CITY[day.city];
  const rail = useRef<HTMLDivElement>(null);
  const slide = useSlide(rail, sel);

  const bar = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useHeightVar(bar, "--bar-h", 12);

  const go = useCallback((i: number) => {
    const n = Math.max(0, Math.min(DAYS.length - 1, i));
    setSel(n);

    // Switching days from deep inside a long one would land you mid-way down
    // the next; bring the new day's top up under the pinned date bar instead.
    requestAnimationFrame(() => {
      const top = panel.current?.getBoundingClientRect().top ?? 0;
      const barH = bar.current?.offsetHeight ?? 0;
      if (top < barH) {
        const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
        scrollTo({ top: scrollY + top - barH - 12, behavior: reduce ? "auto" : "smooth" });
      }
    });
  }, []);

  // A new day began while the page was open: go to it, as a fresh visit would.
  const seenToday = useRef(today);
  useEffect(() => {
    if (today === seenToday.current) return;
    seenToday.current = today;
    const todayAt = dayIndexOf(today);
    if (todayAt >= 0) go(todayAt);
  }, [today, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") go(sel + 1);
      if (e.key === "ArrowLeft") go(sel - 1);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [sel, go]);

  return (
    <div className="mx-auto max-w-[1320px] px-6 pt-6 pb-16 xl:px-14 xl:pt-9">
      {/* Header */}
      <header className="flex items-end justify-between gap-6 xl:gap-10">
        <div>
          <p className="text-sm font-bold tracking-[.22em] text-muted uppercase">19 – 28 October 2026</p>
          <h1 className="mt-1.5 font-serif text-[2.75rem] leading-none font-extrabold tracking-tight xl:text-6xl">Japan</h1>
          <p className="mt-2 text-muted xl:mt-3 xl:text-lg">Dhairya, Mum and Dad · Tokyo, Kyoto, Osaka</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">
          {/* Below xl (an iPad on its side) there's no room; the sections are a scroll away. */}
          <button
            onClick={() => document.getElementById("trip-info")?.scrollIntoView({ behavior: "smooth" })}
            className="hidden cursor-pointer rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold hover:border-muted xl:block"
          >
            Flights &amp; hotels ↓
          </button>
          <TripTimer className="px-4 py-2" />
          <div className="rounded-full bg-alert px-4 py-2 text-sm font-bold text-paper">{countdownText(today)}</div>
        </div>
      </header>

      {/* Timeline */}
      <div className="mt-5 xl:mt-7">
        <div className="grid grid-cols-10 gap-2.5">
          {SEGMENTS.map((s, i) => (
            <div key={i} style={{ gridColumn: `span ${s.span}` }}>
              <div className={cx("h-1.5 rounded-full", CITY[s.city].bg)} />
              <div className="mt-2 flex items-baseline gap-2">
                <span className={cx("font-serif text-lg font-extrabold", CITY[s.city].text)}>{CITY[s.city].name}</span>
                {s.city !== "travel" && <span className="text-xs text-muted">{s.nights} nights</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* The date buttons stay pinned while a long day scrolls under them. */}
      <div ref={bar} className="sticky top-0 z-30 -mx-4 bg-paper px-4 pt-3 pb-3 xl:-mx-6 xl:px-6">
        {/* Three layers: card backgrounds, the city-coloured highlight that
            slides between them, then the labels on top — so text stays
            readable while the highlight passes underneath it. */}
        <div ref={rail} className="relative isolate">
          <div aria-hidden className="absolute inset-0 grid grid-cols-10 gap-2.5">
            {DAYS.map((d) => (
              <div key={d.date} className="rounded-2xl border border-line bg-surface" />
            ))}
          </div>

          <span
            aria-hidden
            className={cx(
              "absolute top-0 left-0 rounded-2xl shadow-lg ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none",
              slide && !slide.first ? "transition-[transform,width,background-color] duration-500" : "transition-none",
              c.bg,
              !slide && "opacity-0",
            )}
            style={slide ? { width: slide.w, height: slide.h, transform: `translate(${slide.x}px, ${slide.y}px)` } : undefined}
          />

          <div className="relative grid grid-cols-10 gap-2.5" role="tablist" aria-label="Days">
            {DAYS.map((d, i) => {
              const on = i === sel;
              const dc = CITY[d.city];
              return (
                <button
                  key={d.date}
                  data-slot={i}
                  role="tab"
                  aria-selected={on}
                  onClick={() => go(i)}
                  className={cx(
                    "group relative flex min-h-[84px] cursor-pointer flex-col rounded-2xl p-2.5 text-left transition-colors duration-300 xl:min-h-[104px] xl:p-3",
                    on ? "text-paper" : "hover:bg-[rgba(236,238,240,.05)]",
                  )}
                >
                  <span className={cx("text-xs font-bold uppercase transition-colors duration-300", on ? "text-paper/80" : "text-muted")}>{weekday(d.date)}</span>
                  <span className={cx("font-serif text-3xl leading-tight font-extrabold transition-colors duration-300", !on && dc.text)}>{dayNum(d.date)}</span>
                  <span className={cx("mt-auto line-clamp-2 text-xs leading-snug transition-colors duration-300", on ? "text-paper/90" : "text-muted")}>{d.short}</span>
                  {d.date === today && (
                    <span className="absolute top-2.5 right-2.5 rounded-full bg-alert px-1.5 py-0.5 text-[.6rem] font-bold text-paper uppercase">
                      Today
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected day */}
      <div ref={panel} className="mt-3 grid grid-cols-12 items-start gap-6" role="tabpanel" aria-label={`${dayNum(day.date)} October`}>
        <article key={day.date} className="day-fade col-span-7 rounded-3xl border border-line bg-surface p-6 xl:p-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className={cx("rounded-full px-3 py-1 text-sm font-bold", c.soft, c.text)}>{c.name}</span>
              <span className="text-sm text-muted">
                Day {sel + 1} of {DAYS.length}
              </span>
            </div>
            <div className="flex gap-1.5">
              <NavBtn disabled={sel === 0} onClick={() => go(sel - 1)} label="Previous day">
                ←
              </NavBtn>
              <NavBtn disabled={sel === DAYS.length - 1} onClick={() => go(sel + 1)} label="Next day">
                →
              </NavBtn>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-5 xl:mt-6 xl:gap-6">
            <div className={cx("font-serif text-[5rem] leading-[.8] font-extrabold xl:text-[6.5rem]", c.text)}>{dayNum(day.date)}</div>
            <div className="min-w-0 pt-1">
              <div className="text-sm font-bold tracking-[.14em] text-muted uppercase">{weekdayLong(day.date)}, October</div>
              <h2 className="mt-1 font-serif text-3xl leading-tight font-extrabold xl:text-4xl">{day.title}</h2>
            </div>
          </div>
          <p className="mt-4 max-w-[62ch] text-muted xl:mt-5 xl:text-lg">
            <Rich text={day.gist} />
          </p>

          <div className="mt-6 mb-4 flex flex-wrap items-baseline justify-between gap-3 xl:mt-8">
            <h4 className="text-xs font-bold tracking-[.18em] text-muted uppercase">The day</h4>
            <Legend city={day.city} cats={[...new Set(day.timeline.map((e) => e[3]))]} />
          </div>
          <Timeline day={day} />
        </article>

        {/* Sticky and scrollable, so a place card is in reach from anywhere in a long day. */}
        <aside
          key={`${day.date}-aside`}
          className="day-fade no-scrollbar sticky top-[var(--bar-h,9rem)] col-span-5 -m-1 flex max-h-[calc(100dvh-var(--bar-h,9rem)-1rem)] flex-col gap-4 overflow-y-auto p-1"
        >
          <div className={cx("rounded-3xl p-5 xl:p-7", c.soft)}>
            <div className="text-xs font-bold tracking-[.18em] text-muted uppercase">Tonight</div>
            <div className={cx("mt-1 font-serif text-xl font-extrabold xl:text-2xl", c.text)}>{day.sleep}</div>
          </div>

          <Places day={day} />

          {day.tips.length > 0 && (
            <div className="flex flex-col gap-3">
              {day.tips.map(([h, x]) => (
                <Tip key={h} head={h} text={x} />
              ))}
            </div>
          )}

          <p className="text-center text-sm text-muted">
            Tip: use <kbd className="rounded border border-line bg-surface px-1.5 font-sans">←</kbd>{" "}
            <kbd className="rounded border border-line bg-surface px-1.5 font-sans">→</kbd> to switch days
          </p>
        </aside>
      </div>

      <TripInfo />

      <Footer />
    </div>
  );
}

/** Flights, hotels and the notes under the days. Memoised: nothing in it changes with the day. */
const TripInfo = memo(function TripInfo() {
  return (
    <div id="trip-info" className="mt-16 grid scroll-mt-8 grid-cols-12 gap-x-6 gap-y-12">
      <section className="col-span-7">
        <SectionTitle>Flights</SectionTitle>
        <Flights />
      </section>
      <section className="col-span-5">
        <SectionTitle>Hotels</SectionTitle>
        <Hotels />
      </section>
      <section className="col-span-12">
        <SectionTitle>Goshuin stamps</SectionTitle>
        <Goshuin />
      </section>
      <section className="col-span-7">
        <SectionTitle>Still to check with the agent</SectionTitle>
        <Todo />
      </section>
      <section className="col-span-5">
        <SectionTitle>Goshuin book and souvenirs</SectionTitle>
        <Tips rows={GOSHUIN} />
      </section>
      <section className="col-span-7">
        <SectionTitle>How to ride the metro</SectionTitle>
        <Tips rows={METRO} />
      </section>
    </div>
  );
});

function NavBtn({ children, label, ...p }: { children: ReactNode; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      {...p}
      aria-label={label}
      className="flex size-10 cursor-pointer items-center justify-center rounded-full border border-line text-lg transition hover:border-muted disabled:cursor-default disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Footer() {
  return (
    <footer className="mt-14 border-t border-line pt-6 pb-8 text-sm text-muted">
      Package by Capricorn Tours LLP. Filled dots come from the itinerary or the agent; hollow dots are suggestions. Breakfast is included every day; other meals, local transport, tips and city tax are paid on the spot.
      <a href="/projects" className="mt-3 block font-bold text-ink underline decoration-line underline-offset-4 hover:decoration-muted">
        ← Built by Dhairya Khetan
      </a>
    </footer>
  );
}

/* ---------- mobile ---------- */

/**
 * Puts a phone day just under the date strip and keeps it there while the days
 * above it finish drawing: off-screen days are placeholders (.day-lazy) that
 * take their real height when drawn, which pushes the target. Aims each frame
 * until it holds still; stops the moment the user scrolls. Returns a cancel.
 */
function pinDay(i: number) {
  let frames = 0;
  let last = NaN;
  let still = 0;
  let done = false;
  const stop = () => {
    done = true;
    removeEventListener("wheel", stop);
    removeEventListener("touchstart", stop);
  };
  addEventListener("wheel", stop, { passive: true });
  addEventListener("touchstart", stop, { passive: true });
  const aim = () => {
    const el = document.getElementById(dayId(i));
    if (done || !el || frames++ > 90) return stop();
    instantly(() => el.scrollIntoView());
    const top = el.getBoundingClientRect().top;
    still = top === last ? still + 1 : 0;
    last = top;
    if (still < 3) requestAnimationFrame(aim);
    else stop();
  };
  requestAnimationFrame(aim);
  return stop;
}

/** Runs once a smooth scroll has finished (or after a second where `scrollend` isn't supported). */
function afterScroll(fn: () => void) {
  let ran = false;
  const cancel = () => (ran = true);
  const run = () => {
    removeEventListener("scrollend", run);
    removeEventListener("wheel", cancel);
    removeEventListener("touchstart", cancel);
    if (ran) return;
    ran = true;
    fn();
  };
  addEventListener("scrollend", run, { once: true });
  // The user took over mid-scroll: leave them where they are.
  addEventListener("wheel", cancel, { passive: true });
  addEventListener("touchstart", cancel, { passive: true });
  setTimeout(run, "onscrollend" in window ? 1500 : 900);
}

function Mobile() {
  const today = useToday();
  const [current, setCurrent] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ place: Place; day: (typeof DAYS)[number]; trigger: HTMLElement } | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const openSheet = useCallback((place: Place, day: (typeof DAYS)[number], trigger: HTMLElement) => setSheet({ place, day, trigger }), []);
  const nav = useRef<HTMLElement>(null);
  useHeightVar(nav, "--strip-h", 16);
  const strip = useRef<HTMLDivElement>(null);
  const ring = useSlide(strip, current ? Number(current.slice(3)) - 1 : -1);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setCurrent(vis[0].target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    document.querySelectorAll("article[data-day]").forEach((el) => io.observe(el));
    const start = shownDay ?? dayIndexOf(japanToday());
    const stop = start >= 0 ? pinDay(start) : () => {};
    return () => {
      io.disconnect();
      stop();
    };
  }, []);

  // A new day began while the page was open: bring it up, as a fresh visit would.
  const seenToday = useRef(today);
  useEffect(() => {
    if (today === seenToday.current) return;
    seenToday.current = today;
    const todayAt = dayIndexOf(today);
    if (todayAt >= 0) document.getElementById(dayId(todayAt))?.scrollIntoView();
  }, [today]);

  useEffect(() => {
    if (current) shownDay = Number(current.slice(3)) - 1;
    const s = strip.current;
    const t = current ? s?.querySelector<HTMLElement>(`[data-slot="${Number(current.slice(3)) - 1}"]`) : null;
    if (s && t) s.scrollTo({ left: t.offsetLeft - (s.clientWidth - t.offsetWidth) / 2, behavior: "smooth" });
  }, [current]);

  return (
    <>
      <header className="mx-auto max-w-[680px] px-4 pt-[calc(env(safe-area-inset-top,0px)+32px)] pb-5 md:max-w-[768px] md:px-6">
        <p className="text-xs font-bold tracking-[.2em] text-muted uppercase">19 – 28 October 2026</p>
        <h1 className="mt-1 font-serif text-[2.6rem] leading-none font-extrabold">Japan</h1>
        <p className="mt-2 text-muted">Dhairya, Mum and Dad · Tokyo, Kyoto, Osaka</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-alert px-3 py-1 text-sm font-bold text-paper">{countdownText(today)}</span>
          <TripTimer className="px-3 py-1" />
        </div>
        <Legend className="mt-4" />
        <div className="mt-6 grid grid-cols-10 gap-1">
          {SEGMENTS.map((s, i) => (
            <div key={i} style={{ gridColumn: `span ${s.span}` }} className="min-w-0">
              <div className={cx("h-1.5 rounded-full", CITY[s.city].bg)} />
              {s.city !== "travel" && (
                <div className="mt-1.5">
                  <b className={cx("block font-serif text-base leading-tight", CITY[s.city].text)}>{CITY[s.city].name}</b>
                  <small className="text-muted">{s.nights} nights</small>
                </div>
              )}
            </div>
          ))}
        </div>
      </header>

      <nav ref={nav} aria-label="Jump to a day" className="sticky top-0 z-10 border-b border-line bg-paper pt-[env(safe-area-inset-top,0px)]">
        <div ref={strip} className="no-scrollbar relative mx-auto flex max-w-[680px] gap-1.5 overflow-x-auto px-4 py-2.5 md:max-w-[768px] md:px-6">
          {/* A ring, not a fill, so it can sit on top and slide over the dates
              without hiding them. */}
          <span
            aria-hidden
            className={cx(
              "pointer-events-none absolute top-0 left-0 z-10 rounded-xl ring-2 ring-ink ring-offset-2 ring-offset-paper ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none",
              ring && !ring.first ? "transition-[transform,width] duration-500" : "transition-none",
              !ring && "opacity-0",
            )}
            style={ring ? { width: ring.w, height: ring.h, transform: `translate(${ring.x}px, ${ring.y}px)` } : undefined}
          />
          {DAYS.map((d, i) => {
            const id = dayId(i);
            const on = current === id;
            const isToday = d.date === today;
            return (
              <button
                type="button"
                key={d.date}
                data-slot={i}
                onClick={() => {
                  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
                  afterScroll(() => pinDay(i));
                }}
                aria-current={on || undefined}
                className={cx(
                  "min-w-[52px] shrink-0 rounded-xl border border-b-[3px] px-2.5 pt-1.5 pb-1 text-center leading-tight md:flex-1",
                  CITY[d.city].border,
                  "border-t-line border-r-line border-l-line bg-surface",
                )}
              >
                <span className="block font-serif text-lg font-extrabold">{dayNum(d.date)}</span>
                <span className={cx("text-[.7rem]", isToday ? "font-bold text-alert" : "text-muted")}>{isToday ? "Today" : weekday(d.date)}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="mx-auto max-w-[680px] px-4 md:max-w-[768px] md:px-6">
        <MobileDays today={today} onPlace={openSheet} />

        <MobileInfo />
        <Footer />
      </div>
      <PlaceSheet open={sheet} onClose={closeSheet} />
    </>
  );
}

/* ---------- app ---------- */

/**
 * The day on screen, shared by both layouts. Turning a tablet or resizing a
 * window across the breakpoint swaps Desktop for Mobile; the new one opens on
 * this day instead of jumping back to today.
 */
let shownDay: number | null = null;

export default function App() {
  const desktop = useMedia("(min-width: 1024px)");
  const countdown = useSyncExternalStore(subscribePath, onCountdown);
  useOffline();
  if (countdown) return <Countdown />;
  // Keyed so the swap between layouts fades in rather than snapping.
  return (
    <div key={desktop ? "desktop" : "mobile"} className="day-fade">
      {desktop ? <Desktop /> : <Mobile />}
    </div>
  );
}

/**
 * The phone's ten days. Memoised so that scrolling (which moves the date
 * strip's ring) and opening a place sheet don't redraw every day.
 */
/**
 * The phone's ten days. Memoised so that scrolling (which moves the date
 * strip's ring) and opening a place sheet don't redraw every day. Only the
 * days near the screen are built: the first draw on a slow tablet (an iPad
 * mini 4 on iOS 15, which has no content-visibility) is the day you open on
 * and its neighbours, and the rest are built as you scroll toward them.
 */
const MobileDays = memo(function MobileDays({
  today,
  onPlace,
}: {
  today: string;
  onPlace: (place: Place, day: (typeof DAYS)[number], trigger: HTMLElement) => void;
}) {
  const [drawn, setDrawn] = useState(() => {
    const start = shownDay ?? Math.max(0, dayIndexOf(japanToday()));
    return new Set([start - 1, start, start + 1].filter((i) => i >= 0 && i < DAYS.length));
  });
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const near = entries.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.i));
        if (near.length) setDrawn((prev) => (near.every((i) => prev.has(i)) ? prev : new Set([...prev, ...near])));
      },
      { rootMargin: "1500px 0px" },
    );
    document.querySelectorAll("article[data-day]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <main>
      {DAYS.map((d, i) => (
        <MobileDay key={d.date} d={d} i={i} today={today} drawn={drawn.has(i)} onPlace={onPlace} />
      ))}
    </main>
  );
});

/** One phone day. Memoised, so building a neighbour doesn't redraw it. */
const MobileDay = memo(function MobileDay({
  d,
  i,
  today,
  drawn,
  onPlace,
}: {
  d: (typeof DAYS)[number];
  i: number;
  today: string;
  drawn: boolean;
  onPlace: (place: Place, day: (typeof DAYS)[number], trigger: HTMLElement) => void;
}) {
  const c = CITY[d.city];
  return (
    <article id={dayId(i)} data-day data-i={i} className="day-lazy scroll-mt-[var(--strip-h,84px)] grid grid-cols-[48px_minmax(0,1fr)] gap-x-3 border-b border-line py-7 sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-x-4">
      {/* Pinned under the date strip while its day scrolls by. */}
      <div
        className={cx(
          "sticky top-[var(--strip-h,84px)] self-start text-right font-serif text-[2.4rem] leading-[.9] font-extrabold sm:text-5xl",
          c.text,
        )}
      >
        {dayNum(d.date)}
        <small className="mt-2 block font-sans text-xs leading-snug font-medium text-muted">
          {weekday(d.date)}
          <br />
          Oct
          <br />
          Day {i + 1}
        </small>
      </div>
      <div className="min-w-0">
        <span className={cx("mb-1.5 inline-block rounded-full px-2.5 py-0.5 text-sm font-bold", c.soft, c.text)}>{c.name}</span>
        {d.date === today && <span className="ml-1.5 rounded-full bg-alert px-2.5 py-0.5 text-sm font-bold text-paper">Today</span>}
        <h2 className="mt-0.5 mb-2 font-serif text-[1.4rem] leading-tight font-extrabold sm:text-2xl">{d.title}</h2>
        <p className="mb-3">
          <Rich text={d.gist} />
        </p>
        {drawn ? (
          <>
            <Timeline day={d} compact onPlace={(place, trigger) => onPlace(place, d, trigger)} />
            {/* Places the timeline doesn't name still need a way in. */}
            {(() => {
              const loose = d.places.filter((p) => !d.timeline.some((e) => e[4] === p.id));
              if (!loose.length) return null;
              return (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                  Also:
                  {loose.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-haspopup="dialog"
                      onClick={(e) => onPlace(p, d, e.currentTarget)}
                      className={cx("rounded-md border border-line px-2 py-px text-[.85rem] font-bold", c.soft, c.text)}
                    >
                      {p.name} →
                    </button>
                  ))}
                </p>
              );
            })()}
            {d.tips.length > 0 && (
              <div className="mt-3 space-y-2.5">
                {d.tips.map(([h, x]) => (
                  <Tip key={h} head={h} text={x} />
                ))}
              </div>
            )}
            <p className="mt-3 text-[.95rem] text-muted">
              Sleep: <b className="text-ink">{d.sleep}</b>
            </p>
          </>
        ) : (
          // Roughly the day's height, so the page doesn't jump much as days are built.
          <div aria-hidden style={{ height: d.timeline.length * 56 + d.tips.length * 70 + 60 }} />
        )}
      </div>
    </article>
  );
});

/** The notes under the phone's days. Static, so drawn once. */
const MobileInfo = memo(function MobileInfo() {
  return (
    <>
      {(
        [
          ["flights", "Flights", <Flights />],
          ["hotels", "Hotels", <Hotels />],
          ["goshuin-stamps", "Goshuin stamps", <Goshuin />],
          ["todo", "Still to check with the agent", <Todo />],
          ["goshuin", "Goshuin book and souvenirs", <Tips rows={GOSHUIN} />],
          ["metro", "How to ride the metro", <Tips rows={METRO} />],
        ] as const
      ).map(([id, title, body]) => (
        <Fragment key={id}>
          <section id={id} className="pt-10">
            <SectionTitle>{title}</SectionTitle>
            {body}
          </section>
        </Fragment>
      ))}
    </>
  );
});
