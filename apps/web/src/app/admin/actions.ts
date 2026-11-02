"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  AdminError,
  authenticate,
  changeOwnPassword,
  createAdmin,
  createSession,
  deleteAdmin,
  deleteSession,
  resetPassword,
  updateAdmin,
  type Admin,
} from "@/lib/admin/accounts";
import {
  clearSessionCookie,
  db,
  getCurrentAdmin,
  getSessionToken,
  isAdminConfigured,
  setSessionCookie,
} from "@/lib/admin/session";
import { isRateLimited } from "@/lib/rate-limit";

export type ActionState = {
  error?: string;
  message?: string;
  /** Shown once, straight after an account is created or reset. */
  temporaryPassword?: string;
};

const MAX_LOGINS_PER_WINDOW = 20;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/**
 * Server actions are public endpoints, so each one checks the session itself. Hiding a
 * button is never what stops someone. A temporary password can't do anything but be replaced.
 */
async function requireAdmin(): Promise<Admin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.mustChangePassword) throw new AdminError("Choose a new password first.");
  return admin;
}

/** Turns expected failures into a message. Anything else stays a real error. */
async function run(work: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    const result = await work();
    revalidatePath("/admin");
    return result ?? {};
  } catch (error) {
    if (error instanceof AdminError) return { error: error.message };
    throw error;
  }
}

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  if (!isAdminConfigured()) return { error: "Admin accounts aren't set up yet." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`admin-login:${ip}`, MAX_LOGINS_PER_WINDOW, LOGIN_WINDOW_MS)) {
    return { error: "Too many attempts. Please try again later." };
  }

  try {
    const admin = await authenticate(db, {
      email: form.get("email"),
      password: form.get("password"),
    });
    await setSessionCookie(await createSession(db, admin.id));
  } catch (error) {
    if (error instanceof AdminError) return { error: error.message };
    throw error;
  }
  redirect("/admin");
}

export async function logout(): Promise<void> {
  const token = await getSessionToken();
  if (token && isAdminConfigured()) await deleteSession(db, token);
  await clearSessionCookie();
  redirect("/admin/login");
}

export async function createAdminAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin();
    const { admin, temporaryPassword } = await createAdmin(db, {
      email: form.get("email"),
      name: form.get("name"),
    });
    return { message: `${admin.name} can now sign in as ${admin.email}.`, temporaryPassword };
  });
}

export async function updateAdminAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    await updateAdmin(db, actor, String(form.get("id")), {
      email: form.get("email"),
      name: form.get("name"),
    });
    return { message: "Saved." };
  });
}

export async function deleteAdminAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    await deleteAdmin(db, actor, String(form.get("id")));
    console.info("admin_deleted", { by: actor.id, id: String(form.get("id")) });
  });
}

export async function resetPasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const temporaryPassword = await resetPassword(db, actor, String(form.get("id")));
    return { message: "Password reset. They've been signed out.", temporaryPassword };
  });
}

export async function changePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await getCurrentAdmin();
    const token = await getSessionToken();
    if (!actor || !token) redirect("/admin/login");
    await changeOwnPassword(db, actor, token, {
      current: form.get("current"),
      next: form.get("next"),
    });
    return { message: "Password changed." };
  });
}
