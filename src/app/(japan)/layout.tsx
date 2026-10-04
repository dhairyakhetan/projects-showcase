import type { Metadata, Viewport } from "next";
import { Shippori_Mincho, Zen_Kaku_Gothic_New } from "next/font/google";
import "@/japan/japan.css";

/**
 * The Japan trip page is a separate site that happens to live at /Japan2026,
 * so it gets its own root layout: none of the portfolio's chrome, fonts or
 * colours. Moving between the two is a full page load, by design.
 */

const shippori = Shippori_Mincho({
  subsets: ["latin"],
  weight: ["600", "800"],
  variable: "--font-shippori",
  display: "swap",
});

const zenKaku = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-zen-kaku",
  display: "swap",
});

const TITLE = "Japan trip · 19–28 October 2026";
const DESCRIPTION = "Ten days in Tokyo, Kyoto and Osaka, day by day.";

export const metadata: Metadata = {
  metadataBase: new URL("https://dhairyakhetan.vercel.app"),
  title: TITLE,
  description: DESCRIPTION,
  // The image is Japan2026/opengraph-image.tsx, shared by every day.
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", url: "/Japan2026", locale: "en_IN" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  // Family names and hotels are on this page; no reason to put it in search results.
  robots: { index: false, follow: false },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23F6F7F5'/%3E%3Ccircle cx='16' cy='16' r='8' fill='%23B3392F'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F7F5" },
    { media: "(prefers-color-scheme: dark)", color: "#15181C" },
  ],
};

export default function JapanLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${shippori.variable} ${zenKaku.variable}`}>
      <body>{children}</body>
    </html>
  );
}
