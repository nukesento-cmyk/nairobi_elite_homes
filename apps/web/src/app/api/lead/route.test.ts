import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { POST } from "./route";

const validLead = {
  name: "Wanjiku Test",
  phone: "+254 700 000000",
  email: "wanjiku@example.com",
  intent: "buy",
  areas: ["Karen"],
  source: "listing_detail",
};

let ipCounter = 0;
function post(body: unknown, ip = `10.0.0.${++ipCounter}`) {
  return POST(
    new Request("http://localhost/api/lead", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

function configureProduction() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
  vi.stubEnv("RESEND_API_KEY", "key");
  vi.stubEnv("LEAD_EMAIL_TO", "sales@example.com");
  vi.stubEnv("LEAD_EMAIL_FROM", "site@example.com");
}

function mockTurnstile(success: boolean) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success })));
}

beforeEach(() => {
  send.mockReset().mockResolvedValue({ data: { id: "1" }, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/lead", () => {
  it("emails a valid lead", async () => {
    configureProduction();
    mockTurnstile(true);
    const response = await post({ ...validLead, turnstileToken: "token" });

    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledOnce();
    const email = send.mock.calls[0][0];
    expect(email.to).toBe("sales@example.com");
    expect(email.replyTo).toBe("wanjiku@example.com");
    expect(email.text).toContain("+254 700 000000");
  });

  it.each([
    ["a bad phone", { phone: "call me" }, "phone"],
    ["a bad email", { email: "nope" }, "email"],
    ["a short name", { name: "x" }, "name"],
    ["an unknown intent", { intent: "steal" }, "intent"],
    ["an unknown area", { areas: ["Mars"] }, "areas"],
  ])("rejects %s", async (_name, override, field) => {
    const response = await post({ ...validLead, ...override });
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toHaveProperty(field);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects a body that isn't JSON", async () => {
    expect((await post("not json")).status).toBe(400);
  });

  it("pretends to accept honeypot submissions but sends nothing", async () => {
    configureProduction();
    const response = await post({ ...validLead, company: "Bot Ltd" });
    expect(response.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects a failed security check", async () => {
    configureProduction();
    mockTurnstile(false);
    expect((await post({ ...validLead, turnstileToken: "bad" })).status).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects a missing security token without asking Cloudflare", async () => {
    configureProduction();
    mockTurnstile(true);
    expect((await post(validLead)).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails visibly in production when not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await post(validLead)).status).toBe(503);
  });

  it("reports an email failure instead of claiming success", async () => {
    configureProduction();
    mockTurnstile(true);
    send.mockResolvedValue({ data: null, error: { name: "application_error" } });
    expect((await post({ ...validLead, turnstileToken: "token" })).status).toBe(502);
  });

  it("never logs contact details when email isn't configured in development", async () => {
    const response = await post(validLead);
    expect(response.status).toBe(200);
    const logged = JSON.stringify(vi.mocked(console.info).mock.calls);
    expect(logged).not.toContain("700");
    expect(logged).not.toContain("wanjiku");
  });

  it("rate-limits repeat submissions from one address", async () => {
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await post(validLead, "10.9.9.9")).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });
});
