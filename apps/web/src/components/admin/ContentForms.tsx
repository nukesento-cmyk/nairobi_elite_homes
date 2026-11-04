"use client";

import { upload } from "@vercel/blob/client";
import { useActionState, useState, type ChangeEvent } from "react";

import {
  deletePostAction,
  deletePropertyAction,
  savePostAction,
  savePropertyAction,
} from "@/app/admin/content-actions";
import type { ActionState } from "@/app/admin/actions";
import { buttonVariants } from "@/components/ui/button";
import type { Post, PropertyRow } from "@/lib/content";
import { LEAD_AREAS } from "@/lib/lead-options";

import { dangerButton } from "./AdminForms";
import { EmptyState, PageHeader } from "./ui";
import { useSafeForm } from "./use-safe-form";

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-bone-50 focus-visible:outline-2 focus-visible:outline-copper-400";
const labelClass = "block text-sm text-bone-200";
const button = buttonVariants({ variant: "outline", size: "default", className: "h-10 bg-transparent px-4" });

function Result({ state }: { state: ActionState }) {
  return (
    <>
      {state.error && <p role="alert" className="mt-3 text-sm text-terracotta">{state.error}</p>}
      {state.message && <p role="status" className="mt-3 text-sm text-bone-50">{state.message}</p>}
    </>
  );
}

const MAX_PHOTO_SIDE = 2000;

/** Shrinks a photo before sending, so a phone camera's 8MB file doesn't reach visitors. */
async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read that photo."))), "image/webp", 0.8);
  });
}

export function PhotoField({
  name,
  label,
  defaultValue = "",
  multiple = false,
  uploads,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  multiple?: boolean;
  uploads: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [status, setStatus] = useState<string>();

  async function onChoose(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    for (const [index, file] of files.entries()) {
      setStatus(`Uploading ${index + 1} of ${files.length}…`);
      try {
        const photo = await shrinkPhoto(file);
        const { url } = await upload(`photos/${crypto.randomUUID()}`, photo, {
          access: "public",
          contentType: photo.type,
          handleUploadUrl: "/admin/upload",
        });
        setValue((current) => (multiple && current ? `${current}\n${url}` : url));
      } catch {
        setStatus("That photo couldn't be uploaded. Please try another.");
        return;
      }
    }
    setStatus("Uploaded.");
  }

  const hint = uploads ? "Or paste a secure link, starting with https" : "A secure link, starting with https";
  return (
    <div className="sm:col-span-2">
      <label className={labelClass}>
        {label}
        {multiple ? (
          <textarea name={name} rows={3} value={value} onChange={(e) => setValue(e.target.value)} placeholder={`${hint}, one per line`} className={fieldClass} />
        ) : (
          <input name={name} inputMode="url" value={value} onChange={(e) => setValue(e.target.value)} placeholder={hint} className={fieldClass} />
        )}
      </label>
      {uploads && (
        <label className="mt-2 inline-block cursor-pointer text-sm text-copper-400 underline underline-offset-4">
          {multiple ? "Upload photos" : "Upload a photo"}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} onChange={onChoose} className="sr-only" />
        </label>
      )}
      {status && <p role="status" className="mt-1 text-sm text-bone-200">{status}</p>}
    </div>
  );
}

export function DeleteItem({
  id,
  name,
  action: deleteAction,
}: {
  id: string;
  name: string;
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
}) {
  const [state, action, pending] = useActionState(deleteAction, {});
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={dangerButton}>
        Delete
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-bone-50">Delete {name}? This can&apos;t be undone.</p>
      <button type="submit" disabled={pending} className="h-10 rounded-lg bg-terracotta px-4 text-sm font-medium text-forest-950">
        Yes, delete
      </button>
      <button type="button" onClick={() => setConfirming(false)} className={button}>
        Cancel
      </button>
      <Result state={state} />
    </form>
  );
}

