import { z } from "zod";

import { AdminError, brandScope, canManageGroups, parse, type Admin, type Db } from "@/lib/admin/accounts";
import { targetBrandId } from "@/lib/brands";

export type WhatsAppGroup = { id: string; brandId: string; name: string; url: string };

const COLUMNS = `id, brand_id AS "brandId", name, url`;

const groupSchema = z.object({
  name: z.string().trim().min(2, "Enter a name for the group.").max(100),
  url: z
    .string()
    .trim()
    .regex(/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]+$/, "Paste the group's invite link, starting https://chat.whatsapp.com/."),
});

function requireAllowed(actor: Admin): void {
  if (!canManageGroups(actor)) throw new AdminError("Only admins can manage WhatsApp groups.");
}

export async function listWhatsAppGroups(db: Db, actor: Admin): Promise<WhatsAppGroup[]> {
  requireAllowed(actor);
  return db.query<WhatsAppGroup>(
    `SELECT ${COLUMNS} FROM whatsapp_groups WHERE ($1::uuid IS NULL OR brand_id = $1::uuid) ORDER BY created_at ASC`,
    [brandScope(actor)],
  );
}

export async function createWhatsAppGroup(
  db: Db,
  actor: Admin,
  input: { name: unknown; url: unknown; brandId?: unknown },
): Promise<void> {
  requireAllowed(actor);
  const { name, url } = parse(groupSchema, input);
  const brandId = await targetBrandId(db, actor, input.brandId);
  const rows = await db.query(
    `INSERT INTO whatsapp_groups (brand_id, name, url, created_by) VALUES ($1, $2, $3, $4)
     ON CONFLICT (brand_id, url) DO NOTHING RETURNING id`,
    [brandId, name, url, actor.id],
  );
  if (rows.length === 0) throw new AdminError("That group has already been added.");
}

export async function deleteWhatsAppGroup(db: Db, actor: Admin, id: string): Promise<void> {
  requireAllowed(actor);
  if (!z.uuid().safeParse(id).success) throw new AdminError("That group no longer exists.");
  const rows = await db.query(
    `DELETE FROM whatsapp_groups WHERE id = $1 AND ($2::uuid IS NULL OR brand_id = $2::uuid) RETURNING id`,
    [id, brandScope(actor)],
  );
  if (rows.length === 0) throw new AdminError("That group no longer exists.");
}
