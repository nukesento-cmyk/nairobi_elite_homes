"use client";

import { useMotionValueEvent, useScroll } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { useReducedMotion } from "@/components/motion/useReducedMotion";
import type { ListingImage } from "@/lib/cms/types";

const MAX_SCALE = 1.08;
const FADE_START = 0.15;
const FADE_END = 0.6;

type HeroMediaProps = {
  exterior: ListingImage;
  interior: ListingImage | null;
};

/**
 * The hero's one transition: the photo eases forward and crossfades to the interior
 * as the page scrolls. Writing styles directly keeps scrolling out of React.
 * The interior isn't requested until scrolling starts, so it can't compete with the
 * exterior for the page's largest paint.
 */
export function HeroMedia({ exterior, interior }: HeroMediaProps) {
  const frame = useRef<HTMLDivElement>(null);
  const interiorLayer = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [interiorRequested, setInteriorRequested] = useState(false);
  const { scrollYProgress } = useScroll({ target: frame, offset: ["start start", "end start"] });

  const applyStyles = useCallback(
    (progress: number) => {
      if (frame.current) {
        const scale = reducedMotion ? 1 : 1 + (MAX_SCALE - 1) * progress;
        frame.current.style.transform = `scale(${scale})`;
      }
      if (interiorLayer.current) {
        const fade = (progress - FADE_START) / (FADE_END - FADE_START);
        interiorLayer.current.style.opacity = String(Math.min(1, Math.max(0, fade)));
      }
    },
    [reducedMotion],
  );

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    applyStyles(progress);
    if (progress > 0) setInteriorRequested(true);
  });
  // Catches the interior mounting mid-scroll and the reduced-motion setting changing.
  useEffect(() => applyStyles(scrollYProgress.get()), [applyStyles, interiorRequested, scrollYProgress]);

  return (
    <div ref={frame} className="absolute inset-0 will-change-transform">
      <Image
        src={exterior.url}
        alt={exterior.alt}
        fill
        preload
        // Sits behind a dark overlay, which hides what lower quality would show. On phones,
        // where the overlay is heaviest, half resolution makes this much faster to download.
        quality={50}
        sizes="(max-width: 767px) 50vw, 100vw"
        placeholder={exterior.lqip ? "blur" : "empty"}
        blurDataURL={exterior.lqip ?? undefined}
        className="object-cover"
      />
      {interior && interiorRequested && (
        <div ref={interiorLayer} className="absolute inset-0 opacity-0">
          <Image
            src={interior.url}
            alt={interior.alt}
            fill
            sizes="100vw"
            loading="eager"
            placeholder={interior.lqip ? "blur" : "empty"}
            blurDataURL={interior.lqip ?? undefined}
            className="object-cover"
          />
        </div>
      )}
    </div>
  );
}
