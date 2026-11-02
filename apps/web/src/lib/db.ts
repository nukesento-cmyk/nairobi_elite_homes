import "server-only";

import postgres from "postgres";

import type { Db } from "@/lib/admin/accounts";

// One small connection per server instance, reused between requests. Prepared statements
// are off so this also works through a pooled connection, such as Neon's.
const store = globalThis as typeof globalThis & { nehSql?: ReturnType<typeof postgres> };

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export const db: Db = {
  async query<Row>(text: string, params: unknown[] = []) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set.");
    store.nehSql ??= postgres(url, { max: 3, prepare: false, idle_timeout: 20 });
    return (await store.nehSql.unsafe(text, params as never[])) as unknown as Row[];
  },
};
