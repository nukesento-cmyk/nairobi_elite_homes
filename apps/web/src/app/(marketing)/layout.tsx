import type { ReactNode } from "react";

import { CommunityStatusBeacon } from "@/components/marketing/CommunityStatusBeacon";
import { ExitIntentModal } from "@/components/marketing/ExitIntentModal";
import { FloatingWhatsAppButton } from "@/components/marketing/FloatingWhatsAppButton";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { UrgencyStrip } from "@/components/marketing/UrgencyStrip";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-60 focus:rounded-md focus:bg-bone-50 focus:px-3 focus:py-2 focus:text-forest-950"
      >
        Skip to content
      </a>
      <UrgencyStrip />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <FloatingWhatsAppButton />
      <ExitIntentModal />
      <CommunityStatusBeacon />
    </>
  );
}
