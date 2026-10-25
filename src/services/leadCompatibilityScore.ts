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

function normalizeMatchString(value?: string | null): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .trim();
}

function checkStringOverlap(a?: string | null, b?: string | null): boolean {
  const normA = normalizeMatchString(a);
  const normB = normalizeMatchString(b);
  if (!normA || !normB) return false;
  if (normA === normB || normA.includes(normB) || normB.includes(normA)) return true;

  const wordsA = normA.split(/\s+/).filter((w) => w.length > 3);
  const wordsB = normB.split(/\s+/).filter((w) => w.length > 3);
  return wordsA.some((wA) => wordsB.some((wB) => wA.includes(wB) || wB.includes(wA)));
}

/**
 * Calcula o Índice de Compatibilidade Comercial do Lead (0 a 100).
 * 
 * DIRETRIZES DE SEGURANÇA E PRECISÃO:
 * 1. Separa:
 *    A. Completude e disponibilidade de dados de contato (até 30 pts);
 *    B. Aderência à missão: cidade, segmento e serviço (até 40 pts);
 *    C. Sinais de oportunidade e presença pública (até 30 pts).
 * 2. Compara a cidade do lead com a cidade da missão e segmento com nicho da missão.
 * 3. NUNCA concede pontos simplesmente porque o nome do serviço foi preenchido.
 * 4. NUNCA afirma 'site ativo e acessível' sem teste de acessibilidade em tempo real.
 * 5. NUNCA afirma que número celular é WhatsApp confirmado sem checagem de API.
 * 6. NUNCA apresenta a nota como probabilidade de fechamento.
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
  // PILAR A: DISPONIBILIDADE E VALIDAÇÃO DE CONTATOS (Até 30 pontos)
  // =========================================================================
  const rawPhone = lead.whatsapp_number || lead.telefone;
  const phoneCheck = sanitizeBrazilianPhoneNumber(rawPhone);

  if (phoneCheck.isValid && phoneCheck.isCellPhone) {
    score += 20;
    motivos.push("Telefone em formato compatível com celular/WhatsApp (+20 pts)");
    dadosUtilizados.push(`Telefone celular formatado: ${phoneCheck.formattedDisplay}`);
    dadosNaoVerificados.push(
      "Cadastro ativo no WhatsApp e recebimento de mensagens não verificados em API externa"
    );
  } else if (phoneCheck.isValid) {
    score += 10;
    motivos.push("Telefone fixo comercial cadastrado (+10 pts)");
    dadosUtilizados.push(`Telefone fixo: ${phoneCheck.formattedDisplay}`);
    dadosNaoVerificados.push("WhatsApp direto não verificado neste número fixo");
  } else {
    motivos.push("Telefone comercial ausente ou em formato não reconhecido (0 pts)");
    dadosNaoVerificados.push("Telefone para contato direto não identificado nos registros públicos");
  }

  if (lead.sinais?.has_whatsapp_on_site) {
    score += 5;
    motivos.push("Link de atendimento via WhatsApp mapeado no domínio (+5 pts)");
    dadosUtilizados.push("Botão ou link de WhatsApp identificado na página");
  }

  if (lead.endereco && lead.endereco.trim().length > 5) {
    score += 5;
    motivos.push("Endereço físico cadastrado no município (+5 pts)");
    dadosUtilizados.push(`Endereço: ${lead.endereco.trim()}`);
  } else {
    dadosNaoVerificados.push("Endereço físico comercial completo não detalhado");
  }

  // =========================================================================
  // PILAR B: ADERÊNCIA À MISSÃO COMERCIAL (CIDADE, SEGMENTO E SERVIÇO) (Até 40 pontos)
  // =========================================================================
  const leadCity = lead.cidade ? lead.cidade.trim() : "";
  const targetCity = options.targetCity ? options.targetCity.trim() : "";

  if (targetCity) {
    const cityMatches = checkStringOverlap(leadCity, targetCity);
    if (cityMatches) {
      score += 15;
      motivos.push(`Localização coincide com a praça-alvo da missão: ${leadCity} (+15 pts)`);
      dadosUtilizados.push(`Cidade alinhada à missão: ${leadCity}`);
    } else {
      motivos.push(
        `Empresa situada em praça diferente da cidade-alvo (${leadCity || "Não informada"} vs ${targetCity}) (0 pts)`
      );
      dadosNaoVerificados.push("Empresa fora do foco geográfico prioritário da missão");
    }
  } else if (leadCity && leadCity.toLowerCase() !== "não informada") {
    score += 10;
    motivos.push(`Cidade da empresa informada: ${leadCity} (+10 pts)`);
    dadosUtilizados.push(`Cidade cadastrada: ${leadCity}`);
  } else {
    dadosNaoVerificados.push("Cidade de operação não confirmada");
  }

  const leadNiche = lead.nicho ? lead.nicho.trim() : "";
  const targetNiche = options.targetNiche ? options.targetNiche.trim() : "";

  if (targetNiche) {
    const nicheMatches = checkStringOverlap(leadNiche, targetNiche);
    if (nicheMatches) {
      score += 15;
      motivos.push(`Segmento alinhado ao nicho da missão: ${leadNiche} (+15 pts)`);
      dadosUtilizados.push(`Nicho alinhado à missão: ${leadNiche}`);
    } else {
      motivos.push(
        `Segmento cadastrado (${leadNiche || "Não informado"}) difere do nicho-alvo da missão (${targetNiche}) (0 pts)`
      );
      dadosNaoVerificados.push("Segmento fora do nicho prioritário da missão");
    }
  } else if (leadNiche && leadNiche.toLowerCase() !== "não informado") {
    score += 10;
    motivos.push(`Segmento da empresa informado: ${leadNiche} (+10 pts)`);
    dadosUtilizados.push(`Segmento cadastrado: ${leadNiche}`);
  } else {
    dadosNaoVerificados.push("Segmento de mercado não categorizado");
  }

  // Aderência real do serviço aos sinais da empresa (Critérios específicos por serviço - até 10 pts)
  const serviceNorm = normalizeMatchString(options.userServiceName);
  const hasWebsite = Boolean(
    lead.website && lead.website.trim().length > 4 && !lead.website.includes("facebook.com")
  );
  const reviewsCount = typeof lead.total_reviews === "number" ? lead.total_reviews : 0;
  const hasPixel = Boolean(lead.sinais?.has_meta_pixel || lead.sinais?.has_gtag);

  if (serviceNorm) {
    if (
      serviceNorm.includes("site") ||
      serviceNorm.includes("landing") ||
      serviceNorm.includes("web")
    ) {
      if (!hasWebsite) {
        score += 10;
        motivos.push(
          "Ausência de website cadastrado representa aderência direta para oferta de criação de site (+10 pts)"
        );
      } else if (!lead.sinais?.has_whatsapp_on_site || !hasPixel) {
        score += 5;
        motivos.push(
          "Website cadastrado com espaço para otimização de conversão e pontos de contato (+5 pts)"
        );
      }
    } else if (
      serviceNorm.includes("trafego") ||
      serviceNorm.includes("anuncio") ||
      serviceNorm.includes("ads") ||
      serviceNorm.includes("performance")
    ) {
      if (hasWebsite && reviewsCount >= 5) {
        score += 10;
        motivos.push(
          "Presença web e avaliações indicam operação ativa apta para geração de demanda local (+10 pts)"
        );
      } else if (hasPixel) {
        score += 10;
        motivos.push(
          "Tags de anúncios detectadas no domínio, indicando maturidade técnica para tráfego pago (+10 pts)"
        );
      } else if (reviewsCount >= 3) {
        score += 5;
        motivos.push(
          "Histórico de clientes locais que pode ser ampliado com campanhas de busca (+5 pts)"
        );
      }
    } else if (serviceNorm.includes("social") || serviceNorm.includes("instagram") || serviceNorm.includes("conteudo")) {
      if (lead.instagram_url || reviewsCount >= 5) {
        score += 10;
        motivos.push(
          "Presença digital mapeada para estruturação de posicionamento e rotina de conteúdo (+10 pts)"
        );
      }
    } else if (serviceNorm.includes("clinica") || serviceNorm.includes("odonto") || serviceNorm.includes("saude")) {
      const isHealth =
        leadNiche.toLowerCase().includes("odont") ||
        leadNiche.toLowerCase().includes("clinic") ||
        leadNiche.toLowerCase().includes("saude");
      if (isHealth && phoneCheck.isValid) {
        score += 10;
        motivos.push(
          "Clínica com canal de atendimento telefônico/WhatsApp para direcionamento de agendamentos (+10 pts)"
        );
      }
    } else if (serviceNorm.includes("crm") || serviceNorm.includes("automacao")) {
      if (phoneCheck.isValid && hasWebsite) {
        score += 10;
        motivos.push(
          "Múltiplos canais de entrada exigem triagem e acompanhamento comercial organizado (+10 pts)"
        );
      }
    }
  }

  // =========================================================================
  // PILAR C: SINAIS DE OPORTUNIDADE E PRESENÇA PÚBLICA (Até 30 pontos)
  // =========================================================================
  if (hasWebsite && lead.website) {
    score += 10;
    motivos.push("Website institucional cadastrado nos registros públicos (+10 pts)");
    dadosUtilizados.push(`URL cadastrada: ${lead.website.trim()}`);
    dadosNaoVerificados.push(
      "Acessibilidade do servidor web e taxa de conversão não testadas em tempo real"
    );
  } else {
    motivos.push("Website próprio não cadastrado nos registros públicos consultados (0 pts)");
    dadosNaoVerificados.push("Website institucional próprio não localizado");
  }

  const reviews = typeof lead.total_reviews === "number" ? lead.total_reviews : null;
  const rating = typeof lead.rating === "number" ? lead.rating : null;

  if (reviews !== null && reviews >= 20) {
    score += 15;
    motivos.push(`Histórico consolidado com ${reviews} avaliações públicas no Google (+15 pts)`);
    dadosUtilizados.push(
      `Avaliações no Google: ${reviews} avaliações registradas${rating ? ` (nota média ${rating}★)` : ""}`
    );
  } else if (reviews !== null && reviews >= 5) {
    score += 10;
    motivos.push(`Presença no Google com histórico de ${reviews} avaliações (+10 pts)`);
    dadosUtilizados.push(
      `Avaliações no Google: ${reviews} avaliações registradas${rating ? ` (nota média ${rating}★)` : ""}`
    );
  } else if (reviews !== null && reviews > 0) {
    score += 5;
    motivos.push(`Perfil no Google com ${reviews} avaliação inicial (+5 pts)`);
    dadosUtilizados.push(`Avaliações no Google: ${reviews} avaliação`);
  } else {
    dadosNaoVerificados.push("Histórico de avaliações públicas no Google não mapeado");
  }

  if (lead.sinais?.has_meta_pixel || lead.sinais?.has_gtag || lead.sinais?.has_gtm) {
    score += 5;
    motivos.push("Tags de marketing/Pixel detectadas no domínio (+5 pts)");
    dadosUtilizados.push("Tags de rastreamento digital detectadas no domínio");
  }

  // Limitações estruturais invariantes
  dadosNaoVerificados.push("Faturamento e capacidade orçamentária não verificados nos registros públicos");
  dadosNaoVerificados.push("Decisor comercial nominal não identificado publicamente");
  dadosNaoVerificados.push(
    "Disponibilidade da empresa para contratar novos serviços não verificada previamente"
  );

  // Normalização estrita 0 a 100
  const finalScore = Math.min(100, Math.max(0, score));

  let ratingLevel: "alta" | "media" | "baixa" = "baixa";
  if (finalScore >= 70) ratingLevel = "alta";
  else if (finalScore >= 40) ratingLevel = "media";

  const isPrioritySDR = finalScore >= minScore;

  const resumoExplicativo = `Compatibilidade comercial avaliada em ${finalScore}/100 com base em ${dadosUtilizados.length} dados verificados (${
    ratingLevel === "alta"
      ? "alta aderência cadastral com a missão"
      : ratingLevel === "media"
      ? "aderência moderada"
      : "dados cadastrais limitados"
  }). Não representa probabilidade de fechamento nem garantia de contratação comercial.`;

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
