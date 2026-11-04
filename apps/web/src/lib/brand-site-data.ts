import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";

import { brandOrigin, siteBase } from "@/lib/brand-site";
import { DEFAULT_BRAND_ID, findBrandByKey, type Brand } from "@/lib/brands";
import { CMS_CACHE_TAG, fromDatabase } from "@/lib/cms";
import { publicProperties, publicProperty, publishedPost, publishedPosts, teaserProperties } from "@/lib/content";
import { db } from "@/lib/db";

export type BrandSite = Brand & {
  /** Start of every link on this site. */
  base: string;
  /** The brand's own address, when it has a domain. */
  origin: string | null;
};

/** Null for the original brand, whose site is the main one, and for anything unknown. */
export async function getBrandSite(key: string): Promise<BrandSite | null> {
  "use cache";
  cacheTag(CMS_CACHE_TAG);
  cacheLife("hours");
  const brand = await fromDatabase(() => findBrandByKey(db, key), null);
  if (!brand || brand.id === DEFAULT_BRAND_ID) return null;
  return { ...brand, base: siteBase(key), origin: brand.domain ? brandOrigin(brand.domain) : null };
}

export async function requireBrandSite(params: Promise<{ site: string }>): Promise<BrandSite> {
  const site = await getBrandSite((await params).site);
  if (!site) notFound();
  return site;
}

export async function getBrandListings(brandId: string) {
  "use cache";
  cacheTag(CMS_CACHE_TAG);
  cacheLife("hours");
  return fromDatabase(() => publicProperties(db, brandId), []);
}

export async function getBrandTeasers(brandId: string) {
  "use cache";
  cacheTag(CMS_CACHE_TAG);
  cacheLife("hours");
  return fromDatabase(() => teaserProperties(db, brandId), []);
}

export async function getBrandListing(brandId: string, slug: string) {
  "use cache";
  cacheTag(CMS_CACHE_TAG);
  cacheLife("hours");
  return fromDatabase(() => publicProperty(db, slug, brandId), null);
}

export async function getBrandPosts(brandId: string) {
  "use cache";
  cacheTag(CMS_CACHE_TAG);
  cacheLife("hours");
  return fromDatabase(() => publishedPosts(db, brandId), []);
}

export async function getBrandPost(brandId: string, slug: string) {
  "use cache";
  cacheTag(CMS_CACHE_TAG);
  cacheLife("hours");
  return fromDatabase(() => publishedPost(db, slug, brandId), null);
}
