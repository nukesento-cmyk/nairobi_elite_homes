import { describe, expect, it } from "vitest";

import { bareHost, googleRedirectOrigin, isMainHost, parseBase, relayHost, relayState, siteBase, slugFromBase } from "./brand-site";

const MAIN = "https://main.example";

describe("telling the main site from a brand's domain", () => {
  it.each(["main.example", "www.main.example", "MAIN.example:443", "localhost:3000", "127.0.0.1", "x-y.vercel.app"])("treats %s as the main site", (host) => {
    expect(isMainHost(host, MAIN)).toBe(true);
  });

  it.each(["acme.example", "main.example.evil.test", "vercel.app.evil.test"])("treats %s as a brand", (host) => {
    expect(isMainHost(host, MAIN)).toBe(false);
  });

  it("strips the port and www", () => {
    expect(bareHost("WWW.Acme.example:8080")).toBe("acme.example");
  });
});

describe("brand addresses", () => {
  it("links without a prefix on a domain, and under /b/ otherwise", () => {
    expect(siteBase("acme.example")).toBe("");
    expect(siteBase("acme")).toBe("/b/acme");
    expect(slugFromBase("/b/acme")).toBe("acme");
    expect(slugFromBase("")).toBeNull();
  });

  it.each(["//evil.test", "https://evil.test", "/b/../admin", "/b/a/b", "/admin", null, 5])("refuses %s as somewhere to redirect", (value) => {
    expect(parseBase(value)).toBe("");
  });

  it("accepts a brand's address", () => {
    expect(parseBase("/b/acme-homes")).toBe("/b/acme-homes");
  });
});

describe("Google sign-in from a brand's domain", () => {
  it("always returns to the main domain, except in local development", () => {
    expect(googleRedirectOrigin("https://acme.example", MAIN)).toBe(MAIN);
    expect(googleRedirectOrigin(MAIN, MAIN)).toBe(MAIN);
    expect(googleRedirectOrigin("http://localhost:3000", MAIN)).toBe("http://localhost:3000");
    expect(googleRedirectOrigin("https://x.vercel.app", undefined)).toBe("https://x.vercel.app");
  });

  it("passes the answer on only when it arrived somewhere else", () => {
    const state = relayState("abc", "www.acme.example");
    expect(relayHost(state, "main.example")).toBe("www.acme.example");
    expect(relayHost(state, "www.acme.example")).toBeNull();
    expect(relayHost("abc", "main.example")).toBeNull();
    expect(relayHost(null, "main.example")).toBeNull();
    expect(relayHost("~abc", "main.example")).toBeNull();
  });
});
