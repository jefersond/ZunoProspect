import { describe, expect, it, vi } from "vitest";
import { createCreditConsumer } from "./credit-policy.ts";

describe("refine credit policy", () => {
  it("does not charge when the success path never calls the consumer", () => {
    const charge = vi.fn();
    createCreditConsumer(charge);
    expect(charge).not.toHaveBeenCalled();
  });

  it("charges exactly once after success", async () => {
    const charge = vi.fn().mockResolvedValue({ ok: true });
    const consumer = createCreditConsumer(charge);
    await expect(consumer.consume()).resolves.toEqual({ consumed: true });
    await expect(consumer.consume()).resolves.toEqual({ consumed: false });
    expect(charge).toHaveBeenCalledTimes(1);
  });

  it("returns a warning without a second charge when usage persistence fails", async () => {
    const charge = vi.fn().mockResolvedValue({ ok: false, warning: "safe warning" });
    const consumer = createCreditConsumer(charge);
    await expect(consumer.consume()).resolves.toEqual({ consumed: false, warning: "safe warning" });
    await consumer.consume();
    expect(charge).toHaveBeenCalledTimes(1);
  });
});
