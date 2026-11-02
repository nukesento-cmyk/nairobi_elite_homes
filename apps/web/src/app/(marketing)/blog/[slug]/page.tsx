import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getBlogPost, getBlogPosts } from "@/lib/cms";
import { pageMetadata } from "@/lib/seo";

type BlogPostProps = { params: Promise<{ slug: string }> };

// Cache Components requires at least one path at build time. See the listing page.
const NO_POSTS_SLUG = "no-posts";

export async function generateStaticParams() {
  const posts = await getBlogPosts();
  return (posts.length > 0 ? posts.map(({ slug }) => slug) : [NO_POSTS_SLUG]).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: BlogPostProps): Promise<Metadata> {
  const post = await getBlogPost((await params).slug);
  if (!post) return { title: "Post not found", robots: { index: false } };
  return pageMetadata({ title: post.title, description: post.excerpt, path: `/blog/${post.slug}` });
}

async function PostContent({ params }: BlogPostProps) {
  const post = await getBlogPost((await params).slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:py-20">
      <Link href="/blog" className="text-sm text-copper-400 underline underline-offset-4">
        <span aria-hidden="true">←</span> Blog
      </Link>
      <h1 className="mt-6 text-4xl text-bone-50 md:text-6xl">{post.title}</h1>
      {post.publishedAt && (
        <p className="mt-4 text-sm text-bone-200">
          {new Date(post.publishedAt).toLocaleDateString("en-GB", { dateStyle: "long", timeZone: "Africa/Nairobi" })}
        </p>
      )}
      {post.coverUrl && (
        <div className="relative mt-8 aspect-16/9 overflow-hidden rounded-xl">
          <Image src={post.coverUrl} alt={post.coverAlt ?? ""} fill preload sizes="(min-width: 768px) 768px, 100vw" className="object-cover" />
        </div>
      )}
      {/* Plain text only, so nothing typed into a post can run as code on this page. */}
      <div className="mt-8 text-lg leading-relaxed whitespace-pre-line text-bone-100">{post.body}</div>
    </article>
  );
}

export default function BlogPostPage({ params }: BlogPostProps) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="min-h-[80vh]" />}>
      <PostContent params={params} />
    </Suspense>
  );
}
