import { NextResponse } from "next/server";
import { getProjects } from "@/lib/repos";

/**
 * Same-origin projects endpoint, for client-side refreshes and for inspecting
 * classifier output without reading the DOM. Shares `getProjects`' cache, so
 * it costs nothing extra until the revalidation window lapses.
 */
export async function GET() {
  const result = await getProjects();

  return NextResponse.json(result, {
    status: result.degraded ? 503 : 200,
    headers: {
      "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
