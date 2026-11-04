import type { Db } from "@/lib/admin/accounts";

/** The SuperAdmin's switch. No row counts as off, and a database error stops the caller. */
export async function isResearchEnabled(db: Db, brandId: string): Promise<boolean> {
  const [row] = await db.query<{ research_enabled: boolean }>(
    `SELECT research_enabled FROM acq_settings WHERE brand_id = $1`,
    [brandId],
  );
  return row?.research_enabled === true;
}
