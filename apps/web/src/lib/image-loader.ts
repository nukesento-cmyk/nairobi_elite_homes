// Sanity's image CDN resizes on request, so next/image doesn't need its own optimizer.
// AVIF at 60 looks clean on photos and is much smaller than at the usual 75.
const DEFAULT_QUALITY = 60;
const PHONE_WIDTH = 828;

export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  // Photos of places come in two sizes, so phones don't download the large one.
  if (src.startsWith("/images/places/") && width <= PHONE_WIDTH) {
    return `${src.replace(".webp", "-800.webp")}?w=${width}`;
  }
  if (src.startsWith("/")) return `${src}?w=${width}`;

  const url = new URL(src);
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality ?? DEFAULT_QUALITY));
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", "max");
  return url.toString();
}
