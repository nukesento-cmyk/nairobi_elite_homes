import { documentStoreFromEnv } from "@/lib/acquisition/document-store";
import { saveDocumentFromLink } from "@/lib/acquisition/onboarding";
import { MAX_DOCUMENT_BYTES } from "@/lib/acquisition/onboarding-types";
import { AdminError } from "@/lib/admin/accounts";
import { db } from "@/lib/db";
import { isRateLimited } from "@/lib/rate-limit";

const MAX_PER_WINDOW = 40;
const WINDOW_MS = 60 * 60 * 1000;
const noStore = { "cache-control": "no-store" };

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`onboarding:${ip}`, MAX_PER_WINDOW, WINDOW_MS)) {
    return Response.json({ error: "Too many uploads. Please try again later." }, { status: 429, headers: noStore });
  }

  const documents = documentStoreFromEnv(process.env);
  if (!documents) {
    console.error("Onboarding uploads are not configured.");
    return Response.json({ error: "Uploads aren't available right now." }, { status: 503, headers: noStore });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const token = form?.get("token");
  if (!(file instanceof File) || typeof token !== "string" || token.length < 20) {
    return Response.json({ error: "Please choose a file." }, { status: 400, headers: noStore });
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return Response.json({ error: "Files can be up to 4 MB. Please send a smaller one." }, { status: 400, headers: noStore });
  }

  try {
    await saveDocumentFromLink({ db, ...documents }, token, form?.get("docType"), Buffer.from(await file.arrayBuffer()));
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    if (error instanceof AdminError) return Response.json({ error: error.message }, { status: 400, headers: noStore });
    // No document details in the log.
    console.error("Onboarding upload failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500, headers: noStore });
  }
}
