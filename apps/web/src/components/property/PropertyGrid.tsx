import { JoinInterstitial } from "@/components/marketing/JoinInterstitial";
import type { SampleListing } from "@/content/sample-listings";
import { interleave } from "@/lib/interleave";

import { PropertyCard } from "./PropertyCard";

// 6 divides evenly into the 1, 2 and 3 column layouts, so the full-width
// interstitial never leaves a gap in the row above it.
const LISTINGS_PER_INTERSTITIAL = 6;

export function PropertyGrid({ listings }: { listings: SampleListing[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
      {interleave(listings, LISTINGS_PER_INTERSTITIAL).map((entry) =>
        entry.kind === "item" ? (
          <PropertyCard key={entry.item.id} listing={entry.item} />
        ) : (
          <JoinInterstitial key={`interstitial-${entry.index}`} />
        ),
      )}
    </div>
  );
}
