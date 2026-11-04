import type { Metadata } from "next";
import { Suspense } from "react";

import { RequestAccessForm } from "@/components/marketing/RequestAccessForm";
import { requireBrandSite } from "@/lib/brand-site-data";
import { brandMetadata } from "@/lib/brand-site-metadata";

type PageProps = { params: Promise<{ site: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const site = await requireBrandSite(params);
  return brandMetadata(site, { title: "Ask for access", path: "/join", description: `Ask ${site.name} for access to its private community.` });
}

async function Join({ params }: PageProps) {
  const site = await requireBrandSite(params);
  return (
    <>
      <h1 className="text-4xl text-bone-50 md:text-6xl">Ask for access</h1>
      <p className="mt-4 text-lg text-bone-100">
        Off-market listings are shared in {site.name}&apos;s private community. Leave your details and an admin will contact you on WhatsApp.
      </p>
      <RequestAccessForm base={site.base} />
    </>
  );
}

export default function BrandJoinPage(props: PageProps) {
  return (
    <section className="mx-auto min-h-[50vh] max-w-xl px-4 py-14 sm:px-6 md:py-20">
      <Suspense>
        <Join {...props} />
      </Suspense>
    </section>
  );
}
