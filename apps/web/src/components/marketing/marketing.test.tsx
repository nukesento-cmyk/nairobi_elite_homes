import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setAnalyticsProvider } from "@/lib/analytics";

import { JoinLink } from "./JoinLink";
import { StripDismissButton } from "./StripDismissButton";

afterEach(() => {
  cleanup();
  setAnalyticsProvider(null);
  sessionStorage.clear();
  delete document.documentElement.dataset.stripDismissed;
});

describe("JoinLink", () => {
  it("links out with its source and fires join_click", () => {
    const provider = vi.fn();
    setAnalyticsProvider(provider);
    render(
      <JoinLink source="footer" placement="global">
        Join
      </JoinLink>,
    );

    const link = screen.getByRole<HTMLAnchorElement>("link", { name: "Join" });
    expect(new URL(link.href).searchParams.get("utm_source")).toBe("footer");
    expect(link.rel).toContain("noopener");

    fireEvent.click(link);
    expect(provider).toHaveBeenCalledWith("join_click", { source: "footer", placement: "global" });
  });
});

describe("StripDismissButton", () => {
  it("hides the strip and remembers it for the session", () => {
    render(<StripDismissButton />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss announcement" }));

    expect(document.documentElement.dataset.stripDismissed).toBe("true");
    expect(sessionStorage.length).toBe(1);
  });
});
