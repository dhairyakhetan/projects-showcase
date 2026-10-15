import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    // The site has two root layouts (the portfolio and /Japan2026), so a
    // wrong URL matches neither and Next falls back to its bare white 404.
    // This lets src/app/global-not-found.tsx render it in the site's own look.
    globalNotFound: true,
  },
  // Next serves public/ files but not a folder's index.html. A redirect, not a
  // rewrite: the static pages link to style.css and images/ relatively, which
  // only resolve inside the folder.
  async redirects() {
    return [{ source: "/WebApp-Project", destination: "/WebApp-Project/index.html", permanent: false }];
  },
};

export default config;
