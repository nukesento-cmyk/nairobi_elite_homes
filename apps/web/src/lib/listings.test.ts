import { describe, expect, it } from "vitest";

import type { PublicListing, TeaserListing } from "@/lib/cms/types";

import {
  filterListings,
  filterTeasers,
  formatPrice,
  formatSpecs,
  listAreas,
  mergeTeasers,
  parseFilters,
  serializeFilters,
} from "./listings";

const listing = (id: string, area: string, period: "sale" | "month", beds?: number): PublicListing => ({
  id,
  slug: id,
  vertical: "residential",
  title: id,
  area,
  price: { amount: 1000, currency: "KES", period },
  specs: { beds },
  isFeatured: false,
  isSample: false,
  updatedAt: "2026-11-01T00:00:00Z",
  hero: null,
});

const teaser = (id: string, area: string): TeaserListing => ({
  id,
  vertical: "residential",
  area,
  lqip: null,
});

const all = [listing("a", "Karen", "sale", 5), listing("b", "Runda", "month", 3), listing("c", "Karen", "month")];

const NO_FILTERS = { area: "", deal: "", beds: 0, acres: 0, title: "" } as const;

describe("formatting", () => {
  it("formats prices", () => {
    expect(formatPrice({ amount: 85000000, currency: "KES", period: "sale" })).toBe("KES 85,000,000");
    expect(formatPrice({ amount: 2000, currency: "USD", period: "month" })).toBe("USD 2,000/mo");
  });

  it("formats specs and skips what's missing", () => {
    expect(formatSpecs({ beds: 1, baths: 2, sqm: 1200 })).toBe("1 bed · 2 baths · 1,200 sqm");
    expect(formatSpecs({ acreage: 0.5 })).toBe("0.5 acres");
    expect(formatSpecs({})).toBe("");
  });
});

describe("filters", () => {
  it("filters by area, deal and minimum beds", () => {
    const ids = (filters: Parameters<typeof filterListings>[1]) =>
      filterListings(all, filters).map((l) => l.id);
    expect(ids(NO_FILTERS)).toEqual(["a", "b", "c"]);
    expect(ids({ ...NO_FILTERS, area: "Karen" })).toEqual(["a", "c"]);
    expect(ids({ ...NO_FILTERS, deal: "month" })).toEqual(["b", "c"]);
    expect(ids({ ...NO_FILTERS, beds: 4 })).toEqual(["a"]);
    expect(ids({ ...NO_FILTERS, area: "Karen", deal: "month", beds: 4 })).toEqual([]);
  });

  it("filters land by minimum size and title", () => {
    const plots = [
      { ...listing("half", "Karen", "sale"), specs: { acreage: 0.5, titleStatus: "freehold" } },
      { ...listing("two", "Runda", "sale"), specs: { acreage: 2, titleStatus: "leasehold" } },
      { ...listing("unknown", "Runda", "sale"), specs: {} },
    ] as PublicListing[];
    const ids = (filters: Parameters<typeof filterListings>[1]) =>
      filterListings(plots, filters).map((l) => l.id);
    expect(ids({ ...NO_FILTERS, acres: 1 })).toEqual(["two"]);
    expect(ids({ ...NO_FILTERS, title: "freehold" })).toEqual(["half"]);
    expect(ids(NO_FILTERS)).toEqual(["half", "two", "unknown"]);
  });

  it("filters teasers by area only", () => {
    const teasers = [teaser("x", "Karen"), teaser("y", "Runda")];
    expect(filterTeasers(teasers, { ...NO_FILTERS, area: "Karen", deal: "month", beds: 9 }).map((t) => t.id)).toEqual(["x"]);
  });

  it("round-trips through the URL", () => {
    const filters = { area: "Karen Hills", deal: "sale", beds: 3, acres: 0.5, title: "freehold" } as const;
    expect(parseFilters(`?${serializeFilters(filters)}`)).toEqual(filters);
    expect(serializeFilters(NO_FILTERS)).toBe("");
  });

  it("ignores invalid URL values", () => {
    expect(parseFilters("?deal=free&beds=-2&acres=-1&title=stolen")).toEqual(NO_FILTERS);
    expect(parseFilters("?beds=abc")).toEqual(NO_FILTERS);
  });

  it("lists each area once, sorted", () => {
    expect(listAreas(all, [teaser("x", "Muthaiga"), teaser("y", "Karen")])).toEqual(["Karen", "Muthaiga", "Runda"]);
  });
});

describe("mergeTeasers", () => {
  const kinds = (listings: number, teasers: number) =>
    mergeTeasers(
      Array.from({ length: listings }, (_, i) => listing(`l${i}`, "Karen", "sale")),
      Array.from({ length: teasers }, (_, i) => teaser(`t${i}`, "Karen")),
      2,
    )
      .map((entry) => entry.kind[0])
      .join("");

  it("spaces teasers through the listings", () => {
    expect(kinds(5, 2)).toBe("lltlltl");
  });

  it("keeps leftover teasers at the end", () => {
    expect(kinds(1, 2)).toBe("ltt");
    expect(kinds(0, 1)).toBe("t");
  });
});
