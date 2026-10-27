import { describe, expect, it } from "vitest";
import { confirmPersistedRefine } from "../../../src/utils/refineOutcome";
import {
  buildAnalysisPrompt,
  buildDiagnosticoBullets,
  buildPersistedPayload,
  buildVerifiedFacts,
  evaluatePreconditions,
  nextHistory,
  sanitizeSellerProfile,
  toStoredDay,
  validateAnalysis,
  type StoredDay,
  type ValidatedAnalysis,
} from "./lead-analysis";
import { okAlready, runGuardedRefine, type LeadRefineRow, type RefineStore } from "./refine-provider-guard";
import { cases, sellers } from "./sample-cases";
import { day, goodRaw, lead as fixtureLead, profile as fixtureProfile } from "./test-fixtures";

// Integração das peças usadas pela função v93 (perfil → pré-condições → validação v6 → guarda de concorrência e
// preservação → payload gravado). Respostas do "Gemini" aqui são FIXTURES escritas à mão; nenhuma chamada real é feita.

interface V6Like { plano_prospeccao_7dias: StoredDay[]; validated: ValidatedAnalysis }

const factsOf = buildVerifiedFacts(fixtureLead);
const validate = (raw: unknown) => {
  const r = validateAnalysis(raw, { channels: factsOf.canais_disponiveis, profile: fixtureProfile, stage: factsOf.etapa_do_historico, facts: factsOf });
  if (!r.ok) throw new Error(`fixture inválida: ${r.issues.join("; ")}`);
  return { plano_prospeccao_7dias: r.analysis.plano.map(toStoredDay), validated: r.analysis } as V6Like;
};

const makeDb = (initial: Partial<LeadRefineRow> = {}) => {
  const row: LeadRefineRow = { status: "novo", notas: "", reason: null, updatedAt: null, generatedAt: null, usedFallback: null, plan: null, ...initial };
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const store: RefineStore = {
    read: async () => { await tick(); return { ...row }; },
    claim: async (prev, lockValue, nowIso) => { await tick(); if (row.reason !== prev) return false; row.reason = lockValue; row.updatedAt = nowIso; return true; },
    release: async (lockValue, restore) => { await tick(); if (row.reason === lockValue) row.reason = restore; },
  };
  return { row, store };
};

const runOnce = (db: ReturnType<typeof makeDb>, counters: { provider: number; persist: number; charge: number }, over: { raw?: unknown; fail?: boolean; saveFails?: boolean; during?: () => void } = {}) =>
  runGuardedRefine<V6Like>({
    requestId: "req",
    isAdmin: false,
    store: db.store,
    callProvider: async () => {
      counters.provider++;
      over.during?.();
      return over.fail ? { ok: false as const, error: "gemini-3.6-flash:timeout" } : { ok: true as const, analysis: validate(over.raw ?? goodRaw()), model: "gemini-3.5-flash-lite" };
    },
    validate: okAlready,
    persist: async (analysis, model, ctx) => {
      counters.persist++;
      if (over.saveFails) return false;
      if (db.row.reason !== ctx.lockValue || (db.row.status ?? null) !== ctx.expected.status) return false;
      const generatedAt = "2026-10-27T15:00:00Z";
      const payload = buildPersistedPayload({
        leadId: "l1", requestId: "req", model, generatedAt, facts: factsOf, profile: fixtureProfile,
        analysis: analysis.validated, days: analysis.plano_prospeccao_7dias, history: nextHistory(ctx.previousPlan, generatedAt), warnings: [],
        telemetry: { attempts: [], http_attempts: 1, generations_with_content: 1, model_used: model, finish_reason: "STOP", usage: null, billing: "billed" },
      });
      db.row.plan = payload; db.row.reason = null; db.row.generatedAt = generatedAt; db.row.usedFallback = false;
      (db.row as unknown as { bullets: string[] }).bullets = buildDiagnosticoBullets(analysis.validated.diagnostico);
      return true;
    },
    charge: async () => { counters.charge++; return true; },
  });

const counters = () => ({ provider: 0, persist: 0, charge: 0 });

describe("perfil do assinante e pré-condições (antes de qualquer chamada)", () => {
  it("perfil completo libera; incompleto pede preenchimento sem consumir IA", () => {
    expect(evaluatePreconditions({ profile: fixtureProfile, stage: "nao_contatado", existingPlan: null, replaceExisting: true })).toBeNull();
    const caseF = cases.find((c) => c.id === "F")!;
    const blocked = evaluatePreconditions({ profile: caseF.seller, stage: "nao_contatado", existingPlan: null, replaceExisting: true });
    expect(blocked).toMatchObject({ code: "REFINE_PROFILE_REQUIRED", status: 422 });
    expect(blocked && "missing" in blocked && blocked.missing).toEqual(["service_offered", "offer_description"]);
  });

  it("nenhum serviço é presumido (tráfego pago só se o assinante disser)", () => {
    const prompt = buildAnalysisPrompt(factsOf, sellers.social);
    expect(prompt).toContain(sellers.social.service_offered);
    expect(prompt).not.toMatch(/gestão de tráfego pago/i);
    expect(evaluatePreconditions({ profile: sanitizeSellerProfile({ display_name: "Ana", service_offered: "Full Service", offer_description: "" }), stage: "nao_contatado", existingPlan: null, replaceExisting: true })?.code).toBe("REFINE_PROFILE_REQUIRED");
  });

  it("lead com opt-out é bloqueado antes de qualquer chamada", () => {
    expect(evaluatePreconditions({ profile: fixtureProfile, stage: "recusou_ou_optout", existingPlan: null, replaceExisting: true })).toMatchObject({ code: "REFINE_LEAD_OPTED_OUT", status: 409 });
  });
});

