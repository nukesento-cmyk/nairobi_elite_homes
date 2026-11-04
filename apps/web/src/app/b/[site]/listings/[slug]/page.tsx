import { Check } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { brandChatLink } from "@/components/brand-site/BrandShell";
import { MatterportTour } from "@/components/property/MatterportTour";
import { PropertyGallery } from "@/components/property/PropertyGallery";
import { buttonVariants } from "@/components/ui/button";
import { getBrandListing, requireBrandSite } from "@/lib/brand-site-data";
import { brandMetadata } from "@/lib/brand-site-metadata";
import { matterportEmbedUrl } from "@/lib/embeds";
import { formatPrice, formatSpecs } from "@/lib/listings";

type PageProps = { params: Promise<{ site: string; slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await requireBrandSite(params);
  const listing = await getBrandListing(site.id, slug);
  if (!listing) return { title: { absolute: `Listing not found | ${site.name}` }, robots: { index: false } };
  return brandMetadata(site, {
    title: `${listing.title} in ${listing.area}`,
    description: [formatPrice(listing.price), formatSpecs(listing.specs), listing.area].filter(Boolean).join(". "),
    path: `/listings/${listing.slug}`,
    image: listing.hero?.url,
  });
}

async function Listing({ params }: PageProps) {
  const { slug } = await params;
  const site = await requireBrandSite(params);
  const listing = await getBrandListing(site.id, slug);
  if (!listing) notFound();

  const specs = formatSpecs(listing.specs);
  const tourUrl = matterportEmbedUrl(listing.matterportId);
  const chat = brandChatLink(site, `Hi ${site.name}, I'm interested in ${listing.title}.`);
  const facts = [
    listing.specs.titleStatus && `Title: ${listing.specs.titleStatus}`,
    listing.specs.zoning && `Zoning: ${listing.specs.zoning}`,
  ].filter((fact) => typeof fact === "string");

  return (
    <article>
      <div className="relative aspect-16/9 max-h-[70vh] w-full bg-linear-to-br from-forest-800 to-forest-950">
        {listing.hero && (
          <Image src={listing.hero.url} alt={listing.hero.alt} fill preload sizes="100vw" className="object-cover" />
        )}
      </div>
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[3fr_2fr]">
        <div className="min-w-0">
          <p className="text-bone-200">{listing.area}</p>
          <h1 className="mt-2 text-4xl text-bone-50 md:text-6xl">{listing.title}</h1>
          <p className="mt-4 text-2xl font-medium text-copper-400">{formatPrice(listing.price)}</p>
          {specs && <p className="mt-2 text-lg text-bone-200">{specs}</p>}
          {facts.length > 0 && <p className="mt-1 text-bone-200">{facts.join(" · ")}</p>}
          {listing.description && (
            <p className="mt-8 max-w-2xl text-lg leading-relaxed whitespace-pre-line text-bone-100">{listing.description}</p>
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
          {tourUrl && (
            <>
              <h2 className="mt-10 mb-5 text-3xl text-bone-50">3D tour</h2>
              <MatterportTour embedUrl={tourUrl} listingId={listing.id} listingTitle={listing.title} poster={listing.hero} />
            </>
          )}
          {listing.gallery.length > 0 && (
            <>
              <h2 className="mt-10 mb-5 text-3xl text-bone-50">Photos</h2>
              <PropertyGallery listingId={listing.id} images={listing.gallery} />
            </>
          )}
        </div>
        <aside className="h-fit rounded-xl border border-border p-6 lg:sticky lg:top-6">
          <h2 className="text-2xl text-bone-50">Interested?</h2>
          <p className="mt-2 text-bone-200">Talk to {site.name} about this listing.</p>
          <div className="mt-5 space-y-3">
            {chat && (
              <a href={chat} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "cta", className: "w-full" })}>
                Message on WhatsApp
              </a>
            )}
            <Link href={`${site.base}/contact`} className={buttonVariants({ variant: "outline", size: "cta", className: "w-full bg-transparent" })}>
              Contact details
            </Link>
          </div>
        </aside>
      </div>
    </article>
  );
}

export default function BrandListingPage(props: PageProps) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="min-h-screen" />}>
      <Listing {...props} />
    </Suspense>
  );
}
