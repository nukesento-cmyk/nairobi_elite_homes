"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { useState, type FormEvent } from "react";

import { buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { LEAD_AREAS, LEAD_BUDGETS, LEAD_INTENTS } from "@/lib/lead-schema";

type LeadFormProps = {
  source: string;
  listing?: string;
};

type FormState =
  | { status: "idle" | "sending" | "sent" }
  | { status: "error"; message: string; fields: Record<string, string[] | undefined> };

const fieldClass =
  "mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-bone-50 focus-visible:outline-2 focus-visible:outline-copper-400";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function LeadForm({ source, listing }: LeadFormProps) {
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const fields = state.status === "error" ? state.fields : {};

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setState({ status: "sending" });

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          phone: data.get("phone"),
          email: data.get("email"),
          intent: data.get("intent") || undefined,
          budget: data.get("budget") || undefined,
          areas: data.getAll("areas"),
          company: data.get("company") || undefined,
          source,
          listing,
          turnstileToken,
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string; fields?: Record<string, string[]> };
        setState({
          status: "error",
          message: result.error ?? "Something went wrong. Please try again.",
          fields: result.fields ?? {},
        });
        return;
      }
      // Contact details live only in the form, so they go when it's reset.
      form.reset();
      setState({ status: "sent" });
      track("lead_submitted", { source });
    } catch {
      setState({
        status: "error",
        message: "We couldn't reach the server. Please check your connection and try again.",
        fields: {},
      });
    }
  }

  if (state.status === "sent") {
    return (
      <p role="status" className="mt-4 text-bone-50">
        Thanks. We&apos;ll be in touch shortly.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 space-y-4 text-sm text-bone-200">
      {/* Hidden from people and assistive technology. Only bots fill this in. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <TextField label="Name" name="name" autoComplete="name" errors={fields.name} />
      <TextField label="Phone" name="phone" type="tel" autoComplete="tel" errors={fields.phone} />
      <TextField label="Email" name="email" type="email" autoComplete="email" errors={fields.email} />

      <label className="block">
        I want to
        <select
          name="intent"
          defaultValue=""
          aria-invalid={Boolean(fields.intent)}
          className={fieldClass}
        >
          <option value="" disabled>
            Choose one
          </option>
          {LEAD_INTENTS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <FieldError errors={fields.intent} />
      </label>

      <label className="block">
        Budget (optional)
        <select name="budget" defaultValue="" className={fieldClass}>
          <option value="">Prefer not to say</option>
          {LEAD_BUDGETS.map((budget) => (
            <option key={budget} value={budget}>
              {budget}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend>Preferred areas (optional)</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {LEAD_AREAS.map((area) => (
            <label key={area} className="flex min-h-6 items-center gap-2 text-bone-50">
              <input type="checkbox" name="areas" value={area} className="size-4 accent-copper" />
              {area}
            </label>
          ))}
        </div>
      </fieldset>

      {TURNSTILE_SITE_KEY && (
        <Turnstile
          siteKey={TURNSTILE_SITE_KEY}
          onSuccess={setTurnstileToken}
          onExpire={() => setTurnstileToken(undefined)}
          options={{ theme: "dark" }}
        />
      )}

      {state.status === "error" && (
        <p role="alert" className="text-terracotta">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={state.status === "sending"}
        className={buttonVariants({ size: "cta", className: "w-full" })}
      >
        {state.status === "sending" ? "Sending…" : "Send"}
      </button>
    </form>
  );
}

function TextField({
  label,
  errors,
  ...input
}: { label: string; errors?: string[] } & React.ComponentProps<"input">) {
  return (
    <label className="block">
      {label}
      <input {...input} aria-invalid={Boolean(errors)} className={fieldClass} />
      <FieldError errors={errors} />
    </label>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.[0] ? <span className="mt-1 block text-terracotta">{errors[0]}</span> : null;
}
