import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/content";

/**
 * /Japan2026 is deliberately not disallowed: its pages carry a noindex tag,
 * and a crawler blocked here would never read it — a blocked URL that's
 * linked from elsewhere can still show up in results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
