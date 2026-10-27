import { describe, expect, it, vi } from "vitest";
import { runAnalysisPipeline, type PipelineDeps, type PipelineInput } from "./analysis-pipeline";
import { createFakeGeminiFetch } from "./gemini-contract";
import { buildAnalysisPrompt, buildVerifiedFacts, evaluatePreconditions, sanitizeSellerProfile, validateAnalysis } from "./lead-analysis";
import { cases, sellers } from "./sample-cases";
import { day, goodRaw } from "./test-fixtures";

// Mesmos dados fictícios do script de amostras reais (sample-cases.ts). Nenhuma chamada ao Gemini aqui.
const caseF = cases.find((c) => c.id === "F")!;
const caseG = cases.find((c) => c.id === "G")!;

const setup = (script: Parameters<typeof createFakeGeminiFetch>[0]["script"]) => {
  const fake = createFakeGeminiFetch({ script });
  const persist = vi.fn(async () => true);
  const consumeCredit = vi.fn(async () => true);
  const deps: PipelineDeps = { apiKey: "k", fetchFn: fake.fetchFn as never, now: () => "2026-10-27T12:00:00.000Z", persist, consumeCredit };
  const input = (c: typeof caseF, over: Partial<PipelineInput> = {}): PipelineInput => ({
    leadId: "lead-1", requestId: "req-1", profile: c.seller, rawLead: c.lead, existingPlan: null, replaceExisting: false, isAdmin: false, ...over,
  });
  return { fake, persist, consumeCredit, deps, input };
};

describe("Caso F · assinante sem oferta cadastrada, lead com poucos dados", () => {
  it("o perfil só tem o nome: a geração é bloqueada ANTES de qualquer requisição, gravação ou crédito", async () => {
    const t = setup([{ status: 200, text: JSON.stringify(goodRaw()) }]);
    const out = await runAnalysisPipeline(t.deps, t.input(caseF));
    expect(out).toMatchObject({ ok: false, code: "REFINE_PROFILE_REQUIRED", status: 422, providerBilling: "not_called", internalCreditCharged: false });
    if (out.ok) return;
    expect(out.extra).toEqual({ missing_fields: ["service_offered", "offer_description"] });
    expect(out.message).toMatch(/serviço que você oferece/);
    expect(out.message).toMatch(/Nenhum crédito foi consumido/);
    expect(t.fake.calls).toHaveLength(0);
    expect(t.persist).not.toHaveBeenCalled();
    expect(t.consumeCredit).not.toHaveBeenCalled();
  });

  it.each([
    ["só o rótulo do dropdown (Full Service)", { display_name: "Ana", service_offered: "Full Service", offer_description: "" }],
    ["serviço genérico com descrição curta", { display_name: "Ana", service_offered: "Tráfego", offer_description: "tráfego pago" }],
    ["descrição concreta mas sem nome de apresentação", { display_name: "", service_offered: "Sites", offer_description: "Faço sites de uma página com serviços, horário, mapa e botão de WhatsApp." }],
  ])("nenhum serviço é presumido: %s", (_n, raw) => {
    const profile = sanitizeSellerProfile(raw);
    const blocked = evaluatePreconditions({ profile, stage: "nao_contatado", existingPlan: null, replaceExisting: false });
    expect(blocked?.code).toBe("REFINE_PROFILE_REQUIRED");
  });

  it("o prompt do lead F, quando o assinante informa a oferta, não presume tráfego pago nem usa o dropdown", () => {
    const prompt = buildAnalysisPrompt(buildVerifiedFacts(caseF.lead), sellers.sites);
    expect(prompt).toContain(sellers.sites.service_offered);
    expect(prompt).not.toMatch(/gestão de tráfego|Full Service/i);
  });

  it("telefone fixo e nenhum outro canal: WhatsApp, Instagram e e-mail NÃO existem para este lead", () => {
    const facts = buildVerifiedFacts(caseF.lead);
    expect(facts.telefone).toBe("fixo");
    expect(facts.canais_disponiveis).toEqual(["telefone"]);
    expect(facts.avaliacoes_google).toBeNull();
    expect(facts.site_cadastrado_no_perfil).toBeNull();
  });

  it("se o Gemini ainda assim propuser WhatsApp para o telefone fixo, o validador descarta o texto e a análise é reprovada (sem gravar nem cobrar)", async () => {
    const profile = sellers.sites;
    const raw = goodRaw();
    raw.plano[0] = day(1, { tipo: "mensagem", canal: "whatsapp", mensagem: "Oi, tudo bem? Aqui é a Marina, da Costa Digital. Faço sites simples para negócios locais. Com quem falo sobre a divulgação do studio?" });
    raw.plano[3] = day(4);
    const t = setup([{ status: 200, text: JSON.stringify(raw) }]);
    const out = await runAnalysisPipeline(t.deps, t.input(caseF, { profile }));
    expect(out).toMatchObject({ ok: false, code: "REFINE_PROVIDER_INVALID_RESPONSE", providerBilling: "billed", internalCreditCharged: false });
    expect(t.persist).not.toHaveBeenCalled();
    expect(t.consumeCredit).not.toHaveBeenCalled();
  });

  it("LACUNA CONHECIDA (comportamento atual, não desejado): lead só com telefone fixo e plano legítimo de ligação + tarefas é REPROVADO por não ter mensagem de texto", () => {
    const profile = sellers.sites;
    const raw = goodRaw();
    raw.plano = raw.plano.map((d, i) => (i === 0 ? day(1, { tipo: "tarefa", canal: "telefone", acao: "Ligar para o studio e perguntar quem cuida da divulgação." }) : day(i + 1)));
    const facts = buildVerifiedFacts(caseF.lead);
    const result = validateAnalysis(raw, { channels: facts.canais_disponiveis, profile, stage: facts.etapa_do_historico, facts });
    // Hoje o validador exige ao menos uma mensagem enviável para lead frio. Para quem só tem telefone fixo isso reprova um plano correto
    // (a geração foi faturada pelo provedor e o assinante vê erro). Correção sugerida, NÃO aplicada: aceitar também uma tarefa de ligação.
    expect(result.ok).toBe(false);
  });
});

