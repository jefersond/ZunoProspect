// Regras puras da análise com IA: o que é um resultado válido do provedor, o que pode ser gravado e quando
// há cobrança. Ficam fora do index.ts para serem testadas sem Deno nem rede.

/** Valor aceito pelo contrato oficial do generateContent (enum MimeType). A forma "application/json" é rejeitada com HTTP 400. */
export const GEMINI_JSON_MIME_TYPE = "APPLICATION_JSON";

/** `gemini-3.5-flash` foi aposentado e roteia para `gemini-3.6-flash`; repetir o mesmo modelo não é reserva. */
export const REFINE_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite"] as const;

const CHANNELS = ["whatsapp", "email", "instagram"];

export interface ValidAnalysis {
  diagnostico_bullets: string[];
  probabilidade_conversao: number;
  fit_level: string | null;
  commercial_opportunity: string;
  probable_pain: string;
  why_good_lead: string;
  messages: { whatsapp_primary: string; instagram: string; email_body: string };
  plano_prospeccao_7dias: Array<{
    dia: number;
    canal: string;
    acao_sugerida: string;
    mensagem: string;
    objecao_provavel: string;
    resposta_sugerida: string;
    cta: string;
  }>;
}

export type AnalysisValidation =
  | { ok: true; value: ValidAnalysis }
  | { ok: false; reason: string };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Valida a resposta do Gemini SEM completar lacunas com texto genérico: uma resposta incompleta é inválida.
 * `defaultChannel` só preenche o canal quando o modelo devolve um valor fora da lista conhecida.
 */
export function validateAnalysis(raw: unknown, defaultChannel = "whatsapp"): AnalysisValidation {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "not_an_object" };
  const r = raw as Record<string, unknown>;

  const bullets = Array.isArray(r.diagnostico_bullets)
    ? r.diagnostico_bullets.map(str).filter(Boolean).slice(0, 4)
    : [];
  if (bullets.length < 3) return { ok: false, reason: "diagnostico_incomplete" };

  const score = Number(r.probabilidade_conversao);
  if (!Number.isFinite(score)) return { ok: false, reason: "score_missing" };

  const byDay = new Map<number, Record<string, unknown>>();
  if (Array.isArray(r.plano_prospeccao_7dias)) {
    for (const d of r.plano_prospeccao_7dias) {
      const dia = Math.trunc(Number((d as Record<string, unknown>)?.dia));
      if (dia >= 1 && dia <= 7 && !byDay.has(dia)) byDay.set(dia, d as Record<string, unknown>);
    }
  }
  const plan: ValidAnalysis["plano_prospeccao_7dias"] = [];
  for (let dia = 1; dia <= 7; dia++) {
    const d = byDay.get(dia);
    if (!d) return { ok: false, reason: `plan_day_${dia}_missing` };
    const mensagem = str(d.mensagem);
    const acao = str(d.acao_sugerida);
    if (!mensagem || !acao) return { ok: false, reason: `plan_day_${dia}_incomplete` };
    plan.push({
      dia,
      canal: CHANNELS.includes(String(d.canal)) ? String(d.canal) : defaultChannel,
      acao_sugerida: acao,
      mensagem,
      objecao_provavel: str(d.objecao_provavel),
      resposta_sugerida: str(d.resposta_sugerida),
      cta: str(d.cta),
    });
  }

  const m = r.messages && typeof r.messages === "object" ? (r.messages as Record<string, unknown>) : {};
  return {
    ok: true,
    value: {
      diagnostico_bullets: bullets,
      probabilidade_conversao: Math.max(0, Math.min(100, score)),
      fit_level: ["alto", "medio", "baixo"].includes(String(r.fit_level)) ? String(r.fit_level) : null,
      commercial_opportunity: str(r.commercial_opportunity),
      probable_pain: str(r.probable_pain),
      why_good_lead: str(r.why_good_lead) || bullets.join(" "),
      messages: { whatsapp_primary: str(m.whatsapp_primary), instagram: str(m.instagram), email_body: str(m.email_body) },
      plano_prospeccao_7dias: plan,
    },
  };
}

export interface ProviderFailure {
  status: number;
  body: {
    success: false;
    request_id: string;
    error_code: string;
    category: "provider_error" | "configuration_error";
    retryable: boolean;
    safe_message: string;
    error_message: string;
    used_fallback: false;
    credit_consumed: false;
    saved: false;
  };
}

/** Resposta de erro quando não há análise válida: nada é gravado, nenhum crédito é cobrado. */
export function buildProviderFailure(requestId: string, reason: string): ProviderFailure {
  const missingKey = reason === "gemini_key_missing";
  const message = missingKey
    ? "A análise com IA está temporariamente indisponível. Seu crédito não foi consumido e a análise anterior foi mantida."
    : "Não foi possível gerar a análise com IA agora. Seu crédito não foi consumido e a análise anterior foi mantida. Tente novamente em alguns instantes.";
  return {
    status: missingKey ? 503 : 502,
    body: {
      success: false,
      request_id: requestId,
      error_code: missingKey ? "REFINE_CONFIGURATION_MISSING" : "REFINE_PROVIDER_UNAVAILABLE",
      category: missingKey ? "configuration_error" : "provider_error",
      retryable: !missingKey,
      safe_message: message,
      error_message: message,
      used_fallback: false,
      credit_consumed: false,
      saved: false,
    },
  };
}

