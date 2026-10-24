import type { LeadProspeccao } from "@/types/lead";
import { sanitizeBrazilianPhoneNumber } from "./sdrProspectingService";

export interface CompatibilityExplanation {
  score: number; // 0 a 100
  ratingLevel: "alta" | "media" | "baixa"; // >= 70 alta, 40-69 média, < 40 baixa
  motivos: string[]; // Principais motivos da nota
  dadosUtilizados: string[]; // Dados reais e verificáveis observados
  dadosNaoVerificados: string[]; // Informações não observadas (sem inferências)
  isPrioritySDR: boolean; // score >= minScoreThreshold
  resumoExplicativo: string;
}

export interface CompatibilityScoreOptions {
  userServiceName?: string;
  minScoreThreshold?: number; // Padrão: 70
  targetCity?: string;
  targetNiche?: string;
}

/**
 * Calcula o Índice de Compatibilidade Comercial do Lead (0 a 100).
 * 
 * DIRETRIZES INVIOLÁVEIS:
 * 1. Baseado EXCLUSIVAMENTE em informações públicas e verificáveis.
 * 2. NUNCA inventa dados ausentes nem presume faturamento ou capacidade de compra.
 * 3. NUNCA transforma ausência de site em "prova de necessidade comercial".
 * 4. NUNCA apresenta a nota como probabilidade estatística de fechamento.
 * 5. Totalmente explicável: detalha motivos, dados usados e dados não verificados.
 */
