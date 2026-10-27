import { describe, expect, it } from "vitest";
import {
  ANALYSIS_PROMPT_VERSION,
  COPY_VERSION,
  buildAnalysisPrompt,
  buildDiagnosticoBullets,
  buildGeminiRequestBody,
  buildPersistedPayload,
  buildVerifiedFacts,
  classifyBrazilianPhone,
  evaluatePreconditions,
  mergeWithPreviousPlan,
  missingSellerProfileFields,
  resolveHistoryStage,
  runGeminiAnalysis,
  sanitizeSellerProfile,
  toStoredDay,
  validateAnalysis,
  type DayChannel,
  type SellerProfile,
} from "./lead-analysis";

// FIXTURES escritos à mão para exercitar o validador. NÃO são saídas do Gemini.
const profile: SellerProfile = {
  display_name: "Marina Costa",
  company_name: "Costa Digital",
  service_offered: "Criação de sites para negócios locais",
  offer_description: "Faço sites de uma página com serviços, horário, mapa e botão de WhatsApp para oficinas e lojas.",
  target_audience: "Oficinas e comércio local",
};

const lead = {
  nome: "Auto Mecânica Irmãos Lima",
  nicho: "oficina mecânica",
  cidade: "Serra",
  endereco: "Av. Principal, 100 - Serra, ES",
  website: null,
  instagram: null,
  email: null,
  phone: "27996543210",
  rating: 4.7,
  reviews: 46,
  status: "novo",
  notas: null,
};

const day = (dia: number, over: Record<string, unknown> = {}) => ({
  dia, tipo: "sem_mensagem", canal: "nenhum", titulo: `Dia ${dia}`, objetivo: "Aguardar", acao: "Aguardar resposta",
  mensagem: "", assunto_email: "", justificativa: "Sem fato novo para justificar contato.", condicao: "",
  objecao_provavel: "", resposta_sugerida: "", ...over,
});

const goodRaw = () => ({
  diagnostico: {
    observado: ["Oficina em Serra com 46 avaliações no Google (nota 4,7) e celular cadastrado; nenhum site no perfil."],
    permite_concluir: "Há reputação construída e um canal direto por celular.",
    nao_permite_concluir: "Não permite concluir se existe site fora do perfil nem se o dono quer um.",
    hipotese_comercial: "Uma página única com serviços e horário pode complementar o perfil do Google, se o dono sentir falta disso.",
    pergunta_de_validacao: "Vocês já têm site ou preferem usar só o Google e o WhatsApp?",
  },
  resumo_estrategia: "Abrir com uma pergunta factual sobre site e só depois falar da página.",
  plano: [
    day(1, { tipo: "mensagem", canal: "whatsapp", acao: "Enviar a abertura", objetivo: "Abrir conversa",
      mensagem: "Oi, tudo bem? Aqui é a Marina, da Costa Digital. Faço sites simples para oficinas: serviços, horário e WhatsApp numa página só. A Irmãos Lima tem 46 avaliações no Google, mas não achei site no perfil. Vocês já têm um?",
      objecao_provavel: "Já temos Instagram.", resposta_sugerida: "O site complementa; ele reúne serviços e horário num só lugar." }),
    day(2, { tipo: "tarefa", acao: "Pesquise o nome da oficina e confirme se existe site ou Facebook fora do perfil do Google." }),
    day(3),
    day(4, { tipo: "acompanhamento", canal: "whatsapp", condicao: "Só se o Dia 1 foi enviado e não houve resposta há 3 dias, e o Dia 2 confirmou que não há site.",
      mensagem: "Oi, aqui é a Marina de novo. Confirmei que o Google mostra as avaliações e o telefone da Irmãos Lima, mas não há uma página com serviços e horário. Posso te explicar como ficaria, em 5 minutos?" }),
    day(5),
    day(6),
    day(7, { acao: "Registrar o resultado e encerrar a sequência sem insistência." }),
  ],
});

const ctx = { channels: ["whatsapp", "telefone"] as DayChannel[], profile, stage: "nao_contatado" as const };

