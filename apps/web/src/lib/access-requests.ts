import { z } from "zod";

import { AdminError, canReview, type Admin, type Db } from "@/lib/admin/accounts";

export type AccessRequest = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  status: "pending" | "link_sent" | "declined";
  createdAt: string | Date;
};

const requestSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(100),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 ()-]{7,18}$/, "Please enter your WhatsApp number."),
  email: z.union([z.literal(""), z.email("Please enter a valid email address.").max(200)]),
  message: z.string().trim().max(500, "Please keep your message shorter."),
});

const COLUMNS = `id, name, phone, email, message, status, created_at AS "createdAt"`;

function requireAdminRole(actor: Admin): void {
  if (!canReview(actor)) throw new AdminError("Only admins can see requests.");
}

/** Asking again while one is waiting adds nothing, and says nothing about who has asked. */
export async function createAccessRequest(db: Db, input: unknown): Promise<void> {
  const result = requestSchema.safeParse(input);
  if (!result.success) throw new AdminError(result.error.issues[0].message);
  const { name, phone, email, message } = result.data;
  await db.query(
    `INSERT INTO access_requests (name, phone, email, message)
     SELECT $1, $2, $3, $4
     WHERE NOT EXISTS (SELECT 1 FROM access_requests WHERE phone = $2 AND status = 'pending')`,
    [name, phone, email || null, message || null],
  );
}

export async function listAccessRequests(db: Db, actor: Admin): Promise<AccessRequest[]> {
  requireAdminRole(actor);
  return db.query<AccessRequest>(
    `SELECT ${COLUMNS} FROM access_requests ORDER BY status = 'pending' DESC, created_at DESC LIMIT 200`,
  );
}

export async function setAccessRequestStatus(db: Db, actor: Admin, id: string, status: unknown): Promise<void> {
  requireAdminRole(actor);
  if (!z.uuid().safeParse(id).success) throw new AdminError("That request no longer exists.");
  const next = z.enum(["pending", "link_sent", "declined"]).safeParse(status);
  if (!next.success) throw new AdminError("That isn't a valid status.");
  const rows = await db.query(
    `UPDATE access_requests SET status = $1, handled_by = $2, handled_at = now() WHERE id = $3 RETURNING id`,
    [next.data, actor.id, id],
  );
  if (rows.length === 0) throw new AdminError("That request no longer exists.");
}

export async function deleteAccessRequest(db: Db, actor: Admin, id: string): Promise<void> {
  requireAdminRole(actor);
  if (!z.uuid().safeParse(id).success) throw new AdminError("That request no longer exists.");
  await db.query(`DELETE FROM access_requests WHERE id = $1`, [id]);
}
