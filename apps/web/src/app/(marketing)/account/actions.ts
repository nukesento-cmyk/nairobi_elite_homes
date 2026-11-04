"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AdminError } from "@/lib/admin/accounts";
import { clearBuyerCookie, getBuyerToken, getCurrentBuyer, setBuyerCookie } from "@/lib/auth/buyer-session";
import { authenticateBuyer, changeBuyerPassword, createBuyerSession, deleteBuyerSession } from "@/lib/buyers";
import { parseBase } from "@/lib/brand-site";
import { db, isDatabaseConfigured } from "@/lib/db";
import { isRateLimited } from "@/lib/rate-limit";

export type UserActionState = { error?: string; message?: string };

const MAX_LOGINS_PER_WINDOW = 20;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function buyerLogin(_: UserActionState, form: FormData): Promise<UserActionState> {
  if (!isDatabaseConfigured()) return { error: "Sign-in isn't available yet." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`user-login:${ip}`, MAX_LOGINS_PER_WINDOW, LOGIN_WINDOW_MS)) {
    return { error: "Too many attempts. Please try again later." };
  }

  try {
    const buyer = await authenticateBuyer(db, { email: form.get("email"), password: form.get("password") });
    await setBuyerCookie(await createBuyerSession(db, buyer.id));
  } catch (error) {
    if (error instanceof AdminError) return { error: error.message };
    throw error;
  }
  redirect(`${parseBase(form.get("base"))}/account`);
}

export async function buyerChangePassword(_: UserActionState, form: FormData): Promise<UserActionState> {
  const [buyer, token] = await Promise.all([getCurrentBuyer(), getBuyerToken()]);
  if (!buyer || !token) redirect(`${parseBase(form.get("base"))}/login`);
  try {
    await changeBuyerPassword(db, buyer, token, { current: form.get("current"), next: form.get("next") });
  } catch (error) {
    if (error instanceof AdminError) return { error: error.message };
    throw error;
  }
  revalidatePath("/account");
  return { message: "Password changed." };
}

export async function buyerSignOut(form: FormData): Promise<void> {
  const token = await getBuyerToken();
  if (token && isDatabaseConfigured()) await deleteBuyerSession(db, token);
  await clearBuyerCookie();
  redirect(`${parseBase(form.get("base"))}/login`);
}
