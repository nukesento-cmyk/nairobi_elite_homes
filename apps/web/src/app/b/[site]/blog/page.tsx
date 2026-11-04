import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { getBrandPosts, requireBrandSite } from "@/lib/brand-site-data";
import { brandMetadata } from "@/lib/brand-site-metadata";

type PageProps = { params: Promise<{ site: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const site = await requireBrandSite(params);
  return brandMetadata(site, { title: "Blog", path: "/blog", description: `Articles from ${site.name}.` });
}

async function Posts({ params }: PageProps) {
  const site = await requireBrandSite(params);
  const posts = await getBrandPosts(site.id);
  if (posts.length === 0) return <p className="text-bone-200">The first articles are on their way.</p>;
  return (
    <ul className="space-y-4">
      {posts.map((post) => (
        <li key={post.id} className="rounded-xl border border-border p-6">
          <Link href={`${site.base}/blog/${post.slug}`} className="text-2xl text-bone-50 underline-draw">{post.title}</Link>
          <p className="mt-2 text-bone-200">{post.excerpt}</p>
        </li>
      ))}
    </ul>
  );
}

export default function BrandBlogPage(props: PageProps) {
  return (
    <section className="mx-auto min-h-[50vh] max-w-3xl px-4 py-14 sm:px-6 md:py-20">
      <h1 className="mb-8 text-4xl text-bone-50 md:text-6xl">Blog</h1>
      <Suspense>
        <Posts {...props} />
      </Suspense>
    </section>
  );
}
