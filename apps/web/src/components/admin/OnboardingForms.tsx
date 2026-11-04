"use client";

import { useActionState, type ReactNode } from "react";

import type { ActionState } from "@/app/admin/actions";
import {
  confirmStepAction,
  failOnboardingAction,
  issueLinkAction,
  removeDocumentAction,
  startOnboardingAction,
  submitForApprovalAction,
  uploadDocumentAction,
  verifyDocumentAction,
} from "@/app/admin/onboarding-actions";
import { OWNER_DOCUMENT_TYPES } from "@/lib/acquisition/onboarding-types";
import { LEAD_AREAS } from "@/lib/lead-options";

import { Result, dangerButton, fieldClass, labelClass, primaryButton, secondaryButton } from "./AdminForms";
import { PhotoField } from "./ContentForms";
import { useSafeForm } from "./use-safe-form";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

/** A single button with hidden values, and its own result underneath. */
function ActionButton({ action, id, label, extra, look = secondaryButton }: { action: Action; id: string; label: string; extra?: Record<string, string>; look?: string }) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <form action={run}>
      <input type="hidden" name="id" value={id} />
      {Object.entries(extra ?? {}).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <button type="submit" disabled={pending} className={look}>{label}</button>
      <Result state={state} />
    </form>
  );
}

export const StartOnboardingButton = ({ id }: { id: string }) => <ActionButton action={startOnboardingAction} id={id} label="Start onboarding" look={primaryButton} />;
export const VerifyDocumentButton = ({ id }: { id: string }) => <ActionButton action={verifyDocumentAction} id={id} label="I've checked this" />;
export const RemoveDocumentButton = ({ id }: { id: string }) => <ActionButton action={removeDocumentAction} id={id} label="Delete" look={dangerButton} />;
export const ConfirmStepButton = ({ id, step, label }: { id: string; step: string; label: string }) => <ActionButton action={confirmStepAction} id={id} label={label} extra={{ step }} look={primaryButton} />;

export function IssueLinkForm({ id, active }: { id: string; active: boolean }) {
  const [state, run, pending] = useActionState(issueLinkAction, {});
  return (
    <form action={run}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={secondaryButton}>{active ? "Replace the upload link" : "Create an upload link"}</button>
      {state.error && <Result state={state} />}
      {state.message && <p role="status" className="mt-2 break-all text-sm text-bone-50">{state.message}</p>}
    </form>
  );
}

export function StaffUploadForm({ id }: { id: string }) {
  const { state, pending, form } = useSafeForm(uploadDocumentAction);
  return (
    <form {...form}>
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Type
          <select name="docType" defaultValue="" required className={fieldClass}>
            <option value="" disabled>Choose one</option>
            {OWNER_DOCUMENT_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          File, up to 1 MB here. Larger files need the upload link
          <input name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className="mt-1.5 block w-full text-bone-100" />
        </label>
      </div>
      <button type="submit" disabled={pending} className={`${secondaryButton} mt-4`}>Add document</button>
      <Result state={state} />
    </form>
  );
}

export function TermsForm({ id }: { id: string }) {
  const { state, pending, form } = useSafeForm(confirmStepAction);
  return (
    <form {...form}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="step" value="terms" />
      <div className="grid gap-4 sm:grid-cols-3">
        <label className={labelClass}>
          Agreed price
          <input name="amount" inputMode="numeric" required className={fieldClass} />
        </label>
        <label className={labelClass}>
          Currency
          <select name="currency" defaultValue="KES" className={fieldClass}>
            <option value="KES">KES</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label className={labelClass}>
          For
          <select name="period" defaultValue="sale" className={fieldClass}>
            <option value="sale">Sale</option>
            <option value="month">Monthly rent</option>
          </select>
        </label>
      </div>
      <label className={`${labelClass} mt-4`}>
        Marketing terms agreed with the owner
        <textarea name="terms" rows={3} required maxLength={2000} className={fieldClass} />
      </label>
      <button type="submit" disabled={pending} className={`${primaryButton} mt-4`}>Confirm price and terms</button>
      <Result state={state} />
    </form>
  );
}

export function FailOnboardingForm({ id }: { id: string }) {
  const { state, pending, form } = useSafeForm(failOnboardingAction);
  return (
    <form {...form}>
      <input type="hidden" name="id" value={id} />
      <label className={labelClass}>
        Why is this being stopped?
        <input name="reason" required maxLength={500} className={fieldClass} />
      </label>
      <button type="submit" disabled={pending} className={`${dangerButton} mt-4`}>Stop onboarding</button>
      <Result state={state} />
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className={labelClass}>{label}{children}</label>;
}

export function SubmitPropertyForm({ id, uploads }: { id: string; uploads: boolean }) {
  const { state, pending, form } = useSafeForm(submitForApprovalAction);
  return (
    <form {...form}>
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title"><input name="title" required minLength={3} maxLength={120} className={fieldClass} /></Field>
        <Field label="Type">
          <select name="vertical" defaultValue="residential" className={fieldClass}>
            <option value="residential">Residential</option>
            <option value="land">Land</option>
            <option value="commercial">Commercial</option>
          </select>
        </Field>
        <Field label="Who can see it">
          <select name="status" defaultValue="public" className={fieldClass}>
            <option value="public">Public</option>
            <option value="off_market">Off market</option>
            <option value="members_only">Members only</option>
          </select>
        </Field>
        <Field label="Area">
          <select name="area" defaultValue="" required className={fieldClass}>
            <option value="" disabled>Choose one</option>
            {LEAD_AREAS.map((area) => <option key={area} value={area}>{area}</option>)}
          </select>
        </Field>
        <Field label="Bedrooms"><input name="beds" inputMode="numeric" className={fieldClass} /></Field>
        <Field label="Bathrooms"><input name="baths" inputMode="numeric" className={fieldClass} /></Field>
        <Field label="Acres"><input name="acreage" inputMode="decimal" className={fieldClass} /></Field>
        <Field label="Square metres"><input name="sqm" inputMode="numeric" className={fieldClass} /></Field>
        <Field label="Title">
          <select name="titleStatus" defaultValue="" className={fieldClass}>
            <option value="">Not stated</option>
            <option value="freehold">Freehold</option>
            <option value="leasehold">Leasehold</option>
          </select>
        </Field>
        <Field label="Zoning"><input name="zoning" maxLength={120} className={fieldClass} /></Field>
      </div>
      <div className="mt-4 grid gap-4">
        <Field label="Description"><textarea name="description" rows={4} maxLength={5000} className={fieldClass} /></Field>
        <Field label="Features, one per line"><textarea name="features" rows={3} className={fieldClass} /></Field>
        <PhotoField name="heroUrl" label="Main photo" uploads={uploads} />
        <Field label="Main photo description"><input name="heroAlt" maxLength={200} className={fieldClass} /></Field>
        <PhotoField name="galleryUrls" label="More photos" multiple uploads={uploads} />
        <Field label="Who owns the rights to these photos, and did they authorise this use?">
          <input name="photoRights" required maxLength={500} className={fieldClass} />
        </Field>
      </div>
      <button type="submit" disabled={pending} className={`${primaryButton} mt-4`}>Send for final approval</button>
      <Result state={state} />
    </form>
  );
}
