"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { AdminError } from "@/lib/admin/accounts";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/admin/session";
import { createBrand, updateBrand, updateBrandSettings } from "@/lib/brands";
import { createUser, deleteUser, resetUserPassword } from "@/lib/buyers";
import { CMS_CACHE_TAG } from "@/lib/cms";
import { createWhatsAppGroup, deleteWhatsAppGroup } from "@/lib/whatsapp-groups";

import type { ActionState } from "./actions";

async function run(work: () => Promise<ActionState>): Promise<ActionState> {
  try {
    const result = await work();
    revalidatePath("/admin");
    return result;
  } catch (error) {
    if (error instanceof AdminError) return { error: error.message };
    throw error;
  }
}

export async function createBrandAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const { brand, adminEmail, temporaryPassword } = await createBrand(db, await requireAdmin(), {
      name: form.get("name"),
      domain: form.get("domain"),
      adminName: form.get("adminName"),
      adminEmail: form.get("adminEmail"),
    });
    return { message: `${brand.name} is set up. ${adminEmail} can now sign in as its admin.`, temporaryPassword };
  });
}

export async function updateBrandAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await updateBrand(db, await requireAdmin(), String(form.get("id")), {
      name: form.get("name"),
      domain: form.get("domain"),
    });
    revalidateTag(CMS_CACHE_TAG, { expire: 0 });
    return { message: "Saved." };
  });
}

export async function updateBrandSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const value = (name: string) => String(form.get(name) ?? "").trim();
    await updateBrandSettings(db, await requireAdmin(), value("id"), {
      logoUrl: value("logoUrl"),
      tagline: value("tagline"),
      about: value("about"),
      // An untouched colour picker sends its starting colour, so the box decides.
      accentColor: form.get("useAccent") === "on" ? value("accentColor").toLowerCase() : "",
      contactEmail: value("contactEmail"),
      contactPhone: value("contactPhone"),
      whatsappPhone: value("whatsappPhone"),
    });
    // Shows on the brand's site straight away.
    revalidateTag(CMS_CACHE_TAG, { expire: 0 });
    return { message: "Saved. It's live on the site." };
  });
}

export async function createUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const { user, temporaryPassword } = await createUser(db, await requireAdmin(), {
      name: form.get("name"),
      email: form.get("email"),
      brandId: form.get("brandId"),
    });
    return { message: `${user.name} can now sign in on the site as ${user.email}.`, temporaryPassword };
  });
}

export async function resetUserPasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const temporaryPassword = await resetUserPassword(db, await requireAdmin(), String(form.get("id")));
    return { message: "Password reset. They've been signed out.", temporaryPassword };
  });
}

export async function deleteUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await deleteUser(db, await requireAdmin(), String(form.get("id")));
    return {};
  });
}

export async function createGroupAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await createWhatsAppGroup(db, await requireAdmin(), {
      name: form.get("name"),
      url: form.get("url"),
      brandId: form.get("brandId"),
    });
    return { message: "Group added." };
  });
}

export async function deleteGroupAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await deleteWhatsAppGroup(db, await requireAdmin(), String(form.get("id")));
    return {};
  });
}
