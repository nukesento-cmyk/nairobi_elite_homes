import type { ListingDetail } from "@/lib/cms/types";
import { site } from "@/config/site";
import type { Community } from "@/content/communities";
import type { Post } from "@/lib/content";

// A title containing "</script>" must not be able to end the script tag.
function serialize(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function communityJsonLd(community: Community, siteUrl: string | null): string {
  return serialize({
    "@context": "https://schema.org",
    "@type": "Place",
    name: `${community.name}, Nairobi`,
    description: community.summary,
    url: siteUrl ? new URL(`/communities/${community.slug}`, siteUrl).toString() : undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: community.name,
      addressRegion: "Nairobi",
      addressCountry: "KE",
    },
  });
}

export function listingJsonLd(listing: ListingDetail): string {
  return serialize({
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: listing.title,
    description: listing.description ?? undefined,
    dateModified: listing.updatedAt,
    image: listing.hero?.url,
    offers: {
      "@type": "Offer",
      price: listing.price.amount,
      priceCurrency: listing.price.currency,
    },
    contentLocation: {
      "@type": "Place",
      name: `${listing.area}, Nairobi`,
      geo: listing.coords
        ? { "@type": "GeoCoordinates", latitude: listing.coords.lat, longitude: listing.coords.lng }
        : undefined,
    },
  });
}

function absoluteUrl(path: string): string | undefined {
  return site.url ? new URL(path, site.url).toString() : undefined;
}

/** Who runs the site, and the site itself, for the homepage. */
export function organizationJsonLd(): string {
  return serialize([
    {
      "@context": "https://schema.org",
      "@type": "RealEstateAgent",
      name: site.name,
      url: absoluteUrl("/"),
      areaServed: { "@type": "City", name: "Nairobi" },
      telephone: site.contact.phone ?? undefined,
      email: site.contact.email ?? undefined,
      sameAs: site.socials.map(({ url }) => url),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: site.name,
      url: absoluteUrl("/"),
    },
  ]);
}

/** The article, plus its FAQ when the post has one. Everything here is visible on the page. */
export function blogPostingJsonLd(
  post: Pick<Post, "slug" | "title" | "excerpt" | "coverUrl" | "publishedAt" | "updatedAt">,
  faqs: { question: string; answer: string }[],
): string {
  const publisher = { "@type": "Organization", name: site.name, url: absoluteUrl("/") };
  const article = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    url: absoluteUrl(`/blog/${post.slug}`),
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    image: post.coverUrl ?? undefined,
    datePublished: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
    dateModified: new Date(post.updatedAt).toISOString(),
    author: publisher,
    publisher,
  };
  if (faqs.length === 0) return serialize(article);
  return serialize([
    article,
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ]);
}

