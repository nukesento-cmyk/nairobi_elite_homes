import Link from "next/link";

import { HomeHero } from "@/components/marketing/HomeHero";
import { WhyJoinCards } from "@/components/marketing/WhyJoinCards";
import { PropertyGrid } from "@/components/property/PropertyGrid";
import { getPublicListings, getTeaserListings, getWhyJoinCards } from "@/lib/cms";
import { mergeTeasers } from "@/lib/listings";

const HOME_LISTING_COUNT = 9;

export default async function HomePage() {
  const [listings, teasers, cards] = await Promise.all([
    getPublicListings(),
    getTeaserListings(),
    getWhyJoinCards(),
  ]);

  return (
    <>
      <HomeHero />

      <section aria-labelledby="why-join" className="py-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 id="why-join" className="mb-10 max-w-2xl text-4xl text-bone-50 md:text-5xl">
            The best property in Nairobi rarely reaches the open market.
          </h2>
          <WhyJoinCards cards={cards.slice(0, 4)} sourcePrefix="home" placement="home_why_join" />
        </div>
      </section>

      <section
        id="listings"
        aria-labelledby="listings-heading"
        className="scroll-mt-14 pb-section"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <h2 id="listings-heading" className="text-4xl text-bone-50 md:text-5xl">
              Listings
            </h2>
            <div className="flex gap-6">
              <Link
                href="/homes"
                className="text-copper-400 underline decoration-copper/50 underline-offset-4 hover:text-bone-50"
              >
                All homes <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/land"
                className="text-copper-400 underline decoration-copper/50 underline-offset-4 hover:text-bone-50"
              >
                All land <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <PropertyGrid
            entries={mergeTeasers(listings.slice(0, HOME_LISTING_COUNT), teasers.slice(0, 3))}
          />
        </div>
      </section>
    </>
  );
}
