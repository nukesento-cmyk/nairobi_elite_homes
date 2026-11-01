import type { ListingDetail } from "@/lib/cms/types";
import type { Community } from "@/content/communities";

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
