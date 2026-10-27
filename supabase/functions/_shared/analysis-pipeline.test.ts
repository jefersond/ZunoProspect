import { describe, expect, it, vi } from "vitest";
import { runAnalysisPipeline, type PipelineDeps, type PipelineInput } from "./analysis-pipeline";
import { createFakeGeminiFetch } from "./gemini-contract";
import { goodRaw, lead, profile } from "./test-fixtures";
import { sanitizeSellerProfile } from "./lead-analysis";

const good = JSON.stringify(goodRaw());

const setup = (script: Parameters<typeof createFakeGeminiFetch>[0]["script"], over: { persist?: boolean; credit?: boolean } = {}) => {
  const fake = createFakeGeminiFetch({ script });
  const persist = vi.fn(async () => over.persist ?? true);
  const consumeCredit = vi.fn(async () => over.credit ?? true);
  const deps: PipelineDeps = { apiKey: "k", fetchFn: fake.fetchFn as never, now: () => "2026-10-27T12:00:00.000Z", persist, consumeCredit };
  const input = (extra: Partial<PipelineInput> = {}): PipelineInput => ({
    leadId: "lead-1", requestId: "req-1", profile, rawLead: lead, existingPlan: null, replaceExisting: false, isAdmin: false, ...extra,
  });
  return { fake, persist, consumeCredit, deps, input };
};

