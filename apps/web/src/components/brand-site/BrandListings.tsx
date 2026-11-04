import { Lock } from "lucide-react";
import Link from "next/link";

import { PropertyCard } from "@/components/property/PropertyCard";
import type { BrandSite } from "@/lib/brand-site-data";
import type { PublicListing, TeaserListing } from "@/lib/cms/types";

const TEASER_LABELS: Record<TeaserListing["vertical"], string> = {
  residential: "Off-market home",
  land: "Off-market land",
  commercial: "Off-market commercial",
};

/** Off-market listings only ever show their type and area. */
function BrandTeaserCard({ teaser, base }: { teaser: TeaserListing; base: string }) {
  return (
    <article className="relative overflow-hidden rounded-xl border border-copper/40">
      <div className="flex aspect-4/3 items-center justify-center bg-linear-to-br from-forest-800 to-forest-950">
        <span className="flex size-12 items-center justify-center rounded-full bg-forest-950/80">
          <Lock aria-hidden="true" className="size-5 text-copper-400" />
        </span>
      </div>
      <div className="p-5">
        <p className="text-sm text-bone-200">{teaser.area}</p>
        <h3 className="mt-1 text-xl text-bone-50">{TEASER_LABELS[teaser.vertical]}</h3>
        <Link href={`${base}/join`} className="mt-3 inline-block font-medium text-copper-400 after:absolute after:inset-0">
          <span className="underline-draw">Ask for access</span> <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

type BrandListingsProps = {
  site: BrandSite;
  listings: PublicListing[];
  teasers: TeaserListing[];
  /** Said when there's nothing to show yet. */
  empty: string;
};

export function BrandListings({ site, listings, teasers, empty }: BrandListingsProps) {
  if (listings.length + teasers.length === 0) return <p className="text-bone-200">{empty}</p>;
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
      {listings.map((listing, index) => (
        <PropertyCard key={listing.id} listing={listing} base={site.base} priority={index === 0} />
      ))}
      {teasers.map((teaser) => (
        <BrandTeaserCard key={teaser.id} teaser={teaser} base={site.base} />
      ))}
    </div>
  );
}
