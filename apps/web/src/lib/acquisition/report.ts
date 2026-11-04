/** A real report's data. Contact details never appear here: they stay behind the dashboard sign-in. */
export type ReportLead = {
  score: number;
  prospect: string;
  category: string;
  property: string;
  classification: string;
  evidence: string;
  sourceUrl: string;
};

export type DailyReportInput = {
  runDate: string;
  /** While this is true the job does no research, and the report says so plainly. */
  isTest: boolean;
  startedAt: Date;
  realLeadCount: number;
  leads: ReportLead[];
  checks: { name: string; ok: boolean; detail: string }[];
  /** How today's research went, stage by stage. */
  funnel?: { label: string; count: number }[];
};

export type Report = { subject: string; html: string; text: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function longDate(runDate: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${runDate}T00:00:00Z`),
  );
}

function clock(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function buildDailyReport(input: DailyReportInput): Report {
  const date = longDate(input.runDate);
  const subject = `${input.isTest ? "[TEST, no real leads] " : ""}Daily Acquisition Report: ${date}`;
  const failed = input.checks.filter((check) => !check.ok);
  const summary = input.isTest
    ? "Research is switched off. This run proves the morning job and its delivery work. Real leads today: 0."
    : input.realLeadCount === 0
      ? "No leads qualified today. The figures below show why."
      : `${input.realLeadCount} ${input.realLeadCount === 1 ? "lead is" : "leads are"} awaiting approval on the dashboard, against a target of 20 to 30.`;
  const funnel = input.funnel ?? [];
  const leadsTitle = input.isTest ? "Sample leads, invented to show the format. Do not call." : "Top leads";

  const text = [
    subject,
    "",
    `Run started ${clock(input.startedAt)} EAT.`,
    summary,
    "",
    ...(funnel.length > 0 ? ["Today", ...funnel.map((row) => `${row.count}  ${row.label}`), ""] : []),
    leadsTitle,
    ...input.leads.map((lead) => `${lead.score}  ${lead.prospect} | ${lead.category} | ${lead.property} | ${lead.classification} | "${lead.evidence}" | ${lead.sourceUrl}`),
    "",
    "System checks",
    ...input.checks.map((check) => `${check.ok ? "OK    " : "FAILED"} ${check.name}: ${check.detail}`),
  ].join("\n");

  const cell = 'style="padding:8px;border:1px solid #d6d3cd;text-align:left;vertical-align:top"';
  const html = `<div style="font-family:Arial,sans-serif;color:#1c1b19;max-width:760px">
<h1 style="font-size:20px">${escapeHtml(subject)}</h1>
${input.isTest ? '<p style="padding:12px;background:#fff4d6;border:1px solid #e0b84c"><strong>Test run: no real leads.</strong> Everything in the leads table below is invented.</p>' : ""}
<p>Run started ${escapeHtml(clock(input.startedAt))} EAT. ${escapeHtml(summary)}</p>
${failed.length > 0 ? `<p style="color:#a11"><strong>${failed.length} system check${failed.length === 1 ? "" : "s"} failed.</strong></p>` : ""}
${funnel.length > 0 ? `<h2 style="font-size:16px">Today</h2><ul>${funnel.map((row) => `<li>${row.count}: ${escapeHtml(row.label)}</li>`).join("")}</ul>` : ""}
<h2 style="font-size:16px">${escapeHtml(leadsTitle)}</h2>
<table style="border-collapse:collapse;font-size:13px">
<tr><th ${cell}>Score</th><th ${cell}>Prospect</th><th ${cell}>Category and campaign</th><th ${cell}>Property</th><th ${cell}>Class and authority</th><th ${cell}>Evidence</th><th ${cell}>Source</th></tr>
${input.leads
  .map(
    (lead) =>
      `<tr><td ${cell}>${lead.score}</td><td ${cell}>${escapeHtml(lead.prospect)}</td><td ${cell}>${escapeHtml(lead.category)}</td><td ${cell}>${escapeHtml(lead.property)}</td><td ${cell}>${escapeHtml(lead.classification)}</td><td ${cell}>"${escapeHtml(lead.evidence)}"</td><td ${cell}>${escapeHtml(lead.sourceUrl)}</td></tr>`,
  )
  .join("\n")}
</table>
<h2 style="font-size:16px">System checks</h2>
<ul>
${input.checks.map((check) => `<li>${check.ok ? "OK" : "<strong>FAILED</strong>"}: ${escapeHtml(check.name)}. ${escapeHtml(check.detail)}</li>`).join("\n")}
</ul>
</div>`;

  return { subject, html, text };
}
