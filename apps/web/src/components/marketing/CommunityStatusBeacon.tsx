"use client";

import { useEffect } from "react";

import { site } from "@/config/site";
import { track } from "@/lib/analytics";

/** Lets marketing compare conversion before and after the paywall. */
export function CommunityStatusBeacon() {
  useEffect(() => {
    track("community_status_viewed", { status: site.community.status });
  }, []);

  return null;
}
