import type { LeadProspeccao } from "@/types/lead";
import {
  calculateLeadCompatibilityScore,
  type CompatibilityExplanation,
} from "./leadCompatibilityScore";
import {
  sanitizeBrazilianPhoneNumber,
  resolveServiceArgumentProfile,
  checkSdrDuplicateApproach,
  type ServiceArgumentProfile,
} from "./sdrProspectingService";

export interface VerifiedLeadFact {
  label: string;
  value: string;
  sourceType: "cadastro_publico" | "sinal_digital" | "historico_zuno";
  verified: boolean;
}

export interface CommercialAngleHypothesis {
  id: string;
  title: string;
  hypothesis: string;
  investigativeQuestion: string;
  basisFact: string;
}

export interface LeadCommercialDossier {
  leadId: string;
  companyName: string;
  city: string;
  niche: string;
  userServiceName: string;
  serviceProfile: ServiceArgumentProfile;
  compatibility: CompatibilityExplanation;
  oQueSabemos: VerifiedLeadFact[];
  possiveisAngulosComerciais: CommercialAngleHypothesis[];
  porQueValeAnalisar: {
    headline: string;
    reasons: string[];
    recommendedEntryChannel: "whatsapp" | "email" | "instagram" | "pesquisa_adicional";
  };
  limitacoesAnalise: string[];
  hasIncompleteData: boolean;
}

export interface BuildDossierOptions {
  userServiceName?: string;
  commercialObjective?: string;
  minScoreThreshold?: number;
}

/**
 * Constrói o Dossiê Comercial Explicável por Empresa.
 *
 * REGRA INVIOLÁVEL:
 * - Separa rigorosamente "O QUE SABEMOS" (fatos verificados) de "POSSÍVEIS ÂNGULOS COMERCIAIS" (hipóteses).
 * - Nunca afirma problemas internos não verificados como se fossem fatos.
 */
