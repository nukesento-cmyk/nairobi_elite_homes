import { describe, expect, it } from "vitest";

import { matterportEmbedUrl, splineEmbedUrl } from "./embeds";

describe("splineEmbedUrl", () => {
  it("accepts a public Spline scene", () => {
    expect(splineEmbedUrl("https://my.spline.design/plot-abc123/")).toBe(
      "https://my.spline.design/plot-abc123/",
    );
  });

  it.each([
    null,
    undefined,
    "",
    "not a url",
    "javascript:alert(1)",
    "http://my.spline.design/plot/",
    "https://my.spline.design/",
    "https://my.spline.design.evil.example/plot/",
    "https://evil.example/my.spline.design/plot/",
  ])("rejects %s", (value) => {
    expect(splineEmbedUrl(value)).toBeNull();
  });
});

describe("matterportEmbedUrl", () => {
  it("builds the embed link from an ID", () => {
    expect(matterportEmbedUrl("SxQL3iGyoDo")).toBe(
      "https://my.matterport.com/show/?m=SxQL3iGyoDo&play=1",
    );
  });

  it.each([null, undefined, "", "abc", 'x"><script>', "SxQL3iGyoDo&play=0", "../../evil"])(
    "rejects %s",
    (value) => {
      expect(matterportEmbedUrl(value)).toBeNull();
    },
  );
});
