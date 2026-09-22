"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import CommandPalette from "@/components/CommandPalette";
import CustomCursor from "@/components/CustomCursor";
import ThemeToggle from "@/components/ThemeToggle";
import { identity, panels } from "@/lib/content";

/**
 * Everything that persists across panel routes: background texture, cursor,
 * command palette, header, nav, footer.
 *
 * Lives in the shared layout, so a panel swap replaces only the page content.
 * That keeps the canvas field running and lets the nav pill animate between
 * tabs — while every panel still has a real URL.
 */
export default function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname.replace(/^\//, "") || "home";

  return (
    <>
      <div className="texture" aria-hidden />
      <CustomCursor />
      <CommandPalette />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 sm:px-8">
        <header className="flex items-center justify-between gap-4 py-6">
          <Link href="/home" className="font-mono text-sm font-semibold tracking-tight">
            <span className="text-[var(--accent)]">~/</span>
            {identity.handle}
          </Link>

          <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
            {panels.map(panel => (
              <Link
                key={panel.id}
                href={`/${panel.id}`}
                aria-current={active === panel.id ? "page" : undefined}
                className={`relative rounded-full px-3.5 py-1.5 font-mono text-xs transition-colors ${
                  active === panel.id
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-dim)] hover:text-[var(--text)]"
                }`}
              >
                {/* One shared element slides between tabs. */}
                {active === panel.id ? (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-[var(--accent-soft)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <span className="relative">{panel.label.toLowerCase()}</span>
              </Link>
            ))}
          </nav>

          <ThemeToggle />
        </header>

        <main className="flex-1 py-8 sm:py-12">{children}</main>

        {/* Bottom-anchored on mobile, scrolling sideways rather than wrapping. */}
        <nav
          aria-label="Sections"
          className="sticky bottom-0 z-20 -mx-5 flex gap-1 overflow-x-auto border-t border-[var(--border)] bg-[var(--bg-overlay)] px-5 py-3 backdrop-blur md:hidden"
        >
          {panels.map(panel => (
            <Link
              key={panel.id}
              href={`/${panel.id}`}
              aria-current={active === panel.id ? "page" : undefined}
              className={`shrink-0 rounded-full px-3.5 py-1.5 font-mono text-xs transition-colors ${
                active === panel.id
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-dim)]"
              }`}
            >
              {panel.label.toLowerCase()}
            </Link>
          ))}
        </nav>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] py-5 font-mono text-[11px] text-[var(--text-faint)]">
          <span>
            © {new Date().getFullYear()} {identity.name}
          </span>

          <span className="hidden items-center gap-3 sm:flex">
            <span>
              <kbd className="rounded border border-[var(--border)] px-1 py-0.5">⌘K</kbd> search
            </span>
          </span>

          <a
            href={`https://github.com/${identity.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-[var(--accent)]"
          >
            github ↗
          </a>
        </footer>
      </div>
    </>
  );
}
