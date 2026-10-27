import { describe, expect, it } from "vitest";
import {
  GEMINI_JSON_MIME_TYPE,
  REFINE_MODELS,
  buildProviderFailure,
  isDuplicateRefine,
  runRefine,
  runGuardedRefine,
  mergePlanPreservingUser,
  acquireRefineLock,
  REFINE_LOCK_TTL_MS,
  type LeadRefineRow,
  type RefineStore,
  shouldChargeCredit,
  shouldPersistAnalysis,
  summarizeProviderError,
  validateAnalysis,
} from "./refine-provider-guard";

const day = (dia: number, extra: Record<string, unknown> = {}) => ({
  dia,
  canal: "whatsapp",
  acao_sugerida: `Ação ${dia}`,
  mensagem: `Mensagem específica do dia ${dia}`,
  objecao_provavel: "Já temos fornecedor.",
  resposta_sugerida: "Entendo.",
  cta: "Faz sentido?",
  ...extra,
});
const valid = () => ({
  diagnostico_bullets: ["a", "b", "c"],
  probabilidade_conversao: 61,
  fit_level: "medio",
  commercial_opportunity: "op",
  probable_pain: "dor",
  messages: { whatsapp_primary: "w", instagram: "i", email_body: "e" },
  plano_prospeccao_7dias: [1, 2, 3, 4, 5, 6, 7].map((d) => day(d)),
});

describe("contrato com o Gemini", () => {
  it("usa o valor de enum aceito pela API, não o MIME em minúsculas que gera HTTP 400", () => {
    expect(GEMINI_JSON_MIME_TYPE).toBe("APPLICATION_JSON");
  });

  it("não repete o modelo aposentado que a API redireciona para o primeiro", () => {
    expect(REFINE_MODELS).not.toContain("gemini-3.5-flash");
    expect(new Set(REFINE_MODELS).size).toBe(REFINE_MODELS.length);
  });
});

describe("validateAnalysis: resposta incompleta nunca vira plano genérico", () => {
  it("aceita uma análise completa e preserva as mensagens exatamente", () => {
    const result = validateAnalysis(valid());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.plano_prospeccao_7dias).toHaveLength(7);
      expect(result.value.plano_prospeccao_7dias[0].mensagem).toBe("Mensagem específica do dia 1");
    }
  });

  it("recusa menos de 3 tópicos de diagnóstico (antes era completado com texto de reserva)", () => {
    const raw = { ...valid(), diagnostico_bullets: ["só um"] };
    expect(validateAnalysis(raw)).toEqual({ ok: false, reason: "diagnostico_incomplete" });
  });

  it("recusa plano sem algum dos 7 dias (antes o dia ausente era substituído pela copy de reserva)", () => {
    const raw = { ...valid(), plano_prospeccao_7dias: [1, 2, 3, 4, 5, 7].map((d) => day(d)) };
    expect(validateAnalysis(raw)).toEqual({ ok: false, reason: "plan_day_6_missing" });
  });

  it("recusa dia com mensagem vazia", () => {
    const days = [1, 2, 3, 4, 5, 6, 7].map((d) => day(d, d === 3 ? { mensagem: "  " } : {}));
    expect(validateAnalysis({ ...valid(), plano_prospeccao_7dias: days })).toEqual({ ok: false, reason: "plan_day_3_incomplete" });
  });

  it("recusa probabilidade ausente e respostas que não são objeto", () => {
    expect(validateAnalysis({ ...valid(), probabilidade_conversao: undefined }).ok).toBe(false);
    expect(validateAnalysis(null).ok).toBe(false);
    expect(validateAnalysis([]).ok).toBe(false);
    expect(validateAnalysis("texto").ok).toBe(false);
  });

  it("só troca o canal inválido pelo padrão; o texto continua do modelo", () => {
    const days = [1, 2, 3, 4, 5, 6, 7].map((d) => day(d, d === 2 ? { canal: "telegrama" } : {}));
    const result = validateAnalysis({ ...valid(), plano_prospeccao_7dias: days }, "email");
    expect(result.ok && result.value.plano_prospeccao_7dias[1].canal).toBe("email");
    expect(result.ok && result.value.plano_prospeccao_7dias[1].mensagem).toBe("Mensagem específica do dia 2");
  });
});

