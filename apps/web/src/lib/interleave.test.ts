import { describe, expect, it } from "vitest";

import { interleave } from "./interleave";

const kinds = (count: number, every: number) =>
  interleave(Array.from({ length: count }, (_, i) => i), every)
    .map((entry) => (entry.kind === "item" ? "i" : "B"))
    .join("");

describe("interleave", () => {
  it("adds a break after every N items", () => {
    expect(kinds(7, 3)).toBe("iiiBiiiBi");
  });

  it("never ends on a break", () => {
    expect(kinds(6, 3)).toBe("iiiBiii");
  });

  it("adds no break when there are too few items", () => {
    expect(kinds(2, 3)).toBe("ii");
    expect(kinds(0, 3)).toBe("");
  });

  it("gives each break a unique index", () => {
    const breaks = interleave([1, 2, 3, 4, 5], 2).flatMap((entry) =>
      entry.kind === "break" ? [entry.index] : [],
    );
    expect(breaks).toEqual([1, 2]);
  });
});
