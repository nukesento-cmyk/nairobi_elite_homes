"use client";

import { useActionState, useState } from "react";

import type { ActionState } from "@/app/admin/actions";
import {
  createBrandAction,
  createGroupAction,
  createUserAction,
  deleteGroupAction,
  deleteUserAction,
  resetUserPasswordAction,
  updateBrandAction,
  updateBrandSettingsAction,
} from "@/app/admin/brand-actions";
import { colors } from "@/config/design-tokens";
import type { Brand } from "@/lib/brands";

import { PhotoField } from "./ContentForms";

import { BrandField, Result, dangerButton, fieldClass, labelClass, primaryButton, secondaryButton, type BrandOption } from "./AdminForms";

export function CreateBrandForm() {
  const [state, action, pending] = useActionState(createBrandAction, {});
  return (
    <form action={action}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Brand name
          <input name="name" required minLength={2} maxLength={100} autoComplete="off" className={fieldClass} />
        </label>
        <label className={labelClass}>
          Domain name (if they have one)
          <input name="domain" placeholder="example.com" autoComplete="off" className={fieldClass} />
        </label>
        <label className={labelClass}>
          Their admin&apos;s name
          <input name="adminName" required minLength={2} autoComplete="off" className={fieldClass} />
        </label>
        <label className={labelClass}>
          Their admin&apos;s email
          <input name="adminEmail" type="email" required autoComplete="off" className={fieldClass} />
        </label>
      </div>
      <button type="submit" disabled={pending} className={`${primaryButton} mt-4`}>
        Add brand and admin
      </button>
      <Result state={state} />
    </form>
  );
}

export function EditBrandForm({ id, name, domain }: { id: string; name: string; domain: string | null }) {
  const [state, action, pending] = useActionState(updateBrandAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Brand name
          <input name="name" required minLength={2} maxLength={100} defaultValue={name} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Domain name
          <input name="domain" placeholder="example.com" defaultValue={domain ?? ""} className={fieldClass} />
        </label>
      </div>
      <button type="submit" disabled={pending} className={`${primaryButton} mt-4`}>
        Save changes
      </button>
      <Result state={state} />
    </form>
  );
}

export function CreateUserForm({ brands }: { brands?: BrandOption[] }) {
  const [state, action, pending] = useActionState(createUserAction, {});
  return (
    <form action={action}>
      {brands && <BrandField brands={brands} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Name
          <input name="name" required minLength={2} autoComplete="off" className={fieldClass} />
        </label>
        <label className={labelClass}>
          Email
          <input name="email" type="email" required autoComplete="off" className={fieldClass} />
        </label>
      </div>
      <button type="submit" disabled={pending} className={`${primaryButton} mt-4`}>
        Add user
      </button>
      <Result state={state} />
    </form>
  );
}

export function ResetUserPasswordForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(resetUserPasswordAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={secondaryButton}>
        Reset password
      </button>
      <Result state={state} />
    </form>
  );
}

/** Two steps, because a deletion can't be undone. */
function ConfirmDelete({
  id,
  name,
  deleteAction,
}: {
  id: string;
  name: string;
  deleteAction: (state: ActionState, form: FormData) => Promise<ActionState>;
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
      <button type="button" onClick={() => setConfirming(false)} className={secondaryButton}>
        Cancel
      </button>
      <Result state={state} />
    </form>
  );
}

export function DeleteUserForm({ id, name }: { id: string; name: string }) {
  return <ConfirmDelete id={id} name={name} deleteAction={deleteUserAction} />;
}

export function DeleteGroupForm({ id, name }: { id: string; name: string }) {
  return <ConfirmDelete id={id} name={name} deleteAction={deleteGroupAction} />;
}

export function CreateGroupForm({ brands }: { brands?: BrandOption[] }) {
  const [state, action, pending] = useActionState(createGroupAction, {});
  return (
    <form action={action}>
      {brands && <BrandField brands={brands} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Group name
          <input name="name" required minLength={2} maxLength={100} autoComplete="off" className={fieldClass} />
        </label>
        <label className={labelClass}>
          Invite link
          <input name="url" type="url" required placeholder="The group's invite link" autoComplete="off" className={fieldClass} />
        </label>
      </div>
      <button type="submit" disabled={pending} className={`${primaryButton} mt-4`}>
        Add group
      </button>
      <Result state={state} />
    </form>
  );
}

const textAreaClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-bone-50 focus-visible:outline-2 focus-visible:outline-copper-400";
const DEFAULT_ACCENT = colors.copper[400].toLowerCase();

/** What a brand's own public site shows. */
export function BrandSettingsForm({ brand, uploads }: { brand: Brand; uploads: boolean }) {
  const [state, action, pending] = useActionState(updateBrandSettingsAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={brand.id} />
      <PhotoField name="logoUrl" label="Logo" defaultValue={brand.logoUrl ?? ""} uploads={uploads} />
      <label className={labelClass}>
        Tagline
        <input name="tagline" maxLength={160} defaultValue={brand.tagline ?? ""} className={fieldClass} />
      </label>
      <label className={labelClass}>
        About the brand
        <textarea name="about" rows={4} maxLength={2000} defaultValue={brand.about ?? ""} className={textAreaClass} />
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-bone-200">
          <input type="checkbox" name="useAccent" defaultChecked={Boolean(brand.accentColor)} />
          Use my own accent colour
        </label>
        <input
          type="color"
          name="accentColor"
          aria-label="Accent colour"
          defaultValue={brand.accentColor ?? DEFAULT_ACCENT}
          className="h-10 w-16 rounded-lg border border-input bg-background"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className={labelClass}>
          Contact email
          <input name="contactEmail" type="email" defaultValue={brand.contactEmail ?? ""} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Contact phone
          <input name="contactPhone" type="tel" defaultValue={brand.contactPhone ?? ""} className={fieldClass} />
        </label>
        <label className={labelClass}>
          WhatsApp number
          <input name="whatsappPhone" type="tel" defaultValue={brand.whatsappPhone ?? ""} className={fieldClass} />
        </label>
      </div>
      <button type="submit" disabled={pending} className={primaryButton}>
        Save site details
      </button>
      <Result state={state} />
    </form>
  );
}
