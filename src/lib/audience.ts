/**
 * Who the site is talking to. "dev" gets the editor: file names, a terminal,
 * an object literal for a bio. "plain" gets the same content in plain words.
 *
 * Stored on <html data-audience> — set before first paint by the blocking
 * script in layout.tsx — so both versions render on the server and CSS shows
 * the right one immediately. "unset" means a first visit: the dev view shows
 * underneath and the prompt asks.
 */
export type Audience = "dev" | "plain";

const KEY = "audience";
export const AUDIENCE_EVENT = "audience:change";

export function getAudience(): Audience {
  return document.documentElement.dataset.audience === "plain" ? "plain" : "dev";
}

export function setAudience(next: Audience) {
  document.documentElement.dataset.audience = next;

  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Blocked storage: it switches now, and asks again next visit.
  }

  window.dispatchEvent(new Event(AUDIENCE_EVENT));
}

export function toggleAudience(): Audience {
  const next = getAudience() === "dev" ? "plain" : "dev";
  setAudience(next);
  return next;
}

/** Inline, blocking, in <head>. Anything later and the wrong view flashes. */
export const AUDIENCE_INIT = `
(function () {
  try {
    var a = localStorage.getItem("${KEY}");
    document.documentElement.dataset.audience = a === "dev" || a === "plain" ? a : "unset";
  } catch (e) {}
})();
`;
