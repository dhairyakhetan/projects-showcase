"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import AudiencePrompt from "@/components/AudiencePrompt";
import CommandPalette, { openPalette } from "@/components/CommandPalette";
import CustomCursor from "@/components/CustomCursor";
import ShaderField from "@/components/ShaderField";
import ThemeToggle from "@/components/ThemeToggle";
import Variant from "@/components/Variant";
import { contact, identity, panels } from "@/lib/content";

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

  return <span className="tabular-nums">{now ?? "--:--:--"}</span>;
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
            <span className="relative transition-transform duration-200 group-hover:-translate-y-px group-active:translate-y-px">
              <Variant dev={panel.file} plain={panel.label} />
            </span>
          </Link>
        );
      })}
    </>
  );
}

/**
 * Everything that persists across pages: the dot field, cursor, palette,
 * header tabs and status bar. Mounted once in the root layout, so a page swap
 * replaces only the content between the header and the status bar.
 */
export default function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname.replace(/^\//, "").split("/")[0] || "home";
  const current = panels.find(panel => panel.id === active) ?? panels[0];

  return (
    <>
      <ShaderField className="pointer-events-none fixed inset-x-0 top-0 h-lvh w-full" />
      <CustomCursor />
      <CommandPalette />
      <AudiencePrompt />

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

      <main className="relative z-10 mx-auto w-full max-w-[1440px] px-5 pb-[calc(var(--status-h)+3rem)] pt-10 md:px-10 md:pt-14 xl:px-[72px]">
        {children}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-40 flex h-[var(--status-h)] items-center justify-between gap-4 border-t border-rule bg-panel px-4 text-[10px] text-dim md:px-5">
        <div className="flex min-w-0 items-center gap-[22px]">
          <a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:text-ink">
            <span className="h-1.5 w-1.5 bg-accent" />
            open to collabs
          </a>
          <Variant dev={<span className="hidden sm:inline">⎇ main*</span>} plain={null} />
          <span className="hidden md:inline">class 11 · jee prep</span>
        </div>

        <div className="flex shrink-0 items-center gap-[22px]">
          <span className="text-ink-mute">
            <Variant dev={current.file} plain={current.label} />
          </span>
          <Variant dev={<span className="hidden md:inline">UTF-8</span>} plain={null} />
          {/* The only way into the palette on a phone, so it shows at every size. */}
          <button
            type="button"
            onClick={openPalette}
            data-cursor-label="menu"
            className="transition-colors hover:text-ink"
          >
            <span className="md:hidden">menu</span>
            <span className="hidden md:inline">
              ⌘K <Variant dev="commands" plain="menu" />
            </span>
          </button>
          <span className="hidden lg:inline">
            © {new Date().getFullYear()} {identity.name}
          </span>
        </div>
      </footer>
    </>
  );
}
