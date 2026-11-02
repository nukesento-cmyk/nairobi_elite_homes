"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { useActionState } from "react";

import { requestAccess } from "@/app/(marketing)/join/actions";
import { buttonVariants } from "@/components/ui/button";

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-bone-50 focus-visible:outline-2 focus-visible:outline-copper-400";
const labelClass = "block text-sm text-bone-200";
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function RequestAccessForm() {
  const [state, action, pending] = useActionState(requestAccess, {});

  if (state.sent) {
    return (
      <p role="status" className="mt-6 rounded-xl border border-copper/40 p-6 text-lg text-bone-50">
        Thanks. Your request is with the admins, and they&apos;ll contact you on WhatsApp.
      </p>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <label className={labelClass}>
        Name
        <input name="name" required minLength={2} autoComplete="name" className={fieldClass} />
      </label>
      <label className={labelClass}>
        WhatsApp number
        <input name="phone" type="tel" required autoComplete="tel" className={fieldClass} />
      </label>
      <label className={labelClass}>
        Email (optional)
        <input name="email" type="email" autoComplete="email" className={fieldClass} />
      </label>
      <label className={labelClass}>
        Anything we should know? (optional)
        <textarea name="message" rows={3} maxLength={500} className={fieldClass} />
      </label>
      {/* Hidden from people. Bots that fill it in are ignored. */}
      <input name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {TURNSTILE_SITE_KEY && <Turnstile siteKey={TURNSTILE_SITE_KEY} options={{ theme: "dark" }} />}
      {state.error && <p role="alert" className="text-sm text-terracotta">{state.error}</p>}
      <button type="submit" disabled={pending} className={buttonVariants({ size: "cta", className: "w-full" })}>
        {pending ? "Sending…" : "Request the link"}
      </button>
    </form>
  );
}
