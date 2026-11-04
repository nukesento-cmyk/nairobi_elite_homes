import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RunSummary } from "@/lib/acquisition/dashboard";

import { logCallAction } from "@/app/admin/acquisition-actions";

import { LeadsView, OptOutView, ReportsView, ResearchView } from "./AcquisitionPanel";
import { AdminShell } from "./AdminShell";
import { AttentionList } from "./ui";

vi.mock("server-only", () => ({}));
vi.mock("@/app/admin/onboarding-actions", () => ({
  confirmStepAction: vi.fn(), failOnboardingAction: vi.fn(), issueLinkAction: vi.fn(), removeDocumentAction: vi.fn(),
  startOnboardingAction: vi.fn(), submitForApprovalAction: vi.fn(), uploadDocumentAction: vi.fn(), verifyDocumentAction: vi.fn(),
}));
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

const lead = { id: "l1", name: "Acme Ltd", category: "developer", campaign: "developers", status: "researched", score: 50, scoreBreakdown: {}, role: "unknown", authority: "unverified", script: "Hello", evidence: [], contacts: [], property: null, nextFollowUp: null, followUpDue: false, calls: [], possibleDuplicates: [] };

describe("morning reports", () => {
  it("shows each report in a sandbox, with how it went", () => {
    const { container } = render(
      <ReportsView
        recipients={[]}
        emailReady
        reports={[
          run({ emailed: true, deliveredAt: "x" }),
          run({ id: "r2", runDate: "2026-11-04" }),
          run({ id: "r3", runDate: "2026-11-03", status: "failed", error: "self_check: boom", report: null }),
        ]}
      />,
    );
    expect(within(container.querySelector('[data-report="2026-11-05"]')!).getByText("Emailed")).toBeTruthy();
    expect(within(container.querySelector('[data-report="2026-11-04"]')!).getByText("On this dashboard only")).toBeTruthy();
    expect(within(container.querySelector('[data-report="2026-11-03"]')!).getByText(/Failed: self_check: boom/)).toBeTruthy();
    expect(screen.getByText(/stopped before its report/)).toBeTruthy();
    const frame = container.querySelector("iframe")!;
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(frame.getAttribute("srcdoc")).toBe("<p>Body</p>");
  });

  it("offers sending only once email works, and says so when it doesn't", () => {
    const { rerender } = render(<ReportsView recipients={[]} emailReady={false} reports={[run({})]} />);
    expect(screen.getByText(/Email isn.t set up yet/)).toBeTruthy();
    expect(screen.queryByLabelText("Send this report to")).toBeNull();
    rerender(<ReportsView recipients={[{ id: "a", email: "team@example.com" }]} emailReady reports={[run({})]} />);
    expect(screen.getByLabelText("Send this report to")).toBeTruthy();
    expect(screen.getByLabelText("Remove team@example.com")).toBeTruthy();
  });

  it("says when there's nothing yet", () => {
    render(<ReportsView recipients={[]} emailReady={false} reports={[]} />);
    expect(screen.getByText("No reports yet")).toBeTruthy();
    expect(screen.getByText(/Nobody yet/)).toBeTruthy();
  });
});

describe("research", () => {
  it("shows the switch, and what's missing when it's on but can't run", () => {
    const { rerender } = render(<ResearchView researchOn={false} researchMissing={[]} domains={[]} />);
    expect(screen.getByRole("button", { name: "Switch research on" })).toBeTruthy();
    expect(screen.getByText("Off")).toBeTruthy();
    rerender(<ResearchView researchOn researchMissing={["ANTHROPIC_API_KEY"]} domains={[]} />);
    expect(screen.getByRole("button", { name: "Switch research off" })).toBeTruthy();
    expect(screen.getByText(/ANTHROPIC_API_KEY/)).toBeTruthy();
  });
});

