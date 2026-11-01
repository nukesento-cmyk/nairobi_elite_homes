import type { Metadata } from "next";

import { ListingsBrowser } from "@/components/property/ListingsBrowser";
import { getPublicListings, getTeaserListings } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Homes",
  description:
    "Homes for sale and rent in Karen, Runda, Kilimani, Rosslyn, Lavington and Muthaiga.",
  alternates: { canonical: "/homes" },
};

export default async function HomesPage() {
  const [listings, teasers] = await Promise.all([getPublicListings(), getTeaserListings()]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-20">
      <h1 className="text-5xl text-bone-50 md:text-7xl">Homes</h1>
      <p className="mt-4 mb-10 max-w-xl text-lg text-bone-200">
        Homes across Nairobi&apos;s premium areas. Off-market homes appear here as locked cards.
      </p>
      <ListingsBrowser
        listings={listings.filter((listing) => listing.vertical === "residential")}
        teasers={teasers.filter((teaser) => teaser.vertical === "residential")}
      />
    </section>
  );
}
