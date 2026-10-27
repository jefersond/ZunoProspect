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
import {
  ANALYSIS_PROMPT_VERSION,
  MAX_OUTPUT_TOKENS,
  buildAnalysisPrompt,
  buildVerifiedFacts,
  evaluatePreconditions,
  runGeminiAnalysis,
  sanitizeSellerProfile,
  validateAnalysis,
  type GeminiRequestOptions,
  type RawLeadForAnalysis,
  type ThinkingLevel,
} from "../supabase/functions/_shared/lead-analysis";

const sellers = {
  trafego: sanitizeSellerProfile({
    display_name: "Rafael Moura", company_name: "Moura Ads",
    service_offered: "Gestão de tráfego pago para clínicas e consultórios",
    offer_description: "Crio e gerencio campanhas no Google Ads e Meta Ads para clínicas e consultórios receberem pacientes novos em procedimentos específicos, com relatório mensal de contatos e agendamentos.",
    target_audience: "Clínicas odontológicas e consultórios da Grande Vitória",
  }),
  social: sanitizeSellerProfile({
    display_name: "Camila Duarte", company_name: "Duarte Conteúdo",
    service_offered: "Gestão de Instagram para restaurantes",
    offer_description: "Cuido do Instagram de restaurantes: organização do perfil, fotos e vídeos dos pratos, cardápio nos destaques, 12 posts por mês e resposta aos comentários.",
    target_audience: "Restaurantes e lanchonetes",
  }),
  sites: sanitizeSellerProfile({
    display_name: "Marina Costa", company_name: "Costa Digital",
    service_offered: "Criação de sites para negócios locais",
    offer_description: "Faço sites de uma página com serviços, horário, mapa e botão de WhatsApp para oficinas e lojas.",
    target_audience: "Oficinas e comércio local",
  }),
  automacao: sanitizeSellerProfile({
    display_name: "Paulo Nery", company_name: "Nery Automação",
    service_offered: "Automação de atendimento no WhatsApp para lojas",
    offer_description: "Configuro WhatsApp Business com respostas rápidas, catálogo, etiquetas de clientes e lembrete de orçamentos pendentes para lojas pequenas.",
    target_audience: "Lojas e comércio local",
  }),
  agencia: sanitizeSellerProfile({
    display_name: "Bianca Ramos", company_name: "Ramos Performance",
    service_offered: "Google Ads e site para empresas de serviços",
    offer_description: "Agência que monta campanhas de busca no Google e uma página de captação de pedidos de orçamento para empresas de serviços para condomínios e empresas.",
    target_audience: "Prestadores de serviço B2B",
  }),
  semOferta: sanitizeSellerProfile({ display_name: "Ana" }),
};

const lead = (over: Partial<RawLeadForAnalysis>): RawLeadForAnalysis => ({
  nome: "", nicho: "", cidade: "", endereco: null, website: null, instagram: null, email: null, phone: null,
  rating: null, reviews: null, status: "novo", notas: null, ...over,
});

const cases = [
  { id: "A", label: "Tráfego pago → clínica odontológica", seller: sellers.trafego, lead: lead({ nome: "Clínica Odontológica Sorriso Vivo", nicho: "clínica odontológica", cidade: "Vitória", website: "https://sorrisovivo.example", phone: "27998765432", reviews: 87, rating: 4.8 }) },
  { id: "B", label: "Social media → restaurante", seller: sellers.social, lead: lead({ nome: "Restaurante Sabor da Ilha", nicho: "restaurante", cidade: "Vila Velha", instagram: "https://instagram.com/saborda.ilha", phone: "27997654321", reviews: 214, rating: 4.6 }) },
  { id: "C", label: "Criação de sites → oficina mecânica", seller: sellers.sites, lead: lead({ nome: "Auto Mecânica Irmãos Lima", nicho: "oficina mecânica", cidade: "Serra", phone: "27996543210", reviews: 46, rating: 4.7 }) },
  { id: "D", label: "Automação → comércio local", seller: sellers.automacao, lead: lead({ nome: "Casa & Cia Utilidades", nicho: "loja de utilidades domésticas", cidade: "Cariacica", website: "https://casaecia.example", phone: "27995432109", reviews: 29, rating: 4.5 }) },
  { id: "E", label: "Agência (serviço informado) → empresa de serviços, telefone fixo", seller: sellers.agencia, lead: lead({ nome: "Andrade Manutenção Predial", nicho: "manutenção predial", cidade: "Vitória", website: "https://andrademp.example", phone: "2733221100", reviews: 12, rating: 4.4 }) },
  { id: "F", label: "Sem descrição da oferta → deve bloquear antes de qualquer chamada", seller: sellers.semOferta, lead: lead({ nome: "Studio Bella Forma", nicho: "estética", cidade: "Guarapari", phone: "2732611234" }) },
  { id: "G", label: "Empresa já respondeu → a sequência fria deve parar", seller: sellers.trafego, lead: lead({ nome: "Clínica Dental Prime", nicho: "clínica odontológica", cidade: "Serra", phone: "27994443322", reviews: 33, rating: 4.9, status: "respondeu", notas: "Respondeu perguntando como funciona e quanto custa." }) },
];

