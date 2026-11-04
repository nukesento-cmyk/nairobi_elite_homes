"use client";

import { useActionState } from "react";

import { addRecipientAction, removeRecipientAction, sendReportAction } from "@/app/admin/acquisition-actions";

import { Result, fieldClass, labelClass, secondaryButton } from "./AdminForms";

export function AddRecipientForm() {
  const [state, action, pending] = useActionState(addRecipientAction, {});
  return (
    <form action={action}>
      <label className={labelClass}>
        Add an email address
        <input name="email" type="email" required autoComplete="off" className={fieldClass} />
      </label>
      <button type="submit" disabled={pending} className={`${secondaryButton} mt-4`}>
        Add
      </button>
      <Result state={state} />
    </form>
  );
}

export function RemoveRecipientForm({ id, email }: { id: string; email: string }) {
  const [state, action, pending] = useActionState(removeRecipientAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} aria-label={`Remove ${email}`} className="text-sm text-copper-400 underline underline-offset-4">
        Remove
      </button>
      <Result state={state} />
    </form>
  );
}

export function SendReportForm({ runId }: { runId: string }) {
  const [state, action, pending] = useActionState(sendReportAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="runId" value={runId} />
      <label className={labelClass}>
        Send this report to
        <input name="email" type="email" required autoComplete="off" className={fieldClass} />
      </label>
      <button type="submit" disabled={pending} className={`${secondaryButton} mt-4`}>
        Send
      </button>
      <Result state={state} />
    </form>
  );
}
