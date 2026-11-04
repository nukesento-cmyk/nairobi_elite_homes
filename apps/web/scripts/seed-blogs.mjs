// Publishes the starter blog posts.
//   pnpm seed-blogs
//
// Safe to run again: a post that already exists is left alone, so later edits are kept.
// A deleted post would be created again, so remove it from db/seed/blog-posts.mjs first.
import { readFileSync } from "node:fs";

import postgres from "postgres";

import { blogPosts } from "../db/seed/blog-posts.mjs";

// The original brand, as in db/schema.sql and src/lib/brands.ts.
const DEFAULT_BRAND_ID = "00000000-0000-4000-8000-000000000001";

if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL first.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });

try {
  await sql.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  for (const post of blogPosts) {
    const rows = await sql`
      INSERT INTO posts (slug, title, excerpt, body, cover_url, cover_alt, review_status, published_at, brand_id)
      VALUES (${post.slug}, ${post.title}, ${post.excerpt}, ${post.body}, ${post.coverUrl}, ${post.coverAlt}, 'approved', now(), ${DEFAULT_BRAND_ID})
      ON CONFLICT (slug) DO NOTHING RETURNING slug`;
    console.log(`${rows.length > 0 ? "Published" : "Exists, left unchanged"}: /blog/${post.slug}`);
  }
} catch (error) {
  // Never prints the connection string, which contains a password.
  console.error(`Seeding failed: ${error.code ?? error.message}.`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 1 });
}
