import type { Metadata } from "next";

const DEFAULT_IMAGE = "/api/og";

type PageMetadata = {
  /** Without the site name, which the root layout's title template adds. */
  title: string;
  description: string;
  /** Path of this page, with no query string. */
  path: string;
  image?: string;
};

/** Canonical and share tags for a page. A link shared in WhatsApp shows these. */
export function pageMetadata({
  title,
  description,
  path,
  image = DEFAULT_IMAGE,
}: PageMetadata): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      title,
      description,
      url: path,
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
