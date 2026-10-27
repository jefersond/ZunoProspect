import { buildIntelligentPlan, buildStructuredDiagnosis } from "@/services/intelligentSevenDayPlan";
import type { LeadProspeccao, PlanoProspeccaoDia } from "@/types/lead";

const baseLead = {
  id: "lead-fixture-1",
  placeId: null,
  nome: "Studio Pilates Harmonia",
  telefone: "27999881122",
  whatsapp_link: null,
  email: null,
  website: "https://harmoniapilates.com.br",
  instagram_url: null,
  instagram_context: null,
  endereco: null,
  cidade: "Vitória",
  nicho: "estúdio de pilates",
  proximidadeAtiva: false,
  raioKm: null,
  sinais: { has_whatsapp_on_site: false, has_meta_pixel: false, has_gtag: false, has_gtm: false },
  rating: 4.9,
  total_reviews: 35,
  status: "novo",
  created_at: "2026-10-20T10:00:00.000Z",
  ai_analise_gerada_em: "2026-10-21T10:00:00.000Z",
  salvo: true,
  notas: null,
  cnpj: null,
  razao_social: null,
  nome_responsavel: null,
  cnpj_telefone: null,
  cnpj_email: null,
  situacao_cadastral: null,
  porte_empresa: null,
  cnae_principal: null,
};

/** Lead gerado pelo fluxo atual: plano e diagnóstico do motor local, sem probabilidade numérica. */
export function makeNewLead(): LeadProspeccao {
  const lead = {
    ...baseLead,
    foco: "Tráfego",
    diagnostico_bullets: [],
    probabilidade_conversao: null,
    plano_prospecao_7dias: [],
  } as unknown as LeadProspeccao;

  const plan = buildIntelligentPlan({ lead, userServiceName: "gestão de tráfego local" });
  lead.plano_prospecao_7dias = plan.days;
  lead.diagnostico_bullets = buildStructuredDiagnosis(lead, "gestão de tráfego local").diagnostico;
  return lead;
}

/** Lead antigo: probabilidade numérica legada, foco nulo, plano no formato anterior (sem assunto_email/objetivo). */
export function makeLegacyLead(): LeadProspeccao {
  const plano: PlanoProspeccaoDia[] = Array.from({ length: 7 }, (_, i) => ({
    dia: i + 1,
    canal: i === 2 ? "email" : i === 1 ? "instagram" : "whatsapp",
    titulo: `Dia ${i + 1}`,
    mensagem: `Mensagem antiga personalizada do dia ${i + 1}`,
    acao_sugerida: `Ação antiga ${i + 1}`,
    objecao_provavel: `Objeção antiga ${i + 1}`,
    resposta_sugerida: `Resposta antiga ${i + 1}`,
    cta: `CTA antigo ${i + 1}`,
  }));

  return {
    ...baseLead,
    id: "lead-fixture-legacy",
    nome: "Auto Peças Litoral",
    cidade: "Guarapari",
    nicho: "autopeças",
    website: null,
    sinais: null,
    foco: null,
    diagnostico_bullets: ["Diagnóstico antigo 1", "Diagnóstico antigo 2"],
    probabilidade_conversao: 85,
    plano_prospecao_7dias: plano,
  } as unknown as LeadProspeccao;
}