describe("primeiro contato, dias sem mensagem, canais e histórico", () => {
  it("primeiro contato com oferta concreta: cita o assinante e o serviço e termina com uma pergunta; dias sem mensagem não têm texto", () => {
    const v = validate(goodRaw());
    const first = v.plano_prospeccao_7dias[0];
    expect(first.mensagem).toMatch(/Marina/);
    expect(first.mensagem).toMatch(/sites/i);
    expect(first.mensagem.trim().endsWith("?")).toBe(true);
    const noText = v.plano_prospeccao_7dias.filter((d) => d.tipo_dia === "tarefa" || d.tipo_dia === "sem_mensagem");
    expect(noText.length).toBeGreaterThanOrEqual(4);
    for (const d of noText) expect(d.mensagem).toBe("");
  });

  it("telefone fixo: sem WhatsApp; plano de ligação (tarefa) é aceito", () => {
    const caseF = cases.find((c) => c.id === "F")!;
    const facts = buildVerifiedFacts(caseF.lead);
    expect(facts.canais_disponiveis).toEqual(["telefone"]);
    const raw = goodRaw();
    raw.plano = raw.plano.map((d, i) => (i === 0 ? day(1, { tipo: "tarefa", canal: "telefone", acao: "Ligar para o studio e perguntar quem cuida da divulgação." }) : day(i + 1)));
    const ok = validateAnalysis(raw, { channels: facts.canais_disponiveis, profile: sellers.sites, stage: facts.etapa_do_historico, facts });
    expect(ok.ok).toBe(true);
    // WhatsApp para telefone fixo é descartado
    const bad = goodRaw();
    bad.plano[0].mensagem = "Oi, aqui é a Marina, da Costa Digital. Faço sites simples para negócios locais. Com quem falo sobre a divulgação do studio?";
    bad.plano[3] = day(4);
    expect(validateAnalysis(bad, { channels: facts.canais_disponiveis, profile: sellers.sites, stage: facts.etapa_do_historico, facts }).ok).toBe(false);
  });

  it("lead que respondeu: no máximo uma mensagem de condução; sequência fria é rebaixada a tarefas", () => {
    const caseG = cases.find((c) => c.id === "G")!;
    const facts = buildVerifiedFacts(caseG.lead);
    expect(facts.etapa_do_historico).toBe("respondeu");
    const cold = (n: number, text: string) => day(n, { tipo: n === 1 ? "mensagem" : "acompanhamento", canal: "whatsapp", condicao: "se sem resposta", mensagem: text });
    const raw = goodRaw();
    raw.plano = [
      cold(1, "Oi, aqui é o Rafael, da Moura Ads. Funciona assim: monto campanhas no Google para a clínica aparecer em buscas locais de tráfego pago, e você acompanha os contatos todo mês. Quer que eu explique em 10 minutos?"),
      day(2),
      cold(3, "Rafael de novo. Pesquisei dentista na Serra e vi clínicas com anúncios no topo. Posso te mostrar como seria o tráfego pago para vocês?"),
      day(4),
      cold(5, "Oi, Rafael por aqui sobre os anúncios da clínica. Faz sentido conversarmos sobre tráfego pago esta semana?"),
      day(6), day(7),
    ];
    const r = validateAnalysis(raw, { channels: facts.canais_disponiveis, profile: caseG.seller, stage: facts.etapa_do_historico, facts });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.analysis.plano.filter((d) => d.tipo === "mensagem" || d.tipo === "acompanhamento")).toHaveLength(1);
    expect(r.demoted_days).toEqual([3, 5]);
  });

  it("dados insuficientes: o prompt manda dizer isso em vez de preencher, sem sinais de HTML", () => {
    const prompt = buildAnalysisPrompt(buildVerifiedFacts({ ...fixtureLead, rating: null, reviews: null }), fixtureProfile);
    expect(prompt).toMatch(/Se os fatos não bastam para uma hipótese, diga isso no diagnóstico/);
    expect(prompt).not.toMatch(/has_meta_pixel|whatsapp_on_site/);
  });
});

