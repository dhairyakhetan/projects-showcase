import type { MetadataRoute } from "next";
import { panels, SITE_URL } from "@/lib/content";

/** The five pages. /Japan2026 is left out on purpose — it's noindex. */
export default function sitemap(): MetadataRoute.Sitemap {
  return panels.map(panel => ({
    url: `${SITE_URL}/${panel.id}`,
    changeFrequency: "monthly",
    priority: panel.id === "home" ? 1 : 0.8,
  }));
}
