"use server";

import { revalidatePath } from "next/cache";

import { emailSender } from "@/lib/acquisition/cron";
import { addRecipient, approveLead, decideDomain, rejectLead, removeRecipient, sendReportTo, setResearchEnabled } from "@/lib/acquisition/dashboard";
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

export async function setResearchAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const enabled = form.get("enabled") === "on";
    await setResearchEnabled(db, await requireAdmin(), DEFAULT_BRAND_ID, enabled);
    return { message: enabled ? "Research is on." : "Research is off. Any run in progress stops at its next page." };
  });
}

export async function decideDomainAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await decideDomain(db, await requireAdmin(), DEFAULT_BRAND_ID, String(form.get("id")), String(form.get("verdict")), form.get("termsUrl"));
    return { message: "Saved." };
  });
}

export async function approveLeadAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await approveLead(db, await requireAdmin(), DEFAULT_BRAND_ID, String(form.get("id")));
    return { message: "Ready to call." };
  });
}

export async function rejectLeadAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await rejectLead(db, await requireAdmin(), DEFAULT_BRAND_ID, String(form.get("id")));
    return { message: "Rejected." };
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
