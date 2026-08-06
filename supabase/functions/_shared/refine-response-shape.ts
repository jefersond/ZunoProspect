// Contrato estrutural do payload retornado pelo "Refinar com IA". As 7 seções abaixo são
// obrigatórias para o usuário conseguir abordar o lead (ver REGRA CRÍTICA DE QUALIDADE):
// 1. resumo do negócio       -> input_context
// 2. diagnóstico             -> diagnostico
// 3. oportunidades           -> diagnostico.oportunidade
// 4. Plano de Prospecção     -> plano_prospeccao_7dias (7 dias)
// 5. argumentos de abordagem -> diagnostico.justificativa + copies
// 6. mensagens personalizadas-> abordagens_por_canal (whatsapp/instagram/email)
// 7. próximos passos         -> cta de cada dia em plano_prospeccao_7dias
export const REQUIRED_REFINE_SECTIONS = [
  "input_context",
  "diagnostico",
  "copies",
  "abordagens_por_canal",
  "plano_prospeccao_7dias",
] as const;

export interface RefinePlanInputContext {
  empresa: string;
  nicho: string;
  cidade: string;
  estado: string | null;
  site: string | null;
  oferta_usuario: string;
  publico_alvo: string;
  dor_principal: string;
  objetivo: string;
  canal: string | null;
  etapa: string | null;
}

export interface RefinePlanDay {
  dia: number;
  canal: string;
  mensagem?: string;
  cta?: string;
  objecao_provavel?: string;
  resposta_sugerida?: string;
  [key: string]: unknown;
}

export interface RefinePlanAnalise {
  fit_level?: "alto" | "medio" | "baixo";
  probable_pain?: string;
  pain_point?: string;
  commercial_opportunity?: string;
  why_good_lead?: string;
  diagnostico_bullets?: string[];
  messages?: {
    whatsapp_primary?: string;
    instagram?: string;
    email_body?: string;
  };
  whatsapp_message?: string;
  instagram_message?: string;
  email_body?: string;
  plano_prospeccao_7dias: RefinePlanDay[];
}

export function buildRefinePlanResponse(params: {
  leadId: string | null;
  requestId: string;
  analise: RefinePlanAnalise;
  inputContext: RefinePlanInputContext;
  fallbackUsed: boolean;
  missingFields: string[];
}): Record<string, unknown> {
  const { leadId, requestId, analise, inputContext, fallbackUsed, missingFields } = params;
  const dias = analise.plano_prospeccao_7dias;

  return {
    lead_id: leadId || null,
    generated_at: new Date().toISOString(),
    prompt_version: "v2_contextual",
    model: "gemini-direct",
    input_context: inputContext,
    diagnostico: {
      fit: analise.fit_level || "medio",
      dor_provavel: analise.probable_pain || analise.pain_point || "Não identificada",
      urgencia: analise.fit_level === "alto" ? "alta" : "media",
      oportunidade: analise.commercial_opportunity || "Não detalhada",
      justificativa: analise.why_good_lead || (analise.diagnostico_bullets || []).join(" "),
    },
    copies: {
      dia_1: dias[0]?.mensagem || "",
      dia_2: dias[1]?.mensagem || "",
      dia_3: dias[2]?.mensagem || "",
      dia_4: dias[3]?.mensagem || "",
      dia_5: dias[4]?.mensagem || "",
      dia_6: dias[5]?.mensagem || "",
      dia_7: dias[6]?.mensagem || "",
    },
    abordagens_por_canal: {
      whatsapp: analise.messages?.whatsapp_primary || analise.whatsapp_message || "",
      instagram: analise.messages?.instagram || analise.instagram_message || "",
      email: analise.messages?.email_body || analise.email_body || "",
    },
    plano_prospeccao_7dias: dias,
    debug: {
      response_size_bytes: JSON.stringify(analise).length,
      request_id: requestId,
      fallback_used: fallbackUsed,
      cache_used: false,
      missing_fields: missingFields,
    },
  };
}
