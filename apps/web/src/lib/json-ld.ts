import type { ListingDetail } from "@/lib/cms/types";

export function listingJsonLd(listing: ListingDetail): string {
  const json = JSON.stringify({
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
  // A listing title containing "</script>" must not be able to end the script tag.
  return json.replace(/</g, "\\u003c");
}
