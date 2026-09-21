import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Repo thumbnails come from two places: GitHub's own generated repo
    // previews, and whatever og:image the worker scraped off a project's
    // live site — which can be on literally any host.
    remotePatterns: [
      { protocol: "https", hostname: "opengraph.githubassets.com" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
