"use client";

import { useActionState } from "react";

import {
  addRecipientAction,
  approveLeadAction,
  clearDuplicatesAction,
  decideDomainAction,
  logCallAction,
  markDoNotContactAction,
  rejectLeadAction,
  removeRecipientAction,
  sendReportAction,
  setResearchAction,
  suppressContactAction,
} from "@/app/admin/acquisition-actions";
import { CALL_OUTCOMES } from "@/lib/acquisition/call-outcomes";

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

export function NotDuplicateForm({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(clearDuplicatesAction, {});
  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} aria-label={`${name} is not a duplicate`} className={secondaryButton}>Not a duplicate</button>
      <Result state={state} />
    </form>
  );
}

export function LogCallForm({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(logCallAction, {});
  return (
    <form action={action} className="mt-3" aria-label={`Log a call with ${name}`}>
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          What happened
          <select name="outcome" required defaultValue="" className={fieldClass}>
            <option value="" disabled>Choose one</option>
            {CALL_OUTCOMES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Follow up on (optional)
          <input name="nextFollowUp" type="date" className={fieldClass} />
        </label>
      </div>
      <label className={`${labelClass} mt-4`}>
        Notes
        <textarea name="notes" rows={2} maxLength={2000} className={fieldClass} />
      </label>
      <label className="mt-4 flex items-start gap-3 text-sm text-bone-200">
        <input name="optOutLineRead" type="checkbox" className="mt-1 size-4" />
        I told them they can opt out
      </label>
      <button type="submit" disabled={pending} className={`${secondaryButton} mt-4`}>Save call</button>
      <Result state={state} />
    </form>
  );
}

export function DoNotContactForm({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(markDoNotContactAction, {});
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="id" value={id} />
      <label className="flex items-start gap-3 text-sm text-bone-200">
        <input name="confirm" type="checkbox" required className="mt-1 size-4" />
        {name} asked not to be contacted. All their contact details go on the list, and this can&apos;t be undone here.
      </label>
      <button type="submit" disabled={pending} className={`${secondaryButton} mt-3`}>Mark Do Not Contact</button>
      <Result state={state} />
    </form>
  );
}

export function SuppressContactForm() {
  const [state, action, pending] = useActionState(suppressContactAction, {});
  return (
    <form action={action}>
      <label className={labelClass}>
        Phone number or email of someone who opted out
        <input name="contact" required autoComplete="off" className={fieldClass} />
      </label>
      <button type="submit" disabled={pending} className={`${secondaryButton} mt-4`}>Add to the list</button>
      <Result state={state} />
    </form>
  );
}

export function ResearchSwitchForm({ on }: { on: boolean }) {
  const [state, action, pending] = useActionState(setResearchAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="enabled" value={on ? "off" : "on"} />
      <button type="submit" disabled={pending} className={secondaryButton}>
        {on ? "Switch research off" : "Switch research on"}
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
