// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { isGoogleConfigured } from "./google";

describe("muting Google sign-in", () => {
  afterEach(() => vi.unstubAllEnvs());

  const withKeys = () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
  };

  it("is on when the keys are set and nothing mutes it", () => {
    withKeys();
    vi.stubEnv("GOOGLE_SIGN_IN_OFF", "");
    expect(isGoogleConfigured()).toBe(true);
  });

  it("is off when muted, with the keys still set", () => {
    withKeys();
    vi.stubEnv("GOOGLE_SIGN_IN_OFF", "true");
    expect(isGoogleConfigured()).toBe(false);
  });

  it("is off without the keys", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    vi.stubEnv("GOOGLE_SIGN_IN_OFF", "");
    expect(isGoogleConfigured()).toBe(false);
  });
});
