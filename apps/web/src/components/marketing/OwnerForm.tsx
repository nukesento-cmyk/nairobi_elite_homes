"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { OWNER_AREAS, OWNER_CONSENT_WORDING, OWNER_PROPERTY_TYPES, OWNER_ROLES } from "@/lib/acquisition/owner-form";

type FormState =
  | { status: "idle" | "sending" | "sent" }
  | { status: "error"; message: string; fields: Record<string, string[] | undefined> };

const fieldClass =
  "mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-bone-50 focus-visible:outline-2 focus-visible:outline-copper-400";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function Field({ label, errors, children }: { label: string; errors?: string[]; children: ReactNode }) {
  return (
    <label className="block">
      {label}
      {children}
      {errors?.[0] && <span role="alert" className="mt-1 block text-copper-400">{errors[0]}</span>}
    </label>
  );
}

export function OwnerForm() {
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const fields = state.status === "error" ? state.fields : {};

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setState({ status: "sending" });

    try {
      const response = await fetch("/api/owner-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          organisation: data.get("organisation"),
          phone: data.get("phone"),
          email: data.get("email"),
          role: data.get("role") || undefined,
          area: data.get("area") || undefined,
          propertyType: data.get("propertyType") || undefined,
          intent: data.get("intent") || undefined,
          askingPriceKes: data.get("askingPriceKes"),
          details: data.get("details"),
          consent: data.get("consent") === "on",
          company: data.get("company") || undefined,
          turnstileToken,
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string; fields?: Record<string, string[]> };
        setState({ status: "error", message: result.error ?? "Something went wrong. Please try again.", fields: result.fields ?? {} });
        return;
      }
      // Contact details live only in the form, so they go when it's reset.
      form.reset();
      setState({ status: "sent" });
    } catch {
      setState({ status: "error", message: "We couldn't reach the server. Please check your connection and try again.", fields: {} });
    }
  }

  if (state.status === "sent") {
    return (
      <p role="status" className="text-lg text-bone-50">
        Thank you. We&apos;ve received your property details, and someone from our team will contact you.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 text-sm text-bone-200">
      {/* Hidden from people and assistive technology. Only bots fill this in. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Field label="Your name" errors={fields.name}>
        <input name="name" autoComplete="name" aria-invalid={Boolean(fields.name)} className={fieldClass} />
      </Field>
      <Field label="Company (if any)" errors={fields.organisation}>
        <input name="organisation" autoComplete="organization" className={fieldClass} />
      </Field>
      <Field label="Phone" errors={fields.phone}>
        <input name="phone" type="tel" autoComplete="tel" aria-invalid={Boolean(fields.phone)} className={fieldClass} />
      </Field>
      <Field label="Email (optional)" errors={fields.email}>
        <input name="email" type="email" autoComplete="email" aria-invalid={Boolean(fields.email)} className={fieldClass} />
      </Field>
      <Field label="Your connection to the property" errors={fields.role}>
        <select name="role" defaultValue="" aria-invalid={Boolean(fields.role)} className={fieldClass}>
          <option value="" disabled>Choose one</option>
          {OWNER_ROLES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <Field label="Property type" errors={fields.propertyType}>
        <select name="propertyType" defaultValue="" aria-invalid={Boolean(fields.propertyType)} className={fieldClass}>
          <option value="" disabled>Choose one</option>
          {OWNER_PROPERTY_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <Field label="Area" errors={fields.area}>
        <select name="area" defaultValue="" aria-invalid={Boolean(fields.area)} className={fieldClass}>
          <option value="" disabled>Choose one</option>
          {OWNER_AREAS.map((area) => <option key={area} value={area}>{area}</option>)}
        </select>
      </Field>
      <Field label="Is it for rent or sale?" errors={fields.intent}>
        <select name="intent" defaultValue="" aria-invalid={Boolean(fields.intent)} className={fieldClass}>
          <option value="" disabled>Choose one</option>
          <option value="rent">Rent</option>
          <option value="sale">Sale</option>
        </select>
      </Field>
      <Field label="Asking price in KES (optional)" errors={fields.askingPriceKes}>
        <input name="askingPriceKes" inputMode="numeric" aria-invalid={Boolean(fields.askingPriceKes)} className={fieldClass} />
      </Field>
      <Field label="Anything else we should know (optional)" errors={fields.details}>
        <textarea name="details" rows={4} maxLength={1000} className="mt-1.5 w-full rounded-lg border border-input bg-background p-3 text-sm text-bone-50 focus-visible:outline-2 focus-visible:outline-copper-400" />
      </Field>

      <label className="flex items-start gap-3">
        <input name="consent" type="checkbox" aria-invalid={Boolean(fields.consent)} className="mt-1 size-4" />
        <span>
          {OWNER_CONSENT_WORDING} See our <Link href="/privacy" className="text-copper-400 underline underline-offset-4">privacy policy</Link>.
        </span>
      </label>
      {fields.consent?.[0] && <p role="alert" className="text-copper-400">{fields.consent[0]}</p>}

      {TURNSTILE_SITE_KEY && <Turnstile siteKey={TURNSTILE_SITE_KEY} onSuccess={setTurnstileToken} />}

      <button type="submit" disabled={state.status === "sending"} className={buttonVariants({ size: "cta", className: "w-full sm:w-auto" })}>
        {state.status === "sending" ? "Sending" : "Submit property"}
      </button>
      {state.status === "error" && <p role="alert" className="text-copper-400">{state.message}</p>}
    </form>
  );
}
