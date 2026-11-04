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
import { Badge, Callout, Card, EmptyState, PageHeader, SectionTitle, type Tone } from "./ui";

const docLabel = (value: string) => OWNER_DOCUMENT_TYPES.find((type) => type.value === value)?.label ?? value;

function stateOf(card: OnboardingCard): { label: string; tone: Tone } {
  if (card.failedReason) return { label: "Stopped", tone: "problem" };
  if (card.finalApprovedAt) return { label: "Published", tone: "good" };
  if (card.submittedAt) return { label: "Waiting for final approval", tone: "attention" };
  return { label: "In progress", tone: "neutral" };
}

type StepInfo = { label: string; done: boolean; hint?: string; action?: ReactNode };

/** The steps in order. Only the next one offers its action, so there's always one clear thing to do. */
function Stepper({ steps }: { steps: StepInfo[] }) {
  const next = steps.findIndex((step) => !step.done);
  return (
    <ol className="space-y-2">
      {steps.map((step, index) => {
        const current = index === next;
        return (
          <li key={step.label} aria-current={current ? "step" : undefined} className={`flex gap-3 rounded-lg p-3 ${current ? "border border-copper/50 bg-copper/5" : ""}`}>
            <span aria-hidden="true" className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
              step.done ? "bg-moss/20 text-moss" : current ? "bg-copper text-forest-950" : "border border-border text-bone-200"
            }`}>
              {step.done ? "✓" : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${step.done ? "text-bone-200" : current ? "font-medium text-bone-50" : "text-bone-200"}`}>
                {step.done && <span className="sr-only">Done: </span>}
                {step.label}
              </p>
              {current && step.hint && <p className="mt-1 text-sm text-bone-200">{step.hint}</p>}
              {current && step.action && <div className="mt-3">{step.action}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function OnboardingItem({ card, uploads }: { card: OnboardingCard; uploads: boolean }) {
  const open = !card.failedReason && !card.submittedAt;
  const state = stateOf(card);
  const steps: StepInfo[] = [
    {
      label: "Identity verified",
      done: Boolean(card.identityAt),
      hint: "Needs a checked ID or passport.",
      action: open && <ConfirmStepButton id={card.id} step="identity" label="Confirm identity" />,
    },
    {
      label: "Ownership or legal authority verified",
      done: Boolean(card.ownershipAt),
      hint: "Needs a checked proof of ownership or authority. Do an official land search where needed.",
      action: open && <ConfirmStepButton id={card.id} step="ownership" label="Confirm ownership or authority" />,
    },
    {
      label: "Property availability confirmed",
      done: Boolean(card.availabilityAt),
      action: open && <ConfirmStepButton id={card.id} step="availability" label="Confirm it's available" />,
    },
    {
      label: card.termsAt ? `Price and terms: ${card.agreedCurrency} ${Number(card.agreedAmount).toLocaleString("en-US")}, ${card.agreedPeriod === "month" ? "monthly rent" : "sale"}` : "Asking price and marketing terms confirmed",
      done: Boolean(card.termsAt),
      action: open && <TermsForm id={card.id} />,
    },
    {
      label: "Written marketing authority signed",
      done: Boolean(card.authorityAt),
      hint: "Needs a checked signed authority. This secures the mandate.",
      action: open && <ConfirmStepButton id={card.id} step="authority" label="Confirm signed authority" />,
    },
    {
      label: "Authorised photos and details sent for final approval",
      done: Boolean(card.submittedAt),
      action: open && <SubmitPropertyForm id={card.id} uploads={uploads} />,
    },
    {
      label: "Final approval, by an admin who didn't verify the documents",
      done: Boolean(card.finalApprovedAt),
      hint: "It's under Approvals. You can't approve what you verified, so this needs a second person.",
    },
  ];
  const done = steps.filter((step) => step.done).length;

  return (
    <Card data-onboarding={card.prospectName}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-medium text-bone-50">{card.prospectName}</p>
        <div className="flex items-center gap-3">
          <span className="text-sm text-bone-200">{done} of {steps.length} steps</span>
          <Badge tone={state.tone}>{state.label}</Badge>
        </div>
      </div>
      <div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-forest-950/60">
        <div className="h-full rounded-full bg-copper" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      {card.failedReason && <div className="mt-4"><Callout tone="problem">Stopped: {card.failedReason}</Callout></div>}

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <SectionTitle>Checklist</SectionTitle>
          <Stepper steps={steps} />
        </div>

        <div>
          <SectionTitle>Documents ({card.documents.length})</SectionTitle>
          {open && (
            <div className="mb-3">
              <IssueLinkForm id={card.id} active={card.linkExpiresAt !== null} />
              {card.linkExpiresAt && <p className="mt-2 text-sm text-bone-200">An upload link is active until {card.linkExpiresAt.slice(0, 10)}.</p>}
            </div>
          )}
          {card.documents.length === 0 ? (
            <p className="text-sm text-bone-200">None yet. Send the owner an upload link.</p>
          ) : (
            <ul className="space-y-2">
              {card.documents.map((doc) => (
                <li key={doc.id} className="rounded-lg bg-forest-950/50 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-bone-100">{docLabel(doc.docType)}</p>
                    <Badge tone={doc.verified ? "good" : "attention"}>{doc.verified ? "Checked" : "Not checked"}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-bone-200">Deleted automatically after {doc.deleteAfter}</p>
                  <div className="mt-2 flex flex-wrap items-start gap-2">
                    <a href={`/admin/documents/${doc.id}`} className="inline-flex h-10 items-center px-1 text-copper-400 underline underline-offset-4">Download</a>
                    {!doc.verified && <VerifyDocumentButton id={doc.id} />}
                    <RemoveDocumentButton id={doc.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {open && (
            <details className="mt-3">
              <summary>Add a document yourself</summary>
              <div className="mt-3"><StaffUploadForm id={card.id} /></div>
            </details>
          )}
          {open && (
            <details className="mt-1">
              <summary>Stop this onboarding</summary>
              <div className="mt-3"><FailOnboardingForm id={card.id} /></div>
            </details>
          )}
        </div>
      </div>
    </Card>
  );
}

export function OnboardingPanel({ cards, missing, uploads }: { cards: OnboardingCard[]; missing: string[]; uploads: boolean }) {
  return (
    <section aria-label="Onboarding">
      <PageHeader title="Onboarding" description="From an interested owner to a published listing. Nothing is published until every step here is done." />
      {missing.length > 0 && (
        <div className="mb-4"><Callout tone="problem">Documents can&apos;t be uploaded or opened until these settings are added: {missing.join(", ")}.</Callout></div>
      )}
      {cards.length === 0 ? (
        <EmptyState title="Nothing being onboarded">Start one from a lead who has expressed interest, under Leads.</EmptyState>
      ) : (
        <ul className="grid gap-4">
          {cards.map((card) => <li key={card.id}><OnboardingItem card={card} uploads={uploads} /></li>)}
        </ul>
      )}
    </section>
  );
}
