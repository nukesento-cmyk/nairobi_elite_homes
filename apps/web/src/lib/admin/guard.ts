import "server-only";

import { redirect } from "next/navigation";

import { AdminError, type Admin } from "./accounts";
import { getCurrentAdmin } from "./session";

/**
 * Server actions are public endpoints, so each one checks the session itself. Hiding a
 * button is never what stops someone. A temporary password can't do anything but be replaced.
 */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.mustChangePassword) throw new AdminError("Choose a new password first.");
  return admin;
}
