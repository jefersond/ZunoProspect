import { describe, expect, it } from "vitest";
import { FAQ_ITEMS } from "./data";
import { cardTrialCopy, trialDurationLabel } from "./trialCopy";

describe("landing trial copy", () => {
  it("uses the current offer duration in card notices", () => {
    expect(cardTrialCopy(4)).toBe("Após cadastrar o cartão, você testa a Zuno grátis por 4 dias.");
    expect(cardTrialCopy(7)).toBe("Após cadastrar o cartão, você testa a Zuno grátis por 7 dias.");
    expect(trialDurationLabel(1)).toBe("1 dia");
  });

  it("keeps the card and billing FAQ in sync with the offer", () => {
    const cardAnswer = FAQ_ITEMS.find((item) => item.pergunta === "Preciso cadastrar cartão?")?.resposta;
    const billingAnswer = FAQ_ITEMS.find((item) => item.pergunta === "Quando começa a cobrança?")?.resposta;
    expect(typeof cardAnswer).toBe("function");
    expect(typeof billingAnswer).toBe("function");
    if (typeof cardAnswer !== "function" || typeof billingAnswer !== "function") return;
    expect(cardAnswer(4)).toContain("4 dias");
    expect(cardAnswer(7)).toContain("7 dias");
    expect(billingAnswer(4)).toContain("4 dias");
    expect(billingAnswer(7)).toContain("7 dias");
  });

  it("does not invent a duration while the offer is unavailable", () => {
    expect(cardTrialCopy(null)).toContain("confirmada no checkout");
    expect(cardTrialCopy(null)).not.toMatch(/\d+ dias/);
  });
});