export function calculateLeadCompatibilityScore(
  lead: Partial<LeadProspeccao>,
  options: CompatibilityScoreOptions = {}
): CompatibilityExplanation {
  const minScore = typeof options.minScoreThreshold === "number" ? options.minScoreThreshold : 70;
  
  let score = 0;
  const motivos: string[] = [];
  const dadosUtilizados: string[] = [];
  const dadosNaoVerificados: string[] = [];

  // =========================================================================
  // 1. DADOS DE CONTATO COMERCIAL E DISPONIBILIDADE (Até 35 pontos)
  // =========================================================================
  const rawPhone = lead.whatsapp_number || lead.telefone;
  const phoneCheck = sanitizeBrazilianPhoneNumber(rawPhone);

  if (phoneCheck.isValid && phoneCheck.isCellPhone) {
    score += 25;
    motivos.push("Telefone celular com WhatsApp formatado para contato direto (+25 pts)");
    dadosUtilizados.push(`Celular com WhatsApp: ${phoneCheck.formattedDisplay}`);
  } else if (phoneCheck.isValid) {
    score += 10;
    motivos.push("Telefone comercial informado (+10 pts)");
    dadosUtilizados.push(`Telefone fixo comercial: ${phoneCheck.formattedDisplay}`);
    dadosNaoVerificados.push("WhatsApp direto não verificado neste número fixo");
  } else {
    motivos.push("Telefone comercial ausente ou em formato inválido (0 pts)");
    dadosNaoVerificados.push("Telefone válido para abordagem direta não identificado");
  }

  if (lead.sinais?.has_whatsapp_on_site) {
    score += 5;
    motivos.push("Canal de atendimento via WhatsApp no site confirmado (+5 pts)");
    dadosUtilizados.push("Botão ou link de WhatsApp ativo no site");
  }

  if (lead.endereco && lead.endereco.trim().length > 5) {
    score += 5;
    motivos.push("Endereço físico comercial verificado (+5 pts)");
    dadosUtilizados.push(`Endereço: ${lead.endereco.trim()}`);
  } else {
    dadosNaoVerificados.push("Endereço físico comercial completo não detalhado");
  }

  // =========================================================================
  // 2. SINAIS DE PRESENÇA DIGITAL E REPUTAÇÃO LOCAL (Até 35 pontos)
  // =========================================================================
  const hasValidWebsite = Boolean(lead.website && lead.website.trim().length > 4 && !lead.website.includes("facebook.com"));
  if (hasValidWebsite) {
    score += 15;
    motivos.push("Website institucional ativo e acessível (+15 pts)");
    dadosUtilizados.push(`Website: ${lead.website!.trim()}`);
  } else {
    motivos.push("Presença web limitada ou sem site próprio cadastrado (0 pts)");
    dadosNaoVerificados.push("Website próprio não localizado nos registros públicos");
  }

  const reviews = typeof lead.total_reviews === "number" ? lead.total_reviews : null;
  const rating = typeof lead.rating === "number" ? lead.rating : null;

  if (reviews !== null && reviews >= 20) {
    score += 15;
    motivos.push(`Reputação consolidada com ${reviews} avaliações públicas (+15 pts)`);
    dadosUtilizados.push(`Avaliações no Google: ${reviews} avaliações${rating ? ` (nota ${rating})` : ""}`);
  } else if (reviews !== null && reviews >= 5) {
    score += 10;
    motivos.push(`Presença no Google com histórico de ${reviews} avaliações (+10 pts)`);
    dadosUtilizados.push(`Avaliações no Google: ${reviews} avaliações${rating ? ` (nota ${rating})` : ""}`);
  } else if (reviews !== null && reviews > 0) {
    score += 5;
    motivos.push(`Perfil com ${reviews} avaliação inicial (+5 pts)`);
    dadosUtilizados.push(`Avaliações no Google: ${reviews} avaliações`);
  } else {
    dadosNaoVerificados.push("Histórico de avaliações públicas no Google não mapeado");
  }

  if (lead.sinais?.has_meta_pixel || lead.sinais?.has_gtag || lead.sinais?.has_gtm) {
    score += 5;
    motivos.push("Maturidade de rastreamento digital identificada (Pixel/Tags) (+5 pts)");
    dadosUtilizados.push("Tags de marketing/Pixel ativas no domínio");
  }

  // =========================================================================
  // 3. SEGMENTO, LOCALIZAÇÃO E ADERÊNCIA AO SERVIÇO (Até 30 pontos)
  // =========================================================================
  const niche = lead.nicho ? lead.nicho.trim() : "";
  if (niche && niche.length > 2 && niche.toLowerCase() !== "não informado") {
    score += 15;
    motivos.push(`Nicho de mercado definido (${niche}) (+15 pts)`);
    dadosUtilizados.push(`Segmento de atuação: ${niche}`);
  } else {
    dadosNaoVerificados.push("Classificação exata do nicho não informada");
  }

  const city = lead.cidade ? lead.cidade.trim() : "";
  if (city && city.length > 2 && city.toLowerCase() !== "não informada") {
    score += 10;
    motivos.push(`Localização geográfica confirmada (${city}) (+10 pts)`);
    dadosUtilizados.push(`Cidade de operação: ${city}`);
  } else {
    dadosNaoVerificados.push("Cidade de operação não confirmada");
  }

  // Aderência básica ao serviço do usuário (se fornecido)
  const userService = (options.userServiceName || "").toLowerCase();
  if (userService) {
    score += 5;
    motivos.push(`Contexto de prospecção alinhado ao serviço de "${options.userServiceName}" (+5 pts)`);
    dadosUtilizados.push(`Serviço oferecido: ${options.userServiceName}`);
  }

  // Informações invariantes que NUNCA são inventadas
  dadosNaoVerificados.push("Faturamento e capacidade orçamentária não verificados nos registros públicos");
  dadosNaoVerificados.push("Decisor comercial direto não mapeado publicamente");

  // Normalização estrita 0 a 100
  const finalScore = Math.min(100, Math.max(0, score));

  let ratingLevel: "alta" | "media" | "baixa" = "baixa";
  if (finalScore >= 70) ratingLevel = "alta";
  else if (finalScore >= 40) ratingLevel = "media";

  const isPrioritySDR = finalScore >= minScore;

  const resumoExplicativo = `Compatibilidade comercial avaliada em ${finalScore}/100 com base em ${dadosUtilizados.length} dados verificados (${ratingLevel === "alta" ? "alta aderência cadastral" : ratingLevel === "media" ? "aderência moderada" : "dados cadastrais limitados"}). Não representa probabilidade de fechamento.`;

  return {
    score: finalScore,
    ratingLevel,
    motivos,
    dadosUtilizados,
    dadosNaoVerificados,
    isPrioritySDR,
    resumoExplicativo,
  };
}
