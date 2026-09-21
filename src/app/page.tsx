import Shell from "@/components/Shell";
import { getProjects } from "@/lib/repos";

/**
 * Server component: the repo data is fetched here, cached by Next, and handed
 * to the client shell already classified. Nothing about the worker — its URL,
 * its allowlist, its rate limit — reaches the browser.
 */
export default async function Page() {
  const data = await getProjects();
  return <Shell data={data} />;
}
