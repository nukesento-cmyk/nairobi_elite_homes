import type { Metadata } from "next";

import { SplineScene } from "@/components/motion/SplineScene";
import { ListingsBrowser } from "@/components/property/ListingsBrowser";
import { getPublicListings, getSiteMedia, getTeaserListings } from "@/lib/cms";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Homes",
  description:
    "Homes for sale and rent in Karen, Runda, Kilimani, Rosslyn, Lavington and Muthaiga.",
  path: "/homes",
});

export default async function HomesPage() {
  const [listings, teasers, { homesScene }] = await Promise.all([
    getPublicListings(),
    getTeaserListings(),
    getSiteMedia(),
  ]);

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
      {homesScene && (
        <div className="mt-section">
          <h2 className="mb-8 text-4xl text-bone-50 md:text-5xl">{homesScene.title}</h2>
          <SplineScene scene={homesScene} />
        </div>
      )}
    </section>
  );
}
