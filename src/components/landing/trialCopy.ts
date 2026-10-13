export function trialDurationLabel(days: number | null): string | null {
  if (!days || !Number.isFinite(days) || days <= 0) return null;
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

export function cardTrialCopy(days: number | null): string {
  const duration = trialDurationLabel(days);
  return duration
    ? `Cartão necessário para ativar o teste grátis de ${duration}.`
    : "Cartão necessário para ativar o teste grátis. A duração será confirmada no checkout.";
}
