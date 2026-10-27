/**
 * Gera amostras REAIS do Gemini com o mesmo prompt, schema, chamada e validador da função analisar-lead-ia (v5).
 *
 *   GEMINI_API_KEY=... npx vite-node scripts/gemini-analysis-samples.ts -- --out ./samples
 *
 * Sem GEMINI_API_KEY nenhuma chamada é feita: o script só mostra o tamanho dos prompts.
 * Cada caso faz exatamente UMA chamada (a mesma que a função faz por análise) e consome tokens da sua chave.
 * Não toca em Supabase, não usa dados de clientes: as empresas abaixo são fictícias.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import {
  ANALYSIS_PROMPT_VERSION,
  buildAnalysisPrompt,
  buildVerifiedFacts,
  evaluatePreconditions,
  runGeminiAnalysis,
  sanitizeSellerProfile,
  validateAnalysis,
  type RawLeadForAnalysis,
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

const outIndex = process.argv.indexOf("--out");
const outDir = outIndex >= 0 ? process.argv[outIndex + 1] : null;
const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const lines: string[] = [`# Amostras Gemini · prompt ${ANALYSIS_PROMPT_VERSION}`, ""];
const report: unknown[] = [];
let totalPrompt = 0, totalOutput = 0, calls = 0;

for (const c of cases) {
  const facts = buildVerifiedFacts(c.lead);
  const blocked = evaluatePreconditions({ profile: c.seller, stage: facts.etapa_do_historico, existingPlan: null, replaceExisting: false });
  const prompt = blocked ? "" : buildAnalysisPrompt(facts, c.seller);
  lines.push(`## Caso ${c.id} · ${c.label}`, "");

  if (blocked) {
    lines.push(`Bloqueado antes da chamada: \`${blocked.code}\`. ${blocked.message}`, "");
    report.push({ case: c.id, blocked: blocked.code });
    console.log(`[${c.id}] bloqueado: ${blocked.code} (0 chamadas)`);
    continue;
  }

  console.log(`[${c.id}] prompt: ${prompt.length} caracteres (~${Math.round(prompt.length / 3.6)} tokens estimados)`);
  if (!apiKey) { report.push({ case: c.id, prompt_chars: prompt.length }); continue; }

  const run = await runGeminiAnalysis({ apiKey, prompt, fetchFn: fetch as never, timeoutMs: 60_000 });
  calls += run.billed_calls;
  if (!run.ok) {
    lines.push(`Falha do provedor: \`${run.kind}\` (${run.error}).`, "");
    report.push({ case: c.id, error: run.kind });
    console.log(`[${c.id}] falhou: ${run.kind} ${run.error}`);
    continue;
  }
  totalPrompt += run.usage?.prompt_tokens ?? 0;
  totalOutput += run.usage?.output_tokens ?? 0;
  const v = validateAnalysis(run.raw, { channels: facts.canais_disponiveis, profile: c.seller, stage: facts.etapa_do_historico });
  lines.push(`Modelo: \`${run.model}\` · tokens: entrada ${run.usage?.prompt_tokens ?? "?"}, saída ${run.usage?.output_tokens ?? "?"} · validação: ${v.ok ? "aprovada" : "REPROVADA"}`, "");
  if (!v.ok) {
    lines.push("Problemas: " + v.issues.join("; "), "", "```json", JSON.stringify(run.raw, null, 2), "```", "");
    report.push({ case: c.id, usage: run.usage, rejected: v.issues, raw: run.raw });
    continue;
  }
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
  report.push({ case: c.id, usage: run.usage, warnings: v.warnings, demoted: v.demoted_days, analysis: v.analysis });
}

if (apiKey) {
  lines.push("## Consumo", "", `Chamadas Gemini: ${calls}. Tokens de entrada: ${totalPrompt}. Tokens de saída: ${totalOutput}.`);
  console.log(`\nTotal: ${calls} chamadas · entrada ${totalPrompt} · saída ${totalOutput} tokens`);
} else {
  console.log("\nGEMINI_API_KEY não definida: nenhuma amostra foi gerada (nenhuma chamada feita).");
}

if (outDir && apiKey) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/gemini-samples.md`, lines.join("\n"));
  writeFileSync(`${outDir}/gemini-samples.json`, JSON.stringify(report, null, 2));
  console.log(`Salvo em ${outDir}/gemini-samples.md e .json`);
}
