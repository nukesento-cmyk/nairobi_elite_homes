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
  images?: PhotoName[];
};

// Stock photos from Unsplash, standing in for real listings until a project is
// connected. They don't show the places named on the sample listings.
const photos = {
  verandahHouse: ["1570129477492-45c003edd2be", "White two-storey house with a verandah and lawn"],
  diningRoom: ["1560185007-cde436f6a4d0", "Dining and sitting room with bay windows"],
  bedroom: ["1600607687644-c7171b42498f", "Bright bedroom with tall black-framed doors"],
  lounge: ["1600210492486-724fe5c67fb0", "Sunlit lounge with leather sofas and plants"],
  openLiving: ["1560448204-e02f11c3d0e2", "Open-plan living room with large windows"],
  plantRoom: ["1502672260266-1c1ef2d93688", "Small sitting room with shelves and plants"],
  modernFacade: ["1600047509807-ba8f99d2cdde", "Modern two-storey house with timber cladding"],
  woodWallLiving: ["1600607687939-ce8a6c25118c", "Modern living room with a timber feature wall"],
  poolVilla: ["1564013799919-ab600027ffc6", "White villa with palm trees and a swimming pool"],
  familyLiving: ["1600566753086-00f18fb6b3ea", "Double-height living room with a timber staircase"],
  whitePoolHouse: ["1600596542815-ffad4c1539a9", "White modern house beside a swimming pool"],
  glassStair: ["1600573472550-8090b5e0745e", "Glass-walled room with a staircase and pool view"],
  duskTower: ["1600585154526-990dced4db0d", "Dark modern building lit up at dusk"],
  duskGarden: ["1600585154340-be6161a56a0c", "Modern house at dusk, with a mature tree on its lawn"],
  goldenField: ["1500382017468-9049fed747ef", "Open golden field at sunset"],
  greenValley: ["1470071459604-3b5ec3a7fe05", "Green valley under a dramatic sky"],
  woodland: ["1441974231531-c6227db76b6e", "Sunlit woodland with a path between tall trees"],
} as const;

type PhotoName = keyof typeof photos;

const assets = Object.entries(photos).map(([name, [id]]) => ({
  _id: `image-sample-${name}`,
  _type: "sanity.imageAsset",
  url: `https://images.unsplash.com/photo-${id}`,
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

const image = (name: PhotoName) => ({
  asset: { _type: "reference", _ref: `image-sample-${name}` },
  alt: photos[name][1],
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
          hero: images[0] ? image(images[0]) : null,
          gallery: images.map(image),
        },
    ownerContact: "DECOY owner contact",
    status: spec.status ?? "public",
    isFeatured: spec.isFeatured ?? false,
  };
}

export const sampleDocuments: unknown[] = [
  ...assets,
  gatedAsset,
  { _id: "siteMedia", _type: "siteMedia", heroExterior: image("duskGarden"), heroInterior: image("woodWallLiving") },
  listing({ id: "sample-family-home-karen", vertical: "residential", title: "Sample family home", area: "Karen", amount: 85000000, specs: { beds: 5, baths: 5, sqm: 420, titleStatus: "freehold" }, isFeatured: true, images: ["verandahHouse", "diningRoom", "lounge", "bedroom"] }),
  listing({ id: "sample-half-acre-runda", vertical: "land", title: "Sample half-acre plot", area: "Runda", amount: 60000000, specs: { acreage: 0.5, titleStatus: "freehold", zoning: "Residential" }, images: ["goldenField"] }),
  listing({ id: "sample-apartment-kilimani", vertical: "residential", title: "Sample apartment", area: "Kilimani", amount: 180000, period: "month", specs: { beds: 3, baths: 3, sqm: 160 }, exact: true, images: ["openLiving", "plantRoom"] }),
  listing({ id: "sample-townhouse-lavington", vertical: "residential", title: "Sample townhouse", area: "Lavington", amount: 42000000, specs: { beds: 4, baths: 4 }, images: ["modernFacade", "woodWallLiving"] }),
  listing({ id: "sample-garden-villa-muthaiga", vertical: "residential", title: "Sample garden villa", area: "Muthaiga", amount: 120000000, specs: { beds: 6, baths: 6 }, images: ["poolVilla", "familyLiving"] }),
  listing({ id: "sample-one-acre-karen", vertical: "land", title: "Sample one-acre plot", area: "Karen", amount: 75000000, specs: { acreage: 1, titleStatus: "leasehold" }, images: ["greenValley"] }),
  listing({ id: "sample-duplex-rosslyn", vertical: "residential", title: "Sample duplex", area: "Rosslyn", amount: 350000, period: "month", specs: { beds: 4, baths: 4 }, images: ["whitePoolHouse", "glassStair"] }),
  listing({ id: "sample-penthouse-kilimani", vertical: "residential", title: "Sample penthouse", area: "Kilimani", amount: 38000000, specs: { beds: 3, baths: 3 }, images: ["duskTower", "woodWallLiving"] }),
  listing({ id: "sample-two-acre-rosslyn", vertical: "land", title: "Sample two-acre plot", area: "Rosslyn", amount: 140000000, specs: { acreage: 2 }, images: ["woodland"] }),
  listing({ id: "gated-one", vertical: "residential", title: "", area: "Karen", amount: 999111999, specs: { beds: 7 }, status: "off_market" }),
  listing({ id: "gated-two", vertical: "land", title: "", area: "Runda", amount: 999222999, specs: { acreage: 9 }, status: "off_market" }),
  listing({ id: "gated-three", vertical: "residential", title: "", area: "Muthaiga", amount: 999333999, specs: { beds: 8 }, status: "members_only" }),
  {
    ...listing({ id: "unpublished", vertical: "residential", title: "DECOY draft", area: "Karen", amount: 999444999, specs: {} }),
    _id: "drafts.sample-unpublished",
    slug: { current: "decoy-draft" },
  },
];