describe("leads", () => {
  it("offers a call log only once approved, and always offers Do Not Contact", () => {
    const { rerender } = render(<LeadsView leads={[lead]} />);
    expect(screen.queryByText("Log a call")).toBeNull();
    expect(screen.getByText("Do Not Contact")).toBeTruthy();
    expect(screen.queryByLabelText("Acme Ltd is not a duplicate")).toBeNull();

    rerender(<LeadsView leads={[{ ...lead, possibleDuplicates: [{ name: "Acme Limited", reason: "Same name" }] }]} />);
    expect(screen.getByText(/Possible duplicate of: Acme Limited \(same name\)/)).toBeTruthy();
    expect(screen.getByLabelText("Acme Ltd is not a duplicate")).toBeTruthy();

    rerender(<LeadsView leads={[{ ...lead, status: "follow_up", nextFollowUp: "2026-11-05", followUpDue: true, calls: [{ outcome: "no_answer", notes: "Try later", at: "2026-11-04" }] }]} />);
    expect(screen.getByText("Log a call")).toBeTruthy();
    expect(screen.getAllByText(/Follow-up due/).length).toBeGreaterThan(0);
    expect(screen.getByText("2026-11-04: No answer. Try later")).toBeTruthy();
  });

  it("filters without losing what's been typed, hiding only the others", () => {
    render(<LeadsView leads={[lead, { ...lead, id: "l2", name: "Beta Ltd", status: "ready_to_call" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Ready to call (1)" }));
    const cards = document.querySelectorAll("[data-lead]");
    expect(cards).toHaveLength(2);
    expect(cards[0].closest("li")!.hidden).toBe(true);
    expect(cards[1].closest("li")!.hidden).toBe(false);
  });

  it("says when there's nothing yet", () => {
    render(<LeadsView leads={[]} />);
    expect(screen.getByText("No leads yet")).toBeTruthy();
  });
});

describe("forms", () => {
  it("keeps what was typed when a save is refused, and clears it once a save succeeds", async () => {
    const save = vi.mocked(logCallAction);
    save.mockResolvedValueOnce({ error: "Tell them they can opt out." });
    const { container } = render(<LeadsView leads={[{ ...lead, status: "ready_to_call" }]} />);
    const form = container.querySelector<HTMLFormElement>('form[aria-label="Log a call with Acme Ltd"]')!;
    const notes = form.querySelector("textarea")!;
    fireEvent.change(notes, { target: { value: "They want a callback." } });
    fireEvent.change(form.querySelector("select")!, { target: { value: "answered" } });

    await act(async () => { fireEvent.submit(form); });
    expect(await screen.findByText("Tell them they can opt out.")).toBeTruthy();
    expect(notes.value).toBe("They want a callback.");
    expect(form.querySelector("select")!.value).toBe("answered");

    save.mockResolvedValueOnce({ message: "Logged." });
    await act(async () => { fireEvent.submit(form); });
    expect(await screen.findByText("Logged.")).toBeTruthy();
    expect(notes.value).toBe("");
  });
});

describe("do not contact", () => {
  it("shows how many are on the list", () => {
    render(<OptOutView count={2} />);
    expect(screen.getByText("2")).toBeTruthy();
  });
});

describe("what needs attention", () => {
  it("links to where each thing gets done, and reads as good news when clear", () => {
    const { rerender } = render(<AttentionList items={[{ href: "#leads", label: "Follow-ups due", count: 2 }, { href: "#research", label: "Websites", count: 0 }]} />);
    expect(screen.getByRole("link", { name: /Follow-ups due/ }).getAttribute("href")).toBe("#leads");
    expect(screen.queryByText("Websites")).toBeNull();
    rerender(<AttentionList items={[{ href: "#leads", label: "Follow-ups due", count: 0 }]} />);
    expect(screen.getByText(/All clear/)).toBeTruthy();
  });
});

describe("the dashboard shell", () => {
  const groups = [{ label: "Work", items: [
    { id: "one", label: "One", content: <p>First section</p> },
    { id: "two", label: "Two", count: 3, urgent: true, content: <input aria-label="Draft" defaultValue="half typed" /> },
  ] }];
  afterEach(() => { window.location.hash = ""; });

  it("shows the first section by default, marks it, and keeps the others mounted", () => {
    const { container } = render(<AdminShell title="T" person={null} footer={null} groups={groups} />);
    expect(container.querySelector("#one")!.hasAttribute("hidden")).toBe(false);
    expect(container.querySelector("#two")!.hasAttribute("hidden")).toBe(true);
    expect(container.querySelector("#two input")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "One", hidden: true })[0].getAttribute("aria-current")).toBe("page");
  });

  it("follows the address, and ignores a section that doesn't exist", async () => {
    window.scrollTo = vi.fn();
    const { container } = render(<AdminShell title="T" person={null} footer={null} groups={groups} />);
    act(() => { window.location.hash = "two"; window.dispatchEvent(new HashChangeEvent("hashchange")); });
    expect(container.querySelector("#two")!.hasAttribute("hidden")).toBe(false);
    expect(container.querySelector("#one")!.hasAttribute("hidden")).toBe(true);
    act(() => { window.location.hash = "nope"; window.dispatchEvent(new HashChangeEvent("hashchange")); });
    expect(container.querySelector("#one")!.hasAttribute("hidden")).toBe(false);
  });
});
