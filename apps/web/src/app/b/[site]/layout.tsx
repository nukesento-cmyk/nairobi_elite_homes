import { Suspense, type ReactNode } from "react";

import { BrandShell } from "@/components/brand-site/BrandShell";
import { requireBrandSite } from "@/lib/brand-site-data";

type LayoutProps = { children: ReactNode; params: Promise<{ site: string }> };

async function Shell({ children, params }: LayoutProps) {
  return <BrandShell site={await requireBrandSite(params)}>{children}</BrandShell>;
}

// Every brand's site is built on first visit and then cached, so a new brand needs no deploy.
export default function BrandSiteLayout(props: LayoutProps) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="min-h-screen" />}>
      <Shell {...props} />
    </Suspense>
  );
}
