import { NextResponse } from "next/server";
import { getProjects } from "@/lib/repos";

/**
 * Same-origin projects endpoint.
 *
 * The page already server-renders this data, so this route exists for the
 * client-side refresh path (and for poking at the classifier output without
 * reading the DOM). It calls the same cached `getProjects`, which means a
 * refresh costs nothing extra until Next's revalidation window lapses.
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
