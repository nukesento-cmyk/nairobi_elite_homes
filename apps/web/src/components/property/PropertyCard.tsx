import type { SampleListing } from "@/content/sample-listings";
import { cn } from "@/lib/utils";

function formatPrice({ amount, currency, period }: SampleListing["price"]): string {
  const value = `${currency} ${amount.toLocaleString("en-US")}`;
  return period === "month" ? `${value}/mo` : value;
}

function formatSpecs({ beds, baths, acreage }: SampleListing["specs"]): string {
  if (acreage) return `${acreage} ${acreage === 1 ? "acre" : "acres"}`;
  return `${beds} beds · ${baths} baths`;
}

export function PropertyCard({ listing }: { listing: SampleListing }) {
  return (
    <article className="overflow-hidden rounded-xl border border-border">
      <div
        className={cn(
          "grain relative aspect-4/3 bg-linear-to-br",
          listing.vertical === "land"
            ? "from-slate-800 to-slate-950"
            : "from-forest-800 to-forest-950",
        )}
      >
        <span className="absolute top-3 left-3 rounded-md bg-forest-950/80 px-2 py-1 text-xs font-medium text-bone-50">
          Sample
        </span>
      </div>
      <div className="p-5">
        <p className="text-sm text-bone-200">{listing.area}</p>
        <h3 className="mt-1 text-xl text-bone-50">{listing.title}</h3>
        <p className="mt-3 text-sm text-bone-200">{formatSpecs(listing.specs)}</p>
        <p className="mt-1 font-medium text-copper-400">{formatPrice(listing.price)}</p>
      </div>
    </article>
  );
}
