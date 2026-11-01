import { timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";

import { CMS_CACHE_TAG } from "@/lib/cms";

function isAuthorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

// Called by a Sanity webhook on publish. Nothing stale is served afterwards,
// because a listing moved off-market must disappear from the site immediately.
export async function POST(request: Request) {
  const secret = process.env.SANITY_REVALIDATE_SECRET;
  if (!secret || !isAuthorized(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidateTag(CMS_CACHE_TAG, { expire: 0 });
  return Response.json({ revalidated: true });
}
