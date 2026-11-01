import Image from "next/image";
import Link from "next/link";

import type { PublicListing } from "@/lib/cms/types";
import { formatPrice, formatSpecs } from "@/lib/listings";
import { cn } from "@/lib/utils";

type PropertyCardProps = {
  listing: PublicListing;
  /** Loads the photo immediately. For cards visible without scrolling. */
  priority?: boolean;
};

export function PropertyCard({ listing, priority = false }: PropertyCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-xl border border-border motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out-expo motion-safe:hover:-translate-y-1">
      <div
        className={cn(
          "grain relative aspect-4/3 bg-linear-to-br",
          listing.vertical === "land"
            ? "from-slate-800 to-slate-950"
            : "from-forest-800 to-forest-950",
        )}
      >
        {listing.hero && (
          <Image
            src={listing.hero.url}
            alt={listing.hero.alt}
            fill
            preload={priority}
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            placeholder={listing.hero.lqip ? "blur" : "empty"}
            blurDataURL={listing.hero.lqip ?? undefined}
            className="object-cover"
          />
        )}
        {listing.isSample && (
          <span className="absolute top-3 left-3 rounded-md bg-forest-950/80 px-2 py-1 text-xs font-medium text-bone-50">
            Sample
          </span>
        )}
      </div>
      <div className="p-5">
        <p className="text-sm text-bone-200">{listing.area}</p>
        <h3 className="mt-1 text-xl text-bone-50">
          {/* The stretched link makes the whole card clickable with a single tab stop. */}
          <Link
            href={`/listings/${listing.slug}`}
            className="underline-draw after:absolute after:inset-0"
          >
            {listing.title}
          </Link>
        </h3>
        <p className="mt-3 text-sm text-bone-200">{formatSpecs(listing.specs)}</p>
        <p className="mt-1 font-medium text-copper-400">{formatPrice(listing.price)}</p>
      </div>
    </article>
  );
}
