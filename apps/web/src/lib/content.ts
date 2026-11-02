import { randomBytes } from "node:crypto";

import { z } from "zod";

import { AdminError, canManageContent, type Admin, type Db } from "@/lib/admin/accounts";
import type { ListingDetail, PublicListing, TeaserListing } from "@/lib/cms/types";
import { LEAD_AREAS } from "@/lib/lead-options";

// --- Validation. Images are https links for now, because uploads need a file store.

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  text(max).transform((value) => value || null);
const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
  z.number("Enter a number.").nonnegative().nullable(),
);
function isSecureLink(value: string): boolean {
  if (/[\s"'<>]/.test(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const imageUrl = z
  .string()
  .trim()
  .refine((value) => !value || isSecureLink(value), "Image links must be secure, starting with https.")
  .transform((value) => value || null);
const lines = z.string().transform((value) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean),
);

const propertySchema = z.object({
  title: text(120).min(3, "Enter a title."),
  vertical: z.enum(["residential", "land", "commercial"], "Choose a type."),
  status: z.enum(["public", "off_market", "members_only"], "Choose who can see it."),
  area: z.enum(LEAD_AREAS, "Choose an area."),
  priceAmount: z.coerce.number("Enter a price.").positive("Enter a price."),
  priceCurrency: z.enum(["KES", "USD"]),
  pricePeriod: z.enum(["sale", "month"]),
  beds: optionalNumber,
  baths: optionalNumber,
  acreage: optionalNumber,
  sqm: optionalNumber,
  titleStatus: z.enum(["", "freehold", "leasehold"]).transform((value) => value || null),
  zoning: optionalText(120),
  description: optionalText(5000),
  features: lines,
  heroUrl: imageUrl,
  heroAlt: optionalText(200),
  galleryUrls: lines.pipe(z.array(imageUrl.pipe(z.string()))),
  matterportId: z
    .string()
    .trim()
    .refine((value) => !value || /^[A-Za-z0-9]{6,20}$/.test(value), "Enter just the Matterport ID.")
    .transform((value) => value || null),
});

const postSchema = z.object({
  title: text(160).min(3, "Enter a title."),
  excerpt: text(300).min(10, "Write a short summary."),
  body: text(50000).min(10, "Write the post."),
  coverUrl: imageUrl,
  coverAlt: optionalText(200),
  published: z.boolean(),
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AdminError(result.error.issues[0].message);
  return result.data;
}

function requireReviewer(actor: Admin): void {
  if (!canManageContent(actor)) throw new AdminError("Only reviewers can add properties and blogs.");
}

function assertId(id: string): void {
  if (!z.uuid().safeParse(id).success) throw new AdminError("That item no longer exists.");
}

function makeSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return `${base || "item"}-${randomBytes(3).toString("hex")}`;
}

// --- Properties

export type PropertyRow = {
  id: string;
  slug: string;
  title: string;
  vertical: PublicListing["vertical"];
  status: "public" | "off_market" | "members_only";
  area: string;
  priceAmount: string;
  priceCurrency: "KES" | "USD";
  pricePeriod: "sale" | "month";
  beds: number | null;
  baths: number | null;
  acreage: string | null;
  sqm: number | null;
  titleStatus: "freehold" | "leasehold" | null;
  zoning: string | null;
  description: string | null;
  features: string[];
  heroUrl: string | null;
  heroAlt: string | null;
  galleryUrls: string[];
  matterportId: string | null;
  updatedAt: string | Date;
};

const PROPERTY_COLUMNS = `id, slug, title, vertical, status, area,
  price_amount AS "priceAmount", price_currency AS "priceCurrency", price_period AS "pricePeriod",
  beds, baths, acreage, sqm, title_status AS "titleStatus", zoning, description, features,
  hero_url AS "heroUrl", hero_alt AS "heroAlt", gallery_urls AS "galleryUrls",
  matterport_id AS "matterportId", updated_at AS "updatedAt"`;

function propertyParams(p: z.infer<typeof propertySchema>): unknown[] {
  return [
    p.title, p.vertical, p.status, p.area, p.priceAmount, p.priceCurrency, p.pricePeriod,
    p.beds, p.baths, p.acreage, p.sqm, p.titleStatus, p.zoning, p.description, p.features,
    p.heroUrl, p.heroAlt, p.galleryUrls, p.matterportId,
  ];
}

export async function listProperties(db: Db, actor: Admin): Promise<PropertyRow[]> {
  requireReviewer(actor);
  return db.query<PropertyRow>(`SELECT ${PROPERTY_COLUMNS} FROM properties ORDER BY created_at DESC`);
}

export async function createProperty(db: Db, actor: Admin, input: unknown): Promise<PropertyRow> {
  requireReviewer(actor);
  const property = parse(propertySchema, input);
  const [row] = await db.query<PropertyRow>(
    `INSERT INTO properties (title, vertical, status, area, price_amount, price_currency, price_period,
       beds, baths, acreage, sqm, title_status, zoning, description, features, hero_url, hero_alt,
       gallery_urls, matterport_id, slug, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::text[],$16,$17,$18::text[],$19,$20,$21)
     RETURNING ${PROPERTY_COLUMNS}`,
    [...propertyParams(property), makeSlug(property.title), actor.id],
  );
  return row;
}

export async function updateProperty(db: Db, actor: Admin, id: string, input: unknown): Promise<void> {
  requireReviewer(actor);
  assertId(id);
  const property = parse(propertySchema, input);
  // The slug stays the same, so links already shared keep working.
  const rows = await db.query(
    `UPDATE properties SET title=$1, vertical=$2, status=$3, area=$4, price_amount=$5, price_currency=$6,
       price_period=$7, beds=$8, baths=$9, acreage=$10, sqm=$11, title_status=$12, zoning=$13,
       description=$14, features=$15::text[], hero_url=$16, hero_alt=$17, gallery_urls=$18::text[],
       matterport_id=$19, updated_at=now()
     WHERE id=$20 RETURNING id`,
    [...propertyParams(property), id],
  );
  if (rows.length === 0) throw new AdminError("That item no longer exists.");
}

export async function deleteProperty(db: Db, actor: Admin, id: string): Promise<void> {
  requireReviewer(actor);
  assertId(id);
  await db.query(`DELETE FROM properties WHERE id = $1`, [id]);
}

// What the public site reads. Gated properties can only ever produce a locked card.

function toListing(row: PropertyRow): PublicListing {
  return {
    id: row.id,
    slug: row.slug,
    vertical: row.vertical,
    title: row.title,
    area: row.area,
    price: { amount: Number(row.priceAmount), currency: row.priceCurrency, period: row.pricePeriod },
    specs: {
      beds: row.beds,
      baths: row.baths,
      acreage: row.acreage === null ? null : Number(row.acreage),
      sqm: row.sqm,
      titleStatus: row.titleStatus,
      zoning: row.zoning,
    },
    isFeatured: false,
    isSample: false,
    updatedAt: new Date(row.updatedAt).toISOString(),
    hero: row.heroUrl
      ? { url: row.heroUrl, alt: row.heroAlt ?? row.title, width: 1600, height: 1200, lqip: null }
      : null,
  };
}

export async function publicProperties(db: Db): Promise<PublicListing[]> {
  const rows = await db.query<PropertyRow>(
    `SELECT ${PROPERTY_COLUMNS} FROM properties WHERE status = 'public' ORDER BY created_at DESC`,
  );
  return rows.map(toListing);
}

export async function teaserProperties(db: Db): Promise<TeaserListing[]> {
  return db.query<TeaserListing>(
    `SELECT id, vertical, area, NULL AS lqip FROM properties
     WHERE status IN ('off_market', 'members_only') ORDER BY created_at DESC`,
  );
}

export async function publicProperty(db: Db, slug: string): Promise<ListingDetail | null> {
  const [row] = await db.query<PropertyRow>(
    `SELECT ${PROPERTY_COLUMNS} FROM properties WHERE status = 'public' AND slug = $1`,
    [slug],
  );
  if (!row) return null;
  return {
    ...toListing(row),
    description: row.description,
    features: row.features,
    gallery: row.galleryUrls.map((url, index) => ({
      url,
      alt: `${row.title}, photo ${index + 1}`,
      width: 1600,
      height: 1200,
      lqip: null,
    })),
    subArea: null,
    coords: null,
    matterportId: row.matterportId,
  };
}

// --- Blog

export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverUrl: string | null;
  coverAlt: string | null;
  published: boolean;
  publishedAt: string | Date | null;
  updatedAt: string | Date;
};

const POST_COLUMNS = `id, slug, title, excerpt, body, cover_url AS "coverUrl", cover_alt AS "coverAlt",
  published, published_at AS "publishedAt", updated_at AS "updatedAt"`;

export async function listPosts(db: Db, actor: Admin): Promise<Post[]> {
  requireReviewer(actor);
  return db.query<Post>(`SELECT ${POST_COLUMNS} FROM posts ORDER BY created_at DESC`);
}

export async function createPost(db: Db, actor: Admin, input: unknown): Promise<Post> {
  requireReviewer(actor);
  const post = parse(postSchema, input);
  const [row] = await db.query<Post>(
    `INSERT INTO posts (title, excerpt, body, cover_url, cover_alt, published, published_at, slug, created_by)
     VALUES ($1,$2,$3,$4,$5,$6, CASE WHEN $6::boolean THEN now() END, $7, $8)
     RETURNING ${POST_COLUMNS}`,
    [post.title, post.excerpt, post.body, post.coverUrl, post.coverAlt, post.published, makeSlug(post.title), actor.id],
  );
  return row;
}

export async function updatePost(db: Db, actor: Admin, id: string, input: unknown): Promise<void> {
  requireReviewer(actor);
  assertId(id);
  const post = parse(postSchema, input);
  const rows = await db.query(
    `UPDATE posts SET title=$1, excerpt=$2, body=$3, cover_url=$4, cover_alt=$5, published=$6,
       published_at = CASE WHEN $6::boolean THEN COALESCE(published_at, now()) ELSE NULL END,
       updated_at = now()
     WHERE id=$7 RETURNING id`,
    [post.title, post.excerpt, post.body, post.coverUrl, post.coverAlt, post.published, id],
  );
  if (rows.length === 0) throw new AdminError("That item no longer exists.");
}

export async function deletePost(db: Db, actor: Admin, id: string): Promise<void> {
  requireReviewer(actor);
  assertId(id);
  await db.query(`DELETE FROM posts WHERE id = $1`, [id]);
}

export async function publishedPosts(db: Db): Promise<Post[]> {
  return db.query<Post>(`SELECT ${POST_COLUMNS} FROM posts WHERE published ORDER BY published_at DESC`);
}

export async function publishedPost(db: Db, slug: string): Promise<Post | null> {
  const [post] = await db.query<Post>(
    `SELECT ${POST_COLUMNS} FROM posts WHERE published AND slug = $1`,
    [slug],
  );
  return post ?? null;
}
