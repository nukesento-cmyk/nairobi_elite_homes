import type { Metadata } from "next";
import { Suspense } from "react";

import { PrivacyPolicy } from "@/components/PrivacyPolicy";
import { requireBrandSite } from "@/lib/brand-site-data";
import { brandMetadata } from "@/lib/brand-site-metadata";

type PageProps = { params: Promise<{ site: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const site = await requireBrandSite(params);
  return brandMetadata(site, { title: "Privacy policy", path: "/privacy", description: `How ${site.name} handles your personal information.` });
}

async function Policy({ params }: PageProps) {
  const site = await requireBrandSite(params);
  return <PrivacyPolicy name={site.name} email={site.contactEmail} phone={site.contactPhone} />;
}

export default function BrandPrivacyPage(props: PageProps) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="min-h-screen" />}>
      <Policy {...props} />
    </Suspense>
  );
}
