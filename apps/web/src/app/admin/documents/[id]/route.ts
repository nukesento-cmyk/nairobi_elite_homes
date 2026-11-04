import { documentStoreFromEnv } from "@/lib/acquisition/document-store";
import { readDocument } from "@/lib/acquisition/onboarding";
import { getCurrentAdmin } from "@/lib/admin/session";
import { DEFAULT_BRAND_ID } from "@/lib/brands";
import { db } from "@/lib/db";

// Lives under /admin because that's the only path the staff session cookie is sent to. The
// check is here, next to the read, and always downloads rather than opening in the page.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.mustChangePassword || admin.role !== "superadmin") return new Response("Not found", { status: 404 });

  const documents = documentStoreFromEnv(process.env);
  if (!documents) return new Response("Documents aren't set up.", { status: 503 });

  const { id } = await params;
  const doc = await readDocument({ db, ...documents }, admin, DEFAULT_BRAND_ID, id);
  if (!doc) return new Response("Not found", { status: 404 });

  const extension = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[doc.contentType] ?? "bin";
  return new Response(new Uint8Array(doc.bytes), {
    headers: {
      "content-type": doc.contentType,
      "content-disposition": `attachment; filename="${doc.docType}.${extension}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
