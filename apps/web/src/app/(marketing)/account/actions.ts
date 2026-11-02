"use server";

import { redirect } from "next/navigation";

import { clearBuyerCookie, getBuyerToken } from "@/lib/auth/buyer-session";
import { deleteBuyerSession } from "@/lib/buyers";
import { db, isDatabaseConfigured } from "@/lib/db";

export async function buyerSignOut(): Promise<void> {
  const token = await getBuyerToken();
  if (token && isDatabaseConfigured()) await deleteBuyerSession(db, token);
  await clearBuyerCookie();
  redirect("/account");
}
