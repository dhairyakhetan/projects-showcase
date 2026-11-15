/**
 * The loading dock — the big intro screen — plays once per visit: the first
 * page load in a tab, and again on a hard refresh.
 *
 * The dock is in the server HTML and shown by CSS only while
 * <html data-intro="on">, which the blocking script below sets before first
 * paint. So it's there from the very first frame instead of popping in after
 * hydration, and a visitor without JS (or a crawler) never gets it.
 */

/** Set by middleware.ts on a hard refresh; tells INTRO_INIT to play it again. */
export const REPLAY_COOKIE = "intro-replay";
export const SEEN_KEY = "intro-seen";
/** Fired on window once the dock has gone and the site is showing. */
export const INTRO_DONE = "intro:done";

/** True while the dock is up — things behind it hold their entrances until INTRO_DONE. */
export function introShowing() {
  return document.documentElement.dataset.intro === "on";
}

/**
 * Inline, blocking, in <head>. If the page never hydrates to dismiss the dock
 * (a script error, a dead network), it lifts itself after a while rather than
 * leaving a wall over the site.
 */
export const INTRO_INIT = `
(function () {
  try {
    var root = document.documentElement;
    var replay = document.cookie.indexOf("${REPLAY_COOKIE}=1") !== -1;
    if (replay) document.cookie = "${REPLAY_COOKIE}=; Max-Age=0; path=/";
    if (!replay && sessionStorage.getItem("${SEEN_KEY}")) return;
    root.dataset.intro = "on";
    setTimeout(function () {
      if (!root.dataset.introReady) delete root.dataset.intro;
    }, 15000);
  } catch (e) {}
})();
`;

/** Fired to bring the dock back on demand (the palette's "Replay the intro"). */
export const INTRO_REPLAY = "intro:replay";

export function replayIntro() {
  document.documentElement.dataset.intro = "on";
  window.dispatchEvent(new Event(INTRO_REPLAY));
}
