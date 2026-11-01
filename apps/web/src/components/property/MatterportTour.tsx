"use client";

import { Rotate3d } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import type { ListingImage } from "@/lib/cms/types";

type MatterportTourProps = {
  embedUrl: string;
  listingId: string;
  listingTitle: string;
  poster: ListingImage | null;
};

/** Matterport's iframe is heavy, so nothing loads from it until the visitor asks. */
export function MatterportTour({ embedUrl, listingId, listingTitle, poster }: MatterportTourProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="grain relative aspect-16/9 overflow-hidden rounded-xl border border-border bg-linear-to-br from-forest-800 to-forest-950">
      {open ? (
        <iframe
          // The clicked button is gone, so keyboard focus moves into the tour.
          ref={(frame) => frame?.focus()}
          src={embedUrl}
          title={`3D tour of ${listingTitle}`}
          allow="fullscreen; xr-spatial-tracking"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <>
          {poster && (
            <Image
              src={poster.url}
              // The same photo already has its description at the top of the page.
              alt=""
              fill
              sizes="(min-width: 1024px) 60vw, 100vw"
              placeholder={poster.lqip ? "blur" : "empty"}
              blurDataURL={poster.lqip ?? undefined}
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-forest-950/40">
            <button
              type="button"
              onClick={() => {
                track("tour_opened", { listingId });
                setOpen(true);
              }}
              className={buttonVariants({ size: "cta" })}
            >
              <Rotate3d aria-hidden="true" className="size-5" />
              Enter 3D tour
            </button>
          </div>
        </>
      )}
    </div>
  );
}
