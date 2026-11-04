import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { brandChatLink } from "@/components/brand-site/BrandShell";
import { buttonVariants } from "@/components/ui/button";
import { requireBrandSite } from "@/lib/brand-site-data";
import { brandMetadata } from "@/lib/brand-site-metadata";

type PageProps = { params: Promise<{ site: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const site = await requireBrandSite(params);
  return brandMetadata(site, { title: "Contact", path: "/contact", description: `How to reach ${site.name}.` });
}

async function Contact({ params }: PageProps) {
  const site = await requireBrandSite(params);
  const chat = brandChatLink(site, `Hi ${site.name}, I'd like to know more.`);
  const hasDetails = chat || site.contactEmail || site.contactPhone;
  return (
    <>
      <h1 className="text-4xl text-bone-50 md:text-6xl">Contact {site.name}</h1>
      {!hasDetails && (
        <p className="mt-6 text-lg text-bone-100">
          Leave your details on the <Link href={`${site.base}/join`} className="text-copper-400 underline underline-offset-4">request page</Link> and an admin will contact you.
        </p>
      )}
      <div className="mt-8 space-y-4 text-lg text-bone-50">
        {site.contactEmail && <p><a href={`mailto:${site.contactEmail}`} className="underline underline-offset-4">{site.contactEmail}</a></p>}
        {site.contactPhone && <p><a href={`tel:${site.contactPhone}`} className="underline underline-offset-4">{site.contactPhone}</a></p>}
        {chat && <a href={chat} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "cta" })}>Message on WhatsApp</a>}
      </div>
    </>
  );
}

export default function BrandContactPage(props: PageProps) {
  return (
    <section className="mx-auto min-h-[50vh] max-w-2xl px-4 py-14 sm:px-6 md:py-20">
      <Suspense>
        <Contact {...props} />
      </Suspense>
    </section>
  );
}
