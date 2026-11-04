import { del, get, put } from "@vercel/blob";
import { getVercelOidcToken } from "@vercel/oidc";

import type { DocumentDeps, DocumentStore } from "./onboarding";

/**
 * A private Blob store of its own, apart from the public one that holds listing photos. It signs
 * in with Vercel's short-lived token, so no long-lived secret is stored.
 *
 * The token is fetched here and passed in on purpose. Left to itself, the SDK falls back to
 * BLOB_READ_WRITE_TOKEN when it can't get one, and that's the public photo store. This way a
 * missing token is an error, and an owner's document can't land in the wrong place.
 */
function blobDocumentStore(storeId: string): DocumentStore {
  const auth = async () => {
    const oidcToken = (await getVercelOidcToken()).trim();
    // An empty token would also reach the SDK's fallback.
    if (!oidcToken) throw new Error("No Vercel sign-in token is available for document storage.");
    return { storeId, oidcToken };
  };
  return {
    async put(pathname, bytes) {
      const { pathname: ref } = await put(pathname, bytes, {
        ...(await auth()),
        access: "private",
        contentType: "application/octet-stream",
        addRandomSuffix: false,
      });
      return ref;
    },
    async get(ref) {
      const result = await get(ref, { ...(await auth()), access: "private", useCache: false });
      if (!result || result.statusCode !== 200) return null;
      return Buffer.from(await new Response(result.stream).arrayBuffer());
    },
    async del(ref) {
      await del(ref, await auth());
    },
  };
}

export const DOCUMENT_SETTINGS = ["ACQUISITION_DOCUMENT_KEY", "ACQUISITION_BLOB_STORE_ID"] as const;

/** The settings onboarding documents still need. Without them, nothing can be uploaded or opened. */
export function missingDocumentSettings(env: Record<string, string | undefined>): string[] {
  return DOCUMENT_SETTINGS.filter((name) => !env[name]);
}

export function documentStoreFromEnv(env: Record<string, string | undefined>): Omit<DocumentDeps, "db"> | null {
  const { ACQUISITION_DOCUMENT_KEY: key, ACQUISITION_BLOB_STORE_ID: storeId } = env;
  if (!key || !storeId) return null;
  return { key, store: blobDocumentStore(storeId) };
}
