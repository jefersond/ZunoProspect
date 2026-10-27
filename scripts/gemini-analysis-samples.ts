/**
 * Amostras REAIS do Gemini com o mesmo prompt, schema, chamada e validador da função analisar-lead-ia (v5).
 * Cada chamada CONSOME TOKENS PAGOS da chave informada. Por isso o script exige um limite explícito:
 *
 *   # 1) Só mostra o plano de chamadas e o teto de custo (não chama nada):
 *   npx vite-node scripts/gemini-analysis-samples.ts -- --cases A,B,C --models gemini-3.6-flash --preflight
 *
 *   # 2) Executa, com teto rígido de chamadas (o script recusa se o plano exceder o teto):
 *   GEMINI_API_KEY=... npx vite-node scripts/gemini-analysis-samples.ts -- --cases A,B,C --models gemini-3.6-flash --preflight --max-calls 4 --out ./samples
 *
 * Regras de custo embutidas: UMA requisição HTTP por chamada (sem repetição), nenhuma tentativa extra por erro,
 * parada imediata em 400/401/403, contador global que impede passar do teto.
 * Não toca em Supabase nem em dados de clientes: as empresas abaixo são fictícias. A chave nunca é impressa.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cases } from "../supabase/functions/_shared/sample-cases";
import {
  ANALYSIS_PROMPT_VERSION,
  MAX_OUTPUT_TOKENS,
  buildAnalysisPrompt,
  buildVerifiedFacts,
  evaluatePreconditions,
  buildGeminiRequestBody,
  runGeminiAnalysis,
  validateAnalysis,
  evaluateAnalysisValue,
  type GeminiRequestOptions,
  type ThinkingLevel,
} from "../supabase/functions/_shared/lead-analysis";
import { validateGenerateContentBody } from "../supabase/functions/_shared/gemini-contract";

const argValue = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : null; };
const hasFlag = (name: string) => process.argv.includes(`--${name}`);
const outDir = argValue("out");
const maxCalls = Number(argValue("max-calls") ?? 0);
const models = (argValue("models") ?? "gemini-3.6-flash").split(",").map((m) => m.trim()).filter(Boolean);
const thinkingArg = argValue("thinking") ?? "LOW";
const thinkingLevel = thinkingArg === "default" ? null : (thinkingArg.toUpperCase() as ThinkingLevel);
const selected = new Set((argValue("cases") ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean));
const budgetUsd = Number(argValue("budget-usd") ?? 0.19);
const outputCap = Number(argValue("max-output-tokens") ?? MAX_OUTPUT_TOKENS);
const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const runnable = cases.filter((c) => selected.has(c.id));
const preflightCalls = hasFlag("preflight") ? models.length : 0;
const analysisCases = runnable.filter((c) => !evaluatePreconditions({ profile: c.seller, stage: buildVerifiedFacts(c.lead).etapa_do_historico, existingPlan: null, replaceExisting: false }));
const plannedCalls = preflightCalls + analysisCases.length * models.length;

// ── Plano e teto de custo no PIOR caso ──
// Pior caso por chamada = entrada (estimada com folga: 2,8 caracteres/token) + saída inteira no limite configurado,
// ao MAIOR preço de saída da tabela daquele modelo. Se o total passar do orçamento, o script recusa.
const pricingFile = JSON.parse(readFileSync(new URL("./gemini-pricing.json", import.meta.url), "utf8")) as { modelos: Record<string, { id: string; input: number; output: number }> };
const pricesOf = (model: string) => Object.entries(pricingFile.modelos).filter(([, m]) => m.id === model);
const worstCaseUsd = (model: string, inputTokens: number, outputTokens: number) => {
  const prices = pricesOf(model).map(([, m]) => m);
  if (!prices.length) return null;
  const p = prices.reduce((max, cur) => (cur.output > max.output ? cur : max));
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
};
const conservativeInput = (prompt: string) => Math.ceil(prompt.length / 2.8);
console.log("PLANO");
console.log(`- modelos: ${models.join(", ")} | raciocínio: ${thinkingLevel ?? "padrão do modelo"} | casos: ${analysisCases.map((c) => c.id).join(", ") || "nenhum"}`);
console.log(`- chamadas planejadas: ${plannedCalls} (${preflightCalls} de contrato com schema mínimo + ${analysisCases.length * models.length} análises completas)`);
console.log(`- teto informado (--max-calls): ${maxCalls} | limite de saída por análise: ${outputCap} tokens | orçamento: US$ ${budgetUsd.toFixed(2)}`);
let worstTotal = 0;
let priceMissing = false;
for (const m of models) {
  const pre = hasFlag("preflight") ? worstCaseUsd(m, 150, 200) : 0;
  const analyses = analysisCases.map((c) => worstCaseUsd(m, conservativeInput(buildAnalysisPrompt(buildVerifiedFacts(c.lead), c.seller)), outputCap));
  if (pre === null || analyses.some((x) => x === null)) { priceMissing = true; console.log(`- ${m}: SEM PREÇO na tabela`); continue; }
  const total = (pre ?? 0) + (analyses as number[]).reduce((a, b) => a + b, 0);
  worstTotal += total;
  console.log(`- ${m}: pior caso ≈ US$ ${total.toFixed(4)} (preço de saída mais alto da tabela: US$ ${Math.max(...pricesOf(m).map(([, p]) => p.output))}/1M)`);
}
console.log(`- pior caso total ≈ US$ ${worstTotal.toFixed(4)} (preços NÃO verificados na fonte; ver scripts/gemini-pricing.json)`);

// Validação local do contrato HTTP (sem rede): se algum corpo violar o contrato oficial, nada é enviado.
const tinySchema = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false };
const contractProblems = [
  ...(hasFlag("preflight") ? validateGenerateContentBody(buildGeminiRequestBody('Retorne exatamente {"ok": true}.', { thinkingLevel, maxOutputTokens: 200, schema: tinySchema })) : []),
  ...(analysisCases.length ? validateGenerateContentBody(buildGeminiRequestBody("x", { thinkingLevel, maxOutputTokens: outputCap })) : []),
];
console.log(`- contrato HTTP validado localmente: ${contractProblems.length ? "FALHOU" : "ok"}`);
if (contractProblems.length) { console.error("\nRECUSADO: o corpo da requisição viola o contrato oficial:\n- " + contractProblems.join("\n- ")); process.exit(1); }
if (priceMissing) { console.error("\nRECUSADO: há modelo sem preço na tabela; sem preço não há como garantir o orçamento."); process.exit(1); }
if (worstTotal > budgetUsd) {
  console.error(`\nRECUSADO: o pior caso (US$ ${worstTotal.toFixed(4)}) ultrapassa o orçamento (US$ ${budgetUsd.toFixed(2)}). Reduza --max-output-tokens, casos ou modelos.`);
  process.exit(1);
}

if (plannedCalls === 0) { console.log("\nNada a executar (informe --cases e/ou --preflight)."); process.exit(0); }
if (!apiKey || maxCalls <= 0) {
  console.log(`\nNENHUMA chamada feita. ${!apiKey ? "GEMINI_API_KEY não definida. " : ""}${maxCalls <= 0 ? "Informe --max-calls N (N ≥ chamadas planejadas) para autorizar." : ""}`);
  process.exit(0);
}
if (plannedCalls > maxCalls) { console.error(`\nRECUSADO: o plano tem ${plannedCalls} chamadas e o teto é ${maxCalls}. Reduza casos/modelos ou aumente o teto conscientemente.`); process.exit(1); }

const lines: string[] = [`# Amostras Gemini · prompt ${ANALYSIS_PROMPT_VERSION}`, ""];
const report: unknown[] = [];
let calls = 0;
const totals = { prompt: 0, output: 0, thoughts: 0, total: 0, attempts: 0, generations: 0, approved: 0, rejected: 0 };
let spentWorstUsd = 0; // gasto real estimado, ao MAIOR preço da tabela (proteção em tempo de execução)
const guard = () => { if (calls >= maxCalls) throw new Error("teto de chamadas atingido"); if (spentWorstUsd >= budgetUsd) throw new Error("orçamento atingido"); calls++; };
type Usage = { prompt_tokens: number | null; output_tokens: number | null; thoughts_tokens: number | null } | null;
/** Custo estimado da chamada pela tabela de preços (saída = texto visível + raciocínio). Um valor por cenário de preço do modelo. */
const costOf = (model: string, usage: Usage) => {
  if (!usage) return "custo indisponível (sem usageMetadata)";
  return pricesOf(model).map(([label, p]) => {
    const usd = ((usage.prompt_tokens ?? 0) * p.input + ((usage.output_tokens ?? 0) + (usage.thoughts_tokens ?? 0)) * p.output) / 1_000_000;
    return `US$ ${usd.toFixed(5)} (${label})`;
  }).join(" · ");
};
const accrue = (model: string, usage: Usage) => {
  if (!usage) return;
  const worst = Math.max(...pricesOf(model).map(([, p]) => ((usage.prompt_tokens ?? 0) * p.input + ((usage.output_tokens ?? 0) + (usage.thoughts_tokens ?? 0)) * p.output) / 1_000_000));
  spentWorstUsd += worst;
};

