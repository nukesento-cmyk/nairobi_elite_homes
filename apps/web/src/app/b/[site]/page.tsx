import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BrandListings } from "@/components/brand-site/BrandListings";
import { buttonVariants } from "@/components/ui/button";
import { getBrandListings, getBrandPosts, getBrandTeasers, requireBrandSite } from "@/lib/brand-site-data";
import { brandMetadata } from "@/lib/brand-site-metadata";

type PageProps = { params: Promise<{ site: string }> };

const HOME_LISTINGS = 6;
const HOME_POSTS = 3;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return brandMetadata(await requireBrandSite(params), { path: "" });
}

async function Home({ params }: PageProps) {
  const site = await requireBrandSite(params);
  const [listings, teasers, posts] = await Promise.all([
    getBrandListings(site.id),
    getBrandTeasers(site.id),
    getBrandPosts(site.id),
  ]);
  return (
    <>
      <section className="grain bg-linear-to-br from-forest-800 to-forest-950">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
          <h1 className="max-w-3xl text-5xl text-bone-50 md:text-7xl">{site.name}</h1>
          {site.tagline && <p className="mt-5 max-w-2xl text-xl text-bone-100">{site.tagline}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`${site.base}/homes`} className={buttonVariants({ size: "cta" })}>Browse homes</Link>
            <Link href={`${site.base}/join`} className={buttonVariants({ variant: "outline", size: "cta", className: "bg-transparent" })}>
              Ask for access
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-20">
        <h2 className="mb-6 text-3xl text-bone-50">Latest listings</h2>
        <BrandListings
          site={site}
          listings={listings.slice(0, HOME_LISTINGS)}
          teasers={listings.length < HOME_LISTINGS ? teasers.slice(0, HOME_LISTINGS - listings.length) : []}
          empty="New listings are on their way."
        />
      </section>

      {site.about && (
        <section className="mx-auto max-w-3xl px-4 pb-14 sm:px-6 md:pb-20">
          <h2 className="mb-4 text-3xl text-bone-50">About {site.name}</h2>
          <p className="text-lg leading-relaxed whitespace-pre-line text-bone-100">{site.about}</p>
        </section>
      )}

      {posts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 md:pb-20">
          <h2 className="mb-6 text-3xl text-bone-50">From the blog</h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {posts.slice(0, HOME_POSTS).map((post) => (
              <li key={post.id} className="rounded-xl border border-border p-5">
                <Link href={`${site.base}/blog/${post.slug}`} className="text-xl text-bone-50 underline-draw">{post.title}</Link>
                <p className="mt-2 text-sm text-bone-200">{post.excerpt}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function BrandHomePage(props: PageProps) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="min-h-screen" />}>
      <Home {...props} />
    </Suspense>
  );
}
