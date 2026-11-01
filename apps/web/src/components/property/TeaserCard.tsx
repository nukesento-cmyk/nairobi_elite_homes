import { Lock } from "lucide-react";

import { JoinLink } from "@/components/marketing/JoinLink";
import type { TeaserListing } from "@/lib/cms/types";
import { cn } from "@/lib/utils";

const verticalLabels: Record<TeaserListing["vertical"], string> = {
  residential: "Off-market home",
  land: "Off-market land",
  commercial: "Off-market commercial",
};

export function TeaserCard({ teaser }: { teaser: TeaserListing }) {
  return (
    <article className="group relative overflow-hidden rounded-xl border border-copper/40 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out-expo motion-safe:hover:-translate-y-1">
      <div
        className={cn(
          "relative aspect-4/3 overflow-hidden bg-linear-to-br",
          teaser.vertical === "land"
            ? "from-slate-800 to-slate-950"
            : "from-forest-800 to-forest-950",
        )}
      >
        {teaser.lqip && (
          <div
            aria-hidden="true"
            className="absolute inset-0 scale-110 bg-cover bg-center blur-xl"
            style={{ backgroundImage: `url("${teaser.lqip}")` }}
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-forest-950/80">
            <Lock aria-hidden="true" className="size-5 text-copper-400" />
          </span>
        </div>
      </div>
      <div className="p-5">
        <p className="text-sm text-bone-200">{teaser.area}</p>
        <h3 className="mt-1 text-xl text-bone-50">{verticalLabels[teaser.vertical]}</h3>
        <p className="mt-3 text-sm text-bone-200">Shared first in the group.</p>
        <JoinLink
          source="teaser_card"
          placement="listing_grid"
          className="mt-1 inline-block font-medium text-copper-400 after:absolute after:inset-0"
        >
          <span className="underline-draw">Join to view</span> <span aria-hidden="true">→</span>
        </JoinLink>
      </div>
    </article>
  );
}
