import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import Chrome from "@/components/Chrome";
import { identity } from "@/lib/content";
import { getProjects } from "@/lib/repos";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
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
    { media: "(prefers-color-scheme: dark)", color: "#07080b" },
    { media: "(prefers-color-scheme: light)", color: "#fff8ea" },
  ],
};

/**
 * Applies the stored theme before first paint. Has to be inline and blocking:
 * anything deferred is already too late and the wrong theme flashes.
 */
const THEME_INIT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    document.documentElement.dataset.theme = stored || (prefersLight ? "light" : "dark");
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
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
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const data = await getProjects();

  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
        <Chrome projects={data.projects} degraded={data.degraded}>
          {children}
        </Chrome>
      </body>
    </html>
  );
}
