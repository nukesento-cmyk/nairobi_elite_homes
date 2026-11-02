"use client";

import { useMemo, useSyncExternalStore, type ReactNode } from "react";

import { track } from "@/lib/analytics";
import type { PublicListing, TeaserListing } from "@/lib/cms/types";
import {
  filterListings,
  filterTeasers,
  listAreas,
  mergeTeasers,
  parseFilters,
  serializeFilters,
  type ListingFilters,
} from "@/lib/listings";

import { PropertyGrid } from "./PropertyGrid";

const FILTER_CHANGE = "neh-listing-filters";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(FILTER_CHANGE, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(FILTER_CHANGE, onChange);
  };
}

type ListingsBrowserProps = {
  variant?: "homes" | "land";
  listings: PublicListing[];
  teasers: TeaserListing[];
};

// Filters run in the browser, over data that is already safe to send. The server
// renders the unfiltered list, so every public listing is in the HTML for search
// engines, and filtered URLs can still be shared.
export function ListingsBrowser({ variant = "homes", listings, teasers }: ListingsBrowserProps) {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  const filters = useMemo(() => parseFilters(search), [search]);
  const areas = useMemo(() => listAreas(listings, teasers), [listings, teasers]);
  const entries = mergeTeasers(filterListings(listings, filters), filterTeasers(teasers, filters));

  function update<Name extends keyof ListingFilters>(filter: Name, value: ListingFilters[Name]) {
    const query = serializeFilters({ ...filters, [filter]: value });
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
    window.dispatchEvent(new Event(FILTER_CHANGE));
    track("filter_used", { filter });
  }

  return (
    <>
      <form className="mb-8 grid gap-4 sm:grid-cols-3" aria-label="Filter listings">
        <Filter label="Area" value={filters.area} onChange={(value) => update("area", value)}>
          <option value="">All areas</option>
          {areas.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </Filter>

        {variant === "homes" ? (
          <>
            <Filter
              label="Buy or rent"
              value={filters.deal}
              onChange={(value) => update("deal", value as ListingFilters["deal"])}
            >
              <option value="">Buy or rent</option>
              <option value="sale">Buy</option>
              <option value="month">Rent</option>
            </Filter>
            <Filter
              label="Bedrooms"
              value={String(filters.beds)}
              onChange={(value) => update("beds", Number(value))}
            >
              <option value="0">Any</option>
              {[2, 3, 4, 5].map((beds) => (
                <option key={beds} value={beds}>
                  {beds}+
                </option>
              ))}
            </Filter>
          </>
        ) : (
          <>
            <Filter
              label="Minimum size"
              value={String(filters.acres)}
              onChange={(value) => update("acres", Number(value))}
            >
              <option value="0">Any size</option>
              {[0.5, 1, 2, 5].map((acres) => (
                <option key={acres} value={acres}>
                  {acres}+ {acres === 1 || acres === 0.5 ? "acre" : "acres"}
                </option>
              ))}
            </Filter>
            <Filter
              label="Title"
              value={filters.title}
              onChange={(value) => update("title", value as ListingFilters["title"])}
            >
              <option value="">Any title</option>
              <option value="freehold">Freehold</option>
              <option value="leasehold">Leasehold</option>
            </Filter>
          </>
        )}
      </form>

      <h2 className="sr-only">Results</h2>
      <p role="status" className="mb-6 text-sm text-bone-200">
        {entries.length === 1 ? "1 listing" : `${entries.length} listings`}
      </p>

      {entries.length > 0 ? (
        <PropertyGrid entries={entries} prioritizeFirstCard={variant === "homes"} />
      ) : (
        <p className="rounded-xl border border-border p-10 text-center text-bone-200">
          Nothing public matches those filters. New listings reach the group first.
        </p>
      )}
    </>
  );
}

type FilterProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
};

function Filter({ label, value, onChange, children }: FilterProps) {
  return (
    <label className="text-sm text-bone-200">
      <span className="mb-1.5 block">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-bone-50 focus-visible:outline-2 focus-visible:outline-copper-400"
      >
        {children}
      </select>
    </label>
  );
}
