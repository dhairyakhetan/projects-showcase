/**
 * "Opens elsewhere" arrow.
 *
 * An SVG rather than the ↗ character, which Chromium renders with emoji
 * presentation — a blue tile that ignores the surrounding colour and sits
 * wrong on the baseline. This inherits currentColor and scales with the text.
 */
export default function ArrowUpRight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}
