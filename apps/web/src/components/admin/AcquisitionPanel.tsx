import { CALL_OUTCOMES } from "@/lib/acquisition/call-outcomes";
import type { LeadRow, PendingDomain, Recipient, RunSummary } from "@/lib/acquisition/dashboard";

import {
  AddRecipientForm,
  DoNotContactForm,
  DomainDecisionForm,
  LeadDecisionForms,
  LeadFilter,
  LogCallForm,
  NotDuplicateForm,
  RemoveRecipientForm,
  ResearchSwitchForm,
  SendReportForm,
  SuppressContactForm,
} from "./AcquisitionForms";
import { StartOnboardingButton } from "./OnboardingForms";
import { Badge, Callout, Card, EmptyState, PageHeader, SectionTitle, Stat, type Tone } from "./ui";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  researched: { label: "Awaiting approval", tone: "attention" },
  ready_to_call: { label: "Ready to call", tone: "good" },
  contacted: { label: "Contacted", tone: "neutral" },
  interested: { label: "Interested", tone: "good" },
  meeting_scheduled: { label: "Meeting scheduled", tone: "good" },
  negotiating: { label: "Negotiating", tone: "good" },
  follow_up: { label: "Follow up", tone: "neutral" },
};

const words = (value: string) => value.replace(/_/g, " ");
const outcomeLabel = (value: string) => CALL_OUTCOMES.find((item) => item.value === value)?.label ?? value;

