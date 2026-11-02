// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { trackStartTrial } from "../lib/metaPixel";

describe("Rastreamento Meta Pixel StartTrial — Testes de Conformidade", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (window as any).fbq;
    localStorage.clear();
    sessionStorage.clear();
    Object.defineProperty(window, "location", {
      writable: true,
      value: new URL("https://www.zunopropect.com.br/prospeccao?internal=false"),
    });
  });

  it("1. trackStartTrial envia event_name StartTrial com value: 0 e currency: BRL", () => {
    const mockFbq = vi.fn();
    (window as any).fbq = mockFbq;

    trackStartTrial({
      plan_id: "starter",
      content_name: "Zuno Prospect Starter",
      event_id: "cs_test_session_12345",
    });

    expect(mockFbq).toHaveBeenCalledWith(
      "track",
      "StartTrial",
      expect.objectContaining({
        value: 0,
        currency: "BRL",
        plan_id: "starter",
        content_name: "Zuno Prospect Starter",
        event_id: "cs_test_session_12345",
      }),
      { eventID: "cs_test_session_12345" }
    );
  });

  it("2. Prospeccao.tsx exige sessionId vindo do Stripe para disparar StartTrial", () => {
    const prospeccaoSrc = fs.readFileSync(path.resolve("src/pages/Prospeccao.tsx"), "utf8");
    expect(prospeccaoSrc).toContain('const sessionId = searchParams.get("session_id") || "";');
    expect(prospeccaoSrc).toContain("if (sessionId && user?.id)");
    expect(prospeccaoSrc).toContain("trackStartTrial({");
  });

  it("3. Previne duplicação em F5 através de chave determinística no localStorage", () => {
    const prospeccaoSrc = fs.readFileSync(path.resolve("src/pages/Prospeccao.tsx"), "utf8");
    expect(prospeccaoSrc).toContain("const trackingKey = `zuno_meta_start_trial_${user.id}_${sessionId}`;");
    expect(prospeccaoSrc).toContain("localStorage.setItem(trackingKey, Date.now().toString());");
    expect(prospeccaoSrc).toContain("if (!alreadyTrackedLocally && !alreadyTrackedRemotely)");
  });

  it("4. Previne duplicação em novo login ou outra aba através de verificação em app_events", () => {
    const prospeccaoSrc = fs.readFileSync(path.resolve("src/pages/Prospeccao.tsx"), "utf8");
    expect(prospeccaoSrc).toContain('.eq("event_name", "meta_start_trial_dispatched")');
    expect(prospeccaoSrc).toContain('.contains("metadata", { session_id: sessionId })');
    expect(prospeccaoSrc).toContain('trackEvent("meta_start_trial_dispatched",');
  });

  it("5. Nunca dispara Purchase no navegador durante o retorno do trial", () => {
    const prospeccaoSrc = fs.readFileSync(path.resolve("src/pages/Prospeccao.tsx"), "utf8");
    expect(prospeccaoSrc).toContain("// Nunca disparamos Purchase no browser. O pagamento canonico continua no webhook Stripe.");
    expect(prospeccaoSrc).not.toContain('trackPurchase(');
  });

  it("6. Suporta captura de test_event_code para a ferramenta Testar Eventos da Meta", () => {
    const metaPixelSrc = fs.readFileSync(path.resolve("src/lib/metaPixel.ts"), "utf8");
    expect(metaPixelSrc).toContain('"test_event_code"');
  });
});
