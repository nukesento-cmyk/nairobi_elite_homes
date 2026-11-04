"use server";

import { revalidatePath } from "next/cache";

import { documentStoreFromEnv } from "@/lib/acquisition/document-store";
import {
  confirmStep,
  failOnboarding,
  issueUploadLink,
  removeDocument,
  saveDocumentAsStaff,
  startOnboarding,
  submitForApproval,
  verifyDocument,
  type DocumentDeps,
} from "@/lib/acquisition/onboarding";
import { MAX_DOCUMENT_BYTES, ONBOARDING_STEPS, type OnboardingStep } from "@/lib/acquisition/onboarding-types";
import { AdminError } from "@/lib/admin/accounts";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/admin/session";
import { DEFAULT_BRAND_ID as BRAND } from "@/lib/brands";

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

const value = (form: FormData, name: string) => String(form.get(name) ?? "");

function documents(): DocumentDeps {
  const store = documentStoreFromEnv(process.env);
  if (!store) throw new AdminError("Document storage isn't set up yet.");
  return { db, ...store };
}

export async function startOnboardingAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await startOnboarding(db, await requireAdmin(), BRAND, value(form, "id"));
    return { message: "Onboarding started. It's in the Onboarding section." };
  });
}

export async function issueLinkAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const token = await issueUploadLink(db, await requireAdmin(), BRAND, value(form, "id"));
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    return { message: `Send them this link. It works for 7 days, is shown only now, and replaces any earlier link: ${base}/owner-documents#${token}` };
  });
}

export async function verifyDocumentAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await verifyDocument(db, await requireAdmin(), BRAND, value(form, "id"));
    return { message: "Marked as checked." };
  });
}

export async function removeDocumentAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await removeDocument(documents(), await requireAdmin(), BRAND, value(form, "id"));
    return { message: "Deleted." };
  });
}

export async function uploadDocumentAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new AdminError("Choose a file.");
    if (file.size > MAX_DOCUMENT_BYTES) throw new AdminError("Files can be up to 4 MB.");
    await saveDocumentAsStaff(documents(), await requireAdmin(), BRAND, value(form, "id"), form.get("docType"), Buffer.from(await file.arrayBuffer()));
    return { message: "Added." };
  });
}

export async function confirmStepAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const step = value(form, "step") as OnboardingStep;
    if (!ONBOARDING_STEPS.includes(step)) throw new AdminError("That step doesn't exist.");
    await confirmStep(db, await requireAdmin(), BRAND, value(form, "id"), step, {
      amount: form.get("amount"),
      currency: form.get("currency"),
      period: form.get("period"),
      terms: form.get("terms"),
    });
    return { message: "Confirmed." };
  });
}

export async function failOnboardingAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await failOnboarding(db, await requireAdmin(), BRAND, value(form, "id"), form.get("reason"));
    return { message: "Stopped." };
  });
}

export async function submitForApprovalAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await submitForApproval(
      db,
      await requireAdmin(),
      BRAND,
      value(form, "id"),
      {
        title: value(form, "title"),
        vertical: value(form, "vertical"),
        status: value(form, "status"),
        area: value(form, "area"),
        beds: value(form, "beds"),
        baths: value(form, "baths"),
        acreage: value(form, "acreage"),
        sqm: value(form, "sqm"),
        titleStatus: value(form, "titleStatus"),
        zoning: value(form, "zoning"),
        description: value(form, "description"),
        features: value(form, "features"),
        heroUrl: value(form, "heroUrl"),
        heroAlt: value(form, "heroAlt"),
        galleryUrls: value(form, "galleryUrls"),
        matterportId: "",
      },
      form.get("photoRights"),
    );
    return { message: "Sent to Approvals. An admin who didn't verify the documents gives the final approval." };
  });
}
