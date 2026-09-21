import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AboutPanel from "@/components/panels/AboutPanel";
import ContactPanel from "@/components/panels/ContactPanel";
import HomePanel from "@/components/panels/HomePanel";
import ProjectsPanel from "@/components/panels/ProjectsPanel";
import QualificationPanel from "@/components/panels/QualificationPanel";
import { identity, panels, type PanelId } from "@/lib/content";
import { getProjects } from "@/lib/repos";

/** All five are prerendered; anything else 404s rather than rendering empty. */
export function generateStaticParams() {
  return panels.map(panel => ({ panel: panel.id }));
}

export const dynamicParams = false;

function isPanelId(value: string): value is PanelId {
  return panels.some(panel => panel.id === value);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ panel: string }>;
}): Promise<Metadata> {
  const { panel } = await params;
  const match = panels.find(entry => entry.id === panel);

  return {
    title: match && match.id !== "home" ? `${match.label} — ${identity.name}` : undefined,
    alternates: { canonical: `/${panel}` },
  };
}

export default async function PanelPage({ params }: { params: Promise<{ panel: string }> }) {
  const { panel } = await params;
  if (!isPanelId(panel)) notFound();

  // Same cached call the layout makes, so this costs nothing extra.
  const data = await getProjects();

  // Keyed on the route so the entrance animation replays on every swap.
  return (
    <div key={panel} className="panel-enter">
      {panel === "home" ? <HomePanel projects={data.projects} /> : null}
      {panel === "about" ? <AboutPanel /> : null}
      {panel === "qualification" ? <QualificationPanel /> : null}
      {panel === "projects" ? <ProjectsPanel data={data} /> : null}
      {panel === "contact" ? <ContactPanel /> : null}
    </div>
  );
}