describe("persistência e cobrança", () => {
  it("análise inválida não grava e não cobra", () => {
    const invalid = validateAnalysis({});
    expect(shouldPersistAnalysis(invalid)).toBe(false);
    expect(shouldChargeCredit(invalid, false)).toBe(false);
  });

  it("análise válida grava; cobra só quem não é administrador", () => {
    const ok = validateAnalysis(valid());
    expect(shouldPersistAnalysis(ok)).toBe(true);
    expect(shouldChargeCredit(ok, false)).toBe(true);
    expect(shouldChargeCredit(ok, true)).toBe(false);
  });
});

describe("buildProviderFailure", () => {
  it("falha do provedor: 502, success false, sem fallback, sem gravação, sem crédito, repetível", () => {
    const f = buildProviderFailure("req-1", "gemini-3.6-flash:400");
    expect(f.status).toBe(502);
    expect(f.body).toMatchObject({
      success: false,
      error_code: "REFINE_PROVIDER_UNAVAILABLE",
      category: "provider_error",
      retryable: true,
      used_fallback: false,
      credit_consumed: false,
      saved: false,
    });
    expect(f.body.safe_message).toMatch(/crédito não foi consumido/i);
    expect(f.body.safe_message).toMatch(/anterior foi mantida/i);
  });

  it("chave ausente: 503 de configuração, sem prometer nova tentativa", () => {
    const f = buildProviderFailure("req-2", "gemini_key_missing");
    expect(f.status).toBe(503);
    expect(f.body.error_code).toBe("REFINE_CONFIGURATION_MISSING");
    expect(f.body.retryable).toBe(false);
  });

  it("a mensagem pública não vaza o motivo interno", () => {
    expect(JSON.stringify(buildProviderFailure("req-3", "gemini-3.6-flash:400"))).not.toMatch(/gemini-3|400/);
  });
});

describe("summarizeProviderError", () => {
  it("extrai status e mensagem do corpo de erro do Gemini", () => {
    const body = JSON.stringify({ error: { code: 400, status: "INVALID_ARGUMENT", message: 'Invalid value at generation_config.response_format.text.mime_type' } });
    expect(summarizeProviderError(body)).toBe("INVALID_ARGUMENT: Invalid value at generation_config.response_format.text.mime_type");
  });

  it("mascara chave de API que apareça no corpo e limita o tamanho", () => {
    const out = summarizeProviderError(`key=AIza${"x".repeat(35)} ${"y".repeat(500)}`, 120);
    expect(out).not.toMatch(/AIza/);
    expect(out.length).toBeLessThanOrEqual(120);
  });
});

describe("isDuplicateRefine: clique duplo/duas abas não geram nem cobram duas vezes", () => {
  const now = Date.parse("2026-10-27T12:00:30Z");
  it("análise válida gravada há 10 s é duplicata", () => {
    expect(isDuplicateRefine({ generatedAt: "2026-10-27T12:00:20Z", usedFallback: false }, now)).toBe(true);
  });
  it("fora da janela (nova geração intencional) não é duplicata", () => {
    expect(isDuplicateRefine({ generatedAt: "2026-10-27T11:50:00Z", usedFallback: false }, now)).toBe(false);
  });
  it("texto de reserva recente nunca bloqueia uma nova tentativa", () => {
    expect(isDuplicateRefine({ generatedAt: "2026-10-27T12:00:25Z", usedFallback: true }, now)).toBe(false);
  });
  it("sem análise anterior ou data inválida não é duplicata", () => {
    expect(isDuplicateRefine({ generatedAt: null, usedFallback: null }, now)).toBe(false);
    expect(isDuplicateRefine({ generatedAt: "lixo", usedFallback: false }, now)).toBe(false);
  });
});

