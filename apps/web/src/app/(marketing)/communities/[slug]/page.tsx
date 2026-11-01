import { Check, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { JoinLink } from "@/components/marketing/JoinLink";
import { PropertyGrid } from "@/components/property/PropertyGrid";
import { buttonVariants } from "@/components/ui/button";
import { site } from "@/config/site";
import { getCommunityCopy } from "@/content/community";
import { communities } from "@/content/communities";
import { getCommunity, getPublicListings, getTeaserListings } from "@/lib/cms";
import { communityJsonLd } from "@/lib/json-ld";
import { mergeTeasers } from "@/lib/listings";

type CommunityPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return communities.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: CommunityPageProps): Promise<Metadata> {
  const community = await getCommunity((await params).slug);
  if (!community) return { title: "Area not found", robots: { index: false } };

  return {
    title: `Living in ${community.name}, Nairobi: homes, land and what to check`,
    description: community.summary,
    alternates: { canonical: `/communities/${community.slug}` },
  };
}

function CommunityFallback() {
  return <div aria-hidden="true" className="min-h-[80vh]" />;
}

export default function CommunityPage({ params }: CommunityPageProps) {
  return (
    <Suspense fallback={<CommunityFallback />}>
      <CommunityContent params={params} />
    </Suspense>
  );
}

async function CommunityContent({ params }: CommunityPageProps) {
  const community = await getCommunity((await params).slug);
  if (!community) notFound();

  const [listings, teasers] = await Promise.all([getPublicListings(), getTeaserListings()]);
  const entries = mergeTeasers(
    listings.filter((listing) => listing.area === community.name),
    teasers.filter((teaser) => teaser.area === community.name),
  );
  const { cta } = getCommunityCopy(site);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: communityJsonLd(community, site.url) }}
      />

      <section className="grain relative bg-linear-to-b from-forest-900 to-forest-950 py-section">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <p className="text-bone-200">Nairobi</p>
          <h1 className="mt-2 text-display text-bone-50">{community.name}</h1>
          <p className="mt-6 max-w-2xl text-xl text-bone-100">{community.summary}</p>
        </div>
      </section>

      <section aria-labelledby="about" className="py-section">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 id="about" className="text-4xl text-bone-50 md:text-5xl">
              About {community.name}
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-bone-100">{community.intro}</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <h3 className="text-2xl text-bone-50">What it&apos;s like</h3>
              <CheckList items={community.character} />
            </div>
            <div>
              <h3 className="text-2xl text-bone-50">Who it suits</h3>
              <CheckList items={community.suits} />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="checks" className="pb-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="rounded-xl border border-copper/40 bg-forest-900/40 p-6 md:p-10">
            <h2 id="checks" className="max-w-3xl text-3xl text-bone-50 md:text-4xl">
              What to check before you buy in {community.name}
            </h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {community.checks.map((check) => (
                <li key={check} className="flex gap-3 text-bone-50">
                  <ShieldAlert
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className="mt-0.5 size-5 shrink-0 text-copper-400"
                  />
                  {check}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-bone-200">
              General guidance only, not legal advice. Use your own lawyer for any purchase.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="available" className="pb-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 id="available" className="mb-10 text-4xl text-bone-50 md:text-5xl">
            Listings in {community.name}
          </h2>
          {entries.length > 0 ? (
            <PropertyGrid entries={entries} />
          ) : (
            <p className="rounded-xl border border-border p-10 text-center text-bone-200">
              Nothing public in {community.name} right now. New listings reach the group first.
            </p>
          )}
          <div className="mt-10">
            <JoinLink
              source={`community_${community.slug}`}
              placement="community_page"
              className={buttonVariants({ size: "cta-lg", className: "w-full sm:w-auto" })}
            >
              {cta.long}
            </JoinLink>
          </div>
        </div>
      </section>
    </>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-bone-50">
          <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-copper-400" />
          {item}
        </li>
      ))}
    </ul>
  );
}
