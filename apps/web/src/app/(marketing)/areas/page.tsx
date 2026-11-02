import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PLACE_HERO_CLASS, PhotoCredit, PlaceBackground } from "@/components/marketing/PlaceBackground";
import { placeImages } from "@/content/place-images";
import { getCommunities } from "@/lib/cms";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Areas",
  description:
    "What living in Karen, Runda, Kilimani, Rosslyn, Lavington and Muthaiga is like, who each area suits, and what to check before buying.",
  path: "/areas",
});

export default async function AreasPage() {
  const communities = await getCommunities();

  return (
    <>
      <section className={`grain relative bg-linear-to-b from-forest-900 to-forest-950 py-section ${PLACE_HERO_CLASS}`}>
        <PlaceBackground image={placeImages.areas} />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <h1 className="text-display text-bone-50">Areas</h1>
          <p className="mt-6 max-w-2xl text-xl text-bone-100">
            What each of Nairobi&apos;s premium areas is like, and what to check before you buy there.
          </p>
        </div>
      </section>

      <section aria-label="All areas" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-20">
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {communities.map((community) => {
            const image = placeImages[community.slug];
            return (
              <li
                key={community.slug}
                className="group relative overflow-hidden rounded-xl border border-border motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out-expo motion-safe:hover:-translate-y-1"
              >
                {image && (
                  <div className="relative aspect-16/9">
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="p-6">
                  <h2 className="text-2xl text-bone-50">
                    <Link href={`/communities/${community.slug}`} className="underline-draw after:absolute after:inset-0">
                      {community.name}
                    </Link>
                  </h2>
                  <p className="mt-3 text-bone-200">{community.summary}</p>
                  {image && <PhotoCredit image={image} className="relative z-10 mt-4" />}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