const argValue = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : null; };
const hasFlag = (name: string) => process.argv.includes(`--${name}`);
const outDir = argValue("out");
const maxCalls = Number(argValue("max-calls") ?? 0);
const models = (argValue("models") ?? "gemini-3.6-flash").split(",").map((m) => m.trim()).filter(Boolean);
const thinkingArg = argValue("thinking") ?? "LOW";
const thinkingLevel = thinkingArg === "default" ? null : (thinkingArg.toUpperCase() as ThinkingLevel);
const selected = new Set((argValue("cases") ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean));
const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const runnable = cases.filter((c) => selected.has(c.id));
const preflightCalls = hasFlag("preflight") ? models.length : 0;
const analysisCases = runnable.filter((c) => !evaluatePreconditions({ profile: c.seller, stage: buildVerifiedFacts(c.lead).etapa_do_historico, existingPlan: null, replaceExisting: false }));
const plannedCalls = preflightCalls + analysisCases.length * models.length;

// ── Plano e teto de custo no pior caso (todas as chamadas usando o limite de saída inteiro) ──
const pricingFile = JSON.parse(readFileSync(new URL("./gemini-pricing.json", import.meta.url), "utf8")) as { modelos: Record<string, { id: string; input: number; output: number }> };
const worstCaseUsd = (model: string, inputTokens: number, outputTokens: number) => {
  const prices = Object.values(pricingFile.modelos).filter((m) => m.id === model);
  if (!prices.length) return null;
  const p = prices.reduce((max, cur) => (cur.output > max.output ? cur : max));
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
};
console.log("PLANO");
console.log(`- modelos: ${models.join(", ")} | raciocínio: ${thinkingLevel ?? "padrão do modelo"} | casos: ${analysisCases.map((c) => c.id).join(", ") || "nenhum"}`);
console.log(`- chamadas planejadas: ${plannedCalls} (${preflightCalls} de contrato com schema mínimo + ${analysisCases.length * models.length} análises completas)`);
console.log(`- teto informado (--max-calls): ${maxCalls}`);
let worstTotal = 0;
for (const m of models) {
  const pre = hasFlag("preflight") ? worstCaseUsd(m, 100, 200) ?? NaN : 0;
  const per = worstCaseUsd(m, 1600, MAX_OUTPUT_TOKENS);
  const total = pre + (per ?? NaN) * analysisCases.length;
  worstTotal += total;
  console.log(`- ${m}: pior caso ≈ ${Number.isFinite(total) ? `US$ ${total.toFixed(3)}` : "sem preço na tabela"} (entrada 1.600 + saída inteira de ${MAX_OUTPUT_TOKENS} tokens por análise, preço mais alto da tabela)`);
}
if (Number.isFinite(worstTotal)) console.log(`- pior caso total ≈ US$ ${worstTotal.toFixed(3)} (preços NÃO verificados na fonte)`);

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
const guard = () => { if (calls >= maxCalls) throw new Error("teto de chamadas atingido"); calls++; };

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
  const tiny = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false };
  for (const m of models) {
    if (stop) break;
    const r = await once(m, 'Retorne exatamente {"ok": true}.', { thinkingLevel, maxOutputTokens: 200, schema: tiny });
    tally(r.telemetry);
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
    const run = await once(m, prompt, { thinkingLevel });
    tally(run.telemetry);
    const t = run.telemetry;
    const head = `modelo usado: \`${t.model_used ?? m}\` · tentativas HTTP ${t.http_attempts} · gerações com conteúdo ${t.generations_with_content} · finish ${t.finish_reason ?? "?"} · tokens: prompt ${t.usage?.prompt_tokens ?? "?"}, saída ${t.usage?.output_tokens ?? "?"}, raciocínio ${t.usage?.thoughts_tokens ?? "?"}, total ${t.usage?.total_tokens ?? "?"}`;
    if (!run.ok) {
      lines.push(head, `Falha: \`${run.kind}\` (${run.error}) · cobrança do provedor: ${t.billing}`, "");
      report.push({ case: c.id, model: m, telemetry: t, failure: run.kind }); console.log(`[${c.id}/${m}] falhou: ${run.kind} (${t.billing})`);
      if (run.kind === "invalid_request" || run.kind === "auth_error") stop = true;
      continue;
    }
    const v = validateAnalysis(run.raw, { channels: facts.canais_disponiveis, profile: c.seller, stage: facts.etapa_do_historico });
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
    report.push({ case: c.id, model: m, telemetry: t, warnings: v.warnings, demoted: v.demoted_days, analysis: v.analysis });
  }
}

const summary = `Chamadas feitas: ${calls}/${maxCalls} · requisições HTTP: ${totals.attempts} · gerações com conteúdo: ${totals.generations} · aprovadas: ${totals.approved} · reprovadas: ${totals.rejected} · tokens: prompt ${totals.prompt}, saída ${totals.output}, raciocínio ${totals.thoughts}, total ${totals.total}`;
lines.push("## Consumo", "", summary);
console.log("\n" + summary);
if (outDir) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/gemini-samples.md`, lines.join("\n"));
  writeFileSync(`${outDir}/gemini-samples.json`, JSON.stringify(report, null, 2));
  console.log(`Salvo em ${outDir}/gemini-samples.md e .json`);
}