function PropertyForm({ property, uploads }: { property?: PropertyRow; uploads: boolean }) {
  const { state, pending, form } = useSafeForm(savePropertyAction);
  const isNew = !property;
  return (
    <form {...form} className="grid gap-4 sm:grid-cols-2">
      {property && <input type="hidden" name="id" value={property.id} />}
      <label className={`${labelClass} sm:col-span-2`}>
        Title
        <input name="title" required minLength={3} defaultValue={property?.title} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Type
        <select name="vertical" defaultValue={property?.vertical ?? "residential"} className={fieldClass}>
          <option value="residential">Home</option>
          <option value="land">Land</option>
          <option value="commercial">Commercial</option>
        </select>
      </label>
      <label className={labelClass}>
        Who can see it
        <select name="status" defaultValue={property?.status ?? "public"} className={fieldClass}>
          <option value="public">Public listing</option>
          <option value="off_market">Off-market (locked card, area only)</option>
          <option value="members_only">Members only (locked card, area only)</option>
        </select>
      </label>
      <label className={labelClass}>
        Area
        <select name="area" defaultValue={property?.area ?? LEAD_AREAS[0]} className={fieldClass}>
          {LEAD_AREAS.map((area) => <option key={area} value={area}>{area}</option>)}
        </select>
      </label>
      <label className={labelClass}>
        Bread
        <input name="priceAmount" type="number" min="1" step="any" required defaultValue={property?.priceAmount} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Currency
        <select name="priceCurrency" defaultValue={property?.priceCurrency ?? "KES"} className={fieldClass}>
          <option>KES</option>
          <option>USD</option>
        </select>
      </label>
      <label className={labelClass}>
        Deal
        <select name="pricePeriod" defaultValue={property?.pricePeriod ?? "sale"} className={fieldClass}>
          <option value="sale">For sale</option>
          <option value="month">Per month</option>
        </select>
      </label>
      <label className={labelClass}>
        Bedrooms
        <input name="beds" type="number" min="0" defaultValue={property?.beds ?? ""} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Bathrooms
        <input name="baths" type="number" min="0" defaultValue={property?.baths ?? ""} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Acres
        <input name="acreage" type="number" min="0" step="any" defaultValue={property?.acreage ?? ""} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Square metres
        <input name="sqm" type="number" min="0" defaultValue={property?.sqm ?? ""} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Title status
        <select name="titleStatus" defaultValue={property?.titleStatus ?? ""} className={fieldClass}>
          <option value="">Not stated</option>
          <option value="freehold">Freehold</option>
          <option value="leasehold">Leasehold</option>
        </select>
      </label>
      <label className={labelClass}>
        Zoning
        <input name="zoning" defaultValue={property?.zoning ?? ""} className={fieldClass} />
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Description
        <textarea name="description" rows={4} defaultValue={property?.description ?? ""} className={fieldClass} />
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Features, one per line
        <textarea name="features" rows={3} defaultValue={property?.features.join("\n")} className={fieldClass} />
      </label>
      <PhotoField name="heroUrl" label="Main photo" defaultValue={property?.heroUrl ?? ""} uploads={uploads} />
      <label className={`${labelClass} sm:col-span-2`}>
        Main photo description
        <input name="heroAlt" defaultValue={property?.heroAlt ?? ""} className={fieldClass} />
      </label>
      <PhotoField name="galleryUrls" label="More photos" defaultValue={property?.galleryUrls.join("\n")} multiple uploads={uploads} />
      <label className={labelClass}>
        Matterport ID (public listings only)
        <input name="matterportId" defaultValue={property?.matterportId ?? ""} className={fieldClass} />
      </label>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className={button}>
          {isNew ? "Send for approval" : "Save and send for approval"}
        </button>
        {property?.reviewStatus === "approved" && (
          <p className="mt-2 text-sm text-bone-200">Saving takes this off the site until it&apos;s approved again.</p>
        )}
        <Result state={state} />
      </div>
    </form>
  );
}

function ReviewBadge({ status, note }: { status: string; note: string | null }) {
  const labels: Record<string, string> = {
    draft: "Draft",
    pending: "Waiting for approval",
    approved: "Live",
    rejected: "Needs changes",
  };
  return (
    <p className="mt-1 text-sm text-copper-400">
      {labels[status]}
      {note && <span className="block text-bone-50">Admin&apos;s note: {note}</span>}
    </p>
  );
}

