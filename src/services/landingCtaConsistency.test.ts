import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const ctaFiles = [
  "src/components/landing/HeroSection.tsx",
  "src/components/landing/ProductProofSection.tsx",
  "src/components/landing/AntesDepoisSection.tsx",
  "src/components/landing/ComoFuncionaSection.tsx",
  "src/components/landing/ParaQuemSection.tsx",
  "src/components/landing/PrecosSection.tsx",
  "src/components/landing/CTAFinalSection.tsx",
  "src/components/landing/StickyCtaBar.tsx",
  "src/components/landing/LPHeader.tsx",
];

describe("landing CTA visual consistency", () => {
  it("uses a shared 48px CTA geometry token", () => {
    const styles = source("src/components/landing/ctaStyles.ts");
    expect(styles).toContain("h-12");
    expect(styles).toContain("min-h-12");
    expect(styles).toContain("rounded-lg");
    expect(styles).toContain("px-6");
    expect(styles).toContain("gap-2");
    expect(styles).toContain("font-bold");
  });

  it("keeps hero actions in one aligned responsive group", () => {
    const hero = source("src/components/landing/HeroSection.tsx");
    const styles = source("src/components/landing/ctaStyles.ts");
    expect(hero).toContain("LANDING_CTA_PAIR");
    expect(styles).toContain("sm:flex-row sm:items-center");
    expect(hero.match(/LANDING_CTA_BASE/g)?.length).toBeGreaterThanOrEqual(2);
    expect(hero.match(/LANDING_CTA_RESPONSIVE/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("pins all pricing CTAs to the same card baseline", () => {
    const pricing = source("src/components/landing/PrecosSection.tsx");
    const styles = source("src/components/landing/ctaStyles.ts");
    expect(pricing).toContain("flex h-full min-h-[540px] flex-col");
    expect(pricing).toContain("LANDING_PRICING_CTA_AREA");
    expect(styles).toContain("mt-auto");
    expect(pricing).toContain('"w-full transition-all duration-300"');
  });

  it("uses one arrow size and shared gap instead of manual margins", () => {
    const joined = ctaFiles.map(source).join("\n");
    expect(joined).not.toMatch(/ArrowRight className="ml-2/);
    expect(joined).toContain("LANDING_CTA_ICON");
    expect(source("src/components/landing/ctaStyles.ts")).toContain('"h-4 w-4 shrink-0"');
  });

  it("uses full-width primary section CTAs on mobile", () => {
    const files = [
      "src/components/landing/HeroSection.tsx",
      "src/components/landing/ProductProofSection.tsx",
      "src/components/landing/AntesDepoisSection.tsx",
      "src/components/landing/ComoFuncionaSection.tsx",
      "src/components/landing/ParaQuemSection.tsx",
      "src/components/landing/CTAFinalSection.tsx",
    ];
    for (const path of files) {
      expect(source(path)).toContain("LANDING_CTA_RESPONSIVE");
    }
    expect(source("src/components/landing/ctaStyles.ts")).toContain('"w-full sm:w-auto"');
    expect(source("src/components/landing/StickyCtaBar.tsx")).toContain("w-full");
  });

  it("uses the same 24px section-to-CTA spacing token where applicable", () => {
    const styles = source("src/components/landing/ctaStyles.ts");
    expect(styles).toContain('LANDING_SECTION_CTA_WRAP = "mt-6 flex justify-center"');
    expect(styles).toContain('LANDING_CTA_PAIR =\n  "mt-6');
    expect(source("src/components/landing/ProductProofSection.tsx")).toContain("mt-6");
    expect(source("src/components/landing/AntesDepoisSection.tsx")).toContain("LANDING_SECTION_CTA_WRAP");
    expect(source("src/components/landing/ComoFuncionaSection.tsx")).toContain("LANDING_SECTION_CTA_WRAP");
    expect(source("src/components/landing/ParaQuemSection.tsx")).toContain("LANDING_SECTION_CTA_WRAP");
  });

  it("does not leave legacy 56px CTA heights in real landing CTA blocks", () => {
    const joined = ctaFiles.map(source).join("\n");
    expect(joined).not.toMatch(/className="[^"]*h-14[^"]*(?:bg-\[#12D98B\]|border-\[#20312A\])/);
  });
});