async function once(model: string, prompt: string, request: GeminiRequestOptions) {
  guard();
  return runGeminiAnalysis({ apiKey, prompt, fetchFn: fetch as never, models: [model], maxAttempts: 1, timeoutMs: 90_000, request });
}
const tally = (t: { http_attempts: number; generations_with_content: number; usage: { prompt_tokens: number | null; output_tokens: number | null; thoughts_tokens: number | null; total_tokens: number | null } | null }) => {
  totals.attempts += t.http_attempts; totals.generations += t.generations_with_content;
  totals.prompt += t.usage?.prompt_tokens ?? 0; totals.output += t.usage?.output_tokens ?? 0; totals.thoughts += t.usage?.thoughts_tokens ?? 0; totals.total += t.usage?.total_tokens ?? 0;
};

let stop = false;
if (hasFlag("preflight")) {
  lines.push("## Teste de contrato (schema mínimo)", "");
  for (const m of models) {
    if (stop) break;
    const r = await once(m, 'Retorne exatamente {"ok": true}.', { thinkingLevel, maxOutputTokens: 200, schema: tinySchema });
    tally(r.telemetry);
    accrue(m, r.telemetry.usage);
    const line = `- ${m}: ${r.ok ? "aceito" : `RECUSADO (${r.kind}: ${r.error})`} · tentativas HTTP ${r.telemetry.http_attempts} · tokens ${JSON.stringify(r.telemetry.usage)} · cobrança ${r.telemetry.billing}`;
    lines.push(line); console.log(line);
    if (!r.ok && (r.kind === "invalid_request" || r.kind === "auth_error")) { stop = true; lines.push("Interrompido: erro de configuração no teste de contrato."); }
  }
  lines.push("");
}