export function buildLeadCommercialDossier(
  lead: Partial<LeadProspeccao>,
  options: BuildDossierOptions = {}
): LeadCommercialDossier {
  const companyName = lead.nome?.trim() || "Empresa sem nome identificado";
  const city = lead.cidade?.trim() || "Não informada";
  const niche = lead.nicho?.trim() || "Não informado";
  const userServiceName =
    options.userServiceName?.trim() ||
    (lead.foco && lead.foco !== "zuno_internal_prospecting" ? lead.foco : "Gestão de Tráfego e Aquisição Local");

  const hasWebsite = Boolean(
    lead.website && lead.website.trim().length > 4 && !lead.website.includes("facebook.com")
  );
  const phoneInfo = sanitizeBrazilianPhoneNumber(lead.whatsapp_number || lead.telefone);
  const duplicateCheck = checkSdrDuplicateApproach(lead);

  const compatibility = calculateLeadCompatibilityScore(lead, {
    userServiceName,
    minScoreThreshold: options.minScoreThreshold ?? 70,
    targetCity: city,
    targetNiche: niche,
  });

  const serviceProfile = resolveServiceArgumentProfile(userServiceName, niche, city, hasWebsite);

  // =========================================================================
  // 1. O QUE SABEMOS (Estritamente Fatos Verificados)
  // =========================================================================
  const oQueSabemos: VerifiedLeadFact[] = [
    {
      label: "Empresa",
      value: companyName,
      sourceType: "cadastro_publico",
      verified: Boolean(lead.nome && lead.nome.trim().length > 1),
    },
    {
      label: "Cidade / Praça",
      value: city,
      sourceType: "cadastro_publico",
      verified: city.toLowerCase() !== "não informada",
    },
    {
      label: "Segmento / Nicho",
      value: niche,
      sourceType: "cadastro_publico",
      verified: niche.toLowerCase() !== "não informado",
    },
  ];

  if (hasWebsite && lead.website) {
    oQueSabemos.push({
      label: "Website verificado",
      value: lead.website.trim(),
      sourceType: "sinal_digital",
      verified: true,
    });
  } else {
    oQueSabemos.push({
      label: "Website próprio",
      value: "Não localizado nos registros públicos consultados",
      sourceType: "sinal_digital",
      verified: false,
    });
  }

  if (phoneInfo.isValid) {
    oQueSabemos.push({
      label: phoneInfo.isCellPhone ? "WhatsApp / Celular público" : "Telefone fixo comercial",
      value: phoneInfo.formattedDisplay,
      sourceType: "cadastro_publico",
      verified: true,
    });
  } else {
    oQueSabemos.push({
      label: "Telefone público",
      value: "Não identificado ou em formato incompleto",
      sourceType: "cadastro_publico",
      verified: false,
    });
  }

  if (typeof lead.total_reviews === "number" && lead.total_reviews > 0) {
    oQueSabemos.push({
      label: "Reputação pública no Google",
      value: `${lead.total_reviews} avaliações registradas${lead.rating ? ` (nota média ${lead.rating}★)` : ""}`,
      sourceType: "cadastro_publico",
      verified: true,
    });
  }

  const digitalSignalsList: string[] = [];
  if (lead.sinais?.has_whatsapp_on_site) digitalSignalsList.push("Link de WhatsApp no site");
  if (lead.sinais?.has_meta_pixel) digitalSignalsList.push("Meta Pixel detectado");
  if (lead.sinais?.has_gtag) digitalSignalsList.push("Google Tag detectada");
  if (lead.sinais?.has_gtm) digitalSignalsList.push("Google Tag Manager detectado");

  if (digitalSignalsList.length > 0) {
    oQueSabemos.push({
      label: "Sinais técnicos observados no site",
      value: digitalSignalsList.join(" • "),
      sourceType: "sinal_digital",
      verified: true,
    });
  }

  const currentStatus = lead.status || "novo";
  oQueSabemos.push({
    label: "Histórico registrado no Zuno",
    value: duplicateCheck.isDuplicate
      ? `Status '${currentStatus}' — ${duplicateCheck.reason}`
      : `Status '${currentStatus}' — Nenhuma abordagem anterior registrada`,
    sourceType: "historico_zuno",
    verified: true,
  });

  // =========================================================================
  // 2. POSSÍVEIS ÂNGULOS COMERCIAIS (Hipóteses e Perguntas para Investigar)
  // =========================================================================
  const possiveisAngulosComerciais: CommercialAngleHypothesis[] = [];

  if (serviceProfile.category === "clinicas" || serviceProfile.category === "gestao_trafego") {
    possiveisAngulosComerciais.push({
      id: "angulo-demanda-ativa",
      title: "Hipótese de Captação de Demanda Ativa em " + city,
      hypothesis: hasWebsite
        ? `Como a ${companyName} já possui site ativo em ${city}, vale investigar se o tráfego atual está direcionado para os procedimentos/serviços de maior margem ou apenas institucional.`
        : `Como a ${companyName} atua em ${niche} em ${city} e tem contato telefônico público, vale investigar como hoje captam clientes que pesquisam ativamente no Google da região.`,
      investigativeQuestion: `Hoje a maior parte dos novos clientes/pacientes da ${companyName} em ${city} chega por indicação ou por campanhas locais de busca e redes sociais?`,
      basisFact: hasWebsite ? "Site ativo e localização confirmada" : "Atuação local confirmada em " + city,
    });
  }

  if (serviceProfile.category === "criacao_sites") {
    possiveisAngulosComerciais.push({
      id: "angulo-conversao-web",
      title: hasWebsite
        ? "Hipótese de Clareza e Conversão Rápida na Página Atual"
        : "Hipótese de Autoridade Local com Página de Conversão Própria",
      hypothesis: hasWebsite
        ? `A empresa já conta com domínio ativo (${lead.website}). O ângulo consultivo é avaliar se o visitante mobile encontra o botão de WhatsApp e os diferenciais logo na primeira dobra.`
        : `Não localizamos site próprio no cadastro público. Vale perguntar se a empresa utiliza apenas redes sociais/indicação e se faz sentido ter uma página enxuta para buscas locais em ${city}.`,
      investigativeQuestion: hasWebsite
        ? `Vocês costumam medir quantos visitantes do site atual clicam para falar com o atendimento no WhatsApp?`
        : `Quando um cliente pesquisa por ${niche} em ${city} no Google, para qual página vocês costumam direcionar o atendimento hoje?`,
      basisFact: hasWebsite ? `Website verificado: ${lead.website}` : "Website próprio não localizado no cadastro público",
    });
  }

  if (serviceProfile.category === "social_media") {
    possiveisAngulosComerciais.push({
      id: "angulo-posicionamento-social",
      title: "Hipótese de Confiança Visual e Prova Social antes do Orçamento",
      hypothesis: `Empresas de ${niche} em ${city} costumam receber visitas no perfil de clientes comparando opções. Vale investigar se os destaques e conteúdos atuais explicam claramente como funciona o atendimento.`,
      investigativeQuestion: `Como vocês organizam hoje a rotina de conteúdos para responder às principais dúvidas dos clientes antes de eles chamarem no WhatsApp?`,
      basisFact: `Segmento ${niche} em ${city}`,
    });
  }

  // Ângulo complementar de triagem e conversão no WhatsApp (sempre relevante e verificável)
  possiveisAngulosComerciais.push({
    id: "angulo-atendimento-whatsapp",
    title: "Hipótese de Aproveitamento de Contatos na Recepção / Comercial",
    hypothesis:
      typeof lead.total_reviews === "number" && lead.total_reviews >= 10
        ? `A empresa possui ${lead.total_reviews} avaliações públicas no Google, indicando fluxo real de clientes. Vale investigar como estruturam o retorno comercial para novos interessados.`
        : `Vale entender com o responsável quem faz a triagem dos novos contatos comerciais no WhatsApp e qual é a meta de novos clientes para este mês em ${city}.`,
    investigativeQuestion: `Quem é a pessoa responsável por acompanhar os novos contatos pelo WhatsApp e avaliar parcerias comerciais aí na ${companyName}?`,
    basisFact:
      typeof lead.total_reviews === "number" && lead.total_reviews >= 10
        ? `${lead.total_reviews} avaliações públicas registradas`
        : "Canal de atendimento comercial mapeado",
  });

  // =========================================================================
  // 3. POR QUE VALE ANALISAR ESTA EMPRESA?
  // =========================================================================
  const recommendedEntryChannel: "whatsapp" | "email" | "instagram" | "pesquisa_adicional" =
    phoneInfo.isValid && phoneInfo.isCellPhone
      ? "whatsapp"
      : lead.email
      ? "email"
      : lead.instagram_url
      ? "instagram"
      : phoneInfo.isValid
      ? "whatsapp"
      : "pesquisa_adicional";

  const headline =
    compatibility.score >= 70
      ? `Oportunidade prioritária (${compatibility.score}/100): empresa com canais verificados e aderência direta à oferta de ${userServiceName} em ${city}.`
      : compatibility.score >= 40
      ? `Oportunidade de compatibilidade moderada (${compatibility.score}/100): dados básicos confirmados em ${city}, recomendando abordagem consultiva neutra.`
      : `Cadastro com dados limitados (${compatibility.score}/100): exige validação complementar de canais antes de investir tempo na sequência.`;

  const hasIncompleteData = !hasWebsite && !phoneInfo.isValid;

  return {
    leadId: lead.id || companyName,
    companyName,
    city,
    niche,
    userServiceName,
    serviceProfile,
    compatibility,
    oQueSabemos,
    possiveisAngulosComerciais,
    porQueValeAnalisar: {
      headline,
      reasons: compatibility.motivos,
      recommendedEntryChannel,
    },
    limitacoesAnalise: compatibility.dadosNaoVerificados,
    hasIncompleteData,
  };
}
