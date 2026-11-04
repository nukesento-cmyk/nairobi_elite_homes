import type { Recipient, RunSummary } from "@/lib/acquisition/dashboard";

import { AddRecipientForm, RemoveRecipientForm, SendReportForm } from "./AcquisitionForms";

function outcome(run: RunSummary): string {
  if (run.status === "failed") return `Failed: ${run.error ?? "unknown error"}`;
  if (run.status === "running") return "Running";
  return run.emailed ? "Emailed" : "On this dashboard only";
}

export function AcquisitionPanel({
  reports,
  recipients,
  emailReady,
}: {
  reports: RunSummary[];
  recipients: Recipient[];
  emailReady: boolean;
}) {
  return (
    <section id="acquisition" className="mb-14 scroll-mt-6" aria-labelledby="acquisition-heading">
      <h2 id="acquisition-heading" className="mb-2 text-2xl text-bone-50">Acquisition reports</h2>
      <p className="mb-6 text-sm text-bone-200">
        A new report arrives every morning. Research isn&apos;t switched on yet, so reports are labelled as tests and hold no real leads.
      </p>

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
