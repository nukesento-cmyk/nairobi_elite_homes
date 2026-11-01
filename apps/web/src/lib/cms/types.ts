export type Vertical = "residential" | "land" | "commercial";

export type ListingImage = {
  url: string;
  alt: string;
  width: number;
  height: number;
  lqip: string | null;
};

export type ListingPrice = {
  amount: number;
  currency: "KES" | "USD";
  period: "sale" | "month";
};

export type ListingSpecs = {
  beds?: number | null;
  baths?: number | null;
  acreage?: number | null;
  sqm?: number | null;
  titleStatus?: "freehold" | "leasehold" | null;
  zoning?: string | null;
};

/** A listing anyone may see. */
export type PublicListing = {
  id: string;
  slug: string;
  vertical: Vertical;
  title: string;
  area: string;
  price: ListingPrice;
  specs: ListingSpecs;
  isFeatured: boolean;
  isSample: boolean;
  updatedAt: string;
  hero: ListingImage | null;
};

export type ListingDetail = PublicListing & {
  description: string | null;
  features: string[];
  gallery: ListingImage[];
  /** Null unless the listing is marked as having a public exact location. */
  subArea: string | null;
  coords: { lat: number; lng: number } | null;
  matterportId: string | null;
};

/**
 * An off-market or members-only listing. This is everything the browser ever
 * receives about one: no title, slug, price or image URL.
 */
export type TeaserListing = {
  id: string;
  vertical: Vertical;
  area: string;
  /** A tiny blurred placeholder, which cannot be enlarged into the real photo. */
  lqip: string | null;
};

/** The one 3D moment for a vertical. */
export type SceneMedia = {
  url: string;
  title: string;
  poster: ListingImage | null;
};

export type SiteMedia = {
  heroExterior: ListingImage | null;
  heroInterior: ListingImage | null;
  homesScene: SceneMedia | null;
  landScene: SceneMedia | null;
};
