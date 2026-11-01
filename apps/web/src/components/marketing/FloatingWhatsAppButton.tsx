"use client";

import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";

import { site } from "@/config/site";
import { getCommunityCopy } from "@/content/community";

import { JoinLink } from "./JoinLink";

export function FloatingWhatsAppButton() {
  const { cta } = getCommunityCopy(site);

  // Listing pages have their own fixed bar on phones.
  if (usePathname()?.startsWith("/listings/")) return null;

  return (
    <JoinLink
      source="floating_button"
      aria-label={`${cta.long} on WhatsApp`}
      className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full bg-copper text-forest-950 shadow-lg motion-safe:animate-soft-pulse md:hidden"
    >
      <MessageCircle aria-hidden="true" className="size-6" />
    </JoinLink>
  );
}
