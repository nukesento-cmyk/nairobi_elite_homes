import type { ListingPrice, ListingSpecs, PublicListing, TeaserListing } from "@/lib/cms/types";

export function formatPrice({ amount, currency, period }: ListingPrice): string {
  const value = `${currency} ${amount.toLocaleString("en-US")}`;
  return period === "month" ? `${value}/mo` : value;
}

export function formatSpecs({ beds, baths, acreage, sqm }: ListingSpecs): string {
  const parts = [
    beds ? `${beds} ${beds === 1 ? "bed" : "beds"}` : null,
    baths ? `${baths} ${baths === 1 ? "bath" : "baths"}` : null,
    acreage ? `${acreage} ${acreage === 1 ? "acre" : "acres"}` : null,
    sqm ? `${sqm.toLocaleString("en-US")} sqm` : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

export type ListingFilters = {
  area: string;
  deal: "" | "sale" | "month";
  beds: number;
  acres: number;
  title: "" | "freehold" | "leasehold";
};

export function parseFilters(search: string): ListingFilters {
  const params = new URLSearchParams(search);
  const deal = params.get("deal");
  const beds = Number(params.get("beds"));
  const acres = Number(params.get("acres"));
  const title = params.get("title");
  return {
    area: params.get("area") ?? "",
    deal: deal === "sale" || deal === "month" ? deal : "",
    beds: Number.isInteger(beds) && beds > 0 ? beds : 0,
    acres: Number.isFinite(acres) && acres > 0 ? acres : 0,
    title: title === "freehold" || title === "leasehold" ? title : "",
  };
}

export function serializeFilters({ area, deal, beds, acres, title }: ListingFilters): string {
  const params = new URLSearchParams();
  if (area) params.set("area", area);
  if (deal) params.set("deal", deal);
  if (beds) params.set("beds", String(beds));
  if (acres) params.set("acres", String(acres));
  if (title) params.set("title", title);
  return params.toString();
}

export function filterListings(
  listings: PublicListing[],
  { area, deal, beds, acres, title }: ListingFilters,
) {
  return listings.filter(
    (listing) =>
      (!area || listing.area === area) &&
      (!deal || listing.price.period === deal) &&
      (!beds || (listing.specs.beds ?? 0) >= beds) &&
      (!acres || (listing.specs.acreage ?? 0) >= acres) &&
      (!title || listing.specs.titleStatus === title),
  );
}

/** Teasers reveal only their area, so that's the only filter that can apply to them. */
export function filterTeasers(teasers: TeaserListing[], { area }: ListingFilters) {
  return teasers.filter((teaser) => !area || teaser.area === area);
}

export function listAreas(listings: PublicListing[], teasers: TeaserListing[]): string[] {
  return [...new Set([...listings, ...teasers].map((entry) => entry.area))].sort();
}

export type GridEntry =
  | { kind: "listing"; listing: PublicListing }
  | { kind: "teaser"; teaser: TeaserListing };

/** Places a teaser after every `every` public listings, then adds any left over at the end. */
export function mergeTeasers(
  listings: PublicListing[],
  teasers: TeaserListing[],
  every = 3,
): GridEntry[] {
  const remaining = [...teasers];
  const merged = listings.flatMap((listing, i): GridEntry[] => {
    const entry: GridEntry = { kind: "listing", listing };
    const teaser = (i + 1) % every === 0 ? remaining.shift() : undefined;
    return teaser ? [entry, { kind: "teaser", teaser }] : [entry];
  });
  return [...merged, ...remaining.map((teaser): GridEntry => ({ kind: "teaser", teaser }))];
}
