"use client";

import { useActionState, useState } from "react";

import {
  changePasswordAction,
  createAdminAction,
  deleteAdminAction,
  login,
  resetPasswordAction,
  updateAdminAction,
  type ActionState,
} from "@/app/admin/actions";
import { buttonVariants } from "@/components/ui/button";

export const fieldClass =
  "mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-bone-50 focus-visible:outline-2 focus-visible:outline-copper-400";
export const labelClass = "block text-sm text-bone-200";
export const secondaryButton = buttonVariants({
  variant: "outline",
  size: "default",
  className: "h-10 bg-transparent px-4",
});

/** The one main action in a form. Everything else stays secondary, and risky actions look risky. */
export const primaryButton = buttonVariants({ size: "default", className: "h-10 px-4" });
export const dangerButton =
  "inline-flex h-10 items-center justify-center rounded-lg border border-terracotta/60 px-4 text-sm font-medium text-terracotta transition-colors hover:bg-terracotta/10 focus-visible:outline-2 focus-visible:outline-terracotta disabled:opacity-50";

export type BrandOption = { id: string; name: string };

/** Only the SuperAdmin chooses. Everyone else always works in their own brand. */
export function BrandField({ brands }: { brands: BrandOption[] }) {
  return (
    <label className={`${labelClass} mb-4 max-w-xs`}>
      Brand
      <select name="brandId" required className={fieldClass}>
        {brands.map((brand) => (
          <option key={brand.id} value={brand.id}>
            {brand.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Result({ state }: { state: ActionState }) {
  return (
    <>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-terracotta">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="mt-3 text-sm text-bone-50">
          {state.message}
        </p>
      )}
      {state.temporaryPassword && (
        <div className="mt-3 rounded-lg border border-copper/50 p-3 text-sm text-bone-50">
          <p>Temporary password, shown only once. They&apos;ll choose their own at first sign-in:</p>
          <code className="mt-2 block font-mono break-all text-copper-400 select-all">
            {state.temporaryPassword}
          </code>
        </div>
      )}
    </>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, {});
  return (
    <form action={action} className="space-y-4">
      <label className={labelClass}>
        Email
        <input name="email" type="email" required autoComplete="username" className={fieldClass} />
      </label>
      <label className={labelClass}>
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={fieldClass}
        />
      </label>
      <button type="submit" disabled={pending} className={buttonVariants({ size: "cta", className: "w-full" })}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <Result state={state} />
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, {});
  return (
    <form action={action} className="max-w-md space-y-4">
      <label className={labelClass}>
        Current password
        <input
          name="current"
          type="password"
          required
          autoComplete="current-password"
          className={fieldClass}
        />
      </label>
      <label className={labelClass}>
        New password (at least 12 characters)
        <input
          name="next"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          className={fieldClass}
        />
      </label>
      <button type="submit" disabled={pending} className={primaryButton}>
        Change password
      </button>
      <Result state={state} />
    </form>
  );
}

const ROLE_NAME: Record<string, string> = { admin: "Admin", reviewer: "Reviewer" };

export function CreateAdminForm({ roles, brands }: { roles: string[]; brands?: BrandOption[] }) {
  const [state, action, pending] = useActionState(createAdminAction, {});
  return (
    <form action={action}>
      {brands && <BrandField brands={brands} />}
      {roles.length === 1 ? (
        <input type="hidden" name="role" value={roles[0]} />
      ) : (
        <label className={`${labelClass} mb-4 max-w-xs`}>
          Role
          <select name="role" required className={fieldClass}>
            {roles.map((role) => (
              <option key={role} value={role}>
                {ROLE_NAME[role]}
              </option>
            ))}
          </select>
        </label>
      )}
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
        Add {roles.length === 1 ? ROLE_NAME[roles[0]].toLowerCase() : "account"}
      </button>
      <Result state={state} />
    </form>
  );
}

export function EditAdminForm({ id, name, email }: { id: string; name: string; email: string }) {
  const [state, action, pending] = useActionState(updateAdminAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Name
          <input name="name" required minLength={2} defaultValue={name} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Email
          <input name="email" type="email" required defaultValue={email} className={fieldClass} />
        </label>
      </div>
      <button type="submit" disabled={pending} className={`${primaryButton} mt-4`}>
        Save changes
      </button>
      <Result state={state} />
    </form>
  );
}

export function ResetPasswordForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, {});
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
export function DeleteAdminForm({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(deleteAdminAction, {});
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
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-lg bg-terracotta px-4 text-sm font-medium text-forest-950"
      >
        Yes, delete
      </button>
      <button type="button" onClick={() => setConfirming(false)} className={secondaryButton}>
        Cancel
      </button>
      <Result state={state} />
    </form>
  );
}
