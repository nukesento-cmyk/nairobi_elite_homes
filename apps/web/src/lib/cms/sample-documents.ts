// Invented documents, shaped exactly like Sanity's, used until a project is
// connected. Every listing shows a "Sample" badge and is excluded from search.
//
// Anything containing DECOY must never reach a browser: tests and the browser
// checks fail if it does.
type SampleSpec = {
  id: string;
  vertical: "residential" | "land";
  title: string;
  area: string;
  amount: number;
  period?: "sale" | "month";
  specs: Record<string, unknown>;
  status?: "public" | "off_market" | "members_only";
  isFeatured?: boolean;
  exact?: boolean;
  images?: string[];
};

const assets = ["one", "two", "three"].map((name) => ({
  _id: `image-sample-${name}`,
  _type: "sanity.imageAsset",
  url: `/sample/${name}.svg`,
  metadata: { dimensions: { width: 1600, height: 1200 }, lqip: null },
}));

const gatedAsset = {
  _id: "image-gated",
  _type: "sanity.imageAsset",
  url: "/DECOY-gated-photo.jpg",
  metadata: {
    dimensions: { width: 1600, height: 1200 },
    lqip: "data:image/gif;base64,R0lGODlhAQABAIAAAC4+NgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==",
  },
};

const image = (name: string, alt: string) => ({
  asset: { _type: "reference", _ref: `image-sample-${name}` },
  alt,
});

function listing(spec: SampleSpec) {
  const gated = spec.status === "off_market" || spec.status === "members_only";
  const images = spec.images ?? [];
  return {
    _id: spec.id,
    _type: "listing",
    _updatedAt: "2026-11-01T00:00:00Z",
    isSample: true,
    title: gated ? `DECOY title ${spec.id}` : spec.title,
    slug: { current: gated ? `decoy-slug-${spec.id}` : spec.id },
    vertical: spec.vertical,
    description: gated
      ? "DECOY description"
      : "This is sample text showing how a listing description will read once real listings are published.",
    location: {
      area: spec.area,
      subArea: spec.exact ? "Sample sub-area" : "DECOY exact sub-area",
      coords: { lat: -1.2921, lng: 36.8219 },
      isExactPublic: spec.exact ?? false,
    },
    price: { amount: spec.amount, currency: "KES", period: spec.period ?? "sale" },
    specs: spec.specs,
    features: gated ? ["DECOY feature"] : ["Sample feature one", "Sample feature two", "Sample feature three"],
    media: gated
      ? { hero: { asset: { _type: "reference", _ref: "image-gated" }, alt: "DECOY alt" } }
      : {
          hero: images[0] ? image(images[0], `${spec.title}, sample photo`) : null,
          gallery: images.map((name, i) => image(name, `${spec.title}, sample photo ${i + 1}`)),
        },
    ownerContact: "DECOY owner contact",
    status: spec.status ?? "public",
    isFeatured: spec.isFeatured ?? false,
  };
}

export const sampleDocuments: unknown[] = [
  ...assets,
  gatedAsset,
  listing({ id: "sample-family-home-karen", vertical: "residential", title: "Sample family home", area: "Karen", amount: 85000000, specs: { beds: 5, baths: 5, sqm: 420, titleStatus: "freehold" }, isFeatured: true, images: ["one", "two", "three"] }),
  listing({ id: "sample-half-acre-runda", vertical: "land", title: "Sample half-acre plot", area: "Runda", amount: 60000000, specs: { acreage: 0.5, titleStatus: "freehold", zoning: "Residential" } }),
  listing({ id: "sample-apartment-kilimani", vertical: "residential", title: "Sample apartment", area: "Kilimani", amount: 180000, period: "month", specs: { beds: 3, baths: 3, sqm: 160 }, exact: true }),
  listing({ id: "sample-townhouse-lavington", vertical: "residential", title: "Sample townhouse", area: "Lavington", amount: 42000000, specs: { beds: 4, baths: 4 } }),
  listing({ id: "sample-garden-villa-muthaiga", vertical: "residential", title: "Sample garden villa", area: "Muthaiga", amount: 120000000, specs: { beds: 6, baths: 6 } }),
  listing({ id: "sample-one-acre-karen", vertical: "land", title: "Sample one-acre plot", area: "Karen", amount: 75000000, specs: { acreage: 1, titleStatus: "leasehold" } }),
  listing({ id: "sample-duplex-rosslyn", vertical: "residential", title: "Sample duplex", area: "Rosslyn", amount: 350000, period: "month", specs: { beds: 4, baths: 4 } }),
  listing({ id: "sample-penthouse-kilimani", vertical: "residential", title: "Sample penthouse", area: "Kilimani", amount: 38000000, specs: { beds: 3, baths: 3 } }),
  listing({ id: "sample-two-acre-rosslyn", vertical: "land", title: "Sample two-acre plot", area: "Rosslyn", amount: 140000000, specs: { acreage: 2 } }),
  listing({ id: "gated-one", vertical: "residential", title: "", area: "Karen", amount: 999111999, specs: { beds: 7 }, status: "off_market" }),
  listing({ id: "gated-two", vertical: "land", title: "", area: "Runda", amount: 999222999, specs: { acreage: 9 }, status: "off_market" }),
  listing({ id: "gated-three", vertical: "residential", title: "", area: "Muthaiga", amount: 999333999, specs: { beds: 8 }, status: "members_only" }),
  {
    ...listing({ id: "unpublished", vertical: "residential", title: "DECOY draft", area: "Karen", amount: 999444999, specs: {} }),
    _id: "drafts.sample-unpublished",
    slug: { current: "decoy-draft" },
  },
];
