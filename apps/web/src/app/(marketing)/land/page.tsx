import { FileSearch, Landmark, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";

import { JoinLink } from "@/components/marketing/JoinLink";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { SplineScene } from "@/components/motion/SplineScene";
import { ListingsBrowser } from "@/components/property/ListingsBrowser";
import { buttonVariants } from "@/components/ui/button";
import { site } from "@/config/site";
import { getCommunityCopy } from "@/content/community";
import { getPublicListings, getSiteMedia, getTeaserListings } from "@/lib/cms";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Land for sale in Nairobi's premium areas",
  description:
    "Land in Karen, Runda, Rosslyn and more, with title status and zoning shown up front, and what to check before you buy.",
  path: "/land",
});

const safeguards = [
  {
    icon: FileSearch,
    title: "Title status up front",
    body: "Each listing states freehold or leasehold where we have it. Always confirm it with your own official search.",
  },
  {
    icon: Landmark,
    title: "Zoning before you fall in love",
    body: "What you can build matters as much as the plot. Listings show zoning where it's known.",
  },
  {
    icon: TriangleAlert,
    title: "Member warnings",
    body: "The group shares title-status notes, zoning flags and warnings about problem deals.",
  },
];

export default async function LandPage() {
  const [listings, teasers, { landScene }] = await Promise.all([
    getPublicListings(),
    getTeaserListings(),
    getSiteMedia(),
  ]);
  const { cta } = getCommunityCopy(site);

  return (
    <div className="vertical-land bg-background">
      <section className="grain relative bg-linear-to-b from-slate-800 to-slate-950 py-section">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h1 className="max-w-4xl text-display text-bone-50">
            Land in Nairobi is a minefield. Walk it with people who&apos;ve been there.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-bone-200">
            Title problems, zoning surprises and outright scams are the real risks in buying
            land. Start with what&apos;s known about a plot, then verify it for yourself.
          </p>
          <div className="mt-10">
            <JoinLink
              source="land_hero"
              placement="land_hero"
              className={buttonVariants({ size: "cta-lg", className: "w-full sm:w-auto" })}
            >
              {cta.long}
            </JoinLink>
          </div>
        </div>
      </section>

      <section aria-labelledby="safeguards" className="py-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 id="safeguards" className="sr-only">
            How we approach land
          </h2>
          <ScrollReveal as="ul" className="grid gap-8 md:grid-cols-3">
            {safeguards.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <Icon aria-hidden="true" strokeWidth={1.5} className="size-6 text-copper-400" />
                <h3 className="mt-4 text-2xl text-bone-50">{title}</h3>
                <p className="mt-2 text-bone-200">{body}</p>
              </li>
            ))}
          </ScrollReveal>
        </div>
      </section>

      <section aria-labelledby="plots" className="pb-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 id="plots" className="mb-10 text-4xl text-bone-50 md:text-5xl">
            Plots
          </h2>
          <ListingsBrowser
            variant="land"
            listings={listings.filter((listing) => listing.vertical === "land")}
            teasers={teasers.filter((teaser) => teaser.vertical === "land")}
          />
        </div>
      </section>

      {landScene && (
        <section aria-labelledby="land-scene" className="pb-section">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 id="land-scene" className="mb-8 text-4xl text-bone-50 md:text-5xl">
              {landScene.title}
            </h2>
            <SplineScene scene={landScene} />
          </div>
        </section>
      )}
    </div>
  );
}
