export const LANDING_CTA_BASE =
  "h-auto min-h-12 rounded-lg px-6 py-3 text-center leading-tight whitespace-normal font-bold inline-flex items-center justify-center gap-2 transition-all duration-300 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";

export const LANDING_CTA_RESPONSIVE = "w-full sm:w-auto";

export const LANDING_CTA_ICON = "h-4 w-4 shrink-0";

export const getTrialCtaLabel = (trialDurationDays: number | null) =>
  trialDurationDays ? `Começar meu teste de ${trialDurationDays} dias` : "Começar meu teste";

export const LANDING_CTA_PAIR =
  "mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center";

export const LANDING_SECTION_CTA_WRAP = "mt-6 flex justify-center";

export const LANDING_PRICING_CTA_AREA = "mt-auto flex flex-col gap-2 pt-6";
