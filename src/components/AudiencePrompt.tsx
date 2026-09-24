"use client";

import { useEffect, useRef } from "react";
import { setAudience } from "@/lib/audience";

/**
 * The one question a first-time visitor gets asked.
 *
 * Always in the server HTML, shown by CSS only while <html data-audience> is
 * "unset" — so it's there at first paint instead of popping in after
 * hydration, and never appears for anyone who has already answered (or has
 * no JS, since only the blocking script can set "unset").
 */
export default function AudiencePrompt() {
  const firstButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (document.documentElement.dataset.audience === "unset") firstButton.current?.focus();
  }, []);

  return (
    <div className="audience-prompt fixed inset-0 z-[100] items-center justify-center bg-[var(--bg-overlay)] p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audience-question"
        className="panel panel-enter w-full max-w-[560px] shadow-[var(--shadow)]"
      >
        <div className="panel-bar">
          <span>first time here?</span>
          <span>1 question</span>
        </div>

        <div className="flex flex-col gap-6 p-7 sm:p-9">
          <h2
            id="audience-question"
            className="font-display text-[clamp(2.2rem,7vw,3.25rem)] font-normal leading-[1.02] tracking-[-0.02em]"
          >
            Quick one — do you <span className="italic text-accent">write code?</span>
          </h2>

          <p className="text-[13px] leading-[1.8] text-dim">
            Programmer, developer, anything technical. Yes gets this site dressed up as a code
            editor; no gets the same things in plain words. Change your mind any time from the
            menu in the bottom bar, or ⌘K.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              ref={firstButton}
              type="button"
              onClick={() => setAudience("dev")}
              data-cursor-label="yes"
              className="btn btn-primary"
            >
              yes, show me the code
            </button>
            <button
              type="button"
              onClick={() => setAudience("plain")}
              data-cursor-label="no"
              className="btn btn-ghost"
            >
              no, keep it simple
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
