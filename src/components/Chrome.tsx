"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import CommandPalette, { openPalette } from "@/components/CommandPalette";
import CustomCursor from "@/components/CustomCursor";
import { fileTag } from "@/components/Eyebrow";
import LiquidTransition from "@/components/LiquidTransition";
import LoadingDock from "@/components/LoadingDock";
import Roll, { HoverRoll } from "@/components/Roll";
import ShaderField from "@/components/ShaderField";
import ShortcutKey from "@/components/ShortcutKey";
import ThemeToggle from "@/components/ThemeToggle";
import { identity, panels, SITE_SOURCE, SITE_URL } from "@/lib/content";
import { click, SOUND_EVENT, soundEnabled, toggleSound } from "@/lib/sound";

/** Renders nothing time-dependent on the server — a mismatch would be a hydration error. */
function Clock() {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const format = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    });

    const tick = () => setNow(format.format(new Date()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  return <Roll text={now ?? "--:--:--"} className="tabular-nums" />;
}

function Tabs({ active, compact }: { active: string; compact?: boolean }) {
  return (
    <>
      {panels.map((panel, index) => {
        const on = active === panel.id;

        return (
          <Link
            key={panel.id}
            href={`/${panel.id}`}
            aria-current={on ? "page" : undefined}
            data-cursor-label="open"
            className={`group relative flex shrink-0 items-center gap-2.5 border-r border-rule px-4 text-xs transition-colors lg:px-[22px] ${
              on ? "text-ink" : "text-dim hover:text-ink"
            }`}
          >
            {/* One shared element slides between tabs: the lit background and
                its accent top edge. */}
            {on ? (
              <motion.span
                layoutId={compact ? "tab-compact" : "tab"}
                aria-hidden
                className="absolute inset-0 border-t-2 border-accent bg-panel-hi"
                transition={{ type: "spring", stiffness: 480, damping: 38 }}
              />
            ) : null}
            <span
              className={`relative text-[10px] transition-colors ${
                on ? "text-accent" : "text-faint group-hover:text-accent"
              }`}
            >
              0{index + 1}
            </span>
            <span className="relative">
              <HoverRoll text={panel.label} />
              <span className="text-faint">{fileTag(panel.file)}</span>
            </span>
          </Link>
        );
      })}
    </>
  );
}

/** The current page in the status bar. Clicking copies a link to it. */
function PageLink({ label }: { label: string }) {
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${SITE_URL}${pathname}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Blocked clipboard: the address bar has it anyway.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      data-cursor-label="copy link"
      title="Copy a link to this page"
      className="text-ink-mute transition-colors hover:text-ink"
    >
      <Roll text={copied ? "link copied ✓" : label} />
    </button>
  );
}

function SoundToggle({ className = "" }: { className?: string }) {
  const [on, setOn] = useState(true);

  useEffect(() => {
    const read = () => setOn(soundEnabled());
    read();
    window.addEventListener(SOUND_EVENT, read);
    return () => window.removeEventListener(SOUND_EVENT, read);
  }, []);

  return (
    <button
      type="button"
      onClick={() => toggleSound()}
      aria-pressed={on}
      data-cursor-label={on ? "mute" : "unmute"}
      className={`transition-colors hover:text-ink ${className}`}
    >
      <span className="text-accent">♪</span> <Roll text={on ? "sound on " : "sound off"} />
    </button>
  );
}

/**
 * Everything that persists across pages: the dot field, cursor, palette,
 * loading dock, page transitions, header tabs and status bar. Mounted once in
 * the root layout, so a page swap replaces only the content between the
 * header and the status bar.
 */
export default function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname.replace(/^\//, "").split("/")[0] || "home";
  // Undefined on the 404 page, which wears the same chrome.
  const current = panels.find(page => page.id === active);

  // Every press makes a small click, once sound has been allowed.
  useEffect(() => {
    function onDown(event: PointerEvent) {
      if ((event.target as HTMLElement | null)?.closest("a, button, [role=tab], label")) click();
    }
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  const item = "transition-colors hover:text-ink";

  return (
    <>
      <ShaderField className="pointer-events-none fixed inset-x-0 top-0 h-lvh w-full" />
      <CustomCursor />
      <CommandPalette />
      <LoadingDock />
      <LiquidTransition />

      <header className="sticky top-0 z-40 border-b border-rule bg-bg/85 backdrop-blur-md">
        <div className="flex h-14 items-stretch lg:h-16">
          <Link
            href="/home"
            aria-label={`${identity.name}, home`}
            data-cursor-label="home"
            className="flex items-center gap-0.5 px-5 text-lg font-bold tracking-tight md:px-8 md:pr-6"
          >
            <span>dk</span>
            <span className="caret text-accent">_</span>
          </Link>

          <nav aria-label="Pages" className="hidden flex-1 items-stretch border-l border-rule lg:flex">
            <Tabs active={active} />
          </nav>

          <div className="ml-auto flex items-stretch border-l border-rule">
            <span className="hidden items-center gap-2 px-6 text-[11px] text-dim xl:flex">
              <span className="live-dot h-[7px] w-[7px] rounded-full bg-accent" />
              India · IST <Clock />
            </span>
            <ThemeToggle className="border-l border-rule px-5 xl:px-6" />
          </div>
        </div>

        {/* Below lg the tabs get their own row and scroll sideways, like an
            editor with more files open than fit. */}
        <nav
          aria-label="Pages"
          className="no-scrollbar flex h-11 items-stretch overflow-x-auto border-t border-rule lg:hidden"
        >
          <Tabs active={active} compact />
        </nav>
      </header>

      {/* overflow-x: clip, not hidden — clip makes no scroll container, so the
          sticky project stack still sticks, while the ferrofluid's overhang
          can't widen the page on a phone. */}
      <main className="relative z-10 mx-auto w-full max-w-[1440px] overflow-x-clip px-5 pb-[calc(var(--status-h)+3rem)] pt-10 md:px-10 md:pt-14 xl:px-[72px]">
        {children}
      </main>

      {/* Laid out like an editor's status bar, but every item in it does something. */}
      <footer className="fixed inset-x-0 bottom-0 z-40 flex h-[var(--status-h)] items-center justify-between gap-4 border-t border-rule bg-panel px-4 text-[10px] text-dim md:px-5">
        <div className="flex min-w-0 items-center gap-[22px]">
          <Link href="/contact" data-cursor-label="say hi" className={`flex items-center gap-2 ${item}`}>
            <span className="h-1.5 w-1.5 bg-accent" />
            open to collabs
          </Link>
          <a
            href={SITE_SOURCE}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor-label="source"
            className={`hidden sm:inline ${item}`}
          >
            ⎇ view source
          </a>
          <Link href="/qualification" data-cursor-label="open" className={`hidden md:inline ${item}`}>
            class 11 · jee prep
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-[22px]">
          <PageLink label={current ? `${current.label}${fileTag(current.file)}` : "404"} />
          <SoundToggle className="hidden sm:inline" />
          {/* The only way into the palette on a phone, so it shows at every size. */}
          <button type="button" onClick={openPalette} data-cursor-label="menu" className={item}>
            <span className="md:hidden">menu</span>
            <span className="hidden md:inline">
              <ShortcutKey /> menu
            </span>
          </button>
          <Link href="/about" data-cursor-label="about" className={`hidden lg:inline ${item}`}>
            © {new Date().getFullYear()} {identity.name}
          </Link>
        </div>
      </footer>
    </>
  );
}
