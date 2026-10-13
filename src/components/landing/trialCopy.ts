export function trialDurationLabel(days: number | null): string | null {
  if (!days || !Number.isFinite(days) || days <= 0) return null;
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

export function cardTrialCopy(days: number | null): string {
  const duration = trialDurationLabel(days);
  return duration
    ? `Após cadastrar o cartão, você testa a Zuno grátis por ${duration}.`
    : "Após cadastrar o cartão, você inicia o teste grátis. A duração será confirmada no checkout.";
}
