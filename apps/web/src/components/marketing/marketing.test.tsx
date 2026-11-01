import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MatterportTour } from "@/components/property/MatterportTour";
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

describe("MatterportTour", () => {
  it("loads nothing until clicked, then fires tour_opened", () => {
    const provider = vi.fn();
    setAnalyticsProvider(provider);
    const { container } = render(
      <MatterportTour
        embedUrl="https://my.matterport.com/show/?m=abc123&play=1"
        listingId="listing-1"
        listingTitle="A home"
        poster={null}
      />,
    );
    expect(container.querySelector("iframe")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Enter 3D tour" }));

    expect(screen.getByTitle("3D tour of A home")).toBeTruthy();
    expect(provider).toHaveBeenCalledWith("tour_opened", { listingId: "listing-1" });
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
