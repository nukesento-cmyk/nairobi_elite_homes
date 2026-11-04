import type { ReactNode } from "react";

import type { OnboardingCard } from "@/lib/acquisition/onboarding";
import { OWNER_DOCUMENT_TYPES } from "@/lib/acquisition/onboarding-types";

import {
  ConfirmStepButton,
  FailOnboardingForm,
  IssueLinkForm,
  RemoveDocumentButton,
  StaffUploadForm,
  SubmitPropertyForm,
  TermsForm,
  VerifyDocumentButton,
} from "./OnboardingForms";

const docLabel = (value: string) => OWNER_DOCUMENT_TYPES.find((type) => type.value === value)?.label ?? value;

function Step({ done, label, children }: { done: boolean; label: string; children?: ReactNode }) {
  return (
    <li className="rounded-lg border border-border p-4">
      <p className={done ? "text-sm text-bone-200" : "text-sm text-bone-50"}>{done ? "Done: " : ""}{label}</p>
      {!done && children && <div className="mt-3">{children}</div>}
    </li>
  );
}

function stateOf(card: OnboardingCard): string {
  if (card.failedReason) return `Stopped: ${card.failedReason}`;
  if (card.finalApprovedAt) return "Approved and published";
  if (card.submittedAt) return "With Approvals, waiting for an admin who didn't verify the documents";
  return "In progress";
}

function Card({ card, uploads }: { card: OnboardingCard; uploads: boolean }) {
  const open = !card.failedReason && !card.submittedAt;
  return (
    <li data-onboarding={card.prospectName} className="rounded-xl border border-border p-5">
      <p className="text-lg text-bone-50">{card.prospectName}</p>
      <p className="text-sm text-bone-200">{stateOf(card)}</p>

      {open && (
        <div className="mt-4">
          <IssueLinkForm id={card.id} active={card.linkExpiresAt !== null} />
          {card.linkExpiresAt && <p className="mt-2 text-sm text-bone-200">An upload link is active until {card.linkExpiresAt.slice(0, 10)}.</p>}
        </div>
      )}

      <h4 className="mt-5 mb-2 text-bone-50">Documents ({card.documents.length})</h4>
      {card.documents.length === 0 ? (
        <p className="text-sm text-bone-200">None yet.</p>
      ) : (
        <ul className="grid gap-3">
          {card.documents.map((doc) => (
            <li key={doc.id} className="rounded-lg border border-border p-3 text-sm">
              <p className="text-bone-100">{docLabel(doc.docType)} {doc.verified ? "· checked" : "· not checked yet"}</p>
              <p className="text-bone-200">Deleted automatically after {doc.deleteAfter}</p>
              <div className="mt-2 flex flex-wrap items-start gap-3">
                <a href={`/admin/documents/${doc.id}`} className="py-2 text-copper-400 underline underline-offset-4">Download</a>
                {!doc.verified && <VerifyDocumentButton id={doc.id} />}
                <RemoveDocumentButton id={doc.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-copper-400">Add a document yourself</summary>
          <div className="mt-3"><StaffUploadForm id={card.id} /></div>
        </details>
      )}

      <h4 className="mt-5 mb-2 text-bone-50">Checklist</h4>
      <ol className="grid gap-3">
        <Step done={Boolean(card.identityAt)} label="Identity verified">
          {open && <ConfirmStepButton id={card.id} step="identity" label="Confirm identity" />}
        </Step>
        <Step done={Boolean(card.ownershipAt)} label="Ownership or legal authority verified. Do an official land search where needed.">
          {open && <ConfirmStepButton id={card.id} step="ownership" label="Confirm ownership or authority" />}
        </Step>
        <Step done={Boolean(card.availabilityAt)} label="Property availability confirmed">
          {open && <ConfirmStepButton id={card.id} step="availability" label="Confirm it's available" />}
        </Step>
        <Step done={Boolean(card.termsAt)} label={card.termsAt ? `Price and terms confirmed: ${card.agreedCurrency} ${card.agreedAmount}, ${card.agreedPeriod === "month" ? "monthly rent" : "sale"}` : "Asking price and marketing terms confirmed"}>
          {open && <TermsForm id={card.id} />}
        </Step>
        <Step done={Boolean(card.authorityAt)} label="Written marketing authority signed. This secures the mandate.">
          {open && <ConfirmStepButton id={card.id} step="authority" label="Confirm signed authority" />}
        </Step>
        <Step done={Boolean(card.submittedAt)} label="Authorised photos and details sent for final approval">
          {open && card.authorityAt && <SubmitPropertyForm id={card.id} uploads={uploads} />}
        </Step>
        <Step done={Boolean(card.finalApprovedAt)} label="Final approval by an admin who didn't verify the documents, under Approvals" />
      </ol>

      {open && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-copper-400">Stop this onboarding</summary>
          <div className="mt-3"><FailOnboardingForm id={card.id} /></div>
        </details>
      )}
    </li>
  );
}

export function OnboardingPanel({ cards, missing, uploads }: { cards: OnboardingCard[]; missing: string[]; uploads: boolean }) {
  return (
    <section id="onboarding" className="mb-14 scroll-mt-6" aria-labelledby="onboarding-heading">
      <h2 id="onboarding-heading" className="mb-2 text-2xl text-bone-50">Onboarding ({cards.length})</h2>
      <p className="mb-6 text-sm text-bone-200">
        Start one from a lead that has expressed interest. Nothing is published until every step here is done.
      </p>
      {missing.length > 0 && (
        <p className="mb-4 text-sm text-bone-100">Documents can&apos;t be uploaded or opened until these settings are added: {missing.join(", ")}.</p>
      )}
      {cards.length === 0 ? <p className="text-sm text-bone-200">Nothing being onboarded.</p> : (
        <ul className="grid gap-4">
          {cards.map((card) => <Card key={card.id} card={card} uploads={uploads} />)}
        </ul>
      )}
    </section>
  );
}
