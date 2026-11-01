"use client";

import { JoinLink } from "@/components/marketing/JoinLink";
import { buttonVariants } from "@/components/ui/button";
import { site } from "@/config/site";
import { getCommunityCopy } from "@/content/community";
import { track } from "@/lib/analytics";
import { directChatLink } from "@/lib/whatsapp";

/** The mobile bar on listing pages. It replaces the floating WhatsApp button there. */
export function ListingActionBar({ listingTitle }: { listingTitle: string }) {
  const { cta } = getCommunityCopy(site);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-2 border-t border-border bg-forest-950 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
      <JoinLink
        source="listing_bar"
        placement="listing_detail"
        className={buttonVariants({ size: "cta", className: "px-2" })}
      >
        {cta.short}
      </JoinLink>
      <a
        href={directChatLink(`Hi, I'm interested in ${listingTitle}.`)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          track("join_click", { source: "listing_bar_whatsapp", placement: "listing_detail" })
        }
        className={buttonVariants({ variant: "outline", size: "cta", className: "bg-transparent px-2" })}
      >
        WhatsApp us
      </a>
    </div>
  );
}