describe("pipeline da análise: uma geração, gravação confirmada e só então o crédito", () => {
  it("lead novo: 1 requisição, grava, desconta 1 crédito interno", async () => {
    const t = setup([{ status: 200, text: good }]);
    const out = await runAnalysisPipeline(t.deps, t.input());
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(t.fake.calls).toHaveLength(1);
    expect(t.persist).toHaveBeenCalledTimes(1);
    expect(t.consumeCredit).toHaveBeenCalledTimes(1);
    expect(out.internalCreditCharged).toBe(true);
    expect(out.telemetry).toMatchObject({ http_attempts: 1, generations_with_content: 1, model_used: "gemini-3.6-flash" });
    expect(out.payload.plano_prospeccao_7dias).toHaveLength(7);
    expect(out.payload.history).toEqual([]);
    expect(out.payload.debug.usage).toMatchObject({ prompt_tokens: 1500, thoughts_tokens: 600 });
  });

  it("administrador não consome crédito interno (a chamada ao provedor continua existindo e sendo registrada)", async () => {
    const t = setup([{ status: 200, text: good }]);
    const out = await runAnalysisPipeline(t.deps, t.input({ isAdmin: true }));
    expect(out.ok).toBe(true);
    expect(t.consumeCredit).not.toHaveBeenCalled();
    if (out.ok) expect(out.telemetry.generations_with_content).toBe(1);
  });

  it("falha ao gravar: NÃO desconta crédito, mas o provedor registra geração faturada (são coisas diferentes)", async () => {
    const t = setup([{ status: 200, text: good }], { persist: false });
    const out = await runAnalysisPipeline(t.deps, t.input());
    expect(out).toMatchObject({ ok: false, code: "REFINE_SAVE_FAILED", internalCreditCharged: false, providerBilling: "billed" });
    expect(t.consumeCredit).not.toHaveBeenCalled();
  });

  it("erro ao descontar crédito: análise segue salva e avisa", async () => {
    const t = setup([{ status: 200, text: good }], { credit: false });
    const out = await runAnalysisPipeline(t.deps, t.input());
    expect(out).toMatchObject({ ok: true, internalCreditCharged: false });
    if (out.ok) expect(out.creditWarning).toMatch(/consumo do crédito/);
  });

  describe("bloqueios antes de qualquer chamada (zero custo no provedor)", () => {
    it.each([
      ["perfil sem descrição da oferta", { profile: sanitizeSellerProfile({ display_name: "Ana" }) }, "REFINE_PROFILE_REQUIRED"],
      ["lead com opt-out", { rawLead: { ...lead, status: "recusou_optout" } }, "REFINE_LEAD_OPTED_OUT"],
      ["opt-out por anotação", { rawLead: { ...lead, notas: "pediu para não contatar" } }, "REFINE_LEAD_OPTED_OUT"],
      ["plano existente sem confirmação", { existingPlan: { plano_prospeccao_7dias: [{ dia: 1, mensagem: "x" }] } }, "REFINE_PLAN_EXISTS"],
    ])("%s", async (_n, over, code) => {
      const t = setup([{ status: 200, text: good }]);
      const out = await runAnalysisPipeline(t.deps, t.input(over as Partial<PipelineInput>));
      expect(out).toMatchObject({ ok: false, code, providerBilling: "not_called" });
      expect(t.fake.calls).toHaveLength(0);
      expect(t.persist).not.toHaveBeenCalled();
      expect(t.consumeCredit).not.toHaveBeenCalled();
    });
  });

  describe("falhas do provedor: não gravam, não descontam crédito e distinguem a cobrança do provedor", () => {
    it("HTTP 400 (configuração): código próprio, não repete, não faturada", async () => {
      const t = setup([{ status: 400 }]);
      const out = await runAnalysisPipeline(t.deps, t.input());
      expect(out).toMatchObject({ ok: false, code: "REFINE_PROVIDER_INVALID_REQUEST", providerBilling: "not_billed" });
      expect(t.fake.calls).toHaveLength(1);
      expect(t.persist).not.toHaveBeenCalled();
      expect(t.consumeCredit).not.toHaveBeenCalled();
    });

    it("chave recusada (401/403)", async () => {
      const t = setup([{ status: 403 }]);
      expect(await runAnalysisPipeline(t.deps, t.input())).toMatchObject({ ok: false, code: "REFINE_PROVIDER_AUTH_FAILED", providerBilling: "not_billed" });
    });

    it("indisponibilidade: máximo de 2 requisições, consumo DESCONHECIDO", async () => {
      const t = setup([{ status: 503 }]);
      const out = await runAnalysisPipeline(t.deps, t.input());
      expect(out).toMatchObject({ ok: false, code: "REFINE_PROVIDER_UNAVAILABLE", providerBilling: "unknown" });
      expect(t.fake.calls).toHaveLength(2);
      expect(t.consumeCredit).not.toHaveBeenCalled();
    });

    it("JSON inválido: 1 requisição, faturada pelo provedor, sem crédito interno e sem repetição", async () => {
      const t = setup([{ status: 200, text: "{quebrado" }, { status: 200, text: good }]);
      const out = await runAnalysisPipeline(t.deps, t.input());
      expect(out).toMatchObject({ ok: false, code: "REFINE_PROVIDER_INVALID_RESPONSE", providerBilling: "billed", internalCreditCharged: false });
      expect(t.fake.calls).toHaveLength(1);
    });

    it("reprovada pelo validador (sem nenhuma mensagem utilizável): faturada, sem gravar, sem crédito", async () => {
      const bad = goodRaw();
      bad.plano[0] = { ...bad.plano[0], mensagem: "Preparei um vídeo de 1 minuto para a oficina, quer ver?" };
      bad.plano[3] = { ...bad.plano[3], tipo: "tarefa", canal: "nenhum", mensagem: "", acao: "Revisar" };
      const t = setup([{ status: 200, text: JSON.stringify(bad) }]);
      const out = await runAnalysisPipeline(t.deps, t.input());
      expect(out).toMatchObject({ ok: false, code: "REFINE_PROVIDER_INVALID_RESPONSE", providerBilling: "billed" });
      expect(t.persist).not.toHaveBeenCalled();
      expect(t.consumeCredit).not.toHaveBeenCalled();
    });
  });

  describe("preservação ao gerar nova versão", () => {
    const previous = {
      generated_at: "2026-10-01T00:00:00Z",
      prompt_version: "v4_human_commercial_plan",
      diagnostico_bullets: ["diagnóstico antigo"],
      history: [{ saved_at: "2026-09-01", prompt_version: "v3" }],
      plano_prospeccao_7dias: [
        { dia: 1, canal: "whatsapp", mensagem: "Minha mensagem editada do dia 1.", is_custom_edited: true, edited_at: "2026-10-02T00:00:00Z" },
        { dia: 2, canal: "instagram", mensagem: "Texto antigo do dia 2" },
        { dia: 3, canal: "whatsapp", mensagem: "Já enviado no dia 3", status_dia: "concluido" },
      ],
    };

    it("mantém o dia editado e o concluído, guarda a versão anterior e o histórico mais antigo", async () => {
      const t = setup([{ status: 200, text: good }]);
      const out = await runAnalysisPipeline(t.deps, t.input({ existingPlan: previous, replaceExisting: true }));
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.preservedDays).toEqual([1, 3]);
      const days = out.payload.plano_prospeccao_7dias as unknown as Array<Record<string, unknown>>;
      expect(days[0]).toMatchObject({ mensagem: "Minha mensagem editada do dia 1.", is_custom_edited: true, preserved_from_previous: true });
      expect(days[2]).toMatchObject({ mensagem: "Já enviado no dia 3", status_dia: "concluido" });
      expect(days[1].mensagem).toBe(""); // dia 2 do plano novo é tarefa
      const history = out.payload.history as Array<Record<string, unknown>>;
      expect(history[0]).toMatchObject({ prompt_version: "v4_human_commercial_plan", diagnostico_bullets: ["diagnóstico antigo"] });
      expect(history[1]).toMatchObject({ prompt_version: "v3" });
      expect(t.persist).toHaveBeenCalledTimes(1);
    });

    it("plano legado em array também é preservado como versão anterior", async () => {
      const t = setup([{ status: 200, text: good }]);
      const out = await runAnalysisPipeline(t.deps, t.input({ existingPlan: previous.plano_prospeccao_7dias, replaceExisting: true }));
      expect(out.ok).toBe(true);
      if (out.ok) expect((out.payload.history as unknown[]).length).toBe(1);
    });
  });

  it("o prompt enviado ao Gemini traz o serviço do assinante e nenhum sinal de HTML suspenso", async () => {
    const t = setup([{ status: 200, text: good }]);
    await runAnalysisPipeline(t.deps, t.input({ rawLead: { ...lead, has_meta_pixel: true, has_gtm: true } as never }));
    const sent = (t.fake.calls[0].body as { contents: Array<{ parts: Array<{ text: string }> }> }).contents[0].parts[0].text;
    expect(sent).toContain(profile.service_offered);
    expect(sent.toLowerCase()).not.toMatch(/has_meta_pixel|has_gtm|"pixel"/);
  });
});
