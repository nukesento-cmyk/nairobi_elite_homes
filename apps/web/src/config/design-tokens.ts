// Mirrored in the @theme block of src/app/globals.css, because Tailwind 4 reads
// its theme from CSS. src/config/design-tokens.test.ts fails if the two drift.
export const colors = {
  forest: { 950: "#0E1A14", 900: "#1F3A2E", 800: "#2E4A3A" },
  midnight: { 950: "#0B0D14", 900: "#1A1F2E" },
  slate: { 950: "#14161A", 900: "#2A2D33", 800: "#2E3238" },
  bone: { 50: "#E8E2D4", 100: "#F2EAE0", 200: "#C4B8A0" },
  copper: { DEFAULT: "#B87333", 600: "#A5652B", 400: "#D08B4A" },
  terracotta: { DEFAULT: "#C56B4A" },
} as const;
