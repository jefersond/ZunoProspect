import { describe, expect, it } from "vitest";
import {
  ANALYSIS_PROMPT_VERSION,
  DEFAULT_MODELS,
  MAX_HTTP_ATTEMPTS,
  MAX_OUTPUT_TOKENS,
  classifyHttpStatus,
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
} from "./lead-analysis";
import { GEMINI_CONTRACT_REVISION, createFakeGeminiFetch, validateGenerateContentBody } from "./gemini-contract";

import { day, goodRaw, lead, profile } from "./test-fixtures";

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

  it("payload registra tentativas, versão do prompt e não contém score", () => {
    const r = validateAnalysis(goodRaw(), ctx);
    if (!r.ok) throw new Error("fixture inválida");
    const payload = buildPersistedPayload({
      leadId: "l1", requestId: "r1", model: "gemini-x", generatedAt: "2026-10-27T00:00:00Z",
      facts: buildVerifiedFacts(lead), profile, analysis: r.analysis, days: r.analysis.plano.map(toStoredDay),
      history: [], warnings: r.warnings,
      telemetry: { attempts: [], http_attempts: 1, generations_with_content: 1, model_used: "gemini-x", finish_reason: "STOP", usage: null, billing: "billed" },
    });
    expect(payload.prompt_version).toBe(ANALYSIS_PROMPT_VERSION);
    expect(payload.debug.http_attempts).toBe(1);
    expect(payload.debug.generations_with_content).toBe(1);
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

describe("contrato HTTP oficial do generateContent (sem chamadas reais)", () => {
  const prompt = buildAnalysisPrompt(buildVerifiedFacts(lead), profile);
  const goodJson = JSON.stringify(goodRaw());

  it(`o corpo enviado respeita o contrato oficial (revisão ${GEMINI_CONTRACT_REVISION})`, () => {
    expect(validateGenerateContentBody(buildGeminiRequestBody(prompt))).toEqual([]);
    for (const level of ["MINIMAL", "LOW", "MEDIUM", "HIGH"] as const) {
      expect(validateGenerateContentBody(buildGeminiRequestBody(prompt, { thinkingLevel: level }))).toEqual([]);
    }
    expect(validateGenerateContentBody(buildGeminiRequestBody(prompt, { thinkingLevel: null }))).toEqual([]);
  });

  it("usa responseFormat.text com mimeType em ENUM (APPLICATION_JSON) e não o campo obsoleto", () => {
    const body = buildGeminiRequestBody(prompt) as { generationConfig: Record<string, unknown> };
    expect(body.generationConfig.responseFormat).toMatchObject({ text: { mimeType: "APPLICATION_JSON" } });
    expect(body.generationConfig).not.toHaveProperty("responseSchema");
    expect(body.generationConfig).not.toHaveProperty("responseMimeType");
    expect(body.generationConfig).not.toHaveProperty("temperature"); // ignorado no Gemini 3.6 Flash e posteriores
  });

  it("REGRESSÃO: o formato anterior ('application/json') é recusado pelo contrato (seria HTTP 400)", () => {
    const old = buildGeminiRequestBody(prompt) as { generationConfig: { responseFormat: { text: { mimeType: string } } } };
    old.generationConfig.responseFormat.text.mimeType = "application/json";
    const errors = validateGenerateContentBody(old);
    expect(errors.join(" ")).toMatch(/mime_type: Invalid value "application\/json"/);
  });

  type Mutable = { foo?: number; generationConfig: { responseMimeTyp?: string; responseSchema?: unknown; thinkingConfig: { thinkingLevel: string }; responseFormat: { text: { mimeType: string; schema: { properties: { resumo_estrategia: { pattern?: string } } } } } } };
  it.each([
    ["campo desconhecido no generationConfig", (b: Mutable) => { b.generationConfig.responseMimeTyp = "x"; }, /Unknown name "responseMimeTyp"/],
    ["thinkingLevel inválido", (b: Mutable) => { b.generationConfig.thinkingConfig.thinkingLevel = "low"; }, /thinking_level/],
    ["palavra-chave de schema sem suporte (pattern)", (b: Mutable) => { b.generationConfig.responseFormat.text.schema.properties.resumo_estrategia.pattern = "^a"; }, /não suportada "pattern"/],
    ["campos obsoletos de formato", (b: Mutable) => { b.generationConfig.responseSchema = {}; }, /obsoletos/],
    ["schema sem mimeType JSON", (b: Mutable) => { b.generationConfig.responseFormat.text.mimeType = "TEXT_PLAIN"; }, /só se aplica com mime_type APPLICATION_JSON/],
    ["campo desconhecido no topo", (b: Mutable) => { b.foo = 1; }, /Unknown name "foo"/],
  ])("o contrato recusa: %s", (_n, mutate, expected) => {
    const body = JSON.parse(JSON.stringify(buildGeminiRequestBody(prompt))) as Mutable;
    mutate(body);
    expect(validateGenerateContentBody(body).join(" ")).toMatch(expected);
  });

  it("o schema usa só palavras-chave suportadas e todo 'required' existe em 'properties'", () => {
    // validateGenerateContentBody já percorre o schema; garante que nosso schema real passa sem erros.
    expect(validateGenerateContentBody(buildGeminiRequestBody("x"))).toEqual([]);
  });

  it("cadeia de modelos: sem o alias aposentado gemini-3.5-flash e sem repetição", () => {
    expect(DEFAULT_MODELS).toEqual(["gemini-3.6-flash", "gemini-3.5-flash-lite"]);
    expect(DEFAULT_MODELS).not.toContain("gemini-3.5-flash");
    expect(new Set(DEFAULT_MODELS).size).toBe(DEFAULT_MODELS.length);
  });
});

describe("custo: tentativas, tokens e cobrança (servidor falso que valida o contrato)", () => {
  const prompt = buildAnalysisPrompt(buildVerifiedFacts(lead), profile);
  const good = JSON.stringify(goodRaw());
  const run = (script: Parameters<typeof createFakeGeminiFetch>[0]["script"], extra: Partial<Parameters<typeof runGeminiAnalysis>[0]> = {}) => {
    const fake = createFakeGeminiFetch({ script });
    return runGeminiAnalysis({ apiKey: "k", prompt, fetchFn: fake.fetchFn as never, ...extra }).then((result) => ({ result, calls: fake.calls }));
  };

  it("caminho normal: UMA requisição, UMA geração, tokens separados (inclui raciocínio) e modelo usado", async () => {
    const { result, calls } = await run([{ status: 200, text: good, thoughtText: "raciocínio interno", usage: { promptTokenCount: 1600, candidatesTokenCount: 1400, thoughtsTokenCount: 700, totalTokenCount: 3700 } }]);
    expect(calls).toHaveLength(1);
    expect(calls[0].contractErrors).toEqual([]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.raw).toEqual(JSON.parse(good)); // a parte "thought" não entra na resposta
    expect(result.usage).toEqual({ prompt_tokens: 1600, output_tokens: 1400, thoughts_tokens: 700, total_tokens: 3700, cached_tokens: null });
    expect(result.telemetry).toMatchObject({ http_attempts: 1, generations_with_content: 1, model_used: "gemini-3.6-flash", finish_reason: "STOP", billing: "billed" });
  });

  it("HTTP 400 (configuração inválida): encerra na hora, 1 tentativa, não faturada, sem tentar outro modelo", async () => {
    const fake = createFakeGeminiFetch({ script: [{ status: 200, text: good }] });
    // força um corpo inválido: modelo recebe thinkingLevel fora do enum
    const result = await runGeminiAnalysis({ apiKey: "k", prompt, fetchFn: fake.fetchFn as never, request: { thinkingLevel: "invalido" as never } });
    expect(fake.calls).toHaveLength(1);
    expect(result).toMatchObject({ ok: false, kind: "invalid_request", telemetry: { http_attempts: 1, billing: "not_billed", generations_with_content: 0 } });
    expect(fake.calls[0].contractErrors.join(" ")).toMatch(/thinking_level/);
  });

  it("401/403 encerram (chave/permissão) sem repetir", async () => {
    for (const status of [401, 403]) {
      const { result, calls } = await run([{ status }]);
      expect(calls).toHaveLength(1);
      expect(result).toMatchObject({ ok: false, kind: "auth_error", telemetry: { billing: "not_billed" } });
    }
  });

  it("429 passa ao modelo de reserva, dentro do teto de tentativas", async () => {
    const { result, calls } = await run([{ status: 429 }, { status: 200, text: good }]);
    expect(calls.map((c) => c.model)).toEqual(["gemini-3.6-flash", "gemini-3.5-flash-lite"]);
    expect(result).toMatchObject({ ok: true, model: "gemini-3.5-flash-lite", telemetry: { http_attempts: 2, generations_with_content: 1, billing: "billed" } });
  });

  it(`teto: nunca mais que ${MAX_HTTP_ATTEMPTS} requisições HTTP, mesmo se todas falharem`, async () => {
    const { result, calls } = await run([{ status: 503 }], { models: ["a", "b", "c", "d"] });
    expect(calls).toHaveLength(MAX_HTTP_ATTEMPTS);
    expect(result).toMatchObject({ ok: false, kind: "provider_unavailable", telemetry: { http_attempts: MAX_HTTP_ATTEMPTS } });
  });

  it("5xx e timeout têm consumo DESCONHECIDO (não é o mesmo que 'não faturada')", async () => {
    const down = await run([{ status: 503 }]);
    expect(down.result.telemetry.billing).toBe("unknown");
    const slow = await run([{ throws: "timeout" }]);
    expect(slow.result.telemetry).toMatchObject({ billing: "unknown", attempts: expect.arrayContaining([expect.objectContaining({ outcome: "timeout" })]) });
    const rateLimited = await run([{ status: 429 }]);
    expect(rateLimited.result.telemetry.billing).toBe("not_billed");
  });

  it.each([
    ["JSON inválido", { status: 200 as const, text: "{não é json" }, "invalid_json", "billed"],
    ["resposta vazia", { status: 200 as const, text: null }, "empty", "unknown"],
    ["truncada por limite de tokens", { status: 200 as const, text: '{"diagnostico":', finishReason: "MAX_TOKENS" }, "truncated", "billed"],
  ])("200 com %s: NUNCA dispara nova requisição", async (_n, step, outcome, billing) => {
    const { result, calls } = await run([step, { status: 200, text: good }]);
    expect(calls).toHaveLength(1);
    expect(result).toMatchObject({ ok: false, kind: "invalid_output" });
    expect(result.telemetry.attempts[0]).toMatchObject({ outcome, billing });
  });

  it("limite de saída explícito no pedido", async () => {
    const { calls } = await run([{ status: 200, text: good }]);
    expect((calls[0].body as { generationConfig: { maxOutputTokens: number } }).generationConfig.maxOutputTokens).toBe(MAX_OUTPUT_TOKENS);
  });

  it.each([
    [400, "not_billed", false], [401, "not_billed", false], [403, "not_billed", false],
    [404, "not_billed", true], [429, "not_billed", true], [500, "unknown", true], [503, "unknown", true], [504, "unknown", true],
  ])("classificação do HTTP %i: %s, próximo modelo=%s", (status, billing, next) => {
    expect(classifyHttpStatus(status)).toMatchObject({ billing, nextModel: next });
  });
});
