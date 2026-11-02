import Image from "next/image";

import type { PlaceImage } from "@/content/place-images";
import { cn } from "@/lib/utils";

/** The classes a hero needs so the photo runs up under the transparent header. */
export const PLACE_HERO_CLASS =
  "-mt-(--header-h) overflow-hidden pt-[calc(var(--spacing-section)+var(--header-h))]";

export function PhotoCredit({ image, className }: { image: PlaceImage; className?: string }) {
  return (
    <p className={cn("text-xs text-bone-200", className)}>
      {image.caption}. Photo: {" "}
      <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-bone-50">
        {image.author}
      </a>
      , {image.licence}
    </p>
  );
}

/** A real photo behind a hero, darkened enough that text stays readable on any part of it. */
export function PlaceBackground({ image, tone = "forest" }: { image: PlaceImage; tone?: "forest" | "slate" }) {
  return (
    <>
      <Image
        src={image.src}
        alt={image.alt}
        fill
        preload
        sizes="100vw"
        className="object-cover"
      />
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 bg-linear-to-b md:bg-linear-to-r",
          tone === "slate"
            ? "from-slate-950/85 via-slate-950/80 to-slate-950/70 md:via-slate-950/75 md:to-slate-950/30"
            : "from-forest-950/85 via-forest-950/80 to-forest-950/70 md:via-forest-950/75 md:to-forest-950/30",
        )}
      />
      <PhotoCredit
        image={image}
        className="absolute right-4 bottom-3 z-10 max-w-[calc(100%-2rem)] rounded bg-forest-950/75 px-2 py-1 text-bone-50"
      />
    </>
  );
}
