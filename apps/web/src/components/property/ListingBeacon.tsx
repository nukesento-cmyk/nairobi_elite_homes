"use client";

import { useEffect } from "react";

import { track } from "@/lib/analytics";

export function ListingBeacon({ listingId }: { listingId: string }) {
  useEffect(() => {
    track("view_listing", { listingId });
  }, [listingId]);

  return null;
}
