import { Check, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { JoinLink } from "@/components/marketing/JoinLink";
import { LeadForm } from "@/components/marketing/LeadForm";
import { ListingActionBar } from "@/components/property/ListingActionBar";
import { ListingBeacon } from "@/components/property/ListingBeacon";
import { PropertyGallery } from "@/components/property/PropertyGallery";
import { buttonVariants } from "@/components/ui/button";
import { site } from "@/config/site";
import { getCommunityCopy } from "@/content/community";
import { getListing, getPublicSlugs } from "@/lib/cms";
import { listingJsonLd } from "@/lib/json-ld";
import { formatPrice, formatSpecs } from "@/lib/listings";

type ListingPageProps = { params: Promise<{ slug: string }> };

// Cache Components requires at least one path at build time, so an empty
// catalogue prerenders this placeholder, which resolves to the 404 page.
const NO_LISTINGS_SLUG = "no-listings";

export async function generateStaticParams() {
  const slugs = await getPublicSlugs();
  return (slugs.length > 0 ? slugs : [NO_LISTINGS_SLUG]).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const listing = await getListing((await params).slug);
  if (!listing) return { title: "Listing not found", robots: { index: false } };

  const title = `${listing.title} in ${listing.area}`;
  const description = `${formatPrice(listing.price)}. ${formatSpecs(listing.specs)}. ${listing.area}, Nairobi.`;
  const image = `/api/og?slug=${encodeURIComponent(listing.slug)}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    robots: listing.isSample ? { index: false } : undefined,
  };
}

// Known listings are fully prerendered. A listing published since the last
// build shows this briefly, then is cached like the others.
function ListingFallback() {
  return (
    <div aria-hidden="true">
      <div className="aspect-16/9 max-h-[70vh] w-full bg-linear-to-br from-forest-800 to-forest-950" />
      <div className="mx-auto min-h-[60vh] max-w-7xl px-4 py-14 sm:px-6" />
    </div>
  );
}

export default function ListingPage({ params }: ListingPageProps) {
  return (
    <Suspense fallback={<ListingFallback />}>
      <ListingContent params={params} />
    </Suspense>
  );
}

async function ListingContent({ params }: ListingPageProps) {
  const listing = await getListing((await params).slug);
  if (!listing) notFound();

  const { listingGate } = getCommunityCopy(site);
  const specs = formatSpecs(listing.specs);
  const facts = [
    listing.specs.titleStatus && `Title: ${listing.specs.titleStatus}`,
    listing.specs.zoning && `Zoning: ${listing.specs.zoning}`,
  ].filter((fact) => typeof fact === "string");

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: listingJsonLd(listing) }}
      />
      <ListingBeacon listingId={listing.id} />

      <div className="relative aspect-16/9 max-h-[70vh] w-full bg-linear-to-br from-forest-800 to-forest-950">
        {listing.hero && (
          <Image
            src={listing.hero.url}
            alt={listing.hero.alt}
            fill
            priority
            sizes="100vw"
            placeholder={listing.hero.lqip ? "blur" : "empty"}
            blurDataURL={listing.hero.lqip ?? undefined}
            className="object-cover"
          />
        )}
      </div>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[3fr_2fr]">
        <div className="min-w-0">
          {listing.isSample && (
            <p className="mb-4 w-fit rounded-md border border-copper/50 px-2 py-1 text-xs font-medium text-copper-400">
              Sample listing
            </p>
          )}
          <p className="text-bone-200">{listing.area}, Nairobi</p>
          <h1 className="mt-2 text-4xl text-bone-50 md:text-6xl">{listing.title}</h1>
          <p className="mt-4 text-2xl font-medium text-copper-400">{formatPrice(listing.price)}</p>
          {specs && <p className="mt-2 text-lg text-bone-200">{specs}</p>}
          {facts.length > 0 && <p className="mt-1 text-bone-200">{facts.join(" · ")}</p>}

          {listing.description && (
            <p className="mt-8 max-w-2xl text-lg leading-relaxed whitespace-pre-line text-bone-100">
              {listing.description}
            </p>
          )}

          {listing.features.length > 0 && (
            <>
              <h2 className="mt-10 text-3xl text-bone-50">Features</h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {listing.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-bone-50">
                    <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-copper-400" />
                    {feature}
                  </li>
                ))}
              </ul>
            </>
          )}

          {listing.gallery.length > 0 && (
            <>
              <h2 className="mt-10 mb-5 text-3xl text-bone-50">Photos</h2>
              <PropertyGallery listingId={listing.id} images={listing.gallery} />
            </>
          )}
        </div>

        <aside className="flex flex-col gap-6 self-start">
          <div className="overflow-hidden rounded-xl border border-copper/40">
            {listing.subArea ? (
              <p className="flex items-center gap-2 p-6 text-bone-50">
                <MapPin aria-hidden="true" className="size-5 text-copper-400" />
                {listing.subArea}, {listing.area}
              </p>
            ) : (
              // Decorative only. The exact location is never sent to the browser.
              <div
                aria-hidden="true"
                className="grain relative h-32 bg-linear-to-br from-forest-800 to-forest-900 blur-[2px]"
              />
            )}
            <div className="p-6">
              <h2 className="text-2xl text-bone-50">{listingGate.title}</h2>
              <p className="mt-2 mb-5 text-bone-200">{listingGate.body}</p>
              <JoinLink
                source="listing_detail"
                placement="listing_detail"
                className={buttonVariants({ size: "cta", className: "w-full" })}
              >
                {listingGate.cta}
              </JoinLink>
            </div>
          </div>

          <div className="rounded-xl border border-border p-6">
            <h2 className="text-2xl text-bone-50">Ask about this listing</h2>
            <LeadForm source="listing_detail" listing={listing.slug} />
          </div>
        </aside>
      </div>

      <ListingActionBar listingTitle={listing.title} />
    </article>
  );
}
