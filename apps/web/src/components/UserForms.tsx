"use client";

import { useActionState } from "react";

import { buyerChangePassword, buyerLogin, type UserActionState } from "@/app/(marketing)/account/actions";
import { buttonVariants } from "@/components/ui/button";

const fieldClass =
  "mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-bone-50 focus-visible:outline-2 focus-visible:outline-copper-400";
const labelClass = "block text-sm text-bone-200";

function Result({ state }: { state: UserActionState }) {
  return (
    <>
      {state.error && <p role="alert" className="mt-3 text-sm text-terracotta">{state.error}</p>}
      {state.message && <p role="status" className="mt-3 text-sm text-bone-50">{state.message}</p>}
    </>
  );
}

export function UserLoginForm({ base = "" }: { base?: string }) {
  const [state, action, pending] = useActionState(buyerLogin, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="base" value={base} />
      <label className={labelClass}>
        Email
        <input name="email" type="email" required autoComplete="username" className={fieldClass} />
      </label>
      <label className={labelClass}>
        Password
        <input name="password" type="password" required autoComplete="current-password" className={fieldClass} />
      </label>
      <button type="submit" disabled={pending} className={buttonVariants({ size: "cta", className: "w-full" })}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <Result state={state} />
    </form>
  );
}

export function UserChangePasswordForm({ base = "" }: { base?: string }) {
  const [state, action, pending] = useActionState(buyerChangePassword, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="base" value={base} />
      <label className={labelClass}>
        Current password
        <input name="current" type="password" required autoComplete="current-password" className={fieldClass} />
      </label>
      <label className={labelClass}>
        New password (at least 12 characters)
        <input name="next" type="password" required minLength={12} autoComplete="new-password" className={fieldClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className={buttonVariants({ variant: "outline", size: "default", className: "h-10 bg-transparent px-4" })}
      >
        Change password
      </button>
      <Result state={state} />
    </form>
  );
}
