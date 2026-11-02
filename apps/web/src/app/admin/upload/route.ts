import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { canManageContent } from "@/lib/admin/accounts";
import { getCurrentAdmin } from "@/lib/admin/session";

const MAX_BYTES = 8 * 1024 * 1024;

// Lives under /admin because that's the only path the staff session cookie is sent to.
// Issues a short-lived token so the browser can send the photo straight to the file store,
// because photos can be larger than a server function accepts. Only signed-in reviewers get one.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const admin = await getCurrentAdmin();
        if (!admin || admin.mustChangePassword || !canManageContent(admin)) {
          throw new Error("Only reviewers can upload photos.");
        }
        return {
          allowedContentTypes: ["image/webp", "image/jpeg", "image/png"],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Upload refused." }, { status: 403 });
  }
}
