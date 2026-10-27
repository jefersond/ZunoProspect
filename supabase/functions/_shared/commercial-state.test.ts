import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyCommercialState, normalizeSubscriptionStatus, summarizeByCategory, summarizeByState, summarizeCommercialProfile } from "./commercial-state.ts";

const sub = (subscription_status?: string) => ({ subscription_status });

describe("estado comercial real (painel ADM)", () => {
  it("pago ativo exige plano pago E status confirmado", () => {
    expect(classifyCommercialState({ planName: "pro", subscription: sub("active") })).toBe("paid_active");
    expect(classifyCommercialState({ planName: "agencia", subscription: sub("authorized") })).toBe("paid_active");
  });
  it("nome do plano sem status confirmando NÃO é pagante e não vira 'active'", () => {
    expect(classifyCommercialState({ planName: "pro", subscription: {} })).toBe("indefinido");
    expect(classifyCommercialState({ planName: "pro", subscription: null })).toBe("indefinido");
    expect(classifyCommercialState({ planName: "pro", subscription: sub("pending") })).toBe("indefinido");
    expect(normalizeSubscriptionStatus({})).toBeNull();
  });
  it("gratuito, teste, cancelado e pendente ficam separados", () => {
    expect(classifyCommercialState({ planName: "free", subscription: {} })).toBe("free");
    expect(classifyCommercialState({ planName: "free", subscription: sub("active") })).toBe("free");
    expect(classifyCommercialState({ planName: "pro", subscription: sub("trialing") })).toBe("trial");
    expect(classifyCommercialState({ planName: "pro", subscription: sub("cancelled") })).toBe("canceled");
    expect(classifyCommercialState({ planName: "pro", subscription: sub("canceled") })).toBe("canceled");
    expect(classifyCommercialState({ planName: "pro", subscription: sub("past_due") })).toBe("past_due");
  });
  it("admin fica fora das contagens de assinantes", () => {
    expect(classifyCommercialState({ planName: "free", subscription: {}, isAdmin: true })).toBe("admin");
  });
  it("contagens por estado e por categoria separam pagos ativos de testes", () => {
    const mk = (state: any, cat = "") => ({ commercial_state: state, commercial_profile: summarizeCommercialProfile(cat ? { display_name: "A", service_category: cat, service_offered: "x" } : null) });
    const users = [mk("paid_active", "sites"), mk("paid_active", "sites"), mk("trial", "sites"), mk("free"), mk("canceled", "seo"), mk("admin", "sites")];
    expect(summarizeByState(users)).toMatchObject({ paid_active: 2, trial: 1, free: 1, canceled: 1, admin: 1 });
    const cat = summarizeByCategory(users);
    expect(cat.sites).toMatchObject({ paid_active: 2, trial: 1 });
    expect(cat.nao_informado.free).toBe(1);
    expect(cat.seo.canceled).toBe(1);
  });
  it("perfil ausente é 'não informado'; completo exige descrição concreta", () => {
    expect(summarizeCommercialProfile(null)).toMatchObject({ filled: false, complete: false, service_category: "" });
    const p = summarizeCommercialProfile({ display_name: "Ana", service_category: "sites", service_offered: "Sites", offer_description: "Faço sites de uma página com serviços, horário, mapa e botão de WhatsApp para oficinas." });
    expect(p).toMatchObject({ filled: true, complete: true, service_category_label: "Sites" });
  });
  it("endpoint: verificação is_admin acontece antes de ler seller_profiles e plan_status não tem padrão active", () => {
    const src = readFileSync(new URL("../admin-get-users/index.ts", import.meta.url), "utf8");
    expect(src.indexOf('"Acesso negado"')).toBeGreaterThan(0);
    expect(src.indexOf('from("seller_profiles")')).toBeGreaterThan(src.indexOf('"Acesso negado"'));
    expect(src).not.toMatch(/\|\| "active"/);
  });
});
