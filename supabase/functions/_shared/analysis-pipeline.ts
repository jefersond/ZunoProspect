import {
  buildAnalysisPrompt,
  buildPersistedPayload,
  buildVerifiedFacts,
  evaluatePreconditions,
  mergeWithPreviousPlan,
  runGeminiAnalysis,
  toStoredDay,
  validateAnalysis,
  type BillingCertainty,
  type GeminiRequestOptions,
  type GeminiTelemetry,
  type RawLeadForAnalysis,
  type SellerProfile,
  type StoredDay,
} from "./lead-analysis.ts";

type FetchFn = Parameters<typeof runGeminiAnalysis>[0]["fetchFn"];

export interface PipelineDeps {
  apiKey: string;
  fetchFn: FetchFn;
  models?: string[];
  request?: GeminiRequestOptions;
  timeoutMs?: number;
  now: () => string;
  /** Grava o resultado no lead do usuário. Retorna false se não confirmou a gravação. */
  persist: (values: { diagnostico_bullets: string[]; plano_prospeccao: unknown; ai_analise_gerada_em: string }) => Promise<boolean>;
  /** Desconta 1 crédito interno. Só é chamado depois da gravação confirmada. */
  consumeCredit: () => Promise<boolean>;
}

export interface PipelineInput {
  leadId: string;
  requestId: string;
  profile: SellerProfile;
  rawLead: RawLeadForAnalysis;
  existingPlan: unknown;
  replaceExisting: boolean;
  isAdmin: boolean;
}

export interface PipelineSuccess {
  ok: true;
  payload: ReturnType<typeof buildPersistedPayload>;
  preservedDays: number[];
  demotedDays: number[];
  warnings: string[];
  telemetry: GeminiTelemetry;
  internalCreditCharged: boolean;
  creditWarning: string | null;
}

export interface PipelineFailure {
  ok: false;
  code: string;
  status: number;
  message: string;
  extra?: Record<string, unknown>;
  telemetry: GeminiTelemetry | null;
  /** Cobrança do PROVEDOR (Gemini). "not_called": nenhuma requisição foi feita. Independe do crédito interno. */
  providerBilling: BillingCertainty | "not_called";
  internalCreditCharged: false;
}

const failure = (f: Omit<PipelineFailure, "ok" | "internalCreditCharged">): PipelineFailure => ({ ok: false, internalCreditCharged: false, ...f });

/**
 * Análise completa em UMA geração. Ordem: pré-condições (sem custo) → Gemini → validação → mesclagem com o plano
 * anterior → gravação confirmada → só então o crédito interno. Falha em qualquer etapa NÃO desconta crédito.
 */
export async function runAnalysisPipeline(deps: PipelineDeps, input: PipelineInput): Promise<PipelineSuccess | PipelineFailure> {
  const facts = buildVerifiedFacts(input.rawLead);

  const blocked = evaluatePreconditions({
    profile: input.profile,
    stage: facts.etapa_do_historico,
    existingPlan: input.existingPlan,
    replaceExisting: input.replaceExisting,
  });
  if (blocked) {
    return failure({
      code: blocked.code,
      status: blocked.status,
      message: blocked.message,
      extra: blocked.code === "REFINE_PROFILE_REQUIRED" ? { missing_fields: blocked.missing } : undefined,
      telemetry: null,
      providerBilling: "not_called",
    });
  }

  const run = await runGeminiAnalysis({
    apiKey: deps.apiKey,
    prompt: buildAnalysisPrompt(facts, input.profile),
    fetchFn: deps.fetchFn,
    models: deps.models,
    request: deps.request,
    timeoutMs: deps.timeoutMs,
  });

  if ("kind" in run) {
    const map: Record<string, { code: string; status: number; message: string }> = {
      invalid_request: { code: "REFINE_PROVIDER_INVALID_REQUEST", status: 502, message: "A configuração da análise foi recusada pelo provedor de IA. Seu crédito não foi consumido. Já registramos o problema." },
      auth_error: { code: "REFINE_PROVIDER_AUTH_FAILED", status: 503, message: "O serviço de IA está indisponível por um problema de configuração. Seu crédito não foi consumido." },
      invalid_output: { code: "REFINE_PROVIDER_INVALID_RESPONSE", status: 502, message: "Não conseguimos gerar uma análise válida agora. Seu crédito não foi consumido. Tente novamente." },
      provider_unavailable: { code: "REFINE_PROVIDER_UNAVAILABLE", status: 503, message: "O serviço de IA está indisponível no momento. Seu crédito não foi consumido. Tente novamente em instantes." },
    };
    return failure({ ...map[run.kind], telemetry: run.telemetry, providerBilling: run.telemetry.billing });
  }

  const validation = validateAnalysis(run.raw, { channels: facts.canais_disponiveis, profile: input.profile, stage: facts.etapa_do_historico, facts });
  if ("issues" in validation) {
    return failure({
      code: "REFINE_PROVIDER_INVALID_RESPONSE",
      status: 502,
      message: "A análise gerada não passou na verificação de qualidade. Seu crédito não foi consumido. Tente novamente.",
      extra: { validation_issues: validation.issues.slice(0, 8) },
      telemetry: run.telemetry,
      providerBilling: run.telemetry.billing,
    });
  }

  const now = deps.now();
  const newDays = validation.analysis.plano.map(toStoredDay) as StoredDay[];
  const hadPlan = Array.isArray(input.existingPlan) ? input.existingPlan.length > 0 : Boolean(input.existingPlan);
  const merged = hadPlan
    ? mergeWithPreviousPlan(newDays, input.existingPlan, now)
    : { days: newDays, history: [] as Record<string, unknown>[], preserved_days: [] as number[] };

  const payload = buildPersistedPayload({
    leadId: input.leadId,
    requestId: input.requestId,
    model: run.model,
    generatedAt: now,
    facts,
    profile: input.profile,
    analysis: validation.analysis,
    days: merged.days,
    history: merged.history,
    warnings: validation.warnings,
    telemetry: run.telemetry,
  });

  const saved = await deps.persist({
    diagnostico_bullets: payload.diagnostico_bullets,
    plano_prospeccao: payload,
    ai_analise_gerada_em: now,
  });
  if (!saved) {
    return failure({
      code: "REFINE_SAVE_FAILED",
      status: 503,
      message: "A análise foi gerada, mas não pôde ser salva. Seu crédito não foi consumido.",
      telemetry: run.telemetry,
      providerBilling: run.telemetry.billing,
    });
  }

  let internalCreditCharged = false;
  let creditWarning: string | null = null;
  if (!input.isAdmin) {
    try {
      internalCreditCharged = await deps.consumeCredit();
      if (!internalCreditCharged) creditWarning = "Análise concluída, mas houve um erro ao registrar o consumo do crédito.";
    } catch {
      creditWarning = "Análise concluída, mas houve um erro ao registrar o consumo do crédito.";
    }
  }

  return {
    ok: true,
    payload,
    preservedDays: merged.preserved_days,
    demotedDays: validation.demoted_days,
    warnings: validation.warnings,
    telemetry: run.telemetry,
    internalCreditCharged,
    creditWarning,
  };
}
