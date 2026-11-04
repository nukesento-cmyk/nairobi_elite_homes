import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RunSummary } from "@/lib/acquisition/dashboard";

import { AcquisitionPanel } from "./AcquisitionPanel";

vi.mock("server-only", () => ({}));
vi.mock("@/app/admin/acquisition-actions", () => ({
  setResearchAction: vi.fn(),
  logCallAction: vi.fn(),
  clearDuplicatesAction: vi.fn(),
  markDoNotContactAction: vi.fn(),
  suppressContactAction: vi.fn(),
  decideDomainAction: vi.fn(),
  approveLeadAction: vi.fn(),
  rejectLeadAction: vi.fn(),
  addRecipientAction: vi.fn(),
  removeRecipientAction: vi.fn(),
  sendReportAction: vi.fn(),
}));

const report = { subject: "[TEST, no real leads] Report", html: "<p>Body</p>", text: "Body" };
const run = (over: Partial<RunSummary>): RunSummary => ({
  id: "r1", runDate: "2026-11-05", status: "completed", attempts: 1, startedBy: "cron", deliveredAt: null, error: null, emailed: false, report, ...over,
});

afterEach(cleanup);

describe("AcquisitionPanel", () => {
  it("shows each report in a sandbox, with how it went", () => {
    const { container } = render(
      <AcquisitionPanel
        researchOn={false} researchMissing={[]}
        domains={[]}
        leads={[]} doNotContactCount={0}
        recipients={[]}
        emailReady
        reports={[
          run({ emailed: true, deliveredAt: "x" }),
          run({ id: "r2", runDate: "2026-11-04" }),
          run({ id: "r3", runDate: "2026-11-03", status: "failed", error: "self_check: boom", report: null }),
        ]}
      />,
    );
    expect(within(container.querySelector('[data-report="2026-11-05"]')!).getByText(/Emailed/)).toBeTruthy();
    expect(within(container.querySelector('[data-report="2026-11-04"]')!).getByText(/On this dashboard only/)).toBeTruthy();
    expect(within(container.querySelector('[data-report="2026-11-03"]')!).getByText(/Failed: self_check: boom/)).toBeTruthy();
    expect(screen.getByText(/stopped before its report/)).toBeTruthy();
    const frame = container.querySelector("iframe")!;
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(frame.getAttribute("srcdoc")).toBe("<p>Body</p>");
  });

  it("offers sending only once email works, and says so when it doesn't", () => {
    const { rerender } = render(<AcquisitionPanel researchOn={false} researchMissing={[]} domains={[]} leads={[]} doNotContactCount={0} recipients={[]} emailReady={false} reports={[run({})]} />);
    expect(screen.getByText(/Email isn.t set up yet/)).toBeTruthy();
    expect(screen.queryByLabelText("Send this report to")).toBeNull();
    rerender(<AcquisitionPanel researchOn={false} researchMissing={[]} domains={[]} leads={[]} doNotContactCount={0} recipients={[{ id: "a", email: "team@example.com" }]} emailReady reports={[run({})]} />);
    expect(screen.getByLabelText("Send this report to")).toBeTruthy();
    expect(screen.getByLabelText("Remove team@example.com")).toBeTruthy();
  });

  it("shows the switch, and what's missing when it's on but can't run", () => {
    const { rerender } = render(<AcquisitionPanel researchOn={false} researchMissing={[]} domains={[]} leads={[]} doNotContactCount={0} recipients={[]} emailReady={false} reports={[]} />);
    expect(screen.getByRole("heading", { name: "Research is off" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Switch research on" })).toBeTruthy();
    rerender(<AcquisitionPanel researchOn researchMissing={["ANTHROPIC_API_KEY"]} domains={[]} leads={[]} doNotContactCount={0} recipients={[]} emailReady={false} reports={[]} />);
    expect(screen.getByRole("heading", { name: "Research is on" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Switch research off" })).toBeTruthy();
    expect(screen.getByText(/ANTHROPIC_API_KEY/)).toBeTruthy();
  });

  it("offers a call log only once approved, and always offers Do Not Contact", () => {
    const lead = { id: "l1", name: "Acme Ltd", category: "developer", campaign: "developers", status: "researched", score: 50, scoreBreakdown: {}, role: "unknown", authority: "unverified", script: "Hello", evidence: [], contacts: [], property: null, nextFollowUp: null, followUpDue: false, calls: [], possibleDuplicates: [] };
    const props = { researchOn: false, researchMissing: [], domains: [], recipients: [], emailReady: false, reports: [], doNotContactCount: 2 };
    const { rerender } = render(<AcquisitionPanel {...props} leads={[lead]} />);
    expect(screen.queryByText("Log a call")).toBeNull();
    expect(screen.getByText("Do Not Contact")).toBeTruthy();
    expect(screen.getByText("Do Not Contact list (2)")).toBeTruthy();
    expect(screen.queryByLabelText("Acme Ltd is not a duplicate")).toBeNull();

    rerender(<AcquisitionPanel {...props} leads={[{ ...lead, possibleDuplicates: [{ name: "Acme Limited", reason: "Same name" }] }]} />);
    expect(screen.getByText(/Possible duplicate of: Acme Limited \(same name\)/)).toBeTruthy();
    expect(screen.getByLabelText("Acme Ltd is not a duplicate")).toBeTruthy();

    rerender(<AcquisitionPanel {...props} leads={[{ ...lead, status: "follow_up", nextFollowUp: "2026-11-05", followUpDue: true, calls: [{ outcome: "no_answer", notes: "Try later", at: "2026-11-04" }] }]} />);
    expect(screen.getByText("Log a call")).toBeTruthy();
    expect(screen.getByText("Follow-up due: 2026-11-05")).toBeTruthy();
    expect(screen.getByText("2026-11-04: No answer. Try later")).toBeTruthy();
  });

  it("says when there's nothing yet", () => {
    render(<AcquisitionPanel researchOn={false} researchMissing={[]} domains={[]} leads={[]} doNotContactCount={0} recipients={[]} emailReady={false} reports={[]} />);
    expect(screen.getByText(/No reports yet/)).toBeTruthy();
    expect(screen.getByText(/Nobody yet/)).toBeTruthy();
  });
});
