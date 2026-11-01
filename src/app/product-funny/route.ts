import { readFile } from "node:fs/promises";
import path from "node:path";

// STRATA is one self-contained HTML file (three.js inlined), so it's served
// byte-for-byte outside the portfolio's layout. force-static reads it once at
// build time. Nothing on the portfolio links here and it stays out of the
// sitemap; noindex keeps it out of search results.
export const dynamic = "force-static";

export async function GET() {
  const html = await readFile(path.join(process.cwd(), "src/app/product-funny/strata.html"), "utf8");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" },
  });
}
