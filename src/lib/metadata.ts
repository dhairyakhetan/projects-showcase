import type { Metadata, ResolvingMetadata } from "next";
import { identity } from "@/lib/content";

/**
 * One page's title, description and link preview.
 *
 * Setting openGraph on a page replaces the inherited one wholesale, image
 * included — so the image from (site)/opengraph-image.tsx is carried over.
 */
export async function pageMetadata(
  page: { id: string; label: string; description: string },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const inherited = await parent;
  const home = page.id === "home";
  const title = home ? identity.name : `${page.label} — ${identity.name}`;

  return {
    // Home keeps the layout's fuller title. The key has to be absent for that:
    // `title: undefined` counts as an override and leaves the page with none.
    ...(home ? {} : { title }),
    description: page.description,
    alternates: { canonical: `/${page.id}` },
    openGraph: {
      title,
      description: page.description,
      type: "website",
      siteName: identity.name,
      url: `/${page.id}`,
      locale: "en_IN",
      images: inherited.openGraph?.images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: page.description,
      images: inherited.twitter?.images,
    },
  };
}
