"use client";

import { useActionState, useState } from "react";

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

function DeleteItem({
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
      <button type="button" onClick={() => setConfirming(true)} className={button}>
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

function PropertyForm({ property }: { property?: PropertyRow }) {
  const [state, action, pending] = useActionState(savePropertyAction, {});
  const isNew = !property;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
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
        Price
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
      <label className={labelClass}>
        Main photo link (secure, starting with https)
        <input name="heroUrl" inputMode="url" defaultValue={property?.heroUrl ?? ""} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Main photo description
        <input name="heroAlt" defaultValue={property?.heroAlt ?? ""} className={fieldClass} />
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        More photo links, one per line
        <textarea name="galleryUrls" rows={3} defaultValue={property?.galleryUrls.join("\n")} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Matterport ID (public listings only)
        <input name="matterportId" defaultValue={property?.matterportId ?? ""} className={fieldClass} />
      </label>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className={button}>
          {isNew ? "Add property" : "Save property"}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function PropertyManager({ properties }: { properties: PropertyRow[] }) {
  return (
    <section className="mb-14">
      <h2 className="mb-4 text-2xl text-bone-50">Properties</h2>
      <details className="mb-6 rounded-xl border border-border p-5">
        <summary className="cursor-pointer font-medium text-copper-400">Add a property</summary>
        <div className="mt-5"><PropertyForm /></div>
      </details>
      {properties.length === 0 && <p className="text-bone-200">No properties yet.</p>}
      <ul className="space-y-3">
        {properties.map((property) => (
          <li key={property.id} data-property={property.title} className="rounded-xl border border-border p-5">
            <p className="text-lg text-bone-50">{property.title}</p>
            <p className="text-sm text-bone-200">{property.area} · {property.status.replace("_", " ")}</p>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-copper-400">Edit</summary>
              <div className="mt-4"><PropertyForm property={property} /></div>
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

function PostForm({ post }: { post?: Post }) {
  const [state, action, pending] = useActionState(savePostAction, {});
  return (
    <form action={action} className="space-y-4">
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
        Post
        <textarea name="body" rows={10} required defaultValue={post?.body} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Cover photo link (secure, starting with https)
        <input name="coverUrl" inputMode="url" defaultValue={post?.coverUrl ?? ""} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Cover photo description
        <input name="coverAlt" defaultValue={post?.coverAlt ?? ""} className={fieldClass} />
      </label>
      <label className="flex items-center gap-2 text-sm text-bone-50">
        <input name="published" type="checkbox" defaultChecked={post?.published} className="size-4" />
        Published (visible on the site)
      </label>
      <button type="submit" disabled={pending} className={button}>
        {post ? "Save post" : "Add post"}
      </button>
      <Result state={state} />
    </form>
  );
}

export function PostManager({ posts }: { posts: Post[] }) {
  return (
    <section className="mb-14">
      <h2 className="mb-4 text-2xl text-bone-50">Blog</h2>
      <details className="mb-6 rounded-xl border border-border p-5">
        <summary className="cursor-pointer font-medium text-copper-400">Add a post</summary>
        <div className="mt-5"><PostForm /></div>
      </details>
      {posts.length === 0 && <p className="text-bone-200">No posts yet.</p>}
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.id} data-post={post.title} className="rounded-xl border border-border p-5">
            <p className="text-lg text-bone-50">{post.title}</p>
            <p className="text-sm text-bone-200">{post.published ? "Published" : "Draft"}</p>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-copper-400">Edit</summary>
              <div className="mt-4"><PostForm post={post} /></div>
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
