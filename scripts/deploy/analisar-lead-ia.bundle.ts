import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// GERADO por scripts/build-analisar-lead-ia-bundle.mjs: não edite. Fonte: supabase/functions/analisar-lead-ia/index.ts
// e supabase/functions/_shared/refine-provider-guard.ts.
// ===== refine-provider-guard =====
// Regras puras da análise com IA: o que é um resultado válido do provedor, o que pode ser gravado e quando
// há cobrança. Ficam fora do index.ts para serem testadas sem Deno nem rede.

/** Valor aceito pelo contrato oficial do generateContent (enum MimeType). A forma "application/json" é rejeitada com HTTP 400. */
const GEMINI_JSON_MIME_TYPE = "APPLICATION_JSON";

/** `gemini-3.5-flash` foi aposentado e roteia para `gemini-3.6-flash`; repetir o mesmo modelo não é reserva. */
const REFINE_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite"] as const;

const CHANNELS = ["whatsapp", "email", "instagram"];

interface ValidAnalysis {
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

type AnalysisValidation =
  | { ok: true; value: ValidAnalysis }
  | { ok: false; reason: string };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Valida a resposta do Gemini SEM completar lacunas com texto genérico: uma resposta incompleta é inválida.
 * `defaultChannel` só preenche o canal quando o modelo devolve um valor fora da lista conhecida.
 */
function validateAnalysis(raw: unknown, defaultChannel = "whatsapp"): AnalysisValidation {
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

interface ProviderFailure {
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
function buildProviderFailure(requestId: string, reason: string): ProviderFailure {
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
const shouldPersistAnalysis = (validation: AnalysisValidation) => validation.ok;
const shouldChargeCredit = (validation: AnalysisValidation, isAdmin: boolean) => validation.ok && !isAdmin;

/** Resumo curto e sem segredos do corpo de um erro HTTP do provedor, para o log. */
function summarizeProviderError(body: string, max = 240): string {
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
const DUPLICATE_REFINE_WINDOW_MS = 30_000;

/**
 * Já existe uma análise válida (não de reserva) gravada agora há pouco: a nova solicitação é duplicata e não deve
 * chamar o Gemini nem cobrar outro crédito. Uma nova geração intencional continua possível fora da janela.
 */
function isDuplicateRefine(
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

type ProviderOutcome =
  | { ok: true; analysis: ValidAnalysis; model: string }
  | { ok: false; error: string };

interface RefineDeps {
  requestId: string;
  isAdmin: boolean;
  /** Uma única rodada de chamadas ao provedor (cada modelo no máximo uma vez). */
  callProvider: () => Promise<ProviderOutcome>;
  /** Grava a análise; deve devolver true somente quando o banco confirmou a linha gravada. */
  persist: (analysis: ValidAnalysis, model: string) => Promise<boolean>;
  /** Desconta 1 crédito interno; true somente se o desconto foi registrado. */
  charge: () => Promise<boolean>;
}

type RefineRun =
  | { status: "provider_failed"; reason: string; failure: ProviderFailure }
  | { status: "save_failed" }
  | { status: "saved"; model: string; analysis: ValidAnalysis; charged: boolean; creditWarning: string | null };

const SAVE_FAILED_BODY = (requestId: string) => ({
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
async function runRefine(deps: RefineDeps): Promise<RefineRun> {
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

// ---------------------------------------------------------------------------------------------------------------------
// Preservação do trabalho do assinante
// ---------------------------------------------------------------------------------------------------------------------

type PlanDay = Record<string, unknown> & { dia?: unknown };

type PreservedReason = "edited" | "completed" | "optout_blocked";
interface PreservedDay { dia: number; reason: PreservedReason }

const asObj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Os dias salvos, em qualquer um dos formatos já gravados pelo Zuno (lista, objeto com `plano_prospeccao_7dias` ou `plano_prospeccao`). */
function extractPlanDays(plan: unknown): PlanDay[] {
  const obj = asObj(plan);
  const days = Array.isArray(plan) ? plan : Array.isArray(obj.plano_prospeccao_7dias) ? obj.plano_prospeccao_7dias : obj.plano_prospeccao;
  return Array.isArray(days) ? (days.filter((d) => d && typeof d === "object") as PlanDay[]) : [];
}

type PlanShape = "empty" | "days" | "copies" | "unknown";

/**
 * "days": há lista de dias (onde ficam edições e conclusões); "copies": só o resumo de mensagens, sem nenhuma marca do
 * assinante; "empty": nada salvo; "unknown": há conteúdo que não sabemos ler. Em "unknown" a atualização é recusada.
 */
function classifyPlanShape(plan: unknown): PlanShape {
  if (plan === null || plan === undefined || plan === "") return "empty";
  if (Array.isArray(plan)) return plan.length ? "days" : "empty";
  if (typeof plan !== "object") return "unknown";
  const obj = plan as Record<string, unknown>;
  if (!Object.keys(obj).length) return "empty";
  if (Array.isArray(obj.plano_prospeccao_7dias) || Array.isArray(obj.plano_prospeccao)) return "days";
  if (obj.copies && typeof obj.copies === "object") return "copies";
  return "unknown";
}

function preservedReasonOf(day: PlanDay | undefined): PreservedReason | null {
  if (!day) return null;
  if (day.is_custom_edited === true) return "edited";
  if (day.status_dia === "concluido") return "completed";
  if (day.status_dia === "bloqueado_optout") return "optout_blocked";
  return null;
}

/**
 * Une o plano antigo ao novo SEM sobrescrever o trabalho do assinante: dia editado manualmente, concluído ou
 * bloqueado por recusa fica exatamente como estava; os demais dias recebem o texto novo.
 */
function mergePlanPreservingUser<T extends PlanDay>(previousPlan: unknown, nextDays: T[]): { days: Array<T | PlanDay>; preserved: PreservedDay[] } {
  const previous = new Map<number, PlanDay>();
  for (const d of extractPlanDays(previousPlan)) {
    const n = Math.trunc(Number(d.dia));
    if (n >= 1 && n <= 7 && !previous.has(n)) previous.set(n, d);
  }
  const preserved: PreservedDay[] = [];
  const days = nextDays.map((day) => {
    const n = Math.trunc(Number(day.dia));
    const old = previous.get(n);
    const reason = preservedReasonOf(old);
    if (old && reason) {
      preserved.push({ dia: n, reason });
      return old;
    }
    return day;
  });
  return { days, preserved };
}

/** Mesma regra do cliente (`hasExplicitOptOut`); um teste compara as duas para impedir divergência. */
function isOptOutRow(row: { status?: string | null; notas?: string | null }): boolean {
  const status = String(row.status ?? "").toLowerCase().trim();
  if (["recusou_optout", "opt_out", "optout", "recusa", "bloqueado_optout"].includes(status)) return true;
  const notes = String(row.notas ?? "").toLowerCase();
  return [
    "não tenho interesse", "nao tenho interesse", "não mandar mensagem", "nao mandar mensagem", "remover da lista",
    "pare de mandar", "opt-out", "optout", "solicitou descadastro", "pediu para nao contatar", "pediu para não contatar",
    "número errado", "numero errado",
  ].some((phrase) => notes.includes(phrase));
}

// ---------------------------------------------------------------------------------------------------------------------
// Exclusão mútua por lead (sem migration)
// ---------------------------------------------------------------------------------------------------------------------
//
// Cada geração "reserva" o lead com um UPDATE condicional atômico (compare-and-set) na coluna já existente
// `ai_fallback_reason`, que guarda um marcador `refine_lock_<requestId>` enquanto a geração roda. Só uma das
// requisições simultâneas consegue o UPDATE; as demais recebem "em andamento" sem chamar o Gemini nem cobrar.
// A reserva expira sozinha (REFINE_LOCK_TTL_MS) caso a função morra no meio, e é liberada em toda saída.

const REFINE_LOCK_PREFIX = "refine_lock_";
const REFINE_LOCK_TTL_MS = 90_000;
/**
 * Prazo seguro de escrita: uma geração só grava/cobra até aqui. Fica bem abaixo do TTL da reserva para que, quando
 * a reserva expirar e outra requisição puder começar, a anterior já tenha desistido de gravar e de cobrar.
 */
const REFINE_WRITE_DEADLINE_MS = 70_000;

/** O prazo de validade vai DENTRO do valor da reserva; assim outras atualizações da linha não o alteram. */
const buildLockValue = (requestId: string, now: number) => `${REFINE_LOCK_PREFIX}${requestId}_${now + REFINE_LOCK_TTL_MS}`;
function lockExpiry(reason: string | null | undefined): number | null {
  if (!isRefineLock(reason)) return null;
  const n = Number(String(reason).split("_").pop());
  return Number.isFinite(n) && n > 1_000_000_000_000 ? n : null;
}

/** O que o assinante pode ver como motivo: nunca o marcador interno da reserva. */
const publicFallbackReason = (reason: string | null | undefined) => (isRefineLock(reason) ? null : reason ?? null);

const isRefineLock = (reason: string | null | undefined) => typeof reason === "string" && reason.startsWith(REFINE_LOCK_PREFIX);

interface LeadRefineRow {
  status?: string | null;
  notas?: string | null;
  reason: string | null;
  updatedAt: string | null;
  generatedAt: string | null;
  usedFallback: boolean | null;
  plan: unknown;
}

interface RefineStore {
  read(): Promise<LeadRefineRow | null>;
  /** UPDATE ... WHERE ai_fallback_reason IS NOT DISTINCT FROM prevReason. true somente se UMA linha foi alterada. */
  claim(prevReason: string | null, lockValue: string, nowIso: string): Promise<boolean>;
  /** Devolve o valor anterior da coluna, somente se a reserva ainda for desta requisição. */
  release(lockValue: string, restoreReason: string | null): Promise<void>;
}

type AcquireResult =
  | { acquired: true; lockValue: string; restoreReason: string | null; row: LeadRefineRow }
  | { acquired: false; reason: "in_progress" | "lead_not_found" };

async function acquireRefineLock(store: RefineStore, requestId: string, now = Date.now()): Promise<AcquireResult> {
  const first = await store.read();
  if (!first) return { acquired: false, reason: "lead_not_found" };

  let restoreReason: string | null = first.reason;
  if (isRefineLock(first.reason)) {
    const expiry = lockExpiry(first.reason);
    const updatedAt = first.updatedAt ? Date.parse(first.updatedAt) : NaN;
    const stillValid = expiry !== null ? now < expiry : Number.isFinite(updatedAt) && now - updatedAt < REFINE_LOCK_TTL_MS;
    if (stillValid) return { acquired: false, reason: "in_progress" };
    restoreReason = null; // reserva abandonada (a função morreu ou passou do prazo): não restaura o marcador
  }

  const lockValue = buildLockValue(requestId, now);
  const won = await store.claim(first.reason, lockValue, new Date(now).toISOString());
  if (!won) return { acquired: false, reason: "in_progress" };

  // Relê já com a reserva: a leitura anterior pode estar velha (outra requisição pode ter terminado no intervalo).
  const row = await store.read();
  if (!row) {
    await store.release(lockValue, restoreReason);
    return { acquired: false, reason: "lead_not_found" };
  }
  return { acquired: true, lockValue, restoreReason, row };
}

interface PersistContext {
  lockValue: string;
  preserved: PreservedDay[];
  /** Plano relido imediatamente antes da gravação (não o do início da geração). */
  previousPlan: unknown;
  /** Valores lidos agora; a gravação só vale se continuarem iguais (compare-and-set nas colunas escalares). */
  expected: { status: string | null; generatedAt: string | null };
}

interface GuardedRefineDeps extends Omit<RefineDeps, "persist"> {
  store: RefineStore;
  now?: () => number;
  /** Grava com a reserva ainda ativa; deve limpar a reserva na mesma gravação e devolver true só se o banco confirmou. */
  persist: (analysis: ValidAnalysis, model: string, ctx: PersistContext) => Promise<boolean>;
}

type ConflictReason = "lead_gone" | "lock_lost" | "analysis_changed" | "opt_out" | "plan_shape_unknown";

type GuardedRefineRun =
  | { status: "in_progress" }
  | { status: "lead_not_found" }
  | { status: "already_current"; generatedAt: string | null }
  | { status: "expired" }
  | { status: "conflict"; reason: ConflictReason }
  | (Extract<RefineRun, { status: "provider_failed" | "save_failed" }>)
  | (Extract<RefineRun, { status: "saved" }> & { preserved: PreservedDay[] });

/**
 * Operação completa e idempotente por lead: reserva → (duplicata recente?) → provedor → releitura do estado MAIS
 * RECENTE → mescla preservando o trabalho do assinante → gravação confirmada → cobrança → liberação.
 * Qualquer conflito que não possa ser resolvido com segurança (edição/opt-out/mudança durante a geração, plano em
 * formato desconhecido, prazo da reserva vencido) recusa a atualização: nada é sobrescrito e nada é cobrado.
 */
async function runGuardedRefine(deps: GuardedRefineDeps): Promise<GuardedRefineRun> {
  const now = deps.now ?? Date.now;
  const acquiredAt = now();
  const lock = await acquireRefineLock(deps.store, deps.requestId, acquiredAt);
  if (!lock.acquired) return { status: lock.reason === "lead_not_found" ? "lead_not_found" : "in_progress" };

  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    try { await deps.store.release(lock.lockValue, lock.restoreReason); } catch { /* a reserva expira sozinha */ }
  };

  try {
    // Dentro da reserva: uma análise válida gravada há pouco (outra requisição acabou de terminar) é reaproveitada.
    if (isDuplicateRefine({ generatedAt: lock.row.generatedAt, usedFallback: lock.row.usedFallback }, now())) {
      await release();
      return { status: "already_current", generatedAt: lock.row.generatedAt };
    }

    let preserved: PreservedDay[] = [];
    let refused: { status: "expired" } | { status: "conflict"; reason: ConflictReason } | null = null;
    const refuse = (r: NonNullable<typeof refused>) => { refused = r; return false; };

    const run = await runRefine({
      requestId: deps.requestId,
      isAdmin: deps.isAdmin,
      callProvider: deps.callProvider,
      charge: deps.charge,
      persist: async (analysis, model) => {
        // 1) prazo seguro: depois dele outra requisição pode ter assumido a reserva expirada.
        if (now() - acquiredAt > REFINE_WRITE_DEADLINE_MS) return refuse({ status: "expired" });

        // 2) estado mais recente confirmado no banco (o do início da geração pode estar velho).
        const fresh = await deps.store.read();
        if (!fresh) return refuse({ status: "conflict", reason: "lead_gone" });
        if (fresh.reason !== lock.lockValue) return refuse({ status: "conflict", reason: "lock_lost" });
        if ((fresh.generatedAt ?? null) !== (lock.row.generatedAt ?? null)) return refuse({ status: "conflict", reason: "analysis_changed" });
        if (isOptOutRow(fresh)) return refuse({ status: "conflict", reason: "opt_out" });
        if (classifyPlanShape(fresh.plan) === "unknown") return refuse({ status: "conflict", reason: "plan_shape_unknown" });

        const merged = mergePlanPreservingUser(fresh.plan, analysis.plano_prospeccao_7dias);
        preserved = merged.preserved;
        const finalAnalysis = { ...analysis, plano_prospeccao_7dias: merged.days as ValidAnalysis["plano_prospeccao_7dias"] };
        const ok = await deps.persist(finalAnalysis, model, {
          lockValue: lock.lockValue,
          preserved,
          previousPlan: fresh.plan,
          expected: { status: fresh.status ?? null, generatedAt: fresh.generatedAt ?? null },
        });
        if (ok) released = true; // a gravação confirmada já limpou a reserva
        return ok;
      },
    });

    if (run.status === "saved") return { ...run, preserved };
    await release();
    if (run.status === "save_failed" && refused) return refused;
    return run;
  } catch (error) {
    await release();
    throw error;
  }
}

const CONFLICT_MESSAGES: Record<ConflictReason | "expired", string> = {
  lead_gone: "O lead não foi encontrado ao salvar. Nada foi alterado nem cobrado.",
  lock_lost: "Outra atualização assumiu este lead durante a geração. Nada foi sobrescrito nem cobrado.",
  analysis_changed: "Outra análise foi salva para este lead durante a geração. Nada foi sobrescrito nem cobrado.",
  opt_out: "Este lead registrou recusa durante a geração. A análise e o plano anteriores foram mantidos e nada foi cobrado.",
  plan_shape_unknown: "O plano salvo está em um formato que não conseguimos preservar com segurança. Ele foi mantido como está e nada foi cobrado.",
  expired: "A geração demorou mais que o prazo seguro. A análise anterior foi mantida e nada foi cobrado. Tente novamente.",
};

const CONFLICT_BODY = (requestId: string, key: ConflictReason | "expired") => ({
  success: false as const,
  request_id: requestId,
  error_code: key === "expired" ? "REFINE_LOCK_EXPIRED" : "REFINE_CONFLICT",
  category: "validation_error" as const,
  retryable: key === "expired" || key === "analysis_changed",
  safe_message: CONFLICT_MESSAGES[key],
  error_message: CONFLICT_MESSAGES[key],
  credit_consumed: false as const,
  saved: false as const,
});

const IN_PROGRESS_BODY = (requestId: string) => ({
  success: false as const,
  request_id: requestId,
  error_code: "REFINE_IN_PROGRESS",
  category: "validation_error" as const,
  retryable: true,
  safe_message: "Já existe uma análise deste lead em andamento. Aguarde alguns segundos e atualize a página para ver o resultado. Nenhum crédito extra foi cobrado.",
  error_message: "Já existe uma análise deste lead em andamento. Aguarde alguns segundos e atualize a página para ver o resultado. Nenhum crédito extra foi cobrado.",
  credit_consumed: false as const,
  saved: false as const,
});

// ===== analisar-lead-ia =====

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_EMAILS = new Set([
  "jeferson.zanotell@gmail.com",
  "jefeson.zanotell@gmail.com",
]);

const MODELS = REFINE_MODELS;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function text(v: unknown, fallback = "") {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeLead(raw: any, context: any = {}) {
  const nome = text(raw?.nome || raw?.name || raw?.business_name || raw?.company_name || raw?.title, "Empresa");
  const nicho = text(raw?.nicho || raw?.category || raw?.categoria || raw?.niche || raw?.segmento || context?.nicho || context?.niche, "segmento não informado");
  const cidade = text(raw?.cidade || raw?.city || context?.cidade || context?.city, "cidade não informada");
  const website = text(raw?.website || raw?.site || raw?.url || raw?.website_url) || null;
  const phone = text(raw?.whatsapp_number || raw?.whatsapp || raw?.phone || raw?.telefone || raw?.formatted_phone_number) || null;
  const instagram = text(raw?.instagram_url || raw?.instagram) || null;
  const email = text(raw?.email) || null;
  const endereco = text(raw?.endereco || raw?.address || raw?.formatted_address) || null;
  const foco = text(raw?.foco || raw?.focus || context?.focus, "Full Service");
  const rating = num(raw?.rating ?? raw?.avaliacao ?? raw?.stars);
  const reviews = num(raw?.reviews ?? raw?.user_ratings_total ?? raw?.review_count);
  const pais = text(raw?.pais || raw?.country || context?.pais || context?.country, "BR").toUpperCase();
  const canais = Array.isArray(raw?.canaisProspeccao) ? raw.canaisProspeccao.filter((c: unknown) => ["whatsapp", "email", "instagram"].includes(String(c))) : [];

  return {
    nome, nicho, cidade, website, phone, instagram, email, endereco, foco,
    rating, reviews, pais,
    has_meta_pixel: !!raw?.has_meta_pixel,
    has_gtag: !!raw?.has_gtag,
    has_gtm: !!raw?.has_gtm,
    canaisProspeccao: canais,
  };
}

function availableChannels(lead: any) {
  const selected = lead.canaisProspeccao?.length ? lead.canaisProspeccao : ["whatsapp", "email", "instagram"];
  const out: string[] = [];
  if (selected.includes("whatsapp") && lead.phone) out.push("whatsapp");
  if (selected.includes("email") && lead.email) out.push("email");
  if (selected.includes("instagram") && lead.instagram) out.push("instagram");
  return out.length ? out : selected;
}

function signals(lead: any) {
  return [
    `Empresa: ${lead.nome}`,
    `Segmento: ${lead.nicho}`,
    `Cidade: ${lead.cidade}`,
    lead.website ? `Site informado: ${lead.website}` : "Site não informado nos dados disponíveis",
    lead.instagram ? `Instagram informado: ${lead.instagram}` : "Instagram não informado nos dados disponíveis",
    lead.phone ? "Telefone/WhatsApp disponível" : "Telefone/WhatsApp não informado nos dados disponíveis",
    lead.email ? `E-mail disponível: ${lead.email}` : null,
    lead.rating !== null ? `Nota no Google: ${lead.rating}` : null,
    lead.reviews !== null ? `Avaliações no Google: ${lead.reviews}` : null,
    lead.has_meta_pixel ? "Meta Pixel detectado" : null,
    lead.has_gtag ? "Google Analytics detectado" : null,
    lead.has_gtm ? "Google Tag Manager detectado" : null,
    "A inspeção automática do HTML do site está suspensa: a falta de menção a pixel, tags ou rastreamento NÃO indica que a empresa não os tenha; não afirme nada sobre isso",
  ].filter(Boolean).slice(0, 10);
}

const daySchema = {
  type: "object",
  properties: {
    dia: { type: "integer", minimum: 1, maximum: 7 },
    canal: { type: "string", enum: ["whatsapp", "email", "instagram"] },
    acao_sugerida: { type: "string", description: "Ação prática e curta para executar o contato." },
    mensagem: { type: "string", description: "Mensagem pronta, natural, específica e sem inventar fatos." },
    objecao_provavel: { type: "string" },
    resposta_sugerida: { type: "string" },
    cta: { type: "string" },
  },
  required: ["dia", "canal", "acao_sugerida", "mensagem", "objecao_provavel", "resposta_sugerida", "cta"],
  additionalProperties: false,
};

const outputSchema = {
  type: "object",
  properties: {
    diagnostico_bullets: { type: "array", minItems: 3, maxItems: 4, items: { type: "string" } },
    probabilidade_conversao: { type: "number", minimum: 0, maximum: 100 },
    fit_level: { type: "string", enum: ["alto", "medio", "baixo"] },
    commercial_opportunity: { type: "string" },
    probable_pain: { type: "string" },
    why_good_lead: { type: "string" },
    messages: {
      type: "object",
      properties: {
        whatsapp_primary: { type: "string" },
        instagram: { type: "string" },
        email_body: { type: "string" },
      },
      required: ["whatsapp_primary", "instagram", "email_body"],
      additionalProperties: false,
    },
    plano_prospeccao_7dias: { type: "array", minItems: 7, maxItems: 7, items: daySchema },
  },
  required: ["diagnostico_bullets", "probabilidade_conversao", "fit_level", "commercial_opportunity", "probable_pain", "why_good_lead", "messages", "plano_prospeccao_7dias"],
  additionalProperties: false,
};

function promptFor(lead: any, requestData: any) {
  const chans = availableChannels(lead).join(", ");
  const sigs = signals(lead).join("\n- ");
  const oferta = text(requestData?.oferta_usuario || requestData?.context?.oferta_usuario, "");
  const publico = text(requestData?.publico_alvo || requestData?.context?.publico_alvo, "");
  const dor = text(requestData?.dor_principal || requestData?.context?.dor_principal, "");
  const objetivo = text(requestData?.objetivo || requestData?.context?.objetivo, "");
  const foco = (lead.foco || "Full Service").replace(/zuno_internal_prospecting/g, "Oportunidade comercial");

  return `Você é um estrategista de prospecção B2B brasileiro sênior. Sua missão é gerar uma análise comercial altamente personalizada e um plano de prospecção de exatamente 7 dias progressivos e coerentes.

DADOS REAIS VERIFICADOS DO LEAD:
- ${sigs}
- Serviço/Foco oferecido pelo assinante: ${foco}
- Canais de contato permitidos: ${chans}
${oferta ? `- Oferta específica do usuário: ${oferta}` : ""}
${publico ? `- Público-alvo prioritário: ${publico}` : ""}
${dor ? `- Dor que o usuário deseja explorar: ${dor}` : ""}
${objetivo ? `- Objetivo da abordagem: ${objetivo}` : ""}

REGRAS INVIOLÁVEIS DE QUALIDADE (DIRETRIZ ANTI-ROBÔ):
1. PROIBIÇÃO TOTAL DE CLICHÊS DE IA:
   - NUNCA use as frases:
     * "identificamos oportunidades de melhoria"
     * "potencializar sua presença digital / vendas"
     * "alavancar seus resultados / vendas"
     * "transformar seu negócio"
     * "aumentar exponencialmente"
     * "está perdendo clientes"
     * "diagnóstico exclusivo"
     * "acompanho o perfil / trabalho de vocês há algum tempo" (intimidade falsa)
     * "preparei um vídeo de um minuto" / "vídeo de aproximadamente um minuto" (nunca prometa vídeo que não existe)
     * "já analisei todo o seu marketing"
     * "gap comercial importante"
     * "passando só para saber se viu minha mensagem" (follow-up passivo-agressivo proibido)
     * "+40% de conversão" (provas sociais e percentuais falsos proibidos)

2. ADAPTAÇÃO RIGOROSA AO SERVIÇO OFERECIDO:
   - Se Tráfego Pago: focar em captação local de clientes que buscam ativamente o serviço na cidade, sem acusar falhas em campanhas atuais.
   - Se Social Media: focar em comunicação, apresentação clara dos diferenciais e conversão de seguidores em orçamentos, sem fingir que auditou o Instagram da empresa.
   - Se Criação de Sites: focar em clareza de contato no celular e presença nas buscas do Google, ancorado em se o lead tem ou não site.
   - Se CRM/Automação: focar na velocidade e organização do atendimento no WhatsApp, sem acusar perda de mensagens.
   - Outros serviços: conectar com respeito à demanda comercial da empresa.

3. DIAGNÓSTICO COMERCIAL (3 ou 4 bullets curtos):
   - Bullet 1: O que sabemos sobre a empresa (fatos observados: cidade, nicho, se tem site ou avaliações).
   - Bullet 2: Sinais realmente observáveis na presença pública.
   - Bullet 3: Hipótese comercial honesta conectada ao serviço vendido pelo assinante.
   - Bullet 4: Próxima ação recomendada: iniciar abordagem consultiva focada na rotina atual de captação de clientes.

4. SEQUÊNCIA DE 7 DIAS COERENTES E PROGRESSIVOS:
   - Dia 1: Abertura humana curta e educada, perguntando sobre a rotina de captação ou confirmando o responsável comercial.
   - Dia 2: Observação real sobre o segmento local sem falsa intimidade.
   - Dia 3: Ângulo consultivo com hipótese comercial clara, sem jargões.
   - Dia 4: Acompanhamento leve com pergunta prática, sem cobrança passiva.
   - Dia 5: Ideia prática tangível do segmento em 3 passos, sem estudos de caso inventados.
   - Dia 6: Validação de timing comercial ("faz sentido avaliar agora ou o foco é outro?").
   - Dia 7: Encerramento elegante e cordial, deixando portas abertas e CRM limpo.

Retorne estritamente o JSON compatível com o schema.`;
}

type ProviderResult =
  | { ok: true; analysis: any; model: string }
  | { ok: false; error: string };

async function callGemini(apiKey: string, lead: any, requestData: any, requestId: string): Promise<ProviderResult> {
  // `max_provider_attempts` só pode REDUZIR as tentativas (ex.: 1 em verificações pontuais); nunca aumenta.
  const requested = Math.trunc(Number(requestData?.max_provider_attempts));
  const maxAttempts = Number.isFinite(requested) && requested >= 1 ? Math.min(requested, MODELS.length) : MODELS.length;
  const prompt = promptFor(lead, requestData);
  const defaultChannel = availableChannels(lead)[0] || "whatsapp";
  let lastError = "";

  for (const model of MODELS.slice(0, maxAttempts)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18_000);
    const started = Date.now();
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 7000,
            responseFormat: {
              text: {
                mimeType: GEMINI_JSON_MIME_TYPE,
                schema: outputSchema,
              },
            },
          },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        lastError = `${model}:${response.status}`;
        const detail = summarizeProviderError(await response.text().catch(() => ""));
        clearTimeout(timeout);
        console.warn(JSON.stringify({ module: "analisar-lead-ia", request_id: requestId, stage: "provider", model, status: response.status, detail, duration_ms: Date.now() - started }));
        if ([401, 403].includes(response.status)) break;
        continue;
      }

      const data = await response.json(); // ainda sob o mesmo limite de tempo (clearTimeout só depois)
      clearTimeout(timeout);
      const rawText = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") || "";
      if (!rawText) {
        lastError = `${model}:empty`;
        continue;
      }
      const validation = validateAnalysis(JSON.parse(rawText), defaultChannel);
      if (!validation.ok) {
        lastError = `${model}:invalid_output:${validation.reason}`;
        console.warn(JSON.stringify({ module: "analisar-lead-ia", request_id: requestId, stage: "provider", model, status: 200, invalid_output: validation.reason, duration_ms: Date.now() - started }));
        continue;
      }
      console.info(JSON.stringify({ module: "analisar-lead-ia", request_id: requestId, stage: "provider", model, status: 200, duration_ms: Date.now() - started, success: true }));
      return { ok: true, analysis: validation.value, model };
    } catch (err) {
      clearTimeout(timeout);
      lastError = err instanceof Error ? `${model}:${err.name}:${err.message}` : `${model}:${String(err)}`;
      console.warn(JSON.stringify({ module: "analisar-lead-ia", request_id: requestId, stage: "provider", model, error: err instanceof Error ? err.name : typeof err, duration_ms: Date.now() - started }));
    }
  }

  return { ok: false, error: lastError || "provider_unavailable" };
}

function buildResponse(leadId: string, requestId: string, lead: any, analysis: any, requestData: any, model: string, usedFallback: boolean) {
  const days = analysis.plano_prospeccao_7dias;
  return {
    lead_id: leadId,
    generated_at: new Date().toISOString(),
    prompt_version: "v4_human_commercial_plan",
    model,
    input_context: {
      empresa: lead.nome,
      nicho: lead.nicho,
      cidade: lead.cidade,
      estado: lead.endereco || null,
      site: lead.website || null,
      oferta_usuario: text(requestData?.oferta_usuario || requestData?.context?.oferta_usuario, ""),
      publico_alvo: text(requestData?.publico_alvo || requestData?.context?.publico_alvo, ""),
      dor_principal: text(requestData?.dor_principal || requestData?.context?.dor_principal, ""),
      objetivo: text(requestData?.objetivo || requestData?.context?.objetivo, ""),
      canal: text(requestData?.canal || requestData?.context?.canal, "") || null,
      etapa: text(requestData?.etapa || requestData?.context?.etapa, "") || null,
    },
    diagnostico: {
      fit: analysis.fit_level,
      dor_provavel: analysis.probable_pain,
      urgencia: analysis.fit_level === "alto" ? "alta" : "media",
      oportunidade: analysis.commercial_opportunity,
      justificativa: analysis.why_good_lead,
    },
    copies: {
      dia_1: days[0]?.mensagem || "",
      dia_2: days[1]?.mensagem || "",
      dia_3: days[2]?.mensagem || "",
      dia_4: days[3]?.mensagem || "",
      dia_5: days[4]?.mensagem || "",
      dia_6: days[5]?.mensagem || "",
      dia_7: days[6]?.mensagem || "",
    },
    abordagens_por_canal: {
      whatsapp: analysis.messages?.whatsapp_primary || "",
      instagram: analysis.messages?.instagram || "",
      email: analysis.messages?.email_body || "",
    },
    plano_prospeccao_7dias: days,
    debug: {
      request_id: requestId,
      fallback_used: usedFallback,
      cache_used: false,
      response_size_bytes: JSON.stringify(analysis).length,
    },
  };
}

async function logEvent(admin: any, userId: string, eventType: string, eventData: any) {
  try {
    await admin.rpc("log_app_event", {
      p_user_id: userId,
      p_event_type: eventType,
      p_event_data: eventData,
      p_ip_address: null,
      p_user_agent: null,
    });
  } catch (_) {}
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ success: false, error_message: "Método não permitido." }, 405);

  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const started = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const GEMINI_KEY = (
      Deno.env.get("GOOGLE_GEMINI_API_KEY") ||
      Deno.env.get("GEMINI_API_KEY") ||
      Deno.env.get("GEMINI_API") ||
      Deno.env.get("Gemini_API") ||
      Deno.env.get("VITE_GEMINI_API_KEY") || ""
    ).trim().replace(/^["']|["']$/g, "");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY) {
      return json({ success: false, request_id: requestId, error_code: "REFINE_CONFIGURATION_MISSING", error_message: "O serviço de refinamento está temporariamente indisponível." }, 503);
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ success: false, request_id: requestId, error_code: "REFINE_SESSION_MISSING", error_message: "Sua sessão expirou. Entre novamente para continuar." }, 401);

    const auth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: authError } = await auth.auth.getUser(token);
    const user = userData?.user;
    if (authError || !user) return json({ success: false, request_id: requestId, error_code: "REFINE_SESSION_INVALID", error_message: "Sua sessão expirou. Entre novamente para continuar." }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const requestData = await req.json().catch(() => null);
    if (!requestData || typeof requestData !== "object") return json({ success: false, request_id: requestId, error_code: "REFINE_INPUT_INVALID", error_message: "Dados inválidos para análise." }, 400);

    const payloadLead = requestData.lead && typeof requestData.lead === "object" ? requestData.lead : requestData;
    const rawLeadId = requestData.leadId || requestData.lead_id || payloadLead?.id;
    const leadId = typeof rawLeadId === "string" && UUID_RE.test(rawLeadId.trim()) ? rawLeadId.trim() : null;
    if (!leadId) return json({ success: false, request_id: requestId, error_code: "REFINE_LEAD_REFERENCE_INVALID", error_message: "O lead ainda não está pronto para refinamento. Atualize a lista e tente novamente." }, 409);

    let usageInfo: any = null;
    try {
      const { data } = await auth.rpc("get_current_user_usage");
      usageInfo = data?.[0] || null;
    } catch (_) {}
    const email = String(user.email || "").trim().toLowerCase();
    const isAdmin = ADMIN_EMAILS.has(email) || usageInfo?.is_admin === true || usageInfo?.role === "admin";
    const remaining = Number(usageInfo?.ai_available_total ?? usageInfo?.ai_remaining ?? 3);
    const unlimited = isAdmin || Number(usageInfo?.ai_limit ?? 0) >= 999999;
    if (!unlimited && remaining <= 0) return json({ success: false, request_id: requestId, error_code: "REFINE_PERMISSION_DENIED", error_message: "Você não tem análises de IA disponíveis." }, 402);

    let rows: any[] | null = null;
    try {
      const { data } = await admin.rpc("get_lead_decrypted_by_id", { p_lead_id: leadId, p_user_id: user.id });
      if (Array.isArray(data)) rows = data;
    } catch (_) {}
    if (!rows?.length) {
      const { data } = await admin.from("leads").select("*").eq("id", leadId).eq("user_id", user.id).maybeSingle();
      if (data) rows = [data];
    }
    if (!rows?.length) return json({ success: false, request_id: requestId, error_code: "REFINE_LEAD_NOT_FOUND", error_message: "O lead não foi encontrado na sua conta. Atualize a lista e tente novamente." }, 409);

    const rawLead = { ...rows[0], canaisProspeccao: requestData.canaisProspeccao || rows[0]?.canaisProspeccao || [] };
    const lead = normalizeLead(rawLead, requestData.search_context || requestData.context || {});

    if (lead.foco === "zuno_internal_prospecting" && !isAdmin) {
      return json({ success: false, request_id: requestId, error_code: "REFINE_PERMISSION_DENIED", error_message: "Este tipo de análise não está disponível para sua conta." }, 403);
    }

    let responsePayload: ReturnType<typeof buildResponse> | null = null;

    // Exclusão mútua por lead: duas requisições simultâneas (duas abas, clique duplo) não geram nem cobram duas vezes.
    const store: RefineStore = {
      read: async () => {
        const { data } = await admin
          .from("leads")
          .select("status, notas, ai_fallback_reason, updated_at, ai_analise_gerada_em, ai_used_fallback, plano_prospeccao")
          .eq("id", leadId)
          .eq("user_id", user.id)
          .maybeSingle();
        return data
          ? { status: data.status ?? null, notas: data.notas ?? null, reason: data.ai_fallback_reason ?? null, updatedAt: data.updated_at ?? null, generatedAt: data.ai_analise_gerada_em ?? null, usedFallback: data.ai_used_fallback ?? null, plan: data.plano_prospeccao ?? null }
          : null;
      },
      claim: async (prevReason, lockValue, nowIso) => {
        let query = admin.from("leads").update({ ai_fallback_reason: lockValue, updated_at: nowIso }).eq("id", leadId).eq("user_id", user.id);
        query = prevReason === null ? query.is("ai_fallback_reason", null) : query.eq("ai_fallback_reason", prevReason);
        const { data, error } = await query.select("id");
        return !error && data?.length === 1;
      },
      release: async (lockValue, restoreReason) => {
        await admin
          .from("leads")
          .update({ ai_fallback_reason: restoreReason, updated_at: new Date().toISOString() })
          .eq("id", leadId)
          .eq("user_id", user.id)
          .eq("ai_fallback_reason", lockValue);
      },
    };

    const run = await runGuardedRefine({
      requestId,
      isAdmin,
      store,
      callProvider: async () => GEMINI_KEY
        ? await callGemini(GEMINI_KEY, lead, requestData, requestId)
        : { ok: false, error: "gemini_key_missing" },
      persist: async (analysis, model, ctx) => {
        const built = buildResponse(leadId, requestId, lead, analysis, requestData, model, false);
        // Mantém qualquer outro dado já guardado no plano (histórico) e sobrepõe só o que a nova análise define.
        const previousObject = ctx.previousPlan && typeof ctx.previousPlan === "object" && !Array.isArray(ctx.previousPlan) ? ctx.previousPlan as Record<string, unknown> : {};
        responsePayload = { ...previousObject, ...built } as ReturnType<typeof buildResponse>;
        let update = admin
          .from("leads")
          .update({
            diagnostico_bullets: analysis.diagnostico_bullets,
            probabilidade_conversao: analysis.probabilidade_conversao,
            plano_prospeccao: responsePayload,
            ai_analise_gerada_em: new Date().toISOString(),
            ai_used_fallback: false,
            ai_fallback_reason: null, // limpa a reserva na mesma gravação
          })
          .eq("id", leadId)
          .eq("user_id", user.id)
          .eq("ai_fallback_reason", ctx.lockValue); // só grava se a reserva ainda for desta requisição
        // Compare-and-set nas colunas escalares lidas agora: se o status (ex.: opt-out) ou a análise mudou entre a
        // última leitura e a gravação, nenhuma linha é alterada e a atualização é recusada.
        update = ctx.expected.status === null ? update.is("status", null) : update.eq("status", ctx.expected.status);
        update = ctx.expected.generatedAt === null ? update.is("ai_analise_gerada_em", null) : update.eq("ai_analise_gerada_em", ctx.expected.generatedAt);
        const { data: saved, error: saveError } = await update.select("id, ai_analise_gerada_em");
        return !saveError && Boolean(saved?.length);
      },
      charge: async () => {
        const { data: ok, error } = await admin.rpc("increment_ai_usage", { p_user_id: user.id });
        return !error && ok === true;
      },
    });

    if (run.status === "in_progress") {
      await logEvent(admin, user.id, "ai_analysis_duplicate_ignored", { request_id: requestId, leadId, reason: "in_progress", deducted_credit: false });
      return json(IN_PROGRESS_BODY(requestId), 409);
    }

    if (run.status === "conflict" || run.status === "expired") {
      const key = run.status === "expired" ? "expired" : run.reason;
      await logEvent(admin, user.id, "ai_analysis_failed_handled", { request_id: requestId, leadId, stage: "conflict", reason: key, saved: false, deducted_credit: false });
      return json(CONFLICT_BODY(requestId, key), 409);
    }

    if (run.status === "lead_not_found") {
      return json({ success: false, request_id: requestId, error_code: "REFINE_LEAD_NOT_FOUND", error_message: "O lead não foi encontrado na sua conta. Atualize a lista e tente novamente." }, 409);
    }

    if (run.status === "already_current") {
      await logEvent(admin, user.id, "ai_analysis_duplicate_ignored", { request_id: requestId, leadId, reason: "recent_saved", deducted_credit: false });
      return json({
        success: true,
        request_id: requestId,
        already_current: true,
        saved: true,
        used_fallback: false,
        credit_consumed: false,
        generated_at: run.generatedAt,
      });
    }

    // Sem análise válida do Gemini: nada é gravado (a análise anterior permanece), nenhum crédito é cobrado e o
    // usuário recebe um erro claro. Antes, um texto genérico de reserva era gravado e anunciado como sucesso.
    if (run.status === "provider_failed") {
      await logEvent(admin, user.id, "ai_analysis_failed_handled", {
        request_id: requestId,
        leadId,
        stage: "provider",
        reason: run.reason,
        saved: false,
        deducted_credit: false,
      });
      return json(run.failure.body, run.failure.status);
    }

    if (run.status === "save_failed") {
      await logEvent(admin, user.id, "ai_analysis_failed_handled", { request_id: requestId, stage: "persist_result", internal_code: "REFINE_SAVE_FAILED", deducted_credit: false });
      return json(SAVE_FAILED_BODY(requestId), 503);
    }

    await logEvent(admin, user.id, "ai_analysis_completed", {
      request_id: requestId,
      leadId,
      model: run.model,
      fallback_used: false,
      credit_consumed: run.charged,
      duration_ms: Date.now() - started,
    });

    return json({
      ...(responsePayload ?? {}),
      success: true,
      request_id: requestId,
      saved: true,
      used_fallback: false,
      fallback_reason: null,
      credit_consumed: run.charged,
      preserved_days: run.preserved,
      timing: { total_ms: Date.now() - started },
      ...(run.creditWarning ? { credit_warning: run.creditWarning } : {}),
    });
  } catch (err) {
    console.error(JSON.stringify({ module: "analisar-lead-ia", request_id: requestId, stage: "global", error: err instanceof Error ? err.message : String(err) }));
    return json({ success: false, request_id: requestId, error_code: "REFINE_UNKNOWN_ERROR", error_message: "Não foi possível refinar o conteúdo neste momento. Tente novamente." }, 500);
  }
});
