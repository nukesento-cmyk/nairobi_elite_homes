import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RunSummary } from "@/lib/acquisition/dashboard";

import { AcquisitionPanel } from "./AcquisitionPanel";

vi.mock("server-only", () => ({}));
vi.mock("@/app/admin/acquisition-actions", () => ({
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
    const { rerender } = render(<AcquisitionPanel recipients={[]} emailReady={false} reports={[run({})]} />);
    expect(screen.getByText(/Email isn.t set up yet/)).toBeTruthy();
    expect(screen.queryByLabelText("Send this report to")).toBeNull();
    rerender(<AcquisitionPanel recipients={[{ id: "a", email: "team@example.com" }]} emailReady reports={[run({})]} />);
    expect(screen.getByLabelText("Send this report to")).toBeTruthy();
    expect(screen.getByLabelText("Remove team@example.com")).toBeTruthy();
  });

  it("says when there's nothing yet", () => {
    render(<AcquisitionPanel recipients={[]} emailReady={false} reports={[]} />);
    expect(screen.getByText(/No reports yet/)).toBeTruthy();
    expect(screen.getByText(/Nobody yet/)).toBeTruthy();
  });
});
