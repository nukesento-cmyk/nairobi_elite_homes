"use client";

import { useMemo, useSyncExternalStore } from "react";

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

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-forest-950 px-3 text-sm text-bone-50 focus-visible:outline-2 focus-visible:outline-copper-400";

type ListingsBrowserProps = {
  listings: PublicListing[];
  teasers: TeaserListing[];
};

// Filters run in the browser, over data that is already safe to send. The server
// renders the unfiltered list, so every public listing is in the HTML for search
// engines, and filtered URLs can still be shared.
export function ListingsBrowser({ listings, teasers }: ListingsBrowserProps) {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  const filters = useMemo(() => parseFilters(search), [search]);
  const areas = useMemo(() => listAreas(listings, teasers), [listings, teasers]);
  const entries = mergeTeasers(filterListings(listings, filters), filterTeasers(teasers, filters));

  function update(filter: keyof ListingFilters, value: string) {
    const next = { ...filters, [filter]: filter === "beds" ? Number(value) : value };
    const query = serializeFilters(next);
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
    window.dispatchEvent(new Event(FILTER_CHANGE));
    track("filter_used", { filter });
  }

  return (
    <>
      <form className="mb-8 grid gap-4 sm:grid-cols-3" aria-label="Filter listings">
        <label className="text-sm text-bone-200">
          <span className="mb-1.5 block">Area</span>
          <select
            className={selectClass}
            value={filters.area}
            onChange={(event) => update("area", event.target.value)}
          >
            <option value="">All areas</option>
            {areas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-bone-200">
          <span className="mb-1.5 block">Buy or rent</span>
          <select
            className={selectClass}
            value={filters.deal}
            onChange={(event) => update("deal", event.target.value)}
          >
            <option value="">Buy or rent</option>
            <option value="sale">Buy</option>
            <option value="month">Rent</option>
          </select>
        </label>
        <label className="text-sm text-bone-200">
          <span className="mb-1.5 block">Bedrooms</span>
          <select
            className={selectClass}
            value={filters.beds}
            onChange={(event) => update("beds", event.target.value)}
          >
            <option value={0}>Any</option>
            {[2, 3, 4, 5].map((beds) => (
              <option key={beds} value={beds}>
                {beds}+
              </option>
            ))}
          </select>
        </label>
      </form>

      <h2 className="sr-only">Results</h2>
      <p role="status" className="mb-6 text-sm text-bone-200">
        {entries.length === 1 ? "1 listing" : `${entries.length} listings`}
      </p>

      {entries.length > 0 ? (
        <PropertyGrid entries={entries} prioritizeFirstRow />
      ) : (
        <p className="rounded-xl border border-border p-10 text-center text-bone-200">
          Nothing public matches those filters. New listings reach the group first.
        </p>
      )}
    </>
  );
}
