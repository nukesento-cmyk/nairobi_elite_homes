import { evaluate, parse } from "groq-js";
import { describe, expect, it } from "vitest";

import {
  listingDetailQuery,
  publicListingsQuery,
  publicSlugsQuery,
  teaserListingsQuery,
} from "./queries";
import { sampleDocuments } from "./sample-documents";
import type { ListingDetail, PublicListing, TeaserListing } from "./types";

async function run<T>(query: string, params: Record<string, string> = {}): Promise<T> {
  const result = await evaluate(parse(query, { params }), { dataset: sampleDocuments, params });
  return (await result.get()) as T;
}

describe("gated data never leaves the queries", () => {
  it.each([
    ["public listings", publicListingsQuery, {}],
    ["teaser listings", teaserListingsQuery, {}],
    ["public slugs", publicSlugsQuery, {}],
    ["a public listing's detail", listingDetailQuery, { slug: "sample-family-home-karen" }],
    ["an exact-location listing's detail", listingDetailQuery, { slug: "sample-apartment-kilimani" }],
  ])("%s contain no decoy values", async (_name, query, params) => {
    const text = JSON.stringify(await run(query, params));
    expect(text).not.toContain("DECOY");
    expect(text).not.toMatch(/decoy-slug|decoy-draft|999\d{3}999/);
  });

  it("gives a teaser only its id, vertical, area and placeholder", async () => {
    const teasers = await run<TeaserListing[]>(teaserListingsQuery);
    expect(teasers).toHaveLength(3);
    for (const teaser of teasers) {
      expect(Object.keys(teaser).sort()).toEqual(["area", "id", "lqip", "vertical"]);
      expect(teaser.lqip).toMatch(/^data:image/);
    }
  });

  it("cannot open a gated listing or a draft by slug", async () => {
    expect(await run(listingDetailQuery, { slug: "decoy-slug-gated-one" })).toBeNull();
    expect(await run(listingDetailQuery, { slug: "decoy-draft" })).toBeNull();
  });

  it("hides the exact location unless the listing makes it public", async () => {
    const hidden = await run<ListingDetail>(listingDetailQuery, { slug: "sample-family-home-karen" });
    expect(hidden.subArea).toBeNull();
    expect(hidden.coords).toBeNull();

    const shown = await run<ListingDetail>(listingDetailQuery, { slug: "sample-apartment-kilimani" });
    expect(shown.subArea).toBe("Sample sub-area");
    expect(shown.coords).toEqual({ lat: -1.2921, lng: 36.8219 });
  });
});

describe("public listings", () => {
  it("excludes gated listings and drafts, with featured first", async () => {
    const listings = await run<PublicListing[]>(publicListingsQuery);
    expect(listings).toHaveLength(9);
    expect(listings[0].slug).toBe("sample-family-home-karen");
    expect(listings[0].hero?.url).toContain("1570129477492");
  });

  it("returns the gallery in order", async () => {
    const detail = await run<ListingDetail>(listingDetailQuery, { slug: "sample-family-home-karen" });
    expect(detail.gallery.map((photo) => photo.alt)).toEqual([
      "White two-storey house with a verandah and lawn",
      "Dining and sitting room with bay windows",
      "Sunlit lounge with leather sofas and plants",
      "Bright bedroom with tall black-framed doors",
    ]);
  });
});
