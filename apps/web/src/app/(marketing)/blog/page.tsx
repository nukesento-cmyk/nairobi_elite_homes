import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { getBlogPosts } from "@/lib/cms";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Blog",
  description: "Notes on buying, renting and owning homes and land in Nairobi's premium areas.",
  path: "/blog",
});

export default async function BlogPage() {
  const posts = await getBlogPosts();

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-20">
      <h1 className="mb-10 text-5xl text-bone-50 md:text-7xl">Blog</h1>
      {posts.length === 0 ? (
        <p className="text-lg text-bone-200">The first posts are on their way.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {posts.map((post) => (
            <li
              key={post.id}
              className="group relative overflow-hidden rounded-xl border border-border motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out-expo motion-safe:hover:-translate-y-1"
            >
              {post.coverUrl && (
                <div className="relative aspect-16/9">
                  <Image
                    src={post.coverUrl}
                    alt={post.coverAlt ?? ""}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="p-5">
                <h2 className="text-2xl text-bone-50">
                  <Link href={`/blog/${post.slug}`} className="underline-draw after:absolute after:inset-0">
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-2 text-bone-200">{post.excerpt}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
