/**
 * How far the drawn cursor is being dragged off the real pointer, by whichever
 * ferrofluid has hold of it. Several can be on a page; the strongest pull wins.
 * CustomCursor listens for PULL_EVENT and offsets its dot and ring.
 */

export const PULL_EVENT = "cursor:pull";

const pulls = new Map<string, { x: number; y: number }>();

export function setPull(id: string, x: number, y: number) {
  if (x === 0 && y === 0) pulls.delete(id);
  else pulls.set(id, { x, y });
  window.dispatchEvent(new Event(PULL_EVENT));
}

export function currentPull() {
  let best = { x: 0, y: 0 };
  for (const pull of pulls.values()) {
    if (pull.x * pull.x + pull.y * pull.y > best.x * best.x + best.y * best.y) best = pull;
  }
  return best;
}
