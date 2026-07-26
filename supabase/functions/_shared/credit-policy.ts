export interface CreditChargeResult {
  consumed: boolean;
  warning?: string;
}

export function createCreditConsumer(
  charge: () => Promise<{ ok: boolean; warning?: string }>,
) {
  let attempted = false;

  return {
    async consume(): Promise<CreditChargeResult> {
      if (attempted) return { consumed: false };
      attempted = true;
      const result = await charge();
      if (result.ok) return { consumed: true };
      return { consumed: false, warning: result.warning };
    },
  };
}
