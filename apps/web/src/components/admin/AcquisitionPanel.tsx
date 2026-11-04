import type { LeadRow, PendingDomain, Recipient, RunSummary } from "@/lib/acquisition/dashboard";

import { AddRecipientForm, DomainDecisionForm, LeadDecisionForms, RemoveRecipientForm, SendReportForm } from "./AcquisitionForms";

function outcome(run: RunSummary): string {
  if (run.status === "failed") return `Failed: ${run.error ?? "unknown error"}`;
  if (run.status === "running") return "Running";
  return run.emailed ? "Emailed" : "On this dashboard only";
}

function LeadCard({ lead }: { lead: LeadRow }) {
  return (
    <li data-lead={lead.name} className="rounded-xl border border-border p-5">
      <p className="text-lg text-bone-50">{lead.name}</p>
      <p className="text-sm text-bone-200">
        Score {lead.score ?? "not set"} · {lead.category} · {lead.campaign ?? "no campaign"} · {lead.status === "ready_to_call" ? "Ready to call" : "Awaiting approval"}
      </p>
      <p className="mt-1 text-sm text-bone-200">
        {lead.role}, {lead.authority}. Nothing here proves ownership until documents are checked at onboarding.
      </p>
      {lead.property && <p className="mt-1 text-sm text-bone-100">{lead.property}</p>}
      <ul className="mt-3 grid gap-2 text-sm text-bone-100">
        {lead.evidence.map((item) => (
          <li key={`${item.claimType}-${item.quote}`}>
            &ldquo;{item.quote}&rdquo;{" "}
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="break-all text-copper-400 underline underline-offset-4">source</a>
          </li>
        ))}
      </ul>
      {lead.contacts.length > 0 && (
        <ul className="mt-3 grid gap-1 text-sm text-bone-100">
          {lead.contacts.map((contact) => (
            <li key={contact.value}>
              {contact.value} <span className="text-bone-200">· {contact.contactClass} · {contact.callable ? "may be called" : "locked, pending legal advice"}</span>
            </li>
          ))}
        </ul>
      )}
      {lead.script && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-copper-400">Opening script</summary>
          <p className="mt-2 text-sm text-bone-100">{lead.script}</p>
        </details>
      )}
      {lead.status === "researched" && <LeadDecisionForms id={lead.id} name={lead.name} />}
    </li>
  );
}

export function AcquisitionPanel({
  reports,
  recipients,
  emailReady,
  researchOn,
  domains,
  leads,
}: {
  reports: RunSummary[];
  recipients: Recipient[];
  emailReady: boolean;
  researchOn: boolean;
  domains: PendingDomain[];
  leads: LeadRow[];
}) {
  return (
    <section id="acquisition" className="mb-14 scroll-mt-6" aria-labelledby="acquisition-heading">
      <h2 id="acquisition-heading" className="mb-2 text-2xl text-bone-50">Acquisition reports</h2>
      <p className="mb-6 text-sm text-bone-200">
        {researchOn
          ? "Research runs before dawn, and a new report arrives every morning. Private individuals are skipped until legal advice clears them."
          : "A new report arrives every morning. Research isn't switched on yet, so reports are labelled as tests and hold no real leads."}
      </p>

      <h3 className="mb-3 text-lg text-bone-50">Leads ({leads.length})</h3>
      {leads.length === 0 ? (
        <p className="mb-8 text-sm text-bone-200">No leads yet.</p>
      ) : (
        <ul className="mb-8 grid gap-4">
          {leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
        </ul>
      )}

      <h3 className="mb-1 text-lg text-bone-50">Domains to review ({domains.length})</h3>
      <p className="mb-3 text-sm text-bone-200">
        Nothing is read from a website until you allow it. Read its terms first, and allow it only if they permit this kind of research and contact.
      </p>
      {domains.length === 0 ? (
        <p className="mb-8 text-sm text-bone-200">None waiting.</p>
      ) : (
        <ul className="mb-8 grid gap-4">
          {domains.map((domain) => (
            <li key={domain.id} data-domain={domain.domain} className="rounded-xl border border-border p-5">
              <p className="text-bone-50">{domain.domain}</p>
              <p className="text-sm text-bone-200">{domain.pages} {domain.pages === 1 ? "page" : "pages"} waiting{domain.exampleTitle ? ` · ${domain.exampleTitle}` : ""}</p>
              {domain.exampleUrl && (
                <a href={domain.exampleUrl} target="_blank" rel="noopener noreferrer" className="mb-3 block break-all text-sm text-copper-400 underline underline-offset-4">{domain.exampleUrl}</a>
              )}
              <DomainDecisionForm id={domain.id} domain={domain.domain} />
            </li>
          ))}
        </ul>
      )}

      <div className="mb-6 rounded-xl border border-border p-5">
        <h3 className="mb-1 text-lg text-bone-50">Who gets it by email</h3>
        {!emailReady && (
          <p className="mb-3 text-sm text-bone-200">Email isn&apos;t set up yet. Addresses saved here start getting the report once it is.</p>
        )}
        {recipients.length === 0 ? (
          <p className="mb-4 text-sm text-bone-200">Nobody yet, so reports only appear here.</p>
        ) : (
          <ul className="mb-4 grid gap-2">
            {recipients.map((recipient) => (
              <li key={recipient.id} className="flex flex-wrap items-center justify-between gap-3 text-bone-100">
                {recipient.email}
                <RemoveRecipientForm id={recipient.id} email={recipient.email} />
              </li>
            ))}
          </ul>
        )}
        <AddRecipientForm />
      </div>

      {reports.length === 0 ? (
        <p className="text-bone-200">No reports yet. The first one arrives on the next morning run.</p>
      ) : (
        <ul className="grid gap-4">
          {reports.map((run) => (
            <li key={run.id} data-report={run.runDate} className="rounded-xl border border-border p-5">
              <details>
                <summary className="cursor-pointer text-bone-50">
                  {run.runDate} <span className="text-sm text-bone-200">· {outcome(run)}</span>
                </summary>
                {run.report ? (
                  <div className="mt-4">
                    {/* Sandboxed so nothing in a report can run or reach this page. */}
                    <iframe title={run.report.subject} sandbox="" srcDoc={run.report.html} className="mb-4 h-[32rem] w-full rounded-lg bg-bone-50" />
                    {emailReady && <SendReportForm runId={run.id} />}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-bone-200">This run stopped before its report was built.</p>
                )}
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
