"use server";

import { revalidatePath } from "next/cache";

import { emailSender } from "@/lib/acquisition/cron";
import { addRecipient, removeRecipient, sendReportTo } from "@/lib/acquisition/dashboard";
import { AdminError } from "@/lib/admin/accounts";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/admin/session";
import { DEFAULT_BRAND_ID } from "@/lib/brands";

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

export async function addRecipientAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const email = await addRecipient(db, await requireAdmin(), DEFAULT_BRAND_ID, form.get("email"));
    return { message: `${email} will get the next report.` };
  });
}

export async function removeRecipientAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await removeRecipient(db, await requireAdmin(), DEFAULT_BRAND_ID, String(form.get("id")));
    return { message: "Removed." };
  });
}

export async function sendReportAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const email = await sendReportTo(
      db,
      await requireAdmin(),
      DEFAULT_BRAND_ID,
      String(form.get("runId")),
      form.get("email"),
      emailSender(process.env),
    );
    return { message: `Sent to ${email}.` };
  });
}
