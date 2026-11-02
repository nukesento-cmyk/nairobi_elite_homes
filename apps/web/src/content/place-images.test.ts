import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import imageLoader from "@/lib/image-loader";

import { communities } from "./communities";
import { placeImages } from "./place-images";

describe("place photos", () => {
  it("covers every area", () => {
    for (const { slug } of communities) expect(placeImages[slug], slug).toBeTruthy();
  });

  it.each(Object.entries(placeImages))("%s has both files and full credit", (_, image) => {
    expect(existsSync(`public${image.src}`)).toBe(true);
    expect(existsSync(`public${image.src.replace(".webp", "-800.webp")}`)).toBe(true);
    expect(image.alt.length).toBeGreaterThan(10);
    expect(image.caption).toBeTruthy();
    expect(image.author).toBeTruthy();
    expect(image.licence).toMatch(/^CC/);
    expect(image.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
  });

  it("gives phones the smaller file", () => {
    expect(imageLoader({ src: "/images/places/karen.webp", width: 750 })).toBe("/images/places/karen-800.webp?w=750");
    expect(imageLoader({ src: "/images/places/karen.webp", width: 1920 })).toBe("/images/places/karen.webp?w=1920");
  });
});
