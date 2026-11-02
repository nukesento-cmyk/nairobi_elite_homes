import { JoinInterstitial } from "@/components/marketing/JoinInterstitial";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { interleave } from "@/lib/interleave";
import type { GridEntry } from "@/lib/listings";

import { PropertyCard } from "./PropertyCard";
import { TeaserCard } from "./TeaserCard";

// 6 divides evenly into the 1, 2 and 3 column layouts, so the full-width
// interstitial never leaves a gap in the row above it.
const CARDS_PER_INTERSTITIAL = 6;

type PropertyGridProps = {
  entries: GridEntry[];
  /**
   * Set when the grid starts near the top of the page. Only the first photo is preloaded:
   * on a phone it's the only one in view, and the others would compete with it.
   */
  prioritizeFirstCard?: boolean;
};

export function PropertyGrid({ entries, prioritizeFirstCard = false }: PropertyGridProps) {
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
            priority={prioritizeFirstCard && i === 0}
          />
        ) : (
          <TeaserCard key={entry.item.teaser.id} teaser={entry.item.teaser} />
        );
      })}
    </ScrollReveal>
  );
}
