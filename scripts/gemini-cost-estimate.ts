/**
 * Custo por 100, 1.000 e 10.000 análises, a partir de tokens por análise e da tabela em scripts/gemini-pricing.json.
 * Não chama nenhuma API.
 *
 *   npx vite-node scripts/gemini-cost-estimate.ts
 *   npx vite-node scripts/gemini-cost-estimate.ts -- --input 1600 --output 1400 --thoughts 700   (valores medidos)
 */
import { readFileSync } from "node:fs";
import { buildAnalysisPrompt, buildVerifiedFacts, sanitizeSellerProfile } from "../supabase/functions/_shared/lead-analysis";

const pricing = JSON.parse(readFileSync(new URL("./gemini-pricing.json", import.meta.url), "utf8")) as {
  consultado_em: string; modelos: Record<string, { id: string; input: number; output: number }>;
};
const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? Number(process.argv[i + 1]) : null; };

// Entrada: tamanho REAL do prompt v5 (÷3,6 caracteres por token; estimativa de tokenizador).
const sample = buildAnalysisPrompt(
  buildVerifiedFacts({ nome: "Auto Mecânica Irmãos Lima", nicho: "oficina mecânica", cidade: "Serra", phone: "27996543210", reviews: 46, rating: 4.7 }),
  sanitizeSellerProfile({ display_name: "Marina Costa", company_name: "Costa Digital", service_offered: "Criação de sites para negócios locais", offer_description: "Faço sites de uma página com serviços, horário, mapa e botão de WhatsApp para oficinas e lojas.", target_audience: "Oficinas e comércio local" }),
);
const inputTokens = arg("input") ?? Math.round(sample.length / 3.6);
const visibleOutput = arg("output") ?? 1450; // estimativa: ver PR (diagnóstico + 3 mensagens + 2 tarefas + 2 dias vazios)
const thoughtsScenarios = arg("thoughts") !== null ? [arg("thoughts") as number] : [0, 500, 1500, 3000];

const usd = (n: number, d = 2) => `US$ ${n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
console.log(`Preços de ${pricing.consultado_em} (NÃO verificados na fonte; ver scripts/gemini-pricing.json)`);
console.log(`Tokens por análise: entrada ${inputTokens}${arg("input") ? " (medido)" : " (estimado)"}, saída visível ${visibleOutput}${arg("output") ? " (medido)" : " (estimado)"}\n`);
console.log("| Modelo | Raciocínio (tokens) | Custo por análise | 100 | 1.000 | 10.000 |");
console.log("|---|---|---|---|---|---|");
for (const [label, p] of Object.entries(pricing.modelos)) {
  for (const t of thoughtsScenarios) {
    const per = (inputTokens * p.input + (visibleOutput + t) * p.output) / 1_000_000;
    console.log(`| ${label} | ${t} | ${usd(per, 4)} | ${usd(per * 100)} | ${usd(per * 1000)} | ${usd(per * 10000)} |`);
  }
}
