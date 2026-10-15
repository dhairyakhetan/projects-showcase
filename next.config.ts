import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    // The site has two root layouts (the portfolio and /Japan2026), so a
    // wrong URL matches neither and Next falls back to its bare white 404.
    // This lets src/app/global-not-found.tsx render it in the site's own look.
    globalNotFound: true,
  },
};

export default config;
