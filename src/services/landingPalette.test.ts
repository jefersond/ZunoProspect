import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const landingPaletteFiles = [
  "src/pages/LandingProspeccaoIA.tsx",
  "src/components/landing/HeroSection.tsx",
  "src/components/landing/ProductProofSection.tsx",
  "src/components/landing/SocialProofSection.tsx",
  "src/components/landing/AntesDepoisSection.tsx",
  "src/components/landing/ComoFuncionaSection.tsx",
  "src/components/landing/ParaQuemSection.tsx",
  "src/components/landing/PrecosSection.tsx",
  "src/components/landing/FAQSection.tsx",
  "src/components/landing/CTAFinalSection.tsx",
  "src/components/landing/StickyCtaBar.tsx",
  "src/components/landing/LPHeader.tsx",
  "src/components/landing/Footer.tsx",
  "src/components/landing/mockups/MockupHeroProspeccao.tsx",
  "src/components/landing/UsaAddonDialog.tsx",
  "src/components/landing/LandingPageSkeleton.tsx",
];

describe("official Zuno landing palette", () => {
  it("removes the legacy landing colors", () => {
    const joined = landingPaletteFiles.map(source).join("\n");
    for (const legacy of [
      "#0b0f0e",
      "#111816",
      "#091a12",
      "#1f2d29",
      "#10d98a",
      "#f4f4f5",
      "#9ca3af",
      "#6b7280",
      "#d1d5db",
    ]) {
      expect(joined.toLowerCase()).not.toContain(legacy);
    }
  });

  it("uses the official brand, text and border colors", () => {
    const joined = landingPaletteFiles.map(source).join("\n");
    for (const token of [
      "#07100D",
      "#0D1713",
      "#111D18",
      "#12D98B",
      "#21E6A0",
      "#0B8F60",
      "#F3F7F5",
      "#A9B8B1",
      "#6F8179",
      "#20312A",
      "#E55757",
    ]) {
      expect(joined).toContain(token);
    }
  });

  it("keeps the pricing add-on inside the Zuno palette instead of blue or emerald accents", () => {
    const joined = [
      source("src/components/landing/PrecosSection.tsx"),
      source("src/components/landing/UsaAddonDialog.tsx"),
    ].join("\n");

    expect(joined).not.toMatch(/(?:blue|emerald)-(?:50|100|200|300|400|500|600|700|800|900)/);
  });
});
