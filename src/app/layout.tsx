import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Martian_Mono } from "next/font/google";
import Chrome from "@/components/Chrome";
import { identity } from "@/lib/content";
import "./globals.css";

/* Statements in the serif, everything else in the mono. */
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const martianMono = Martian_Mono({
  subsets: ["latin"],
  variable: "--font-martian-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${identity.name} — ${identity.tagline}`,
  description: identity.blurb,
  authors: [{ name: identity.name }],
  openGraph: {
    title: identity.name,
    description: identity.blurb,
    type: "website",
  },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0c0a" },
    { media: "(prefers-color-scheme: light)", color: "#f3f1e9" },
  ],
};

/**
 * Applies a stored theme before first paint. Has to be inline and blocking:
 * anything deferred is already too late and the wrong theme flashes. Dark is
 * the site's default whatever the OS prefers — light is opt-in.
 */
const THEME_INIT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") document.documentElement.dataset.theme = stored;
  } catch (e) {}
})();
`;

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
    // Font variables go on <html>, not <body>: --font-mono is declared on
    // :root in globals.css, and a variable it references must exist there too.
    <html
      lang="en"
      data-theme="dark"
      className={`${instrumentSerif.variable} ${martianMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <Chrome>{children}</Chrome>
      </body>
    </html>
  );
}
