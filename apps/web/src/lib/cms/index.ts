import "server-only";

import { createClient } from "@sanity/client";
import { cacheLife, cacheTag } from "next/cache";

import { applyCommunitySettings, site, type CommunitySettings, type SiteConfig } from "@/config/site";
import { communities as fallbackCommunities, type Community } from "@/content/communities";
import { applyJoinOverrides, getCommunityCopy, type JoinOverrides } from "@/content/community";
import { testimonials as fallbackTestimonials, type Testimonial } from "@/content/testimonials";
import { whyJoinCards as fallbackCards, type WhyJoinCard } from "@/content/why-join";
import {
  countOffMarket,
  publicProperties,
  publicProperty,
  publishedPost,
  publishedPosts,
  teaserProperties,
  type Post,
} from "@/lib/content";
import { db, isDatabaseConfigured } from "@/lib/db";
import { splineEmbedUrl } from "@/lib/embeds";

import {
  communitiesQuery,
  communitySettingsQuery,
  joinPageQuery,
  listingDetailQuery,
  publicListingsQuery,
  publicSlugsQuery,
  siteMediaQuery,
  teaserListingsQuery,
  testimonialsQuery,
  whyJoinCardsQuery,
} from "./queries";
import type { ListingDetail, PublicListing, SceneMedia, SiteMedia, TeaserListing } from "./types";

export const CMS_CACHE_TAG = "cms";

type Params = Record<string, string>;

/**
 * Runs a GROQ query against Sanity, or against the local sample documents until
 * a project is connected, so both paths exercise the same projections.
 *
 * The dataset must be private: a public one lets anyone read off-market
 * documents straight from Sanity's API, whatever these queries leave out.
 */
async function runQuery<T>(query: string, params: Params = {}): Promise<T> {
  const projectId = process.env.SANITY_PROJECT_ID;
  if (!projectId) {
    const [{ evaluate, parse }, { sampleDocuments }] = await Promise.all([
      import("groq-js"),
      import("./sample-documents"),
    ]);
    const result = await evaluate(parse(query, { params }), { dataset: sampleDocuments, params });
    return (await result.get()) as T;
  }

  const client = createClient({
    projectId,
    dataset: process.env.SANITY_DATASET ?? "production",
    apiVersion: "2026-11-01",
    token: process.env.SANITY_API_READ_TOKEN,
    perspective: "published",
    useCdn: false,
  });
  return client.fetch<T>(query, params);
}

export function isCmsConnected(): boolean {
  return Boolean(process.env.SANITY_PROJECT_ID);
}

/**
 * Reads what reviewers added. A database outage shouldn't take the marketing site down, so
 * it falls back and is retried soon rather than caching the empty result for hours.
 */
async function fromDatabase<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  if (!isDatabaseConfigured()) return fallback;
  try {
    return await read();
  } catch {
    console.error("Reading site content from the database failed.");
    // "minutes" is the shortest that's allowed here. Anything shorter counts as dynamic,
    // which Next.js refuses on these pages and answers with a 500.
    cacheLife("minutes");
    return fallback;
  }
}

/** Sample listings stand in only until there's something real to show. */
async function readOwnListings() {
  const [listings, teasers] = await Promise.all([
    fromDatabase(() => publicProperties(db), []),
    fromDatabase(() => teaserProperties(db), []),
  ]);
  return { listings, teasers, replaceSamples: listings.length + teasers.length > 0 && !isCmsConnected() };
}

export async function getPublicListings(): Promise<PublicListing[]> {
  "use cache";
  cacheTag(CMS_CACHE_TAG);
  cacheLife("hours");
  const own = await readOwnListings();
  if (own.replaceSamples) return own.listings;
  return [...own.listings, ...(await runQuery<PublicListing[]>(publicListingsQuery))];
}

export async function getTeaserListings(): Promise<TeaserListing[]> {
  "use cache";
  cacheTag(CMS_CACHE_TAG);
  cacheLife("hours");
  const own = await readOwnListings();
  if (own.replaceSamples) return own.teasers;
  return [...own.teasers, ...(await runQuery<TeaserListing[]>(teaserListingsQuery))];
}

