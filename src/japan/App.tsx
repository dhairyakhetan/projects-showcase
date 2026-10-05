"use client";

import { Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { DAYS, FLIGHTS, HOTELS, TODO, type City, type Entry, type Place } from "./data";

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
const dayPath = (i: number) => BASE + "/" + dayId(i);
/** Index of the day in the URL (/Japan2026/day1 … /day10), or -1. */
const pathDay = () => {
  const m = location.pathname.match(/^\/Japan2026\/day(\d+)\/?$/);
  const i = m ? Number(m[1]) - 1 : -1;
  return i >= 0 && i < DAYS.length ? i : -1;
};
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const todayIndex = DAYS.findIndex((d) => d.date === TODAY);
const START = DAYS[0].date;
const END = DAYS[DAYS.length - 1].date;
const daysToGo = Math.round((jst(START).getTime() - jst(TODAY).getTime()) / 86400000);
const isWarn = (h: string) => /error|warning/i.test(h);

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

function countdownText() {
  if (TODAY < START) return daysToGo === 1 ? "Starts tomorrow" : `${daysToGo} days to go`;
  if (TODAY <= END) return "Trip in progress";
  return "Trip complete";
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

/**
 * A day as one line: what the agent booked (filled dot) and what Dhairya
 * planned around it (hollow dot), in time order. An entry that names a place
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
      {entries.map(([t, x, kind, ref], i) => {
        const planned = kind === "x";
        const place = ref ? day.places.find((p) => p.id === ref) : undefined;
        const dot = cx("size-3 rounded-full", planned ? cx("border-2 bg-surface", c.border) : c.bg);
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
                {place.name} →
              </button>
            )}
          </span>
        );

        if (compact)
          return (
            <li key={i} className="relative grid grid-cols-[64px_minmax(0,1fr)] gap-2.5 py-1.5 pb-2.5 pl-4">
              <span className={cx("absolute top-[11px] -left-[7px]", dot)} />
              <span className="pt-px text-[.82rem] font-bold text-muted tabular-nums">{t}</span>
              <span className="min-w-0">{body}</span>
            </li>
          );

        return (
          <li key={i} className="grid grid-cols-[96px_28px_minmax(0,1fr)] items-start">
            <span className="pt-[3px] text-right text-sm font-bold text-muted tabular-nums">{t}</span>
            <span className="relative flex h-full justify-center">
              {i < entries.length - 1 && <span className="absolute top-3 bottom-0 w-px bg-line" />}
              <span className={cx("relative mt-[7px] ring-4 ring-surface", dot)} />
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
        <span className="rounded border border-line px-1.5 text-[.68rem] font-bold tracking-wide text-muted uppercase">
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
      <div className="sheet-scrim absolute inset-0 bg-ink/40" onClick={onClose} />
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
function Legend({ city = "tokyo" as City, className }: { city?: City; className?: string }) {
  const c = CITY[city];
  return (
    <p className={cx("flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted", className)}>
      <span className="flex items-center gap-1.5">
        <span className={cx("size-2.5 rounded-full", c.bg)} />
        From your itinerary
      </span>
      <span className="flex items-center gap-1.5">
        <span className={cx("size-2.5 rounded-full border-2", c.border)} />
        Planned by you
      </span>
    </p>
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
          </div>
        </div>
      ))}
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

/* ---------- desktop ---------- */

function Desktop() {
  const initial = () => {
    const fromPath = pathDay();
    if (fromPath >= 0) return fromPath;
    return todayIndex >= 0 ? todayIndex : 0;
  };
  const [sel, setSel] = useState(initial);
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
    if (location.pathname !== dayPath(n)) history.pushState(null, "", dayPath(n));

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

  useEffect(() => {
    const onPop = () => setSel(initial());
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);

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
    <div className="mx-auto max-w-[1320px] px-10 pt-9 pb-16 xl:px-14">
      {/* Header */}
      <header className="flex items-end justify-between gap-10">
        <div>
          <p className="text-sm font-bold tracking-[.22em] text-muted uppercase">19 – 28 October 2026</p>
          <h1 className="mt-1.5 font-serif text-[3.25rem] leading-none font-extrabold tracking-tight xl:text-6xl">Japan</h1>
          <p className="mt-3 text-lg text-muted">Dhairya, Mum and Dad · Tokyo, Kyoto, Osaka</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => document.getElementById("trip-info")?.scrollIntoView({ behavior: "smooth" })}
            className="cursor-pointer rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold hover:border-muted"
          >
            Flights &amp; hotels ↓
          </button>
          <div className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper">{countdownText()}</div>
        </div>
      </header>

      {/* Timeline */}
      <div className="mt-7">
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
      <div ref={bar} className="sticky top-0 z-30 -mx-4 bg-paper/95 px-4 pt-3 pb-3 backdrop-blur xl:-mx-6 xl:px-6">
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
                    "group relative flex min-h-[104px] cursor-pointer flex-col rounded-2xl p-3 text-left transition-colors duration-300",
                    on ? "text-paper" : "hover:bg-ink/[.04]",
                  )}
                >
                  <span className={cx("text-xs font-bold uppercase transition-colors duration-300", on ? "text-paper/80" : "text-muted")}>{weekday(d.date)}</span>
                  <span className={cx("font-serif text-3xl leading-tight font-extrabold transition-colors duration-300", !on && dc.text)}>{dayNum(d.date)}</span>
                  <span className={cx("mt-auto line-clamp-2 text-xs leading-snug transition-colors duration-300", on ? "text-paper/90" : "text-muted")}>{d.short}</span>
                  {d.date === TODAY && (
                    <span className="absolute top-2.5 right-2.5 rounded-full bg-alert px-1.5 py-0.5 text-[.6rem] font-bold text-white uppercase">
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
        <article key={day.date} className="day-fade col-span-7 rounded-3xl border border-line bg-surface p-8 xl:p-10">
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

          <div className="mt-6 flex items-start gap-6">
            <div className={cx("font-serif text-[6.5rem] leading-[.8] font-extrabold", c.text)}>{dayNum(day.date)}</div>
            <div className="min-w-0 pt-1">
              <div className="text-sm font-bold tracking-[.14em] text-muted uppercase">{weekdayLong(day.date)}, October</div>
              <h2 className="mt-1 font-serif text-4xl leading-tight font-extrabold">{day.title}</h2>
            </div>
          </div>
          <p className="mt-5 max-w-[62ch] text-lg text-muted">
            <Rich text={day.gist} />
          </p>

          <div className="mt-8 mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h4 className="text-xs font-bold tracking-[.18em] text-muted uppercase">The day</h4>
            <Legend city={day.city} />
          </div>
          <Timeline day={day} />
        </article>

        {/* Sticky and scrollable, so a place card is in reach from anywhere in a long day. */}
        <aside
          key={`${day.date}-aside`}
          className="day-fade no-scrollbar sticky top-[var(--bar-h,9rem)] col-span-5 -m-1 flex max-h-[calc(100dvh-var(--bar-h,9rem)-1rem)] flex-col gap-4 overflow-y-auto p-1"
        >
          <div className={cx("rounded-3xl p-7", c.soft)}>
            <div className="text-xs font-bold tracking-[.18em] text-muted uppercase">Tonight</div>
            <div className={cx("mt-1 font-serif text-2xl font-extrabold", c.text)}>{day.sleep}</div>
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

      {/* Reference */}
      <div id="trip-info" className="mt-16 grid scroll-mt-8 grid-cols-12 gap-x-6 gap-y-12">
        <section className="col-span-7">
          <SectionTitle>Flights</SectionTitle>
          <Flights />
        </section>
        <section className="col-span-5">
          <SectionTitle>Hotels</SectionTitle>
          <Hotels />
        </section>
        <section className="col-span-7">
          <SectionTitle>Still to check with the agent</SectionTitle>
          <Todo />
        </section>
      </div>

      <Footer />
    </div>
  );
}

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

function Mobile() {
  const [current, setCurrent] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ place: Place; day: (typeof DAYS)[number]; trigger: HTMLElement } | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
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
    const start = pathDay() >= 0 ? pathDay() : todayIndex;
    if (start >= 0) setTimeout(() => document.getElementById(dayId(start))?.scrollIntoView(), 50);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const s = strip.current;
    const t = s?.querySelector<HTMLElement>(`[href="${BASE}/${current}"]`);
    if (s && t) s.scrollTo({ left: t.offsetLeft - (s.clientWidth - t.offsetWidth) / 2, behavior: "smooth" });
    if (current && location.pathname !== `${BASE}/${current}`) history.replaceState(null, "", `${BASE}/${current}`);
  }, [current]);

  return (
    <>
      <header className="mx-auto max-w-[680px] px-4 pt-[calc(env(safe-area-inset-top,0px)+32px)] pb-5 md:px-6">
        <p className="text-xs font-bold tracking-[.2em] text-muted uppercase">19 – 28 October 2026</p>
        <h1 className="mt-1 font-serif text-[2.6rem] leading-none font-extrabold">Japan</h1>
        <p className="mt-2 text-muted">Dhairya, Mum and Dad · Tokyo, Kyoto, Osaka</p>
        <span className="mt-3 inline-block rounded-full bg-ink px-3 py-1 text-sm font-bold text-paper">{countdownText()}</span>
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

      <nav ref={nav} aria-label="Jump to a day" className="sticky top-0 z-10 border-b border-line bg-paper/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur">
        <div ref={strip} className="no-scrollbar relative mx-auto flex max-w-[680px] gap-1.5 overflow-x-auto px-4 py-2.5 md:px-6">
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
            const today = d.date === TODAY;
            return (
              <a
                key={d.date}
                href={dayPath(i)}
                data-slot={i}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
                }}
                aria-current={on || undefined}
                className={cx(
                  "min-w-[52px] shrink-0 rounded-xl border border-b-[3px] px-2.5 pt-1.5 pb-1 text-center leading-tight",
                  CITY[d.city].border,
                  today ? "bg-ink text-paper" : "border-t-line border-r-line border-l-line bg-surface",
                )}
              >
                <span className="block font-serif text-lg font-extrabold">{dayNum(d.date)}</span>
                <span className={cx("text-[.7rem]", today ? "text-paper" : "text-muted")}>{weekday(d.date)}</span>
              </a>
            );
          })}
        </div>
      </nav>

      <div className="mx-auto max-w-[680px] px-4 md:px-6">
        <main>
          {DAYS.map((d, i) => {
            const c = CITY[d.city];
            return (
              <article key={d.date} id={dayId(i)} data-day className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-3 border-b border-line py-7 sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-x-4">
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
                  {d.date === TODAY && <span className="ml-1.5 rounded-full bg-ink px-2.5 py-0.5 text-sm font-bold text-paper">Today</span>}
                  <h2 className="mt-0.5 mb-2 font-serif text-[1.4rem] leading-tight font-extrabold sm:text-2xl">{d.title}</h2>
                  <p className="mb-3">
                    <Rich text={d.gist} />
                  </p>
                  <Timeline day={d} compact onPlace={(place, trigger) => setSheet({ place, day: d, trigger })} />
                  {/* Places the timeline doesn't name still need a way in. */}
                  {(() => {
                    const loose = d.places.filter((p) => !d.timeline.some((e) => e[3] === p.id));
                    if (!loose.length) return null;
                    return (
                      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                        Also:
                        {loose.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            aria-haspopup="dialog"
                            onClick={(e) => setSheet({ place: p, day: d, trigger: e.currentTarget })}
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
                </div>
              </article>
            );
          })}
        </main>

        {(
          [
            ["flights", "Flights", <Flights />],
            ["hotels", "Hotels", <Hotels />],
            ["todo", "Still to check with the agent", <Todo />],
          ] as const
        ).map(([id, title, body]) => (
          <Fragment key={id}>
            <section id={id} className="pt-10">
              <SectionTitle>{title}</SectionTitle>
              {body}
            </section>
          </Fragment>
        ))}
        <Footer />
      </div>
      <PlaceSheet open={sheet} onClose={closeSheet} />
    </>
  );
}

/* ---------- app ---------- */

export default function App() {
  const desktop = useMedia("(min-width: 1024px)");
  return desktop ? <Desktop /> : <Mobile />;
}
