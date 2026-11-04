"use client";

import { useActionState } from "react";

import {
  addRecipientAction,
  approveLeadAction,
  decideDomainAction,
  rejectLeadAction,
  removeRecipientAction,
  sendReportAction,
} from "@/app/admin/acquisition-actions";

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

export function DomainDecisionForm({ id, domain }: { id: string; domain: string }) {
  const [state, action, pending] = useActionState(decideDomainAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <label className={labelClass}>
        Link to the {domain} terms you read
        <input name="termsUrl" type="url" autoComplete="off" className={fieldClass} />
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" name="verdict" value="allowed" disabled={pending} className={secondaryButton}>Allow research</button>
        <button type="submit" name="verdict" value="human_only" disabled={pending} className={secondaryButton}>People only</button>
        <button type="submit" name="verdict" value="blocked" disabled={pending} className={secondaryButton}>Block</button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function LeadDecisionForms({ id, name }: { id: string; name: string }) {
  const [approved, approve, approving] = useActionState(approveLeadAction, {});
  const [rejected, reject, rejecting] = useActionState(rejectLeadAction, {});
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-3">
        <form action={approve}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={approving} aria-label={`Approve ${name}`} className={secondaryButton}>Approve</button>
        </form>
        <form action={reject}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={rejecting} aria-label={`Reject ${name}`} className={secondaryButton}>Reject</button>
        </form>
      </div>
      <Result state={approved} />
      <Result state={rejected} />
    </div>
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
