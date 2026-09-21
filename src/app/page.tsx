import Shell from "@/components/Shell";
import { getProjects } from "@/lib/repos";

/**
 * Repo data is fetched and classified here, then handed to the client shell.
 * Nothing about the worker reaches the browser.
 */
export default async function Page() {
  const data = await getProjects();
  return <Shell data={data} />;
}
