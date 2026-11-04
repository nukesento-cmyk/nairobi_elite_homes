import { del, get, put } from "@vercel/blob";

import type { DocumentDeps, DocumentStore } from "./onboarding";

/** A private Blob store of its own, apart from the public one that holds listing photos. */
function blobDocumentStore(token: string): DocumentStore {
  return {
    async put(pathname, bytes) {
      const { pathname: ref } = await put(pathname, bytes, {
        access: "private",
        token,
        contentType: "application/octet-stream",
        addRandomSuffix: false,
      });
      return ref;
    },
    async get(ref) {
      const result = await get(ref, { access: "private", token, useCache: false });
      if (!result || result.statusCode !== 200) return null;
      return Buffer.from(await new Response(result.stream).arrayBuffer());
    },
    async del(ref) {
      await del(ref, { token });
    },
  };
}

export const DOCUMENT_SETTINGS = ["ACQUISITION_DOCUMENT_KEY", "ACQUISITION_BLOB_READ_WRITE_TOKEN"] as const;

/** The settings onboarding documents still need. Without them, nothing can be uploaded or opened. */
export function missingDocumentSettings(env: Record<string, string | undefined>): string[] {
  return DOCUMENT_SETTINGS.filter((name) => !env[name]);
}

export function documentStoreFromEnv(env: Record<string, string | undefined>): Omit<DocumentDeps, "db"> | null {
  const { ACQUISITION_DOCUMENT_KEY: key, ACQUISITION_BLOB_READ_WRITE_TOKEN: token } = env;
  if (!key || !token) return null;
  return { key, store: blobDocumentStore(token) };
}
