import { NextResponse, type NextRequest } from "next/server";
import { RESET_COOKIE } from "@/lib/audience";

/**
 * A hard refresh asks the "do you write code?" question again.
 *
 * Only the request can tell a hard refresh from a normal one — a hard refresh
 * sends `Cache-Control: no-cache`, a normal one `max-age=0` — so this flags it
 * with a short-lived cookie, and the pre-paint script in lib/audience.ts
 * forgets the stored answer when it sees it.
 *
 * The matcher's `has` condition means this only runs for those requests; a
 * normal page load never invokes it.
 */
export function middleware(request: NextRequest) {
  // Next's own client-side fetches also carry no-cache (fetch with
  // cache: "no-store" adds it), so only a real document load counts.
  const dest = request.headers.get("sec-fetch-dest");
  const isDocument = dest ? dest === "document" : (request.headers.get("accept") ?? "").includes("text/html");
  if (!isDocument) return NextResponse.next();

  const response = NextResponse.next();
  response.cookies.set(RESET_COOKIE, "1", { path: "/", maxAge: 60, sameSite: "lax" });
  return response;
}

// Written out rather than shared: Next reads this object statically at build
// time and rejects anything it would have to evaluate.
export const config = {
  matcher: [
    {
      source: "/",
      has: [{ type: "header", key: "cache-control", value: ".*no-cache.*" }],
      missing: [
        { type: "header", key: "rsc" },
        { type: "header", key: "next-router-prefetch" },
      ],
    },
    {
      source: "/:panel(home|about|qualification|projects|contact)",
      has: [{ type: "header", key: "cache-control", value: ".*no-cache.*" }],
      missing: [
        { type: "header", key: "rsc" },
        { type: "header", key: "next-router-prefetch" },
      ],
    },
  ],
};
