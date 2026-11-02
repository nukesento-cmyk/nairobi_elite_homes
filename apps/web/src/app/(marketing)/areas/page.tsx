import type { Metadata } from "next";
import Link from "next/link";

import { getCommunities } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Areas",
  description:
    "What living in Karen, Runda, Kilimani, Rosslyn, Lavington and Muthaiga is like, who each area suits, and what to check before buying.",
  alternates: { canonical: "/areas" },
};

export default async function AreasPage() {
  const communities = await getCommunities();

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-20">
      <h1 className="text-5xl text-bone-50 md:text-7xl">Areas</h1>
      <p className="mt-4 mb-10 max-w-xl text-lg text-bone-200">
        What each of Nairobi&apos;s premium areas is like, and what to check before you buy there.
      </p>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {communities.map((community) => (
          <li
            key={community.slug}
            className="group relative rounded-xl border border-border p-6 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out-expo motion-safe:hover:-translate-y-1"
          >
            <h2 className="text-2xl text-bone-50">
              <Link
                href={`/communities/${community.slug}`}
                className="underline-draw after:absolute after:inset-0"
              >
                {community.name}
              </Link>
            </h2>
            <p className="mt-3 text-bone-200">{community.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
