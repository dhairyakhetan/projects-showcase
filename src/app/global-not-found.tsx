import type { Metadata } from "next";
import Link from "next/link";
import Chrome from "@/components/Chrome";
import { MOD_KEY_INIT } from "@/components/ShortcutKey";
import Variant from "@/components/Variant";
import { AUDIENCE_INIT } from "@/lib/audience";
import { identity } from "@/lib/content";
import { fontVariables } from "@/lib/fonts";
import { THEME_COLOR, THEME_INIT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: `Not found — ${identity.name}`,
  icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
};

/**
 * Any URL that matches nothing, under either root layout. It has no layout of
 * its own to inherit, so it repeats the portfolio's <html>: fonts, pre-paint
 * scripts and the same chrome, so a typo still lands somewhere that looks
 * like the site and has the tabs to get out.
 */
export default function GlobalNotFound() {
  return (
    <html lang="en" data-theme="dark" className={fontVariables} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content={THEME_COLOR.dark} />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT + MOD_KEY_INIT + AUDIENCE_INIT }} />
      </head>
      <body>
        <Chrome>
          <section
            aria-label="Page not found"
            className="panel-enter flex min-h-[calc(100svh-var(--header-h)-var(--status-h)-7rem)] flex-col justify-center gap-8"
          >
            <p className="text-xs text-dim">
              <span className="text-accent">404</span> /{" "}
              <Variant dev="no such file or directory" plain="Not found" />
            </p>

            <h1 className="font-display text-[clamp(4rem,14vw,7.5rem)] font-normal leading-[0.9] tracking-[-0.03em]">
              Nothing <span className="italic text-accent">here.</span>
            </h1>

            <p className="max-w-[480px] text-sm leading-[1.8] text-dim">
              That page doesn&apos;t exist — probably a typo, or a link that moved. Everything
              that does exist is one of the tabs above.
            </p>

            <div className="flex flex-wrap items-center gap-3.5">
              <Link href="/home" data-cursor-label="home" className="btn btn-primary">
                <Variant dev="cd ~" plain="go home" /> <span aria-hidden className="nudge">→</span>
              </Link>
              <Link href="/projects" data-cursor-label="go" className="btn btn-ghost">
                see projects
              </Link>
            </div>
          </section>
        </Chrome>
      </body>
    </html>
  );
}