/** Só se grava e só se cobra uma análise que passou pela validação. */
export const shouldPersistAnalysis = (validation: AnalysisValidation) => validation.ok;
export const shouldChargeCredit = (validation: AnalysisValidation, isAdmin: boolean) => validation.ok && !isAdmin;

/** Resumo curto e sem segredos do corpo de um erro HTTP do provedor, para o log. */
export function summarizeProviderError(body: string, max = 240): string {
  let message = body;
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown; status?: unknown } };
    const m = parsed?.error?.message;
    const s = parsed?.error?.status;
    message = [typeof s === "string" ? s : "", typeof m === "string" ? m : ""].filter(Boolean).join(": ") || body;
  } catch {
    // corpo não-JSON: usa o texto cru
  }
  return message
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_API_KEY]")
    .replace(/\s+/g, " ")
    .slice(0, max);
}

/** Janela em que uma segunda solicitação para o mesmo lead é tratada como duplicata (clique duplo, duas abas). */
export const DUPLICATE_REFINE_WINDOW_MS = 30_000;

/**
 * Já existe uma análise válida (não de reserva) gravada agora há pouco: a nova solicitação é duplicata e não deve
 * chamar o Gemini nem cobrar outro crédito. Uma nova geração intencional continua possível fora da janela.
 */
export function isDuplicateRefine(
  last: { generatedAt: string | null | undefined; usedFallback: boolean | null | undefined },
  now = Date.now(),
  windowMs = DUPLICATE_REFINE_WINDOW_MS,
): boolean {
  if (!last.generatedAt || last.usedFallback === true) return false;
  const at = Date.parse(last.generatedAt);
  if (!Number.isFinite(at)) return false;
  const age = now - at;
  return age >= 0 && age < windowMs;
}

export type ProviderOutcome =
  | { ok: true; analysis: ValidAnalysis; model: string }
  | { ok: false; error: string };

export interface RefineDeps {
  requestId: string;
  isAdmin: boolean;
  /** Uma única rodada de chamadas ao provedor (cada modelo no máximo uma vez). */
  callProvider: () => Promise<ProviderOutcome>;
  /** Grava a análise; deve devolver true somente quando o banco confirmou a linha gravada. */
  persist: (analysis: ValidAnalysis, model: string) => Promise<boolean>;
  /** Desconta 1 crédito interno; true somente se o desconto foi registrado. */
  charge: () => Promise<boolean>;
}

export type RefineRun =
  | { status: "provider_failed"; reason: string; failure: ProviderFailure }
  | { status: "save_failed" }
  | { status: "saved"; model: string; analysis: ValidAnalysis; charged: boolean; creditWarning: string | null };

export const SAVE_FAILED_BODY = (requestId: string) => ({
  success: false as const,
  request_id: requestId,
  error_code: "REFINE_SAVE_FAILED",
  category: "database_error" as const,
  retryable: true,
  safe_message: "A análise foi gerada, mas não pôde ser salva. Seu crédito não foi consumido e a análise anterior foi mantida.",
  error_message: "A análise foi gerada, mas não pôde ser salva. Seu crédito não foi consumido e a análise anterior foi mantida.",
  credit_consumed: false as const,
  saved: false as const,
});

/**
 * Ordem obrigatória: provedor → gravação confirmada → cobrança. Falha do provedor ou da gravação nunca cobra;
 * cobrança só existe para análise válida já persistida, e administradores não são cobrados.
 */
export async function runRefine(deps: RefineDeps): Promise<RefineRun> {
  const provider = await deps.callProvider();
  if (!provider.ok) {
    return { status: "provider_failed", reason: provider.error, failure: buildProviderFailure(deps.requestId, provider.error) };
  }
  const validation = validateAnalysis(provider.analysis);
  if (!validation.ok) {
    return { status: "provider_failed", reason: `invalid_output:${validation.reason}`, failure: buildProviderFailure(deps.requestId, `invalid_output:${validation.reason}`) };
  }
  const saved = await deps.persist(validation.value, provider.model);
  if (!saved) return { status: "save_failed" };

  let charged = false;
  let creditWarning: string | null = null;
  if (shouldChargeCredit(validation, deps.isAdmin)) {
    try {
      charged = await deps.charge();
    } catch {
      charged = false;
    }
    if (!charged) creditWarning = "Análise atualizada, mas houve um erro ao registrar o consumo do crédito.";
  }
  return { status: "saved", model: provider.model, analysis: validation.value, charged, creditWarning };
}
