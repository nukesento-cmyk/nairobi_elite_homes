// These projections are the privacy boundary for gated listings. Whatever isn't
// projected here never leaves the server, so queries.test.ts checks them against
// sample documents that contain decoy secrets.

const PUBLISHED_LISTING = `_type == "listing" && !(_id in path("drafts.**")) && defined(slug.current)`;

const IMAGE = `{
  "url": asset->url,
  "alt": coalesce(alt, ""),
  "width": asset->metadata.dimensions.width,
  "height": asset->metadata.dimensions.height,
  "lqip": asset->metadata.lqip
}`;

const CARD = `
  "id": _id,
  "slug": slug.current,
  vertical,
  title,
  "area": location.area,
  price,
  specs,
  "isFeatured": coalesce(isFeatured, false),
  "isSample": coalesce(isSample, false),
  "hero": media.hero${IMAGE}
`;

export const publicListingsQuery = `*[${PUBLISHED_LISTING} && status == "public"]
  | order(isFeatured desc, _updatedAt desc) {${CARD}}`;

export const teaserListingsQuery = `*[${PUBLISHED_LISTING} && status in ["off_market", "members_only"]]
  | order(_updatedAt desc) {
    "id": _id,
    vertical,
    "area": location.area,
    "lqip": media.hero.asset->metadata.lqip
  }`;

export const listingDetailQuery = `*[${PUBLISHED_LISTING} && status == "public" && slug.current == $slug][0] {${CARD},
  description,
  "features": coalesce(features, []),
  "gallery": coalesce(media.gallery[]${IMAGE}, []),
  "subArea": select(location.isExactPublic == true => location.subArea, null),
  "coords": select(location.isExactPublic == true => location.coords{lat, lng}, null),
  "updatedAt": _updatedAt
}`;

export const publicSlugsQuery = `*[${PUBLISHED_LISTING} && status == "public"].slug.current`;

export const whyJoinCardsQuery = `*[_type == "whyJoinCard" && !(_id in path("drafts.**"))]
  | order(order asc) {icon, title, problem, solution, ctaLabel, ctaSource}`;

export const testimonialsQuery = `*[_type == "testimonial" && !(_id in path("drafts.**"))]
  | order(_createdAt desc) {quote, name, role}`;
