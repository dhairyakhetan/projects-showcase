import { about, projects } from "@/lib/content";

/**
 * Calls back only if the image really failed.
 *
 * A server-rendered image can fail before React attaches onError, so the
 * image components also check on mount. But "complete, with no width" is
 * also how a freshly inserted image can read for a moment before its request
 * starts — and how some browsers report a lazy one — and treating that as a
 * failure swapped real photos for placeholders after a page change. decode()
 * waits for the actual outcome, whichever it is.
 */
export function confirmFailure(img: HTMLImageElement | null, onFailed: () => void) {
  if (!img || !img.complete || img.naturalWidth > 0) return;
  img.decode().catch(() => {
    if (img.naturalWidth === 0) onFailed();
  });
}

/** Marks a frame's image as painted, which stops its loading shimmer. */
export function markLoaded(img: HTMLImageElement | null) {
  if (img && img.complete && img.naturalWidth > 0) img.dataset.loaded = "1";
}

/** The site's own pictures, warmed into the cache once the browser is idle. */
export function prefetchImages() {
  const sources = [about.portrait, ...projects.featured.map(entry => entry.image)].filter(Boolean) as string[];
  const run = () => {
    for (const src of sources) {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    }
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}
