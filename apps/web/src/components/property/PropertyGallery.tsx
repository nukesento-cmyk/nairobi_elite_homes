"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import { track } from "@/lib/analytics";
import type { ListingImage } from "@/lib/cms/types";

type PropertyGalleryProps = {
  listingId: string;
  images: ListingImage[];
};

export function PropertyGallery({ listingId, images }: PropertyGalleryProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<ListingImage | null>(null);

  if (images.length === 0) return null;

  function open(image: ListingImage) {
    setActive(image);
    dialog.current?.showModal();
    track("gallery_opened", { listingId });
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {images.map((image, i) => (
          <li key={image.url}>
            <button
              type="button"
              onClick={() => open(image)}
              aria-label={`View photo ${i + 1} of ${images.length}`}
              className="relative block aspect-4/3 w-full overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-copper-400"
            >
              <Image
                src={image.url}
                alt={image.alt}
                fill
                sizes="(min-width: 768px) 33vw, 50vw"
                className="object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        aria-label="Photo viewer"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current.close();
        }}
        className="m-auto w-[min(92vw,1100px)] rounded-xl bg-forest-950 p-3 backdrop:bg-forest-950/97"
      >
        <form method="dialog" className="mb-2 flex justify-end">
          <button
            aria-label="Close photo viewer"
            className="flex size-10 items-center justify-center rounded-md text-bone-50 focus-visible:outline-2 focus-visible:outline-copper-400"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </form>
        {active && (
          <Image
            src={active.url}
            alt={active.alt}
            width={active.width}
            height={active.height}
            sizes="92vw"
            className="h-auto max-h-[80vh] w-full rounded-lg object-contain"
          />
        )}
      </dialog>
    </>
  );
}
