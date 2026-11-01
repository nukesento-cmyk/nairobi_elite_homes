import { HomeHero } from "@/components/marketing/HomeHero";
import { WhyJoinCards } from "@/components/marketing/WhyJoinCards";
import { PropertyGrid } from "@/components/property/PropertyGrid";
import { sampleListings } from "@/content/sample-listings";
import { whyJoinCards } from "@/content/why-join";

export default function HomePage() {
  return (
    <>
      <HomeHero />

      <section aria-labelledby="why-join" className="py-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 id="why-join" className="mb-10 max-w-2xl text-4xl text-bone-50 md:text-5xl">
            The best property in Nairobi rarely reaches the open market.
          </h2>
          <WhyJoinCards
            cards={whyJoinCards.slice(0, 4)}
            sourcePrefix="home"
            placement="home_why_join"
          />
        </div>
      </section>

      <section
        id="listings"
        aria-labelledby="listings-heading"
        className="scroll-mt-14 pb-section"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 id="listings-heading" className="text-4xl text-bone-50 md:text-5xl">
            Listings
          </h2>
          <p className="mt-3 mb-10 text-bone-200">
            These are samples while we prepare the public catalogue.
          </p>
          <PropertyGrid listings={sampleListings} />
        </div>
      </section>
    </>
  );
}
