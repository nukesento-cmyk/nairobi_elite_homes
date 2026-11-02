"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { AdminError } from "@/lib/admin/accounts";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/admin/session";
import { deleteAccessRequest, setAccessRequestStatus } from "@/lib/access-requests";
import { CMS_CACHE_TAG } from "@/lib/cms";
import {
  approveItem,
  createPost,
  createProperty,
  deletePost,
  deleteProperty,
  rejectItem,
  updatePost,
  updateProperty,
} from "@/lib/content";

import type { ActionState } from "./actions";

async function run(work: () => Promise<string>): Promise<ActionState> {
  try {
    const message = await work();
    // Shows on the public site straight away.
    revalidateTag(CMS_CACHE_TAG, { expire: 0 });
    revalidatePath("/admin");
    return { message };
  } catch (error) {
    if (error instanceof AdminError) return { error: error.message };
    throw error;
  }
}

const value = (form: FormData, name: string) => String(form.get(name) ?? "");

function propertyInput(form: FormData) {
  return {
    title: value(form, "title"),
    vertical: value(form, "vertical"),
    status: value(form, "status"),
    area: value(form, "area"),
    priceAmount: value(form, "priceAmount"),
    priceCurrency: value(form, "priceCurrency"),
    pricePeriod: value(form, "pricePeriod"),
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
    matterportId: value(form, "matterportId"),
  };
}

function postInput(form: FormData) {
  return {
    title: value(form, "title"),
    excerpt: value(form, "excerpt"),
    body: value(form, "body"),
    coverUrl: value(form, "coverUrl"),
    coverAlt: value(form, "coverAlt"),
    submit: form.get("submit") === "on",
  };
}

export async function savePropertyAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const id = value(form, "id");
    if (id) {
      await updateProperty(db, actor, id, propertyInput(form));
      return "Saved and sent for approval.";
    }
    await createProperty(db, actor, propertyInput(form));
    return "Sent for approval.";
  });
}

export async function deletePropertyAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await deleteProperty(db, await requireAdmin(), value(form, "id"));
    return "Property deleted.";
  });
}

export async function savePostAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireAdmin();
    const id = value(form, "id");
    if (id) {
      await updatePost(db, actor, id, postInput(form));
      return form.get("submit") === "on" ? "Saved and sent for approval." : "Draft saved.";
    }
    await createPost(db, actor, postInput(form));
    return form.get("submit") === "on" ? "Sent for approval." : "Draft saved.";
  });
}

export async function deletePostAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await deletePost(db, await requireAdmin(), value(form, "id"));
    return "Post deleted.";
  });
}

export async function approveAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await approveItem(db, await requireAdmin(), value(form, "kind"), value(form, "id"));
    return "Approved. It's live.";
  });
}

export async function rejectAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await rejectItem(db, await requireAdmin(), value(form, "kind"), value(form, "id"), value(form, "note"));
    return "Sent back to the reviewer.";
  });
}

export async function requestStatusAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await setAccessRequestStatus(db, await requireAdmin(), value(form, "id"), value(form, "status"));
    return "Updated.";
  });
}

export async function deleteRequestAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await deleteAccessRequest(db, await requireAdmin(), value(form, "id"));
    return "Request deleted.";
  });
}
