import { readFile } from "node:fs/promises";
import path from "node:path";

// The page is a plain HTML shell around public/blackjack/: his Python game runs
// in the browser through Pyodide, so it lives outside the portfolio's layout
// like /product-funny. force-static reads the shell once at build time.
export const dynamic = "force-static";

export async function GET() {
  const html = await readFile(path.join(process.cwd(), "src/app/blackjack/page.html"), "utf8");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