describe("runRefine: ordem provedor → gravação confirmada → cobrança", () => {
  const analysis = () => {
    const r = validateAnalysis(valid());
    if (!r.ok) throw new Error("fixture inválida");
    return r.value;
  };
  const deps = (over: Partial<Parameters<typeof runRefine>[0]> = {}) => {
    const calls: string[] = [];
    const base = {
      requestId: "req",
      isAdmin: false,
      callProvider: async () => { calls.push("provider"); return { ok: true as const, analysis: analysis(), model: "gemini-3.6-flash" }; },
      persist: async () => { calls.push("persist"); return true; },
      charge: async () => { calls.push("charge"); return true; },
    };
    return { calls, deps: { ...base, ...over } };
  };

  it("Gemini válido + gravação confirmada: grava e cobra 1 vez, nessa ordem", async () => {
    const { calls, deps: d } = deps();
    const run = await runRefine(d);
    expect(run).toMatchObject({ status: "saved", charged: true, creditWarning: null, model: "gemini-3.6-flash" });
    expect(calls).toEqual(["provider", "persist", "charge"]);
  });

  it("Gemini HTTP 400 (todos os modelos): nada gravado, nada cobrado, erro 502 claro", async () => {
    const { calls, deps: d } = deps({ callProvider: async () => { calls.push("provider"); return { ok: false as const, error: "gemini-3.5-flash-lite:400" }; } });
    const run = await runRefine(d);
    expect(run.status).toBe("provider_failed");
    expect(run.status === "provider_failed" && run.failure.status).toBe(502);
    expect(calls).toEqual(["provider"]);
  });

  it("Gemini devolve análise inválida: não grava e não cobra", async () => {
    const { calls, deps: d } = deps({ callProvider: async () => ({ ok: true as const, analysis: { diagnostico_bullets: ["a"] } as never, model: "gemini-3.6-flash" }) });
    const run = await runRefine(d);
    expect(run.status).toBe("provider_failed");
    expect(calls).toEqual([]);
  });

  it("falha ao gravar: não cobra e informa save_failed", async () => {
    const { calls, deps: d } = deps({ persist: async () => { calls.push("persist"); return false; } });
    const run = await runRefine(d);
    expect(run.status).toBe("save_failed");
    expect(calls).toEqual(["provider", "persist"]);
  });

  it("administrador não é cobrado", async () => {
    const { calls, deps: d } = deps({ isAdmin: true });
    const run = await runRefine(d);
    expect(run).toMatchObject({ status: "saved", charged: false });
    expect(calls).not.toContain("charge");
  });

  it("falha ao descontar o crédito não desfaz a análise gravada e gera aviso (sem cobrança duplicada)", async () => {
    const { calls, deps: d } = deps({ charge: async () => { calls.push("charge"); throw new Error("rpc"); } });
    const run = await runRefine(d);
    expect(run).toMatchObject({ status: "saved", charged: false });
    expect(run.status === "saved" && run.creditWarning).toMatch(/consumo do crédito/);
    expect(calls.filter((c) => c === "charge")).toHaveLength(1);
  });

  it("não há segunda rodada de provedor nem de cobrança", async () => {
    const { calls, deps: d } = deps();
    await runRefine(d);
    expect(calls.filter((c) => c === "provider")).toHaveLength(1);
    expect(calls.filter((c) => c === "charge")).toHaveLength(1);
  });
});

describe("mergePlanPreservingUser: o trabalho do assinante nunca é sobrescrito", () => {
  const fresh = (dia: number) => ({ dia, canal: "whatsapp", acao_sugerida: `nova ${dia}`, mensagem: `Mensagem NOVA do dia ${dia}`, objecao_provavel: "", resposta_sugerida: "", cta: "" });
  const nextDays = [1, 2, 3, 4, 5, 6, 7].map(fresh);
  const old = (dia: number, extra: Record<string, unknown> = {}) => ({ dia, canal: "email", acao_sugerida: "antiga", mensagem: `Mensagem ANTIGA ${dia}`, objecao_provavel: "x", resposta_sugerida: "y", cta: "z", ...extra });

  it("mensagem editada manualmente (is_custom_edited) é mantida integralmente", () => {
    const previous = { plano_prospeccao_7dias: [old(2, { is_custom_edited: true, edited_at: "2026-10-20T10:00:00Z" })] };
    const { days, preserved } = mergePlanPreservingUser(previous, nextDays);
    expect(days[1]).toMatchObject({ mensagem: "Mensagem ANTIGA 2", is_custom_edited: true, edited_at: "2026-10-20T10:00:00Z" });
    expect(days[0].mensagem).toBe("Mensagem NOVA do dia 1");
    expect(preserved).toEqual([{ dia: 2, reason: "edited" }]);
  });

  it("etapa concluída e dia bloqueado por recusa são mantidos", () => {
    const previous = [old(1, { status_dia: "concluido" }), old(3, { status_dia: "bloqueado_optout" })];
    const { days, preserved } = mergePlanPreservingUser(previous, nextDays);
    expect(days[0].mensagem).toBe("Mensagem ANTIGA 1");
    expect(days[2].mensagem).toBe("Mensagem ANTIGA 3");
    expect(preserved).toEqual([{ dia: 1, reason: "completed" }, { dia: 3, reason: "optout_blocked" }]);
  });

  it("dias sem edição nem conclusão recebem o texto novo; sem plano anterior, tudo é novo", () => {
    expect(mergePlanPreservingUser([old(4)], nextDays).days[3].mensagem).toBe("Mensagem NOVA do dia 4");
    const none = mergePlanPreservingUser(null, nextDays);
    expect(none.preserved).toEqual([]);
    expect(none.days).toEqual(nextDays);
  });

  it("lead antigo com plano em lista (sem marcações) continua compatível", () => {
    const legacy = [1, 2, 3, 4, 5, 6, 7].map((d) => old(d));
    expect(mergePlanPreservingUser(legacy, nextDays).preserved).toEqual([]);
  });
});

