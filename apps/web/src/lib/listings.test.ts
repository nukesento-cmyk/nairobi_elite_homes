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
  hero: null,
});

const teaser = (id: string, area: string): TeaserListing => ({
  id,
  vertical: "residential",
  area,
  lqip: null,
});

const all = [listing("a", "Karen", "sale", 5), listing("b", "Runda", "month", 3), listing("c", "Karen", "month")];

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
    expect(ids({ area: "", deal: "", beds: 0 })).toEqual(["a", "b", "c"]);
    expect(ids({ area: "Karen", deal: "", beds: 0 })).toEqual(["a", "c"]);
    expect(ids({ area: "", deal: "month", beds: 0 })).toEqual(["b", "c"]);
    expect(ids({ area: "", deal: "", beds: 4 })).toEqual(["a"]);
    expect(ids({ area: "Karen", deal: "month", beds: 4 })).toEqual([]);
  });

  it("filters teasers by area only", () => {
    const teasers = [teaser("x", "Karen"), teaser("y", "Runda")];
    expect(filterTeasers(teasers, { area: "Karen", deal: "month", beds: 9 }).map((t) => t.id)).toEqual(["x"]);
  });

  it("round-trips through the URL", () => {
    const filters = { area: "Karen Hills", deal: "sale", beds: 3 } as const;
    expect(parseFilters(`?${serializeFilters(filters)}`)).toEqual(filters);
    expect(serializeFilters({ area: "", deal: "", beds: 0 })).toBe("");
  });

  it("ignores invalid URL values", () => {
    expect(parseFilters("?deal=free&beds=-2")).toEqual({ area: "", deal: "", beds: 0 });
    expect(parseFilters("?beds=abc")).toEqual({ area: "", deal: "", beds: 0 });
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