export async function getListing(slug: string): Promise<ListingDetail | null> {
  "use cache";
  cacheTag(CMS_CACHE_TAG);
  cacheLife("hours");
  const own = await fromDatabase(() => publicProperty(db, slug), null);
  return own ?? runQuery<ListingDetail | null>(listingDetailQuery, { slug });
}

export async function getPublicSlugs(): Promise<string[]> {
  "use cache";
  cacheTag(CMS_CACHE_TAG);
  cacheLife("hours");
  const own = await readOwnListings();
  const cms = own.replaceSamples ? [] : await runQuery<string[]>(publicSlugsQuery);
  return [...own.listings.map(({ slug }) => slug), ...cms];
}

export async function getBlogPosts(): Promise<Post[]> {
  "use cache";
  cacheTag(CMS_CACHE_TAG);
  cacheLife("hours");
  return fromDatabase(() => publishedPosts(db), []);
}

export async function getBlogPost(slug: string): Promise<Post | null> {
  "use cache";
  cacheTag(CMS_CACHE_TAG);
  cacheLife("hours");
  return fromDatabase(() => publishedPost(db, slug), null);
}

/** Falls back to the copy in content/ until marketing has added cards to the CMS. */
export async function getWhyJoinCards(): Promise<WhyJoinCard[]> {
  "use cache";
  cacheTag(CMS_CACHE_TAG);
  cacheLife("hours");
  const cards = await runQuery<WhyJoinCard[]>(whyJoinCardsQuery);
  return cards.length > 0 ? cards : fallbackCards;
}

export async function getTestimonials(): Promise<Testimonial[]> {
  "use cache";
  cacheTag(CMS_CACHE_TAG);
  cacheLife("hours");
  const testimonials = await runQuery<Testimonial[]>(testimonialsQuery);
  return testimonials.length > 0 ? testimonials : fallbackTestimonials;
}

/** The site config with marketing's CMS numbers applied. Server components only. */
export async function getLiveSite(): Promise<SiteConfig> {
  "use cache";
  cacheTag(CMS_CACHE_TAG);
  cacheLife("hours");
  const live = applyCommunitySettings(site, await runQuery<CommunitySettings | null>(communitySettingsQuery));
  const offMarketCount = await fromDatabase(() => countOffMarket(db), 0);
  return {
    ...live,
    community: { ...live.community, offMarketCount: offMarketCount || null },
  };
}

/** A scene needs a valid link and a title, or it isn't shown at all. */
function usableScene(scene: Partial<SceneMedia> | null | undefined): SceneMedia | null {
  const url = splineEmbedUrl(scene?.url);
  return url && scene?.title ? { url, title: scene.title, poster: scene.poster ?? null } : null;
}

export async function getSiteMedia(): Promise<SiteMedia> {
  "use cache";
  cacheTag(CMS_CACHE_TAG);
  cacheLife("hours");
  const media = await runQuery<Partial<SiteMedia> | null>(siteMediaQuery);
  return {
    heroExterior: media?.heroExterior ?? null,
    // The crossfade needs a photo to start from.
    heroInterior: media?.heroExterior ? (media.heroInterior ?? null) : null,
    homesScene: usableScene(media?.homesScene),
    landScene: usableScene(media?.landScene),
  };
}

export async function getJoinCopy() {
  "use cache";
  cacheTag(CMS_CACHE_TAG);
  cacheLife("hours");
  const live = await getLiveSite();
  const overrides = await runQuery<JoinOverrides | null>(joinPageQuery, {
    status: live.community.status,
  });
  return applyJoinOverrides(getCommunityCopy(live).join, overrides);
}

/** CMS documents replace the starter copy per slug, so no community page can vanish. */
export async function getCommunities(): Promise<Community[]> {
  "use cache";
  cacheTag(CMS_CACHE_TAG);
  cacheLife("hours");
  const documents = await runQuery<Community[]>(communitiesQuery);
  const bySlug = new Map(documents.map((document) => [document.slug, document]));
  return fallbackCommunities.map((community) => {
    const document = bySlug.get(community.slug);
    if (!document) return community;
    return {
      ...community,
      ...document,
      character: document.character ?? community.character,
      suits: document.suits ?? community.suits,
      checks: document.checks ?? community.checks,
    };
  });
}

export async function getCommunity(slug: string): Promise<Community | null> {
  const all = await getCommunities();
  return all.find((community) => community.slug === slug) ?? null;
}