export function PropertyManager({ properties, uploads }: { properties: PropertyRow[]; uploads: boolean }) {
  return (
    <section aria-label="Properties">
      <PageHeader title="Properties" description="Listings on your site. What a reviewer adds waits for approval." />
      <details className="mb-6 rounded-xl border border-border bg-forest-900/30 px-5 py-3">
        <summary>Add a property</summary>
        <div className="mt-5"><PropertyForm uploads={uploads} /></div>
      </details>
      {properties.length === 0 && <EmptyState title="No properties yet">Add the first one above.</EmptyState>}
      <ul className="space-y-3">
        {properties.map((property) => (
          <li key={property.id} data-property={property.title} className="rounded-xl border border-border bg-forest-900/30 p-5">
            <p className="text-lg text-bone-50">{property.title}</p>
            <p className="text-sm text-bone-200">{property.area} · {property.status.replace("_", " ")}</p>
            <ReviewBadge status={property.reviewStatus} note={property.reviewNote} />
            <details className="mt-4">
              <summary>Edit</summary>
              <div className="mt-4"><PropertyForm property={property} uploads={uploads} /></div>
            </details>
            <div className="mt-4">
              <DeleteItem id={property.id} name={property.title} action={deletePropertyAction} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PostForm({ post, uploads }: { post?: Post; uploads: boolean }) {
  const { state, pending, form } = useSafeForm(savePostAction);
  return (
    <form {...form} className="space-y-4">
      {post && <input type="hidden" name="id" value={post.id} />}
      <label className={labelClass}>
        Title
        <input name="title" required minLength={3} defaultValue={post?.title} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Short summary
        <textarea name="excerpt" rows={2} required defaultValue={post?.excerpt} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Post. Start with a direct answer. Use &quot;## &quot; for headings, &quot;- &quot; for lists, **bold**, and [words](/link). A &quot;## Frequently asked questions&quot; section with &quot;### &quot; questions is picked up by search engines.
        <textarea name="body" rows={10} required defaultValue={post?.body} className={fieldClass} />
      </label>
      <PhotoField name="coverUrl" label="Cover photo" defaultValue={post?.coverUrl ?? ""} uploads={uploads} />
      <label className={labelClass}>
        Cover photo description
        <input name="coverAlt" defaultValue={post?.coverAlt ?? ""} className={fieldClass} />
      </label>
      <label className="flex items-center gap-2 text-sm text-bone-50">
        <input name="submit" type="checkbox" defaultChecked={post ? post.reviewStatus !== "draft" : true} className="size-4" />
        Send for approval (leave unticked to keep as a draft)
      </label>
      <button type="submit" disabled={pending} className={button}>
        {post ? "Save post" : "Add post"}
      </button>
      {post?.reviewStatus === "approved" && (
        <p className="text-sm text-bone-200">Saving takes this off the site until it&apos;s approved again.</p>
      )}
      <Result state={state} />
    </form>
  );
}

export function PostManager({ posts, uploads }: { posts: Post[]; uploads: boolean }) {
  return (
    <section aria-label="Blog">
      <PageHeader title="Blog" description="Posts wait for approval before they appear on the site." />
      <details className="mb-6 rounded-xl border border-border bg-forest-900/30 px-5 py-3">
        <summary>Add a post</summary>
        <div className="mt-5"><PostForm uploads={uploads} /></div>
      </details>
      {posts.length === 0 && <EmptyState title="No posts yet">Write the first one above.</EmptyState>}
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.id} data-post={post.title} className="rounded-xl border border-border bg-forest-900/30 p-5">
            <p className="text-lg text-bone-50">{post.title}</p>
            <ReviewBadge status={post.reviewStatus} note={post.reviewNote} />
            <details className="mt-4">
              <summary>Edit</summary>
              <div className="mt-4"><PostForm post={post} uploads={uploads} /></div>
            </details>
            <div className="mt-4">
              <DeleteItem id={post.id} name={post.title} action={deletePostAction} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
