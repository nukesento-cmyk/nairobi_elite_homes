"use client";

import { X } from "lucide-react";

import { dismissStrip } from "@/lib/strip-dismissal";

export function StripDismissButton() {
  return (
    <button
      type="button"
      aria-label="Dismiss announcement"
      onClick={dismissStrip}
      className="flex size-8 shrink-0 items-center justify-center rounded-md text-bone-200 transition-colors hover:text-bone-50 focus-visible:outline-2 focus-visible:outline-copper-400"
    >
      <X aria-hidden="true" className="size-4" />
    </button>
  );
}
