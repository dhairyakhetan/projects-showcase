import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    // The root layout lives in the (site) route group, so a wrong URL matches
    // no layout and Next falls back to its bare white 404. This lets
    // src/app/global-not-found.tsx render it in the site's own look.
    globalNotFound: true,
  },
};

export default config;
