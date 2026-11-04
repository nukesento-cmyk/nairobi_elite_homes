import type { Metadata } from "next";
import { Suspense } from "react";

import { BrandListings } from "@/components/brand-site/BrandListings";
import { getBrandListings, getBrandTeasers, requireBrandSite } from "@/lib/brand-site-data";
import { brandMetadata } from "@/lib/brand-site-metadata";

type PageProps = { params: Promise<{ site: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const site = await requireBrandSite(params);
  return brandMetadata(site, { title: "Homes", path: "/homes", description: `Homes from ${site.name}.` });
}

async function Listings({ params }: PageProps) {
  const site = await requireBrandSite(params);
  const [listings, teasers] = await Promise.all([getBrandListings(site.id), getBrandTeasers(site.id)]);
  return (
    <BrandListings
      site={site}
      listings={listings.filter(({ vertical }) => vertical !== "land")}
      teasers={teasers.filter(({ vertical }) => vertical !== "land")}
      empty="New homes are on their way."
    />
  );
}

export default function BrandHomesPage(props: PageProps) {
  return (
    <section className="mx-auto min-h-[50vh] max-w-7xl px-4 py-14 sm:px-6 md:py-20">
      <h1 className="mb-8 text-4xl text-bone-50 md:text-6xl">Homes</h1>
      <Suspense>
        <Listings {...props} />
      </Suspense>
    </section>
  );
}
