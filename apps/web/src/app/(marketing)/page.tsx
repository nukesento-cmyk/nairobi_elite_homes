import type { Metadata } from "next";
import Link from "next/link";

import { HomeHero } from "@/components/marketing/HomeHero";
import { WhyJoinCards } from "@/components/marketing/WhyJoinCards";
import { PropertyGrid } from "@/components/property/PropertyGrid";
import { getBlogPosts, getPublicListings, getTeaserListings, getWhyJoinCards } from "@/lib/cms";
import { organizationJsonLd } from "@/lib/json-ld";
import { mergeTeasers } from "@/lib/listings";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Private access to Nairobi's best homes and land",
  description:
    "A private community for serious buyers, renters, sellers and landowners in Karen, Runda, Kilimani, Rosslyn, Lavington and Muthaiga.",
  path: "/",
});

const HOME_LISTING_COUNT = 9;

export default async function HomePage() {
  const [listings, teasers, cards, posts] = await Promise.all([
    getPublicListings(),
    getTeaserListings(),
    getWhyJoinCards(),
    getBlogPosts(),
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJsonLd() }} />
      <HomeHero />

      <section aria-labelledby="why-join" className="py-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 id="why-join" className="mb-10 max-w-2xl text-4xl text-bone-50 md:text-5xl">
            The best property in Nairobi rarely reaches the open market.
          </h2>
          <WhyJoinCards cards={cards.slice(0, 4)} sourcePrefix="home" placement="home_why_join" />
        </div>
      </section>

      <section
        id="listings"
        aria-labelledby="listings-heading"
        className="scroll-mt-14 pb-section"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <h2 id="listings-heading" className="text-4xl text-bone-50 md:text-5xl">
              Listings
            </h2>
            <div className="flex gap-6">
              <Link
                href="/homes"
                className="text-copper-400 underline decoration-copper/50 underline-offset-4 hover:text-bone-50"
              >
                All homes <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/land"
                className="text-copper-400 underline decoration-copper/50 underline-offset-4 hover:text-bone-50"
              >
                All land <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <PropertyGrid
            entries={mergeTeasers(listings.slice(0, HOME_LISTING_COUNT), teasers.slice(0, 3))}
          />
        </div>
      </section>

      {posts.length > 0 && (
        <section aria-labelledby="guides" className="pb-section">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <h2 id="guides" className="text-4xl text-bone-50 md:text-5xl">Buying in Nairobi</h2>
              <Link href="/blog" className="text-copper-400 underline decoration-copper/50 underline-offset-4 hover:text-bone-50">
                All guides <span aria-hidden="true">→</span>
              </Link>
            </div>
            <ul className="grid gap-4 md:grid-cols-3 lg:gap-6">
              {posts.slice(0, 3).map((post) => (
                <li key={post.id} className="group relative rounded-xl border border-border p-6 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out-expo motion-safe:hover:-translate-y-1">
                  <h3 className="text-xl text-bone-50">
                    <Link href={`/blog/${post.slug}`} className="underline-draw after:absolute after:inset-0">{post.title}</Link>
                  </h3>
                  <p className="mt-3 text-sm text-bone-200">{post.excerpt}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
