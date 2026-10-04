import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import AboutPanel from "@/components/panels/AboutPanel";
import ContactPanel from "@/components/panels/ContactPanel";
import HomePanel from "@/components/panels/HomePanel";
import ProjectsPanel from "@/components/panels/ProjectsPanel";
import QualificationPanel from "@/components/panels/QualificationPanel";
import { identity, panels, type PanelId } from "@/lib/content";

/** All five are prerendered; anything else 404s rather than rendering empty. */
export function generateStaticParams() {
  return panels.map(panel => ({ panel: panel.id }));
}

export const dynamicParams = false;

function isPanelId(value: string): value is PanelId {
  return panels.some(panel => panel.id === value);
}

export async function generateMetadata(
  { params }: { params: Promise<{ panel: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { panel } = await params;
  // Setting openGraph here replaces the inherited one wholesale, image
  // included — so the image from ../opengraph-image.tsx is carried over.
  const inherited = await parent;
  const match = panels.find(entry => entry.id === panel);

  const title = match && match.id !== "home" ? `${match.label} — ${identity.name}` : identity.name;

  return {
    title: match && match.id !== "home" ? title : undefined,
    alternates: { canonical: `/${panel}` },
    openGraph: {
      title,
      description: identity.blurb,
      type: "website",
      siteName: identity.name,
      url: `/${panel}`,
      locale: "en_IN",
      images: inherited.openGraph?.images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: identity.blurb,
      images: inherited.twitter?.images,
    },
  };
}

/**
 * No data fetching here, or anywhere else on a page load. Every panel renders
 * from content.ts; the full repo list is fetched by AllRepos only after a
 * click.
 */
export default async function PanelPage({ params }: { params: Promise<{ panel: string }> }) {
  const { panel } = await params;
  if (!isPanelId(panel)) notFound();

  // Keyed on the route so the entrance animation replays on every swap.
  return (
    <div key={panel} className="panel-enter">
      {panel === "home" ? <HomePanel /> : null}
      {panel === "about" ? <AboutPanel /> : null}
      {panel === "qualification" ? <QualificationPanel /> : null}
      {panel === "projects" ? <ProjectsPanel /> : null}
      {panel === "contact" ? <ContactPanel /> : null}
    </div>
  );
}