for (const c of stop ? [] : analysisCases) {
  const facts = buildVerifiedFacts(c.lead);
  const prompt = buildAnalysisPrompt(facts, c.seller);
  for (const m of models) {
    if (stop) break;
    lines.push(`## Caso ${c.id} · ${c.label} · ${m}`, "");
    const run = await once(m, prompt, { thinkingLevel, maxOutputTokens: outputCap });
    tally(run.telemetry);
    accrue(m, run.telemetry.usage);
    const t = run.telemetry;
    const head = `modelo usado: \`${t.model_used ?? m}\` · tentativas HTTP ${t.http_attempts} · gerações com conteúdo ${t.generations_with_content} · finish ${t.finish_reason ?? "?"} · tokens: prompt ${t.usage?.prompt_tokens ?? "?"}, saída ${t.usage?.output_tokens ?? "?"}, raciocínio ${t.usage?.thoughts_tokens ?? "?"}, total ${t.usage?.total_tokens ?? "?"} · custo estimado: ${costOf(m, t.usage)}`;
    if (!run.ok) {
      lines.push(head, `Falha: \`${run.kind}\` (${run.error}) · cobrança do provedor: ${t.billing}`, "");
      report.push({ case: c.id, model: m, telemetry: t, failure: run.kind }); console.log(`[${c.id}/${m}] falhou: ${run.kind} (${t.billing})`);
      if (run.kind === "invalid_request" || run.kind === "auth_error") stop = true;
      continue;
    }
    const v = validateAnalysis(run.raw, { channels: facts.canais_disponiveis, profile: c.seller, stage: facts.etapa_do_historico, facts });
    if (v.ok) totals.approved++; else totals.rejected++;
    lines.push(head, `validação: ${v.ok ? "aprovada" : "REPROVADA"}`, "");
    console.log(`[${c.id}/${m}] ${v.ok ? "aprovada" : "reprovada"} · tokens ${JSON.stringify(t.usage)}`);
    if (!v.ok) { lines.push("Problemas: " + v.issues.join("; "), "", "```json", JSON.stringify(run.raw, null, 2), "```", ""); report.push({ case: c.id, model: m, telemetry: t, rejected: v.issues, raw: run.raw }); continue; }
    if (v.warnings.length) lines.push("Avisos: " + v.warnings.join("; "), "");
    const d = v.analysis.diagnostico;
    lines.push("**Diagnóstico**", ...d.observado.map((o) => `- Observado: ${o}`), `- Permite concluir: ${d.permite_concluir}`, `- Não permite concluir: ${d.nao_permite_concluir}`, `- Hipótese comercial: ${d.hipotese_comercial}`, `- Pergunta de validação: ${d.pergunta_de_validacao}`, "", `**Estratégia:** ${v.analysis.resumo_estrategia}`, "");
    for (const day of v.analysis.plano) {
      lines.push(`**Dia ${day.dia} · ${day.tipo} · ${day.canal}** — ${day.titulo}`);
      if (day.acao) lines.push(`Ação: ${day.acao}`);
      if (day.condicao) lines.push(`Quando: ${day.condicao}`);
      if (day.mensagem) lines.push("```", ...(day.assunto_email ? [`Assunto: ${day.assunto_email}`, ""] : []), day.mensagem, "```", `(${words(day.mensagem)} palavras)`);
      lines.push(`Por que: ${day.justificativa}`, "");
    }
    const noSend = v.analysis.plano.filter((d) => d.tipo === "tarefa" || d.tipo === "sem_mensagem").map((d) => d.dia);
    const withText = v.analysis.plano.filter((d) => d.mensagem).map((d) => d.dia);
    lines.push(`**Resumo do plano:** dias com mensagem: ${withText.join(", ") || "nenhum"} · dias sem envio (tarefa ou sem mensagem): ${noSend.join(", ") || "nenhum"}`, "");
    const value = evaluateAnalysisValue(v.analysis, { facts, profile: c.seller });
    lines.push("**Teste de valor (verificações objetivas; a leitura humana continua necessária):**", ...value.map((x) => `- ${x.ok ? "✔" : "✘"} ${x.question} — ${x.detail}`), "");
    report.push({ case: c.id, model: m, telemetry: t, estimatedCost: costOf(m, t.usage), warnings: v.warnings, demoted: v.demoted_days, noSendDays: noSend, messageDays: withText, value, analysis: v.analysis });
  }
}

const summary = `Custo real estimado (maior preço da tabela): US$ ${spentWorstUsd.toFixed(5)} de US$ ${budgetUsd.toFixed(2)} · Chamadas feitas: ${calls}/${maxCalls} · requisições HTTP: ${totals.attempts} · gerações com conteúdo: ${totals.generations} · aprovadas: ${totals.approved} · reprovadas: ${totals.rejected} · tokens: prompt ${totals.prompt}, saída ${totals.output}, raciocínio ${totals.thoughts}, total ${totals.total}`;
lines.push("## Consumo", "", summary);
console.log("\n" + summary);
if (outDir) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/gemini-samples.md`, lines.join("\n"));
  writeFileSync(`${outDir}/gemini-samples.json`, JSON.stringify(report, null, 2));
  console.log(`Salvo em ${outDir}/gemini-samples.md e .json`);
}