function LeadCard({ lead }: { lead: LeadRow }) {
  const status = STATUS[lead.status] ?? { label: words(lead.status), tone: "neutral" as const };
  const quotes = lead.evidence.slice(0, 2);
  return (
    <Card data-lead={lead.name}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-medium text-bone-50">{lead.name}</p>
          <p className="mt-0.5 text-sm text-bone-200">
            <span className="capitalize">{words(lead.category)}</span>{lead.property ? ` · ${lead.property}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lead.followUpDue && <Badge tone="attention">Follow-up due</Badge>}
          <Badge tone={status.tone}>{status.label}</Badge>
          {lead.score !== null && <span title="Priority score, out of 100" className="font-heading text-2xl text-bone-50">{lead.score}</span>}
        </div>
      </div>

      {lead.nextFollowUp && (
        <p className={`mt-2 text-sm ${lead.followUpDue ? "text-copper-400" : "text-bone-200"}`}>
          {lead.followUpDue ? "Follow-up was set for" : "Follow up on"} {lead.nextFollowUp}
        </p>
      )}

      {lead.contacts.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {lead.contacts.map((contact) => (
            <li key={contact.value} className="flex items-center gap-2 rounded-lg bg-forest-950/50 px-3 py-1.5 text-sm text-bone-50">
              {contact.callable ? (
                <a href={contact.kind === "phone" ? `tel:${contact.value}` : `mailto:${contact.value}`} className="hover:text-copper-400">{contact.value}</a>
              ) : (
                contact.value
              )}
              {!contact.callable && <Badge tone="problem">Locked, pending legal advice</Badge>}
            </li>
          ))}
        </ul>
      )}

      {quotes.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-l-2 border-border pl-3 text-sm text-bone-100">
          {quotes.map((item) => (
            <li key={`${item.claimType}-${item.quote}`}>
              &ldquo;{item.quote}&rdquo;{" "}
              {item.url.startsWith("http") ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-copper-400 underline underline-offset-4">source</a>
              ) : (
                <span className="whitespace-nowrap text-bone-200">from the owner form</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {lead.possibleDuplicates.length > 0 && (
        <div className="mt-4">
          <Callout>
            <p>Possible duplicate of: {lead.possibleDuplicates.map((match) => `${match.name} (${match.reason.toLowerCase()})`).join("; ")}. Check before approving. If it&apos;s really the same one, reject this lead.</p>
            <NotDuplicateForm id={lead.id} name={lead.name} />
          </Callout>
        </div>
      )}

      {lead.status === "researched" && <LeadDecisionForms id={lead.id} name={lead.name} />}
      {["interested", "meeting_scheduled", "negotiating"].includes(lead.status) && (
        <div className="mt-4"><StartOnboardingButton id={lead.id} /></div>
      )}

      {/* Closed options share a row, and an opened one takes the full width beneath them. */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 [&>details[open]]:order-last [&>details[open]]:w-full">
        {lead.status !== "researched" && (
          <details>
            <summary>Log a call</summary>
            <LogCallForm id={lead.id} name={lead.name} />
          </details>
        )}
        {lead.calls.length > 0 && (
          <details>
            <summary>Call history ({lead.calls.length})</summary>
            <ul className="mt-2 mb-2 grid gap-1 text-sm text-bone-200" aria-label={`Calls with ${lead.name}`}>
              {lead.calls.map((call, index) => (
                <li key={`${call.at}-${index}`}>
                  {call.at}: {outcomeLabel(call.outcome)}{call.notes ? `. ${call.notes}` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
        {lead.script && (
          <details>
            <summary>Opening script</summary>
            <p className="mt-2 mb-2 text-sm text-bone-100">{lead.script}</p>
          </details>
        )}
        <details>
          <summary>Details</summary>
          <div className="mt-2 mb-2 space-y-1 text-sm text-bone-200">
            <p>{words(lead.role)}, authority {words(lead.authority)}. Nothing here proves ownership until documents are checked at onboarding.</p>
            {lead.campaign && <p>Campaign: {words(lead.campaign)}</p>}
            {lead.evidence.length > 2 && (
              <ul className="space-y-1 pt-1 text-bone-100">
                {lead.evidence.slice(2).map((item) => <li key={`${item.claimType}-${item.quote}`}>&ldquo;{item.quote}&rdquo;</li>)}
              </ul>
            )}
          </div>
        </details>
        {lead.status === "follow_up" && (
          <details>
            <summary>Start onboarding</summary>
            <div className="mt-2 mb-2">
              <p className="mb-2 text-sm text-bone-200">Only once they&apos;ve expressed interest.</p>
              <StartOnboardingButton id={lead.id} />
            </div>
          </details>
        )}
        <details>
          <summary>Do Not Contact</summary>
          <DoNotContactForm id={lead.id} name={lead.name} />
        </details>
      </div>
    </Card>
  );
}

export function LeadsView({ leads }: { leads: LeadRow[] }) {
  return (
    <section aria-label="Leads">
      <PageHeader title="Leads" description="People and companies worth calling. Approve a lead to put it on the call list, then log each call." />
      {leads.length === 0 ? (
        <EmptyState title="No leads yet">They appear here when an owner submits the form, or when research finds a company.</EmptyState>
      ) : (
        <LeadFilter
          items={leads.map((lead) => ({
            key: lead.id,
            group: lead.followUpDue ? "due" : lead.status === "researched" ? "approval" : lead.status === "ready_to_call" ? "call" : "active",
            node: <LeadCard lead={lead} />,
          }))}
        />
      )}
    </section>
  );
}

export function ResearchView({ researchOn, researchMissing, domains }: { researchOn: boolean; researchMissing: string[]; domains: PendingDomain[] }) {
  return (
    <section aria-label="Research">
      <PageHeader
        title="Research"
        description="Searches the web before dawn, and reads only websites you've allowed. Private individuals are skipped until legal advice clears them."
        actions={<ResearchSwitchForm on={researchOn} />}
      />
      <div data-research={researchOn ? "on" : "off"} className="mb-8 grid gap-3 sm:grid-cols-2">
        <Stat label="Research" value={researchOn ? "On" : "Off"} tone={researchOn ? "good" : "neutral"} note={researchOn ? "Spending up to the daily cap" : "Nothing is searched or spent"} />
        <Stat label="Websites to review" value={domains.length} tone={domains.length > 0 ? "attention" : "neutral"} />
      </div>
      {researchOn && researchMissing.length > 0 && (
        <div className="mb-6"><Callout tone="problem">It can&apos;t run until these settings are added: {researchMissing.join(", ")}.</Callout></div>
      )}

      <SectionTitle hint="Read each site's terms first. Allow it only if they permit this kind of research and contact.">Websites to review</SectionTitle>
      {domains.length === 0 ? (
        <EmptyState title="Nothing to review">New websites that research finds will wait here.</EmptyState>
      ) : (
        <ul className="grid gap-4">
          {domains.map((domain) => (
            <li key={domain.id}>
              <Card data-domain={domain.domain}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-bone-50">{domain.domain}</p>
                  <Badge>{domain.pages} {domain.pages === 1 ? "page" : "pages"} waiting</Badge>
                </div>
                {domain.exampleTitle && <p className="mt-1 text-sm text-bone-200">{domain.exampleTitle}</p>}
                {domain.exampleUrl && (
                  <a href={domain.exampleUrl} target="_blank" rel="noopener noreferrer" className="mt-1 mb-3 block break-all text-sm text-copper-400 underline underline-offset-4">{domain.exampleUrl}</a>
                )}
                <DomainDecisionForm id={domain.id} domain={domain.domain} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function OptOutView({ count }: { count: number }) {
  return (
    <section aria-label="Do Not Contact">
      <PageHeader title="Do Not Contact" description="For anyone who opts out by phone, message or email, whether or not they're a lead. Act on a request within 14 days." />
      <div className="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)] md:items-start">
        <Stat label="On the list" value={count} note="Only scrambled values are kept, so the list can't be read back." />
        <Card><SuppressContactForm /></Card>
      </div>
    </section>
  );
}

function runState(run: RunSummary): { label: string; tone: Tone } {
  if (run.status === "failed") return { label: "Failed", tone: "problem" };
  if (run.status === "running") return { label: "Running", tone: "neutral" };
  return run.emailed ? { label: "Emailed", tone: "good" } : { label: "On this dashboard only", tone: "neutral" };
}

export function ReportsView({ reports, recipients, emailReady }: { reports: RunSummary[]; recipients: Recipient[]; emailReady: boolean }) {
  return (
    <section aria-label="Morning reports">
      <PageHeader title="Morning reports" description="A new report arrives every morning at about 06:00 EAT, whether or not your computer is on." />

      <Card className="mb-8">
        <SectionTitle hint={emailReady ? undefined : "Email isn't set up yet. Addresses saved here start getting the report once it is."}>Who gets it by email</SectionTitle>
        {recipients.length === 0 ? (
          <p className="mb-4 text-sm text-bone-200">Nobody yet, so reports only appear here.</p>
        ) : (
          <ul className="mb-4 divide-y divide-border">
            {recipients.map((recipient) => (
              <li key={recipient.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm text-bone-100">
                {recipient.email}
                <RemoveRecipientForm id={recipient.id} email={recipient.email} />
              </li>
            ))}
          </ul>
        )}
        <AddRecipientForm />
      </Card>

      {reports.length === 0 ? (
        <EmptyState title="No reports yet">The first one arrives on the next morning run.</EmptyState>
      ) : (
        <ul className="grid gap-3">
          {reports.map((run) => {
            const state = runState(run);
            return (
              <li key={run.id}>
                <Card data-report={run.runDate} className="py-3">
                  <details>
                    <summary>
                      <span className="text-bone-50">{run.runDate}</span>
                      <span className="ml-auto"><Badge tone={state.tone}>{state.label}</Badge></span>
                    </summary>
                    {run.status === "failed" && <p className="mt-3 text-sm text-terracotta">Failed: {run.error ?? "unknown error"}</p>}
                    {run.report ? (
                      <div className="mt-4">
                        {/* Sandboxed so nothing in a report can run or reach this page. */}
                        <iframe title={run.report.subject} sandbox="" srcDoc={run.report.html} className="mb-4 h-[32rem] w-full rounded-lg bg-bone-50" />
                        {emailReady && <SendReportForm runId={run.id} />}
                      </div>
                    ) : (
                      <p className="mt-3 mb-2 text-sm text-bone-200">This run stopped before its report was built.</p>
                    )}
                  </details>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
