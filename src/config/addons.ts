export type AddonId = "us_prospecting";

export type AddonConfig = {
  id: AddonId;
  name: string;
  description: string;
  monthlyPrice: number;
  monthlyUnitAmount: number;
  requiredPaidPlan: boolean;
  unlockedCountries: string[];
};

export const ADDONS: Record<AddonId, AddonConfig> = {
  us_prospecting: {
    id: "us_prospecting",
    name: "Prospecção nos Estados Unidos",
    description: "Adicione prospecção em todos os estados dos EUA ao seu plano ativo.",
    monthlyPrice: 57,
    monthlyUnitAmount: 5700,
    requiredPaidPlan: true,
    unlockedCountries: ["US"],
  },
} as const;

export function normalizeAddonId(value: unknown): AddonId | null {
  const addonId = String(value || "").trim().toLowerCase();
  return addonId === "us_prospecting" ? addonId : null;
}