describe("gravação protegida: edições, etapas concluídas, histórico e plano antigo", () => {
  const oldPlan = () => ({
    prompt_version: "v4_human_commercial_plan",
    plano_prospeccao_7dias: [
      { dia: 1, canal: "whatsapp", mensagem: "MINHA MENSAGEM EDITADA", is_custom_edited: true, acao_sugerida: "x", objecao_provavel: "", resposta_sugerida: "", cta: "" },
      { dia: 2, canal: "email", mensagem: "Enviado ontem", status_dia: "concluido", acao_sugerida: "x", objecao_provavel: "", resposta_sugerida: "", cta: "" },
      { dia: 3, canal: "whatsapp", mensagem: "texto antigo gerado", acao_sugerida: "x", objecao_provavel: "", resposta_sugerida: "", cta: "" },
    ],
  });

  it("mensagem editada e etapa concluída continuam exatamente iguais; o texto antigo não editado é substituído; a versão anterior vai para o histórico", async () => {
    const db = makeDb({ plan: oldPlan() });
    const c = counters();
    const run = await runOnce(db, c);
    expect(run.status).toBe("saved");
    const days = (db.row.plan as { plano_prospeccao_7dias: Array<Record<string, unknown>> }).plano_prospeccao_7dias;
    expect(days.find((d) => d.dia === 1)?.mensagem).toBe("MINHA MENSAGEM EDITADA");
    expect(days.find((d) => d.dia === 2)?.mensagem).toBe("Enviado ontem");
    expect(days.find((d) => d.dia === 3)?.mensagem).not.toBe("texto antigo gerado");
    const history = (db.row.plan as { history: Array<{ prompt_version: string }> }).history;
    expect(history[0].prompt_version).toBe("v4_human_commercial_plan");
    expect(c).toEqual({ provider: 1, persist: 1, charge: 1 });
  });

  it("o que foi gravado é confirmado pelo cliente e a mensagem do plano é exatamente a que o SDR usará", async () => {
    const db = makeDb();
    await runOnce(db, counters());
    const row = { ai_analise_gerada_em: db.row.generatedAt, diagnostico_bullets: (db.row as unknown as { bullets: string[] }).bullets, plano_prospeccao: db.row.plan };
    expect(confirmPersistedRefine(row, null)).toMatchObject({ ok: true, usedFallback: false });
    const saved = (db.row.plan as { plano_prospeccao_7dias: Array<{ dia: number; mensagem: string }> }).plano_prospeccao_7dias;
    expect(saved[0].mensagem).toBe(validate(goodRaw()).plano_prospeccao_7dias[0].mensagem); // sem reescrita: SDR lê este texto
  });

  it("opt-out registrado durante a geração: recusa, sem gravar nem cobrar", async () => {
    const db = makeDb({ plan: oldPlan() });
    const before = JSON.stringify(db.row.plan);
    const c = counters();
    const run = await runOnce(db, c, { during: () => { db.row.status = "recusou_optout"; } });
    expect(run).toEqual({ status: "conflict", reason: "opt_out" });
    expect(JSON.stringify(db.row.plan)).toBe(before);
    expect(c.charge).toBe(0);
  });

  it("duas gerações concorrentes do mesmo lead: uma Gemini, uma gravação, uma cobrança", async () => {
    const db = makeDb({ plan: oldPlan() });
    const c = counters();
    const [a, b] = await Promise.all([runOnce(db, c), runOnce(db, c)]);
    expect([a.status, b.status].sort()).toEqual(["in_progress", "saved"]);
    expect(c).toEqual({ provider: 1, persist: 1, charge: 1 });
  });

  it("falha da IA: nada gravado, nada cobrado, plano antigo intacto", async () => {
    const db = makeDb({ plan: oldPlan() });
    const before = JSON.stringify(db.row.plan);
    const c = counters();
    const run = await runOnce(db, c, { fail: true });
    expect(run.status).toBe("provider_failed");
    expect(JSON.stringify(db.row.plan)).toBe(before);
    expect(c).toEqual({ provider: 1, persist: 0, charge: 0 });
  });

  it("falha de persistência: não cobra e libera a reserva", async () => {
    const db = makeDb({ plan: oldPlan() });
    const c = counters();
    const run = await runOnce(db, c, { saveFails: true });
    expect(run.status).toBe("save_failed");
    expect(c.charge).toBe(0);
    expect(db.row.reason).toBeNull();
  });

  it("plano antigo em lista (motor local) é aceito, preservado no histórico e substituído só onde não há edição", async () => {
    const legacy = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ dia: d, canal: "whatsapp", mensagem: `Antiga ${d}`, is_custom_edited: d === 4 }));
    const db = makeDb({ plan: legacy });
    const run = await runOnce(db, counters());
    expect(run.status).toBe("saved");
    const days = (db.row.plan as { plano_prospeccao_7dias: Array<{ dia: number; mensagem: string }> }).plano_prospeccao_7dias;
    expect(days.find((d) => d.dia === 4)?.mensagem).toBe("Antiga 4");
    expect((db.row.plan as { history: unknown[] }).history).toHaveLength(1);
  });
});
