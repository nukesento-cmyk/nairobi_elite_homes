import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { blogPosts } from "../../db/seed/blog-posts.mjs";

import { BlogBody, extractFaqs, parseBlocks } from "./blog-markup";

afterEach(cleanup);

describe("blog markup", () => {
  it("renders headings, lists, bold and links", () => {
    const { container } = render(<BlogBody body={"Intro.\n\n## Heading\n\n### Sub\n\n- **One** item\n- Two [here](/homes)\n\n[out](https://example.com/a)"} />);
    expect(screen.getByRole("heading", { level: 2, name: "Heading" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Sub" })).toBeTruthy();
    expect(container.querySelectorAll("li").length).toBe(2);
    expect(container.querySelector("strong")?.textContent).toBe("One");
    expect(screen.getByRole("link", { name: "here" }).getAttribute("href")).toBe("/homes");
    const out = screen.getByRole("link", { name: "out" });
    expect(out.getAttribute("rel")).toContain("noopener");
  });

  it("never turns text into code or unsafe links", () => {
    const { container } = render(<BlogBody body={"<script>alert(1)</script> [bad](javascript:alert(1)) [odd](//evil.example)"} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("<script>");
  });

  it("collects only FAQ questions with answers, in plain text", () => {
    const faqs = extractFaqs("## Other\n\n### Not this\n\nNo.\n\n## Frequently asked questions\n\n### Yes?\n\nSee [this](/x) **now**.\n\n### Empty?\n\n## Sources\n\n### Nor this\n\nNo.");
    expect(faqs).toEqual([{ question: "Yes?", answer: "See this now." }]);
  });
});

describe("the starter posts", () => {
  it.each(blogPosts.map((post) => [post.slug, post] as const))("%s is complete", (_, post) => {
    expect(post.title.length).toBeLessThanOrEqual(110);
    expect(post.excerpt.length).toBeGreaterThanOrEqual(50);
    expect(post.excerpt.length).toBeLessThanOrEqual(220);
    const blocks = parseBlocks(post.body);
    expect(blocks[0].kind).toBe("p");
    expect(extractFaqs(post.body).length).toBeGreaterThanOrEqual(3);
    expect(post.coverUrl.startsWith("https://")).toBe(true);
    expect(post.coverAlt).toBeTruthy();
  });

  it("only link to pages that exist", () => {
    const slugs = new Set(blogPosts.map(({ slug }) => slug));
    const pages = new Set(["/homes", "/land", "/join", "/areas", "/contact", "/blog"]);
    const areas = ["karen", "runda", "kilimani", "rosslyn", "lavington", "muthaiga"];
    for (const { body } of blogPosts) {
      for (const [, href] of body.matchAll(/\]\((\/[^)]*)\)/g)) {
        const ok = pages.has(href) || areas.some((a) => href === `/communities/${a}`) || slugs.has(href.replace("/blog/", ""));
        expect(ok, href).toBe(true);
      }
    }
  });
});
