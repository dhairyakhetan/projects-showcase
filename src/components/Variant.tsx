import type { ReactNode } from "react";

/**
 * Both versions of something, one for each audience (see lib/audience.ts).
 *
 * Both are rendered and CSS hides one, keyed off <html data-audience>. That's
 * deliberate: the server can't know which a visitor chose, and choosing in
 * React after hydration would flash the wrong one on every page load. The
 * wrappers are `display: contents`, so they add no box to the layout.
 */
export default function Variant({
  dev,
  plain,
  block = false,
}: {
  dev: ReactNode;
  plain: ReactNode;
  /** Use when either side contains block elements. */
  block?: boolean;
}) {
  const Tag = block ? "div" : "span";

  return (
    <>
      <Tag className="dev-only">{dev}</Tag>
      <Tag className="plain-only">{plain}</Tag>
    </>
  );
}
