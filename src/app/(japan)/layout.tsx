import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SITE_URL } from "@/lib/content";
import "@/japan/japan.css";

/**
 * The Japan trip page is a separate site that happens to live at /Japan2026,
 * so it gets its own root layout: none of the portfolio's chrome, fonts or
 * colours. Moving between the two is a full page load, by design.
 */

/*
 * Both fonts are Japanese families: from Google they come as ~600
 * unicode-range slices, about 460 KB of @font-face CSS the browser had to
 * read before drawing anything. The page is English, so src/japan/fonts holds
 * each weight cut down to the characters it uses (about 60 KB for all five).
 * Text with a new character outside that set falls back to the system font;
 * re-run the subset (pyftsubset --text-file) if that ever shows.
 */
const shippori = localFont({
  src: [
    { path: "../../japan/fonts/ShipporiMincho-SemiBold.woff2", weight: "600" },
    { path: "../../japan/fonts/ShipporiMincho-ExtraBold.woff2", weight: "800" },
  ],
  variable: "--font-shippori",
  display: "swap",
});

const zenKaku = localFont({
  src: [
    { path: "../../japan/fonts/ZenKakuGothicNew-Regular.woff2", weight: "400" },
    { path: "../../japan/fonts/ZenKakuGothicNew-Medium.woff2", weight: "500" },
    { path: "../../japan/fonts/ZenKakuGothicNew-Bold.woff2", weight: "700" },
  ],
  variable: "--font-zen-kaku",
  display: "swap",
});

const TITLE = "Japan trip · 19–28 October 2026";
const DESCRIPTION = "Ten days in Tokyo, Kyoto and Osaka, day by day.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  // The image is Japan2026/opengraph-image.tsx, shared by every day.
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", url: "/Japan2026", locale: "en_IN" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  // Family names and hotels are on this page; no reason to put it in search results.
  robots: { index: false, follow: false },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2315181C'/%3E%3Ccircle cx='16' cy='16' r='8' fill='%23B3392F'/%3E%3C/svg%3E",
    apple: "/japan2026-icon-180.png",
  },
  // "Add to Home Screen" opens it like an app, straight onto the plan.
  manifest: "/japan2026.webmanifest",
  appleWebApp: { capable: true, title: "Japan 2026", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#15181C",
};

export default function JapanLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${shippori.variable} ${zenKaku.variable}`}>
      <body>{children}</body>
    </html>
  );
}
