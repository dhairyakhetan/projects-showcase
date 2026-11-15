import type { Metadata } from "next";
import Chrome from "@/components/Chrome";
import { identity, SITE_URL } from "@/lib/content";
import { fontVariables } from "@/lib/fonts";
import { PREPAINT } from "@/lib/prepaint";
import { THEME_COLOR } from "@/lib/theme";
import "../globals.css";

export const metadata: Metadata = {
  // Link previews need absolute URLs; this makes the og:image and og:url ones.
  metadataBase: new URL(SITE_URL),
  title: `${identity.name} — ${identity.tagline}`,
  description: identity.blurb,
  authors: [{ name: identity.name }],
  // The image itself is ./opengraph-image.tsx, shared by every page.
  openGraph: {
    title: identity.name,
    description: identity.blurb,
    type: "website",
    siteName: identity.name,
    url: "/home",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: identity.name,
    description: identity.blurb,
  },
  // apple-touch-icon.png is "dk_" in Martian Mono, as in favicon.svg — iPhones ignore SVG icons.
  icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
};

/**
 * Chrome lives here, in the ROOT layout, deliberately.
 *
 * It was originally in `[panel]/layout.tsx`, which looks equivalent but is
 * not: a layout underneath a dynamic segment is remounted whenever that
 * segment's value changes. Every panel click was therefore tearing down and
 * rebuilding the background, cursor and palette — measurably, the DOM nodes
 * were different objects afterwards. Sitting above `[panel]`, it survives.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Written here, not via `viewport.themeColor`, so it sits ahead of
            the script that retints it for a stored light theme. */}
        <meta name="theme-color" content={THEME_COLOR.dark} />
        <script dangerouslySetInnerHTML={{ __html: PREPAINT }} />
      </head>
      <body>
        <Chrome>{children}</Chrome>
      </body>
    </html>
  );
}
