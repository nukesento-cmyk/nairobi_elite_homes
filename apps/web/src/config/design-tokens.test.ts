import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { colors } from "./design-tokens";

const srcDir = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(join(srcDir, dir), { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .map((file) => join(srcDir, dir, file));
}

describe("design tokens", () => {
  const css = readFileSync(join(srcDir, "app/globals.css"), "utf8").toLowerCase();

  it.each(
    Object.entries(colors).flatMap(([family, shades]) =>
      Object.entries(shades).map(([shade, hex]) => [
        shade === "DEFAULT" ? `--color-${family}` : `--color-${family}-${shade}`,
        hex,
      ]),
    ),
  )("globals.css defines %s as %s", (variable, hex) => {
    expect(css).toContain(`${variable}: ${hex.toLowerCase()};`);
  });
});

describe("source guards", () => {
  const uiFiles = [...sourceFiles("components"), ...sourceFiles("app")];

  it.each(uiFiles)("%s has no ad-hoc hex colors", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  // Fixed third-party protocol addresses, not links marketing would ever change.
  const urlExempt = ["lib/turnstile.ts", "lib/json-ld.ts", "lib/embeds.ts", "lib/cms/sample-documents.ts", "lib/acquisition/sample-leads.ts", "lib/auth/google.ts", "lib/whatsapp-groups.ts", "lib/brand-site.ts"];
  const linkFiles = [...uiFiles, ...sourceFiles("lib"), ...sourceFiles("config")].filter(
    (file) => !urlExempt.some((exempt) => file.endsWith(exempt)),
  );

  it.each(linkFiles)(
    "%s has no hardcoded URLs",
    (file) => {
      expect(readFileSync(file, "utf8")).not.toMatch(/https?:\/\//);
    },
  );
});
