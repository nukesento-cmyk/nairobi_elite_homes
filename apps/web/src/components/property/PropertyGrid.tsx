import { JoinInterstitial } from "@/components/marketing/JoinInterstitial";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { interleave } from "@/lib/interleave";
import type { GridEntry } from "@/lib/listings";

import { PropertyCard } from "./PropertyCard";
import { TeaserCard } from "./TeaserCard";

// 6 divides evenly into the 1, 2 and 3 column layouts, so the full-width
// interstitial never leaves a gap in the row above it.
const CARDS_PER_INTERSTITIAL = 6;

// The first row on the widest layout.
const ABOVE_THE_FOLD_CARDS = 3;

type PropertyGridProps = {
  entries: GridEntry[];
  /** Set when the grid starts near the top of the page, so its first photos load at once. */
  prioritizeFirstRow?: boolean;
};

export function PropertyGrid({ entries, prioritizeFirstRow = false }: PropertyGridProps) {
  return (
    <ScrollReveal className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
      {interleave(entries, CARDS_PER_INTERSTITIAL).map((entry, i) => {
        if (entry.kind === "break") {
          return <JoinInterstitial key={`interstitial-${entry.index}`} />;
        }
        return entry.item.kind === "listing" ? (
          <PropertyCard
            key={entry.item.listing.id}
            listing={entry.item.listing}
            priority={prioritizeFirstRow && i < ABOVE_THE_FOLD_CARDS}
          />
        ) : (
          <TeaserCard key={entry.item.teaser.id} teaser={entry.item.teaser} />
        );
      })}
    </ScrollReveal>
  );
}