// Banco em memória com UPDATE condicional atômico (o mesmo contrato do UPDATE ... WHERE ... do Postgres).
const makeDb = (initial: Partial<LeadRefineRow> = {}) => {
  const row: LeadRefineRow = { reason: null, updatedAt: null, generatedAt: null, usedFallback: null, plan: null, ...initial };
  const log: string[] = [];
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const store: RefineStore = {
    read: async () => { await tick(); return { ...row }; },
    claim: async (prev, lockValue, nowIso) => {
      await tick();
      if (row.reason !== prev) return false; // atômico: só uma requisição vence
      row.reason = lockValue; row.updatedAt = nowIso; log.push("claim");
      return true;
    },
    release: async (lockValue, restore) => {
      await tick();
      if (row.reason === lockValue) { row.reason = restore; log.push("release"); }
    },
  };
  return { row, log, store };
};

describe("exclusão mútua por lead: duas requisições simultâneas", () => {
  const analysisOk = () => {
    const r = validateAnalysis(valid());
    if (!r.ok) throw new Error("fixture");
    return r.value;
  };
  const makeRun = (db: ReturnType<typeof makeDb>, counters: { provider: number; persist: number; charge: number }, requestId: string, over: Partial<Parameters<typeof runGuardedRefine>[0]> = {}) =>
    runGuardedRefine({
      requestId,
      isAdmin: false,
      store: db.store,
      callProvider: async () => { counters.provider++; await new Promise((r) => setTimeout(r, 5)); return { ok: true as const, analysis: analysisOk(), model: "gemini-3.6-flash" }; },
      persist: async (_a, _m, ctx) => {
        counters.persist++;
        if (db.row.reason !== ctx.lockValue) return false;
        db.row.reason = null; db.row.generatedAt = new Date().toISOString(); db.row.usedFallback = false;
        return true;
      },
      charge: async () => { counters.charge++; return true; },
      ...over,
    });

  it("duas abas ao mesmo tempo: uma gera e cobra, a outra recebe 'em andamento' sem Gemini e sem cobrança", async () => {
    const db = makeDb();
    const c = { provider: 0, persist: 0, charge: 0 };
    const [a, b] = await Promise.all([makeRun(db, c, "tab-a"), makeRun(db, c, "tab-b")]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["in_progress", "saved"]);
    expect(c).toEqual({ provider: 1, persist: 1, charge: 1 });
    expect(db.row.reason).toBeNull();
  });

  it("dez requisições simultâneas: exatamente uma cobrança", async () => {
    const db = makeDb();
    const c = { provider: 0, persist: 0, charge: 0 };
    const runs = await Promise.all(Array.from({ length: 10 }, (_, i) => makeRun(db, c, `r${i}`)));
    expect(runs.filter((r) => r.status === "saved")).toHaveLength(1);
    expect(runs.filter((r) => r.status === "in_progress")).toHaveLength(9);
    expect(c.charge).toBe(1);
    expect(c.provider).toBe(1);
  });

  it("ABA: a outra requisição termina entre a leitura e a reserva e a análise recém-gravada é reaproveitada (sem 2ª geração)", async () => {
    const db = makeDb();
    const c = { provider: 0, persist: 0, charge: 0 };
    const first = await makeRun(db, c, "first");
    expect(first.status).toBe("saved");
    // segunda requisição chega logo depois, com a análise de 'first' gravada há instantes
    const second = await makeRun(db, c, "second");
    expect(second.status).toBe("already_current");
    expect(c).toEqual({ provider: 1, persist: 1, charge: 1 });
  });

  it("falha do Gemini libera a reserva e restaura o valor anterior, sem gravar nem cobrar", async () => {
    const db = makeDb({ reason: "gemini-3.1-flash-lite:400" });
    const c = { provider: 0, persist: 0, charge: 0 };
    const run = await makeRun(db, c, "x", { callProvider: async () => { c.provider++; return { ok: false as const, error: "gemini:400" }; } });
    expect(run.status).toBe("provider_failed");
    expect(db.row.reason).toBe("gemini-3.1-flash-lite:400");
    expect(c).toEqual({ provider: 1, persist: 0, charge: 0 });
  });

  it("falha de gravação libera a reserva e não cobra; uma nova tentativa depois consegue", async () => {
    const db = makeDb();
    const c = { provider: 0, persist: 0, charge: 0 };
    const failed = await makeRun(db, c, "w1", { persist: async () => { c.persist++; return false; } });
    expect(failed.status).toBe("save_failed");
    expect(db.row.reason).toBeNull();
    expect(c.charge).toBe(0);
    const retry = await makeRun(db, c, "w2");
    expect(retry.status).toBe("saved");
    expect(c.charge).toBe(1);
  });

  it("exceção no meio também libera a reserva", async () => {
    const db = makeDb();
    const c = { provider: 0, persist: 0, charge: 0 };
    await expect(makeRun(db, c, "boom", { callProvider: async () => { throw new Error("rede"); } })).rejects.toThrow("rede");
    expect(db.row.reason).toBeNull();
  });

  it("reserva abandonada (função morreu) expira e deixa de bloquear; reserva recente bloqueia", async () => {
    const now = Date.parse("2026-10-27T12:00:00Z");
    const stale = makeDb({ reason: "refine_lock_old", updatedAt: new Date(now - REFINE_LOCK_TTL_MS - 1000).toISOString() });
    expect((await acquireRefineLock(stale.store, "new", now)).acquired).toBe(true);
    const fresh = makeDb({ reason: "refine_lock_old", updatedAt: new Date(now - 10_000).toISOString() });
    expect(await acquireRefineLock(fresh.store, "new", now)).toEqual({ acquired: false, reason: "in_progress" });
  });

  it("administrador não é cobrado mesmo com a reserva", async () => {
    const db = makeDb();
    const c = { provider: 0, persist: 0, charge: 0 };
    const run = await makeRun(db, c, "adm", { isAdmin: true });
    expect(run.status).toBe("saved");
    expect(c.charge).toBe(0);
  });

  it("mensagem editada e etapa concluída chegam intactas ao banco; a resposta informa os dias mantidos", async () => {
    const plan = { historico: ["contato 1"], plano_prospeccao_7dias: [
      { dia: 2, canal: "whatsapp", mensagem: "MINHA EDIÇÃO", is_custom_edited: true },
      { dia: 4, canal: "email", mensagem: "enviada ontem", status_dia: "concluido" },
    ] };
    const db = makeDb({ plan });
    const c = { provider: 0, persist: 0, charge: 0 };
    let saved: unknown = null;
    const run = await makeRun(db, c, "m", { persist: async (analysis, _m, ctx) => { saved = analysis.plano_prospeccao_7dias; db.row.reason = null; db.row.generatedAt = new Date().toISOString(); return db.row.reason === null && ctx.lockValue.length > 0; } });
    expect(run.status).toBe("saved");
    const days = saved as Array<{ dia: number; mensagem: string }>;
    expect(days.find((d) => d.dia === 2)?.mensagem).toBe("MINHA EDIÇÃO");
    expect(days.find((d) => d.dia === 4)?.mensagem).toBe("enviada ontem");
    expect(days.find((d) => d.dia === 1)?.mensagem).toBe("Mensagem específica do dia 1");
    expect(run.status === "saved" && run.preserved).toEqual([{ dia: 2, reason: "edited" }, { dia: 4, reason: "completed" }]);
    expect(c.charge).toBe(1);
  });

  it("erro 400 do Gemini com dados anteriores: nada muda e nada é cobrado", async () => {
    const db = makeDb({ generatedAt: "2026-07-01T10:00:00Z", usedFallback: false, plan: { plano_prospeccao_7dias: [] } });
    const before = JSON.stringify(db.row);
    const c = { provider: 0, persist: 0, charge: 0 };
    const run = await makeRun(db, c, "e400", { callProvider: async () => ({ ok: false as const, error: "gemini-3.6-flash:400" }) });
    expect(run.status).toBe("provider_failed");
    expect(c.persist).toBe(0);
    expect(c.charge).toBe(0);
    expect({ ...db.row, updatedAt: null }).toEqual({ ...JSON.parse(before), updatedAt: null });
  });
});