describe("perfil do assinante", () => {
  it("sanitiza, limita tamanho e remove caracteres de controle", () => {
    const p = sanitizeSellerProfile({ display_name: "  Ana\u0000   Lima ", offer_description: "x".repeat(900), service_offered: 42 });
    expect(p.display_name).toBe("Ana Lima");
    expect(p.offer_description).toHaveLength(600);
    expect(p.service_offered).toBe("");
  });

  it("não assume serviço: sem serviço e descrição concreta, a geração é bloqueada", () => {
    const empty = sanitizeSellerProfile({ display_name: "Ana" });
    expect(missingSellerProfileFields(empty)).toEqual(["service_offered", "offer_description"]);
    const vague = sanitizeSellerProfile({ display_name: "Ana", service_offered: "Tráfego", offer_description: "tráfego" });
    expect(missingSellerProfileFields(vague)).toContain("offer_description");
    expect(missingSellerProfileFields(profile)).toEqual([]);
  });
});

describe("pré-condições (nenhuma chamada Gemini antes delas)", () => {
  const base = { profile, stage: "nao_contatado" as const, existingPlan: null, replaceExisting: false };

  it("exige perfil completo", () => {
    const r = evaluatePreconditions({ ...base, profile: sanitizeSellerProfile({}) });
    expect(r?.code).toBe("REFINE_PROFILE_REQUIRED");
  });
  it("bloqueia lead com opt-out", () => {
    expect(evaluatePreconditions({ ...base, stage: "recusou_ou_optout" })?.code).toBe("REFINE_LEAD_OPTED_OUT");
  });
  it("não sobrescreve plano existente sem confirmação explícita", () => {
    const plan = { plano_prospeccao_7dias: [{ dia: 1 }] };
    expect(evaluatePreconditions({ ...base, existingPlan: plan })?.code).toBe("REFINE_PLAN_EXISTS");
    expect(evaluatePreconditions({ ...base, existingPlan: [{ dia: 1 }] })?.code).toBe("REFINE_PLAN_EXISTS");
    expect(evaluatePreconditions({ ...base, existingPlan: plan, replaceExisting: true })).toBeNull();
  });
  it("libera lead novo com perfil completo", () => {
    expect(evaluatePreconditions(base)).toBeNull();
  });
});

describe("fatos verificados e prompt", () => {
  it("telefone fixo não vira WhatsApp", () => {
    expect(classifyBrazilianPhone("2733221100")).toBe("fixo");
    expect(classifyBrazilianPhone("27996543210")).toBe("celular");
    const facts = buildVerifiedFacts({ ...lead, phone: "2733221100" });
    expect(facts.canais_disponiveis).not.toContain("whatsapp");
    expect(facts.canais_disponiveis).toContain("telefone");
  });

  it("não carrega sinais de inspeção de HTML suspensos pelo #55", () => {
    const polluted = { ...lead, has_meta_pixel: true, has_gtag: true, has_gtm: true, whatsapp_on_site: true } as typeof lead;
    const facts = buildVerifiedFacts(polluted);
    const json = JSON.stringify(facts).toLowerCase();
    expect(json).not.toMatch(/pixel|gtag|gtm|whatsapp_on_site/);
  });

  it("o prompt traz perfil + fatos, proíbe afirmar o que não foi medido e não pede nota de fechamento", () => {
    const prompt = buildAnalysisPrompt(buildVerifiedFacts(lead), profile);
    expect(prompt).toContain("Criação de sites para negócios locais");
    expect(prompt).toContain("Auto Mecânica Irmãos Lima");
    expect(prompt).toContain("Nada foi medido sobre site, Pixel, GTM");
    expect(prompt).toContain("Os sete dias NÃO são sete mensagens");
    expect(prompt).not.toMatch(/probabilidade_conversao|fit_level/);
    expect(prompt).not.toMatch(/gestão de tráfego/i);
  });

  it("resolve o estágio do histórico", () => {
    expect(resolveHistoryStage({ status: "novo", notas: "" })).toBe("nao_contatado");
    expect(resolveHistoryStage({ status: "respondeu", notas: "" })).toBe("respondeu");
    expect(resolveHistoryStage({ status: "novo", notas: "pediu para não contatar" })).toBe("recusou_ou_optout");
  });
});

