import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getBrandPost, requireBrandSite } from "@/lib/brand-site-data";
import { brandMetadata } from "@/lib/brand-site-metadata";
import { BlogBody } from "@/lib/blog-markup";

type PageProps = { params: Promise<{ site: string; slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await requireBrandSite(params);
  const post = await getBrandPost(site.id, slug);
  if (!post) return { title: { absolute: `Post not found | ${site.name}` }, robots: { index: false } };
  return brandMetadata(site, { title: post.title, description: post.excerpt, path: `/blog/${post.slug}`, image: post.coverUrl });
}

async function Post({ params }: PageProps) {
  const { slug } = await params;
  const site = await requireBrandSite(params);
  const post = await getBrandPost(site.id, slug);
  if (!post) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:py-20">
      <Link href={`${site.base}/blog`} className="text-sm text-copper-400 underline underline-offset-4">
        <span aria-hidden="true">←</span> Blog
      </Link>
      <h1 className="mt-6 text-4xl text-bone-50 md:text-6xl">{post.title}</h1>
      {post.publishedAt && (
        <p className="mt-4 text-sm text-bone-200">
          {new Date(post.publishedAt).toLocaleDateString("en-GB", { dateStyle: "long", timeZone: "Africa/Nairobi" })}
        </p>
      )}
      {post.coverUrl && (
        <div className="relative mt-8 aspect-[21/8] overflow-hidden rounded-xl">
          <Image src={post.coverUrl} alt={post.coverAlt ?? ""} fill preload sizes="(min-width: 768px) 768px, 100vw" className="object-cover" />
        </div>
      )}
      <BlogBody body={post.body} />
    </article>
  );
}

export default function BrandPostPage(props: PageProps) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="min-h-screen" />}>
      <Post {...props} />
    </Suspense>
  );
}
