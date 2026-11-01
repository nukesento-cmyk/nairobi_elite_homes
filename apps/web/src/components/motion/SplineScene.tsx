"use client";

import { Box } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import type { SceneMedia } from "@/lib/cms/types";

import { useReducedMotion } from "./useReducedMotion";

function canAutoLoad(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches && !connection?.saveData;
}

function afterPageLoad(callback: () => void): () => void {
  if (document.readyState === "complete") {
    callback();
    return () => {};
  }
  window.addEventListener("load", callback, { once: true });
  return () => window.removeEventListener("load", callback);
}

/**
 * One 3D scene behind a poster. The scene starts after the page has loaded and it
 * has come near the viewport. Touch screens, data savers and reduced motion stay
 * on the poster until asked, because a live iframe traps swipes and costs data.
 */
export function SplineScene({ scene }: { scene: SceneMedia }) {
  const container = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [nearViewport, setNearViewport] = useState(false);
  const [autoLoaded, setAutoLoaded] = useState(false);
  const [openedByClick, setOpenedByClick] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setNearViewport(entry.isIntersecting),
      { rootMargin: "200px" },
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearViewport || reducedMotion || !canAutoLoad()) return;
    return afterPageLoad(() => setAutoLoaded(true));
  }, [nearViewport, reducedMotion]);

  const started = autoLoaded || openedByClick;

  return (
    <div
      ref={container}
      className="grain relative aspect-4/3 overflow-hidden rounded-xl border border-border bg-linear-to-br from-forest-800 to-forest-950 md:aspect-16/9"
    >
      {scene.poster && (
        <Image
          src={scene.poster.url}
          alt={scene.poster.alt}
          fill
          sizes="(min-width: 1280px) 1216px, 100vw"
          placeholder={scene.poster.lqip ? "blur" : "empty"}
          blurDataURL={scene.poster.lqip ?? undefined}
          className="object-cover"
        />
      )}

      {started && (
        <iframe
          src={scene.url}
          title={scene.title}
          loading="lazy"
          // A cross-origin frame that isn't displayed stops rendering, which pauses
          // the scene off-screen. Keeping it mounted avoids reloading it on return.
          hidden={!nearViewport}
          onLoad={() => setReady(true)}
          // An auto-started scene is decorative: wheel events must keep scrolling the page.
          className={`absolute inset-0 size-full border-0 transition-opacity duration-500 ${
            ready ? "opacity-100" : "opacity-0"
          } ${openedByClick ? "" : "pointer-events-none"}`}
        />
      )}

      {!started && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setOpenedByClick(true)}
            className={buttonVariants({ size: "cta" })}
          >
            <Box aria-hidden="true" className="size-5" />
            View 3D model
          </button>
        </div>
      )}
    </div>
  );
}