describe("validador", () => {
  it("aceita um plano misto (mensagens, tarefa e dias sem mensagem)", () => {
    const r = validateAnalysis(goodRaw(), ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const types = r.analysis.plano.map((d) => d.tipo);
    expect(types.filter((t) => t === "mensagem" || t === "acompanhamento").length).toBe(2);
    expect(types).toContain("tarefa");
    expect(types.filter((t) => t === "sem_mensagem").length).toBe(4);
    expect(r.demoted_days).toEqual([]);
  });

  it("rejeita resposta que não tem sete dias ou diagnóstico", () => {
    const raw = goodRaw();
    raw.plano = raw.plano.slice(0, 5);
    expect(validateAnalysis(raw, ctx).ok).toBe(false);
    const raw2 = goodRaw();
    raw2.diagnostico.hipotese_comercial = "";
    expect(validateAnalysis(raw2, ctx).ok).toBe(false);
    expect(validateAnalysis(null, ctx).ok).toBe(false);
  });

  it("rejeita diagnóstico com porcentagem de fechamento ou sinal de Pixel", () => {
    const a = goodRaw();
    a.diagnostico.permite_concluir = "Probabilidade de fechamento de 80% para esta empresa.";
    expect(validateAnalysis(a, ctx).ok).toBe(false);
    const b = goodRaw();
    b.diagnostico.observado = ["Site com Pixel do Meta instalado, indicando campanhas."];
    expect(validateAnalysis(b, ctx).ok).toBe(false);
  });

  it.each([
    ["placeholder", "Oi, aqui é o [seu nome], da [sua empresa]. Faço sites simples para oficinas e queria saber se vocês têm um."],
    ["promessa de vídeo", "Oi, aqui é a Marina. Preparei um vídeo mostrando como ficaria o site da oficina. Posso te enviar?"],
    ["porcentagem", "Oi, aqui é a Marina. Sites aumentam em 40% os contatos de oficinas como a sua. Posso explicar?"],
    ["pixel", "Oi, aqui é a Marina. Vi que a oficina não tem Pixel instalado no site. Posso explicar como isso ajuda?"],
    ["acusação", "Oi, aqui é a Marina. A oficina está perdendo clientes por não ter site. Posso te ajudar com isso?"],
  ])("descarta mensagem com %s e transforma o dia em tarefa, sem perder o plano", (_n, text) => {
    const raw = goodRaw();
    raw.plano[3] = day(4, { tipo: "acompanhamento", canal: "whatsapp", condicao: "se sem resposta", mensagem: text });
    const r = validateAnalysis(raw, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.demoted_days).toEqual([4]);
    const d4 = r.analysis.plano[3];
    expect(d4.tipo).toBe("tarefa");
    expect(d4.mensagem).toBe("");
    expect(d4.acao).toContain("descartado");
  });

  it("canal indisponível (Instagram não cadastrado) rebaixa o dia; e-mail sem assunto também", () => {
    const raw = goodRaw();
    raw.plano[3] = day(4, { tipo: "mensagem", canal: "instagram", mensagem: "Oi! Aqui é a Marina, faço sites para oficinas. Vocês já têm um site?" });
    raw.plano[5] = day(6, { tipo: "mensagem", canal: "email", mensagem: "Olá! Sou a Marina e faço sites simples para oficinas. Posso explicar em 5 minutos?" });
    const r = validateAnalysis(raw, { ...ctx, channels: ["whatsapp", "telefone", "email"] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.demoted_days.sort()).toEqual([4, 6]);
  });

  it("mensagem longa demais é descartada; um pouco longa vira aviso", () => {
    const raw = goodRaw();
    raw.plano[0].mensagem = "Oi, aqui é a Marina. " + "palavra ".repeat(120) + "Vocês já têm site?";
    raw.plano[3] = day(4, { tipo: "mensagem", canal: "whatsapp", mensagem: "Oi, aqui é a Marina. " + "palavra ".repeat(66) + "Posso explicar?" });
    const r = validateAnalysis(raw, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.demoted_days).toEqual([1]);
    expect(r.warnings.join(" ")).toMatch(/dia 4: \d+ palavras/);
  });

  it("falha (sem cobrar) se nenhuma mensagem utilizável sobrar para um lead frio", () => {
    const raw = goodRaw();
    raw.plano[0] = day(1, { tipo: "mensagem", canal: "whatsapp", mensagem: "Preparei um vídeo para a oficina, quer ver?" });
    raw.plano[3] = day(4);
    expect(validateAnalysis(raw, ctx).ok).toBe(false);
  });

  it("dia de tarefa/sem mensagem nunca carrega texto enviável", () => {
    const raw = goodRaw();
    raw.plano[1].mensagem = "Texto que não deveria existir num dia de tarefa.";
    const r = validateAnalysis(raw, ctx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.analysis.plano[1].mensagem).toBe("");
  });

  it("acompanhamento antes de qualquer contato é rebaixado", () => {
    const raw = goodRaw();
    raw.plano[0] = day(1, { tipo: "acompanhamento", canal: "whatsapp", condicao: "x", mensagem: "Oi, aqui é a Marina de novo, sobre os sites para oficinas. Vocês já têm um?" });
    raw.plano[3] = day(4, { tipo: "mensagem", canal: "whatsapp", mensagem: "Oi, aqui é a Marina, da Costa Digital. Faço sites para oficinas. Vocês já têm um?" });
    const r = validateAnalysis(raw, ctx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.demoted_days).toEqual([1]);
  });
});

describe("saída salva", () => {
  it("monta bullets legíveis, sem porcentagem, e dias no formato do app", () => {
    const r = validateAnalysis(goodRaw(), ctx);
    if (!r.ok) throw new Error("fixture inválida");
    const bullets = buildDiagnosticoBullets(r.analysis.diagnostico);
    expect(bullets).toHaveLength(5);
    expect(bullets.join(" ")).not.toMatch(/%/);
    const stored = r.analysis.plano.map(toStoredDay);
    expect(stored[0]).toMatchObject({ dia: 1, tipo_dia: "mensagem", canal: "whatsapp", copy_version: COPY_VERSION, fonte: "gemini", is_custom_edited: false });
    expect(stored[2].mensagem).toBe("");
    expect(stored[2].acao_sugerida).toBeTruthy();
  });

  it("payload registra 1 chamada, versão do prompt e não contém score", () => {
    const r = validateAnalysis(goodRaw(), ctx);
    if (!r.ok) throw new Error("fixture inválida");
    const payload = buildPersistedPayload({
      leadId: "l1", requestId: "r1", model: "gemini-x", generatedAt: "2026-10-27T00:00:00Z",
      facts: buildVerifiedFacts(lead), profile, analysis: r.analysis, days: r.analysis.plano.map(toStoredDay),
      history: [], warnings: r.warnings, usage: null,
    });
    expect(payload.prompt_version).toBe(ANALYSIS_PROMPT_VERSION);
    expect(payload.debug.gemini_calls).toBe(1);
    expect(JSON.stringify(payload)).not.toMatch(/probabilidade|fit_level|score/);
    expect(payload.plano_prospeccao_7dias).toHaveLength(7);
  });
});

describe("regeneração preserva edições e histórico", () => {
  const newDays = () => {
    const r = validateAnalysis(goodRaw(), ctx);
    if (!r.ok) throw new Error("fixture inválida");
    return r.analysis.plano.map(toStoredDay);
  };

  it("mantém dias editados à mão e concluídos exatamente como estavam e guarda a versão anterior", () => {
    const previous = {
      generated_at: "2026-10-01T00:00:00Z", prompt_version: "v4", diagnostico_bullets: ["antigo"],
      plano_prospeccao_7dias: [
        { dia: 1, mensagem: "Minha mensagem editada.", canal: "whatsapp", is_custom_edited: true },
        { dia: 2, mensagem: "Texto antigo", canal: "instagram" },
        { dia: 3, mensagem: "Enviado", canal: "whatsapp", status_dia: "concluido" },
      ],
    };
    const merged = mergeWithPreviousPlan(newDays(), previous, "2026-10-27T00:00:00Z");
    expect(merged.preserved_days).toEqual([1, 3]);
    expect(merged.days[0].mensagem).toBe("Minha mensagem editada.");
    expect(merged.days[1].mensagem).toBe("");
    expect(merged.history[0]).toMatchObject({ prompt_version: "v4", saved_at: "2026-10-27T00:00:00Z" });
    expect((merged.history[0].plano_prospeccao_7dias as unknown[]).length).toBe(3);
  });

  it("aceita plano legado em array e limita o histórico a 3 versões", () => {
    const legacy = [{ dia: 1, mensagem: "x", canal: "whatsapp" }];
    const first = mergeWithPreviousPlan(newDays(), legacy, "t1");
    expect(first.history).toHaveLength(1);
    let payload: Record<string, unknown> = { plano_prospeccao_7dias: [{ dia: 1, mensagem: "y" }], history: first.history };
    for (let i = 0; i < 5; i++) {
      const m = mergeWithPreviousPlan(newDays(), payload, `t${i + 2}`);
      payload = { plano_prospeccao_7dias: m.days, history: m.history };
    }
    expect((payload.history as unknown[]).length).toBe(3);
  });
});

describe("custo: uma chamada Gemini por análise", () => {
  const prompt = buildAnalysisPrompt(buildVerifiedFacts(lead), profile);
  const ok = (text: string, usage = { promptTokenCount: 900, candidatesTokenCount: 700, totalTokenCount: 1600 }) => ({
    ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: usage }),
  });
  const http = (status: number) => ({ ok: false, status, json: async () => ({}) });

  it("sucesso: exatamente 1 chamada e uso registrado", async () => {
    let calls = 0;
    const r = await runGeminiAnalysis({ apiKey: "k", prompt, fetchFn: async () => { calls++; return ok(JSON.stringify(goodRaw())); } });
    expect(calls).toBe(1);
    expect(r).toMatchObject({ ok: true, billed_calls: 1, usage: { prompt_tokens: 900, output_tokens: 700 } });
  });

  it("JSON inválido NÃO tenta outro modelo (evita segunda geração cobrada)", async () => {
    let calls = 0;
    const r = await runGeminiAnalysis({ apiKey: "k", prompt, fetchFn: async () => { calls++; return ok("{não é json"); } });
    expect(calls).toBe(1);
    expect(r).toMatchObject({ ok: false, kind: "invalid_output", billed_calls: 1 });
  });

  it("erro HTTP antes de gerar conteúdo passa ao próximo modelo e só 1 é efetivamente gerado", async () => {
    const seen: string[] = [];
    const r = await runGeminiAnalysis({
      apiKey: "k", prompt,
      fetchFn: async (url) => { seen.push(url); return seen.length === 1 ? http(503) : ok(JSON.stringify(goodRaw())); },
    });
    expect(seen).toHaveLength(2);
    expect(r).toMatchObject({ ok: true, billed_calls: 1 });
  });

  it("401/403 interrompe a cadeia; tudo indisponível não cobra", async () => {
    let calls = 0;
    const denied = await runGeminiAnalysis({ apiKey: "k", prompt, fetchFn: async () => { calls++; return http(403); } });
    expect(calls).toBe(1);
    expect(denied).toMatchObject({ ok: false, kind: "provider_unavailable", billed_calls: 0 });
    calls = 0;
    const down = await runGeminiAnalysis({ apiKey: "k", prompt, fetchFn: async () => { calls++; throw new Error("boom"); } });
    expect(calls).toBe(3);
    expect(down).toMatchObject({ ok: false, billed_calls: 0 });
  });

  it("o corpo da requisição usa o schema estruturado e limita a saída", () => {
    const body = buildGeminiRequestBody(prompt) as { generationConfig: { maxOutputTokens: number; responseFormat: { text: { mimeType: string; schema: { required: string[] } } } } };
    expect(body.generationConfig.maxOutputTokens).toBeLessThanOrEqual(5000);
    expect(body.generationConfig.responseFormat.text.mimeType).toBe("application/json");
    expect(body.generationConfig.responseFormat.text.schema.required).toEqual(["diagnostico", "resumo_estrategia", "plano"]);
  });
});