describe("Caso G · a empresa já respondeu", () => {
  const facts = buildVerifiedFacts(caseG.lead);

  it("o histórico real chega ao prompt: etapa 'respondeu' e a anotação do assinante, como dados", () => {
    expect(facts.etapa_do_historico).toBe("respondeu");
    const prompt = buildAnalysisPrompt(facts, caseG.seller);
    expect(prompt).toContain('"etapa_do_historico":"respondeu"');
    expect(prompt).toContain("Respondeu perguntando como funciona e quanto custa.");
    expect(prompt).toContain("Etapa do histórico: respondeu");
    expect(prompt).toMatch(/Se a empresa já respondeu, pare a sequência fria e planeje a condução da conversa/);
    expect(prompt).toMatch(/Não invente contatos anteriores: se a etapa é "nao_contatado"/);
  });

  it("o plano para quem respondeu pode ser só condução (resposta, proposta, reunião): aceito sem 'primeiro contato'", async () => {
    const raw = goodRaw();
    raw.plano = [
      day(1, { tipo: "mensagem", canal: "whatsapp", titulo: "Responder à pergunta", mensagem: "Oi, aqui é o Rafael, da Moura Ads. Funciona assim: eu monto campanhas no Google para a clínica aparecer em buscas como dentista na Serra, e você acompanha os contatos todo mês. Quer que eu explique em 10 minutos?" }),
      day(2, { tipo: "tarefa", acao: "Preparar uma página com público, verba mensal sugerida e o que será medido." }),
      day(3), day(4), day(5), day(6), day(7),
    ];
    const t = setup([{ status: 200, text: JSON.stringify(raw) }]);
    const out = await runAnalysisPipeline(t.deps, t.input(caseG));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const types = (out.payload.plano_prospeccao_7dias as unknown as Array<{ tipo_dia: string }>).map((d) => d.tipo_dia);
    expect(types.filter((x) => x === "mensagem" || x === "acompanhamento")).toHaveLength(1);
    expect(t.consumeCredit).toHaveBeenCalledTimes(1);
  });

  it("LACUNA CONHECIDA (comportamento atual, não desejado): nada no código impede o Gemini de devolver uma sequência fria de 4 mensagens para quem já respondeu", async () => {
    const cold = (n: number, text: string) => day(n, { tipo: n === 1 ? "mensagem" : "acompanhamento", canal: "whatsapp", condicao: "se sem resposta", mensagem: text });
    const raw = goodRaw();
    raw.plano = [
      cold(1, "Oi, aqui é o Rafael, da Moura Ads. Faço campanhas no Google para clínicas. Quem cuida da divulgação da clínica?"),
      day(2),
      cold(3, "Rafael de novo. Pesquisei dentista na Serra e vi clínicas anunciando no topo. Posso te mostrar como seria para vocês?"),
      day(4),
      cold(5, "Oi, Rafael por aqui sobre a divulgação da clínica. Faz sentido conversarmos esta semana sobre campanhas locais?"),
      day(6),
      cold(7, "Vou encerrar por aqui para não insistir. Se divulgar a clínica virar prioridade, é só chamar. Abraço, Rafael."),
    ];
    const t = setup([{ status: 200, text: JSON.stringify(raw) }]);
    const out = await runAnalysisPipeline(t.deps, t.input(caseG));
    // A proteção hoje é só instrução no prompt. O validador aceita (e a tela avisa o assinante que a sequência fria pode estar obsoleta).
    expect(out.ok).toBe(true);
    expect(t.persist).toHaveBeenCalledTimes(1);
  });

  it("empresa que respondeu e que depois recusou (opt-out) é bloqueada antes de qualquer chamada", async () => {
    const t = setup([{ status: 200, text: JSON.stringify(goodRaw()) }]);
    const out = await runAnalysisPipeline(t.deps, t.input(caseG, { rawLead: { ...caseG.lead, status: "recusou_optout" } }));
    expect(out).toMatchObject({ ok: false, code: "REFINE_LEAD_OPTED_OUT", providerBilling: "not_called" });
    expect(t.fake.calls).toHaveLength(0);
  });

  it("nova versão para o lead que respondeu preserva edições e histórico, e exige confirmação", async () => {
    const existing = {
      prompt_version: "v4_human_commercial_plan",
      diagnostico_bullets: ["anterior"],
      plano_prospeccao_7dias: [{ dia: 1, canal: "whatsapp", mensagem: "Minha resposta editada à pergunta de preço.", is_custom_edited: true }],
    };
    const t = setup([{ status: 200, text: JSON.stringify(goodRaw()) }]);
    const blocked = await runAnalysisPipeline(t.deps, t.input(caseG, { existingPlan: existing }));
    expect(blocked).toMatchObject({ ok: false, code: "REFINE_PLAN_EXISTS", providerBilling: "not_called" });
    const out = await runAnalysisPipeline(t.deps, t.input(caseG, { existingPlan: existing, replaceExisting: true }));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.preservedDays).toEqual([1]);
    expect((out.payload.history as unknown[]).length).toBe(1);
  });
});
