import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getFocusBehavior, replacePlaceholders } from "./focusBehavior.ts";

const globalCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_EMAILS = new Set([
  "jeferson.zanotell@gmail.com",
  "jefeson.zanotell@gmail.com",
]);
const ZUNO_INTERNAL_PROSPECTING_FOCUS = "zuno_internal_prospecting";
const ZUNO_COMMERCIAL_FOCUS_LABEL = "Oportunidade comercial";

function isZunoInternalProspectingFocus(foco?: string | null): boolean {
  return foco === ZUNO_INTERNAL_PROSPECTING_FOCUS;
}

function getSafeFocusLabel(foco?: string | null): string {
  if (!foco || isZunoInternalProspectingFocus(foco)) {
    return ZUNO_COMMERCIAL_FOCUS_LABEL;
  }
  return foco;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...globalCorsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function logAppEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
  params: {
    userId: string;
    eventType: string;
    eventData?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
) {
  try {
    await supabaseAdmin.rpc("log_app_event", {
      p_user_id: params.userId,
      p_event_type: params.eventType,
      p_event_data: params.eventData || {},
      p_ip_address: params.ipAddress || null,
      p_user_agent: params.userAgent || null,
    });
  } catch (eventError) {
    console.warn("[analisar-lead-ia] Falha ao registrar app_event", eventError);
  }
}

// =============================================================================
// RETRY COM EXPONENTIAL BACKOFF PARA RATE LIMITS (429)
// =============================================================================
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
  baseDelay = 800,
  onRetry?: () => void
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Se sucesso, retorna imediatamente
      if (response.ok) return response;

      // Se 429 (rate limit), aguarda e tenta novamente
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter
          ? parseInt(retryAfter) * 1000
          : baseDelay * Math.pow(2, attempt); // 2s, 4s, 8s

        console.log(`⏳ Rate limited (429). Aguardando ${delay / 1000}s... (tentativa ${attempt + 1}/${maxRetries})`);
        if (onRetry) onRetry();
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Outros erros (400, 500, etc.) - não faz retry, propaga o erro
      return response;
    } catch (error: any) {
      lastError = error;
      // Erros de rede também podem ter retry
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`⏳ Erro de rede. Aguardando ${delay / 1000}s... (tentativa ${attempt + 1}/${maxRetries})`);
        if (onRetry) onRetry();
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
    }
  }

  throw lastError || new Error(`Rate limit excedido após ${maxRetries} tentativas`);
}

interface LeadData {
  nome: string;
  nicho: string;
  cidade: string;
  website: string | null;
  foco: string;
  whatsapp_on_site: boolean;
  whatsapp_number?: string | null;
  email?: string | null;
  has_meta_pixel: boolean;
  has_gtag: boolean;
  has_gtm: boolean;
  instagram_url: string | null;
  instagram_context: string | null;
  canaisProspeccao?: ("email" | "whatsapp" | "instagram")[];
  cnpj?: string | null;
  razao_social?: string | null;
  nome_responsavel?: string | null;
  situacao_cadastral?: string | null;
  porte_empresa?: string | null;
  cnae_principal?: string | null;
  pais?: "BR" | "US";
  place_id?: string | null;
  rating?: number | null;
  reviews?: number | null;
  endereco?: string | null;
}

// Helper to check if lead is from USA
function isUSLead(lead: LeadData): boolean {
  return lead.pais === "US";
}

function isAdminUserHelper(userEmail?: string | null, usageInfo?: any): boolean {
  const email = (userEmail || "").trim().toLowerCase();
  return (
    email === "jeferson.zanotell@gmail.com" ||
    email === "jefeson.zanotell@gmail.com" ||
    usageInfo?.is_admin === true ||
    usageInfo?.role === "admin"
  );
}

function normalizeLeadForAI(lead: any, searchContext: any = {}): LeadData {
  if (!lead) return {} as LeadData;

  // 1. Nome da empresa
  const nome = lead.nome || lead.name || lead.business_name || lead.company_name || lead.title || lead.nome_empresa || lead.empresa || "";

  // 2. Telefone/Whatsapp
  const phone = lead.phone || lead.telefone || lead.formatted_phone_number || lead.international_phone_number || lead.whatsapp || lead.whatsapp_number || null;

  // 3. Site
  const website = lead.website || lead.site || lead.url || lead.website_url || null;

  // 4. Endereço
  const address = lead.address || lead.endereco || lead.formatted_address || lead.vicinity || null;

  // 5. Cidade
  const city = lead.city || lead.cidade || (lead.location && typeof lead.location === 'object' ? lead.location.city : null) || (lead.searchParams && typeof lead.searchParams === 'object' ? lead.searchParams.city : null) || (lead.filtros && typeof lead.filtros === 'object' ? lead.filtros.cidade : null) || searchContext.city || searchContext.cidade || null;

  // 6. Nicho/categoria
  let nicho = lead.nicho || lead.category || lead.categoria || lead.niche || lead.segmento || (lead.searchParams && typeof lead.searchParams === 'object' ? lead.searchParams.niche : null) || (lead.filtros && typeof lead.filtros === 'object' ? lead.filtros.nicho : null) || searchContext.niche || searchContext.nicho || null;
  if (!nicho && Array.isArray(lead.types) && lead.types.length > 0) {
    nicho = lead.types[0];
  }

  // 7. Avaliação
  const rating = lead.rating !== undefined ? lead.rating : (lead.avaliacao !== undefined ? lead.avaliacao : (lead.stars !== undefined ? lead.stars : null));

  // 8. Reviews
  const reviews = lead.reviews !== undefined ? lead.reviews : (lead.user_ratings_total !== undefined ? lead.user_ratings_total : (lead.review_count !== undefined ? lead.review_count : (lead.total_reviews !== undefined ? lead.total_reviews : null)));

  // 9. Instagram
  const instagram = lead.instagram || lead.instagram_url || null;

  // 10. Google place id
  const placeId = lead.place_id || lead.google_place_id || null;

  // Sinais de marketing
  const has_whatsapp_on_site = lead.whatsapp_on_site || lead.has_whatsapp_on_site || (lead.sinais && typeof lead.sinais === 'object' ? lead.sinais.has_whatsapp_on_site : false) || false;
  const has_meta_pixel = lead.has_meta_pixel || (lead.sinais && typeof lead.sinais === 'object' ? lead.sinais.has_meta_pixel : false) || false;
  const has_gtag = lead.has_gtag || (lead.sinais && typeof lead.sinais === 'object' ? lead.sinais.has_gtag : false) || false;
  const has_gtm = lead.has_gtm || (lead.sinais && typeof lead.sinais === 'object' ? lead.sinais.has_gtm : false) || false;

  return {
    nome: String(nome).trim(),
    nicho: nicho ? String(nicho).trim() : "Não informado",
    cidade: city ? String(city).trim() : "Não informada",
    website: website ? String(website).trim() : null,
    foco: getSafeFocusLabel(lead.foco || lead.focus || searchContext.focus || "Full Service"),
    whatsapp_on_site: !!has_whatsapp_on_site,
    whatsapp_number: phone ? String(phone).trim() : null,
    email: lead.email || null,
    has_meta_pixel: !!has_meta_pixel,
    has_gtag: !!has_gtag,
    has_gtm: !!has_gtm,
    instagram_url: instagram ? String(instagram).trim() : null,
    instagram_context: lead.instagram_context || null,
    canaisProspeccao: lead.canaisProspeccao || [],
    cnpj: lead.cnpj || null,
    razao_social: lead.razao_social || null,
    nome_responsavel: lead.nome_responsavel || null,
    situacao_cadastral: lead.situacao_cadastral || null,
    porte_empresa: lead.porte_empresa || null,
    cnae_principal: lead.cnae_principal || null,
    pais: lead.pais || lead.country || searchContext.country || searchContext.pais || "BR",
    place_id: placeId ? String(placeId).trim() : null,
    rating: rating ? Number(rating) : null,
    reviews: reviews ? Number(reviews) : null,
    endereco: address ? String(address).trim() : null,
  };
}

function getAvailableChannels(lead: LeadData, selectedChannels: ("email" | "whatsapp" | "instagram")[]): ("email" | "whatsapp" | "instagram")[] {
  const available: ("email" | "whatsapp" | "instagram")[] = [];
  
  if (selectedChannels.includes("whatsapp") && (lead.whatsapp_number || lead.whatsapp_on_site)) {
    available.push("whatsapp");
  }
  if (selectedChannels.includes("email") && lead.email) {
    available.push("email");
  }
  if (selectedChannels.includes("instagram") && lead.instagram_url) {
    available.push("instagram");
  }
  
  console.log(`📢 Canais selecionados: ${selectedChannels.join(", ")} | Detectados: ${available.length > 0 ? available.join(", ") : "NENHUM"}`);
  return available;
}

interface SiteSignals {
  whatsapp_on_site: boolean;
  whatsapp_number: string | null;
  has_meta_pixel: boolean;
  has_gtag: boolean;
  has_gtm: boolean;
  instagram_url: string | null;
  email: string | null;
  cnpj: string | null;
}

interface CNPJData {
  razao_social: string | null;
  nome_responsavel: string | null;
  telefone: string | null;
  email: string | null;
  situacao_cadastral: string | null;
  porte_empresa: string | null;
  cnae_principal: string | null;
}

async function fetchCNPJData(cnpj: string): Promise<CNPJData | null> {
  try {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return null;
    
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    let nomeResponsavel: string | null = null;
    if (data.qsa && data.qsa.length > 0) {
      const administrador = data.qsa.find((socio: any) => 
        socio.qualificacao_socio?.toLowerCase().includes('administrador') ||
        socio.qualificacao_socio?.toLowerCase().includes('diretor')
      );
      nomeResponsavel = (administrador || data.qsa[0]).nome_socio;
      if (nomeResponsavel) {
        nomeResponsavel = nomeResponsavel.toLowerCase().split(' ')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      }
    }
    
    return {
      razao_social: data.razao_social || null,
      nome_responsavel: nomeResponsavel,
      telefone: data.ddd_telefone_1 ? data.ddd_telefone_1.replace(/\D/g, '') : null,
      email: data.email ? data.email.toLowerCase() : null,
      situacao_cadastral: data.descricao_situacao_cadastral || null,
      porte_empresa: data.porte || null,
      cnae_principal: data.cnae_fiscal_descricao || null,
    };
  } catch {
    return null;
  }
}

interface AnaliseResult {
  diagnostico_bullets: string[];
  probabilidade_conversao: number;
  score?: number;
  fit_level?: "alto" | "medio" | "baixo";
  diagnostic?: string;
  pain_point?: string;
  approach_angle?: string;
  company_reading?: string;
  why_good_lead?: string;
  data_signals?: string[];
  commercial_opportunity?: string;
  probable_pain?: string;
  approach_gap?: string;
  commercial_angle?: string;
  best_angle?: string;
  recommended_offer?: {
    plan?: "free" | "starter" | "pro" | "agency";
    type?: string;
    reason?: string;
  };
  conversion_path?: string;
  conversion_strategy?: string;
  messages?: {
    whatsapp_primary?: string;
    whatsapp_alternative?: string;
    instagram?: string;
    email_subject?: string;
    email_body?: string;
    follow_up?: string;
  };
  warnings?: string[];
  whatsapp_message?: string;
  instagram_message?: string;
  email_subject?: string;
  email_body?: string;
  follow_up?: string;
  follow_up_message?: string;
  likely_objection?: string;
  objection_response?: string;
  cta?: string;
  variations?: {
    direct?: string;
    consultative?: string;
    light_provocation?: string;
  };
  plano_prospeccao_7dias: Array<{
    dia: number;
    canal: "whatsapp" | "email" | "instagram";
    acao_sugerida: string;
    mensagem: string;
    objecao_provavel: string;
    resposta_sugerida: string;
    cta: string;
    variations?: {
      direct?: string;
      consultative?: string;
      light_provocation?: string;
    };
  }>;
}

const FORBIDDEN_ZUNO_DISCLOSURE_TERMS = [
  "encontrei você usando a Zuno",
  "achei você pela Zuno",
  "a própria Zuno encontrou",
  "usando a própria Zuno",
  "se ela me ajudou a encontrar você",
  "se a Zuno me ajudou a encontrar você",
  "usei a Zuno para encontrar",
  "fui até você usando a Zuno",
  "fui até você usando a ferramenta",
];

function normalizeDisclosureText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function containsForbiddenZunoDisclosure(text?: string | null): boolean {
  if (!text) return false;
  const normalizedText = normalizeDisclosureText(text);
  return FORBIDDEN_ZUNO_DISCLOSURE_TERMS
    .map(normalizeDisclosureText)
    .some((term) => normalizedText.includes(term));
}

function analysisContainsForbiddenZunoDisclosure(analise: AnaliseResult): boolean {
  const texts = [
    ...(analise.diagnostico_bullets || []),
    analise.diagnostic,
    analise.pain_point,
    analise.approach_angle,
    analise.company_reading,
    analise.why_good_lead,
    ...(analise.data_signals || []),
    analise.commercial_opportunity,
    analise.probable_pain,
    analise.approach_gap,
    analise.commercial_angle,
    analise.best_angle,
    analise.recommended_offer?.plan,
    analise.recommended_offer?.type,
    analise.recommended_offer?.reason,
    analise.conversion_path,
    analise.conversion_strategy,
    analise.messages?.whatsapp_primary,
    analise.messages?.whatsapp_alternative,
    analise.messages?.instagram,
    analise.messages?.email_subject,
    analise.messages?.email_body,
    analise.messages?.follow_up,
    ...(analise.warnings || []),
    analise.whatsapp_message,
    analise.instagram_message,
    analise.email_subject,
    analise.email_body,
    analise.follow_up,
    analise.follow_up_message,
    analise.likely_objection,
    analise.objection_response,
    analise.cta,
    analise.variations?.direct,
    analise.variations?.consultative,
    analise.variations?.light_provocation,
    ...(analise.plano_prospeccao_7dias || []).flatMap((dia) => [
      dia.acao_sugerida,
      dia.mensagem,
      dia.objecao_provavel,
      dia.resposta_sugerida,
      dia.cta,
      dia.variations?.direct,
      dia.variations?.consultative,
      dia.variations?.light_provocation,
    ]),
  ];

  return texts.some(containsForbiddenZunoDisclosure);
}

function buildLeadDataSignals(lead?: LeadData): string[] {
  if (!lead) return [];

  const signals = [
    lead.nicho ? `Segmento analisado: ${lead.nicho}` : null,
    lead.cidade ? `Cidade: ${lead.cidade}` : null,
    lead.endereco ? `Endereco informado: ${lead.endereco}` : null,
    lead.website ? `Site informado: ${lead.website}` : "Nos dados disponiveis, nao ha site informado",
    lead.instagram_url ? `Instagram informado: ${lead.instagram_url}` : "Nos dados disponiveis, nao ha Instagram informado",
    lead.whatsapp_number || lead.whatsapp_on_site ? "Telefone/WhatsApp disponivel" : null,
    lead.email ? `Email disponivel: ${lead.email}` : null,
    lead.rating !== undefined && lead.rating !== null ? `Nota media no Google: ${lead.rating}` : null,
    lead.reviews !== undefined && lead.reviews !== null ? `Avaliacoes no Google: ${lead.reviews}` : null,
    lead.has_meta_pixel ? "Meta Pixel detectado no site" : null,
    lead.has_gtag ? "Google Analytics detectado no site" : null,
    lead.has_gtm ? "Google Tag Manager detectado no site" : null,
    lead.foco ? `Analise feita com foco em: ${getSafeFocusLabel(lead.foco)}` : null,
  ].filter((signal): signal is string => !!signal);

  return signals.slice(0, 10);
}

function isFilledLeadValue(value?: string | null): value is string {
  if (!value) return false;
  const normalized = normalizeDisclosureText(value);
  return normalized.length > 0 && !normalized.includes("nao informado") && !normalized.includes("nao informada");
}

function buildStrategicDiagnosisBullets(lead?: LeadData): string[] {
  const company = isFilledLeadValue(lead?.nome) ? lead!.nome : "A empresa";
  const niche = isFilledLeadValue(lead?.nicho) ? lead!.nicho : "seu segmento";
  const city = isFilledLeadValue(lead?.cidade) ? ` em ${lead!.cidade}` : "";
  const focus = isFilledLeadValue(lead?.foco) ? getSafeFocusLabel(lead!.foco) : "o foco selecionado";
  const normalizedFocus = normalizeDisclosureText(focus);
  const trackingTools = [
    lead?.has_meta_pixel ? "Meta Pixel" : null,
    lead?.has_gtag ? "Google Analytics" : null,
    lead?.has_gtm ? "Google Tag Manager" : null,
  ].filter(Boolean).join(", ");
  const hasTracking = trackingTools.length > 0;
  const hasSite = isFilledLeadValue(lead?.website);
  const hasInstagram = isFilledLeadValue(lead?.instagram_url);
  const hasContact = !!(lead?.whatsapp_number || lead?.whatsapp_on_site || lead?.telefone);
  const ratingText = typeof lead?.rating === "number"
    ? ` A nota ${lead.rating}${typeof lead?.reviews === "number" ? ` com ${lead.reviews} avaliacoes` : ""} ajuda a compor uma percepcao inicial de confianca.`
    : "";

  const presenceParts = [
    hasSite ? "site" : null,
    hasInstagram ? "Instagram" : null,
    hasContact ? "canal de contato" : null,
    hasTracking ? "rastreamento" : null,
  ].filter(Boolean);
  const presenceText = presenceParts.length
    ? `A combinacao de ${presenceParts.join(", ")} indica uma base digital para transformar interesse em conversa.`
    : "Nos dados disponiveis, a presenca digital aparece limitada, entao a leitura comercial precisa partir dos sinais publicos mais basicos.";

  const bullets = [
    `${company} apresenta sinais de atuacao em ${niche}${city}.${ratingText} ${presenceText}`,
  ];

  if (isZunoInternalProspectingFocus(lead?.foco)) {
    bullets.push(
      hasSite || hasInstagram || hasContact
        ? "Com foco em oportunidade comercial, a leitura principal e entender se essa presenca digital ja esta sendo bem aproveitada para abrir conversas ou se ainda existe espaco para transformar interesse em demanda mais previsivel."
        : "Com foco em oportunidade comercial, a leitura principal e validar se a empresa depende mais de indicacoes e esforco manual do que de uma rotina previsivel para gerar novas conversas."
    );
    bullets.push(
      hasTracking
        ? "Os sinais de mensuracao e canais ativos sugerem que ja existe alguma base para organizar melhor abordagem, priorizacao e acompanhamento do que chama atencao do mercado."
        : "Nos dados disponiveis, a oportunidade parece estar menos em ferramenta isolada e mais em ganhar clareza sobre onde estao as melhores oportunidades e como abordar com mais contexto."
    );
    bullets.push("A melhor abertura e uma observacao objetiva sobre a presenca comercial da empresa e uma pergunta simples sobre como novas conversas entram hoje, sem apresentar produto de forma apressada.");
    return bullets;
  }

  if (normalizedFocus.includes("servicos_profissionais") || normalizedFocus.includes("servicos profissionais")) {
    bullets.push(
      "Com foco em servicos profissionais, a leitura comercial deve priorizar a identificacao de quem sao os parceiros estrategicos ideais e redes de indicacao que atendem o mesmo publico complementar."
    );
    bullets.push(
      "A principal oportunidade esta em oferecer apoio tecnico especializado ou estabelecer conexao consultiva de utilidade mutua, ao inves de vender um servico de forma direta e agressiva."
    );
    bullets.push(
      "A abordagem comercial deve propor um bate-papo rapido de alinhamento profissional para mapear sinergias e entender se ha espaco para indicacoes de clientes, transmitindo credibilidade e confianca desde o inicio."
    );
    return bullets;
  }

  if (normalizedFocus.includes("trafego") || normalizedFocus.includes("traf")) {
    bullets.push(
      hasTracking
        ? `Com foco em trafego pago, a presenca de ${trackingTools} sugere que a empresa ja pode estar medindo acessos ou preparada para acompanhar campanhas com mais controle.`
        : "Com foco em trafego pago, nos dados disponiveis nao detectei Meta Pixel, Google Analytics ou GTM; isso torna importante validar se a mensuracao esta pronta antes de aumentar investimento em midia.",
    );
    bullets.push(
      hasSite || hasInstagram || hasContact
        ? "A principal oportunidade esta em entender se essa estrutura gera leads qualificados ou apenas visitas. Se o trafego ja roda, o ponto comercial e conversao; se ainda nao roda, existe uma base inicial para comecar com mais seguranca."
        : "A principal oportunidade esta em preparar a estrutura minima antes de campanhas: pagina clara, contato facil e medicao suficiente para saber de onde chegam as conversas.",
    );
    bullets.push("A conversa pode partir de uma pergunta simples sobre campanhas, pagina e WhatsApp, validando se os anuncios trazem contatos bons ou se existe perda entre visita e atendimento.");
    return bullets;
  }

  if (normalizedFocus.includes("design")) {
    bullets.push("Com foco em design, a leitura deve observar se a presenca digital transmite confianca rapidamente e se a marca parece preparada para disputar atencao com concorrentes mais organizados.");
    bullets.push("A oportunidade esta em conectar percepcao visual com resultado comercial: quando a identidade, o site ou o perfil social nao passam clareza, a empresa pode perder contatos antes mesmo da primeira conversa.");
    bullets.push("A conversa pode partir da percepcao que o cliente tem ao encontrar a empresa online e de como pequenos ajustes visuais podem aumentar confianca.");
    return bullets;
  }

  if (normalizedFocus.includes("social") || normalizedFocus.includes("instagram")) {
    bullets.push(
      hasInstagram
        ? "Com foco em social media, o Instagram informado vira um sinal importante de vitrine comercial: ele precisa deixar claro o que a empresa oferece, como entrar em contato e por que confiar."
        : "Com foco em social media, nos dados disponiveis nao ha Instagram informado; isso pode indicar uma oportunidade de fortalecer a vitrine social ou validar se o canal esta sendo usado de forma consistente.",
    );
    bullets.push("A oportunidade esta em transformar presenca social em conversa, evitando que o perfil seja apenas bonito, mas sem caminho claro para gerar contato.");
    bullets.push("A conversa pode partir da pergunta sobre como o Instagram participa hoje da captacao de clientes e se ele ajuda ou apenas acompanha a presenca da empresa.");
    return bullets;
  }

  if (normalizedFocus.includes("seo") || normalizedFocus.includes("site") || normalizedFocus.includes("landing")) {
    bullets.push(
      hasSite
        ? "Com foco em SEO, site ou landing page, a existencia de um site permite avaliar clareza, estrutura e capacidade de transformar visitantes em contatos."
        : "Com foco em SEO, site ou landing page, nos dados disponiveis nao ha site informado; isso limita a captacao por busca e reduz o controle sobre a conversao fora das redes sociais.",
    );
    bullets.push("A oportunidade esta em melhorar descoberta e conversao: aparecer melhor, explicar a oferta com clareza e facilitar o proximo passo do visitante.");
    bullets.push("A conversa pode partir de como a empresa recebe clientes hoje pela internet e se o site ou pagina realmente ajuda a gerar contatos.");
    return bullets;
  }

  if (normalizedFocus.includes("crm") || normalizedFocus.includes("automacao") || normalizedFocus.includes("gestao")) {
    bullets.push("Com foco em CRM, automacao ou gestao interna, os canais de contato indicam uma oportunidade de organizar melhor atendimento, retorno e acompanhamento das oportunidades.");
    bullets.push("A oportunidade esta menos em gerar mais volume e mais em evitar perda de contatos por falta de processo, velocidade de resposta ou historico comercial.");
    bullets.push("A conversa pode partir de como a empresa controla hoje os contatos recebidos e quantas oportunidades se perdem entre o primeiro interesse e o fechamento.");
    return bullets;
  }

  if (normalizedFocus.includes("full")) {
    bullets.push("Com foco em full service, a leitura combina presenca digital, canais de contato, rastreamento e clareza comercial para entender se a empresa precisa de uma melhoria mais completa.");
    bullets.push("A oportunidade esta em alinhar aquisicao, comunicacao e conversao, principalmente se cada canal existe, mas ainda nao trabalha como parte de uma mesma estrategia.");
    bullets.push("A conversa pode partir de quais canais ja trazem resultado e quais ainda parecem existir sem uma funcao comercial clara.");
    return bullets;
  }

  bullets.push(`Com foco em ${focus}, os sinais digitais devem ser lidos pelo impacto comercial: clareza da oferta, facilidade de contato e capacidade de transformar interesse em oportunidade.`);
  bullets.push("A oportunidade esta em identificar onde a empresa ja passa confianca e onde ainda pode estar perdendo conversas por falta de estrutura ou clareza.");
  bullets.push("A conversa pode partir de uma observacao objetiva sobre a presenca digital e de uma pergunta sobre como esse canal contribui para novos clientes hoje.");
  return bullets;
}

function normalizeCommercialDiagnosisForStorage(analise: AnaliseResult, lead?: LeadData): AnaliseResult {
  analise.data_signals = analise.data_signals?.length ? analise.data_signals : buildLeadDataSignals(lead);
  analise.diagnostico_bullets = buildStrategicDiagnosisBullets(lead);
  return analise;
}

function replaceLeadPlaceholders(text: string, lead: LeadData): string {
  return text
    .replace(/\$\{lead\.nome\}/g, lead.nome || "a empresa")
    .replace(/\$\{lead\.nicho\}/g, lead.nicho || "o segmento")
    .replace(/\$\{lead\.foco\}/g, getSafeFocusLabel(lead.foco) || "essa frente")
    .replace(/\$\{lead\.cidade\}/g, lead.cidade || "a cidade");
}

function softenWhatsappCopy(text: string, lead: LeadData): string {
  let result = replaceLeadPlaceholders(text, lead);

  result = result
    .replace(/zuno_internal_prospecting/gi, ZUNO_COMMERCIAL_FOCUS_LABEL)
    .replace(/framework simples de 3 passos/gi, "ponto simples")
    .replace(/quer que eu compartilhe\?/gi, "Quer que eu te mande esse ponto?")
    .replace(/sou especialista em .*? regularmente\./gi, "Peguei o contato pelos canais publicos da empresa e achei que valia te mandar uma observacao rapida.")
    .replace(/nao vim substituir ninguem\./gi, "Nao e para substituir ninguem.")
    .replace(/vale conhecer mesmo que seja so para comparar\?/gi, "Faz sentido comparar com o que voces ja fazem hoje?")
    .replace(/posso mostrar em 5 minutos\./gi, "Se fizer sentido, te mando isso de forma objetiva.")
    .replace(/proposta complementar/gi, "observacao complementar")
    .replace(/metodologia/gi, "forma de olhar")
    .replace(/quero te mostrar como funciona/gi, "posso te mandar um ponto pratico");

  return result.replace(/\s{2,}/g, " ").trim();
}

function sanitizeProspectingPlan(analise: AnaliseResult, lead: LeadData): AnaliseResult {
  if (!Array.isArray(analise.plano_prospeccao_7dias)) {
    return analise;
  }

  analise.plano_prospeccao_7dias = analise.plano_prospeccao_7dias.map((dia) => {
    const cleanMensagem = replaceLeadPlaceholders(dia.mensagem || "", lead);
    const cleanObjecao = replaceLeadPlaceholders(dia.objecao_provavel || "", lead);
    const cleanRespostaBase = replaceLeadPlaceholders(dia.resposta_sugerida || "", lead);
    const cleanCta = replaceLeadPlaceholders(dia.cta || "", lead);
    const cleanAcao = replaceLeadPlaceholders(dia.acao_sugerida || "", lead)
      .replace(/Enviar mensagem de TEXTO com framework/gi, "Enviar mensagem curta com um ponto objetivo")
      .replace(/Enviar ÁUDIO de 30-45 segundos se apresentando/gi, "Enviar texto curto primeiro; se responder, mandar audio")
      .trim();

    return {
      ...dia,
      acao_sugerida: dia.canal === "whatsapp" ? cleanAcao : cleanAcao,
      mensagem: dia.canal === "whatsapp" ? softenWhatsappCopy(cleanMensagem, lead) : cleanMensagem,
      objecao_provavel: dia.canal === "whatsapp" ? softenWhatsappCopy(cleanObjecao, lead) : cleanObjecao,
      resposta_sugerida: dia.canal === "whatsapp" ? softenWhatsappCopy(cleanRespostaBase, lead) : cleanRespostaBase,
      cta: dia.canal === "whatsapp" ? softenWhatsappCopy(cleanCta, lead) : cleanCta,
    };
  });

  return analise;
}

function normalizePremiumCopyForStorage(analise: AnaliseResult): AnaliseResult {
  if (!Array.isArray(analise.plano_prospeccao_7dias) || analise.plano_prospeccao_7dias.length === 0) {
    return analise;
  }

  const firstDay = analise.plano_prospeccao_7dias[0];
  const whatsappPrimary = analise.messages?.whatsapp_primary || analise.whatsapp_message;
  if (whatsappPrimary) firstDay.mensagem = whatsappPrimary;
  if (analise.likely_objection) firstDay.objecao_provavel = analise.likely_objection;
  if (analise.objection_response) firstDay.resposta_sugerida = analise.objection_response;
  if (analise.cta) firstDay.cta = analise.cta;
  delete firstDay.variations;

  const instagramDay = analise.plano_prospeccao_7dias.find((dia) => dia.canal === "instagram");
  const instagramMessage = analise.messages?.instagram || analise.instagram_message;
  if (instagramDay && instagramMessage) {
    instagramDay.mensagem = instagramMessage;
  }

  const emailDay = analise.plano_prospeccao_7dias.find((dia) => dia.canal === "email");
  const emailSubject = analise.messages?.email_subject || analise.email_subject;
  const emailBody = analise.messages?.email_body || analise.email_body;
  if (emailDay && (emailSubject || emailBody)) {
    emailDay.mensagem = [emailSubject ? `Assunto: ${emailSubject}` : "", emailBody || ""]
      .filter(Boolean)
      .join("\n\n");
  }

  const followUpDay = analise.plano_prospeccao_7dias.find((dia) => dia.dia > 1);
  const followUpMessage = analise.messages?.follow_up || analise.follow_up_message || analise.follow_up;
  if (followUpDay && followUpMessage) {
    followUpDay.mensagem = followUpMessage;
  }

  analise.plano_prospeccao_7dias = analise.plano_prospeccao_7dias.map((dia) => {
    const { variations, ...cleanDay } = dia;
    return cleanDay;
  });
  delete analise.variations;

  return analise;
}

const GENERIC_ANALYSIS_TERMS = [
  "pode se beneficiar",
  "tem potencial",
  "a mensagem deve ser consultiva",
  "evitar promessas",
  "gerar valor",
];

function hasGreeting(message: string): boolean {
  const normalized = normalizeDisclosureText(message.trim());
  return /^(ola|oi|tudo bem|bom dia|boa tarde|boa noite)/.test(normalized);
}

function hasContext(message: string, lead: LeadData): boolean {
  const normalized = normalizeDisclosureText(message);
  return [lead.nome, lead.nicho, lead.cidade, getSafeFocusLabel(lead.foco)]
    .filter(Boolean)
    .some((value) => normalizeDisclosureText(String(value)).split(" ")[0] && normalized.includes(normalizeDisclosureText(String(value)).split(" ")[0]));
}

function hasSimpleCta(message: string): boolean {
  const normalized = normalizeDisclosureText(message);
  return normalized.includes("?") || normalized.includes("faz sentido") || normalized.includes("posso") || normalized.includes("quer");
}

function buildFallbackWhatsappMessage(lead: LeadData): string {
  const company = lead.nome && lead.nome !== "NÃ£o informado" ? lead.nome : "tudo bem";
  const niche = lead.nicho && lead.nicho !== "NÃ£o informado" ? lead.nicho : "seu segmento";
  const city = lead.cidade && lead.cidade !== "NÃ£o informada" ? ` em ${lead.cidade}` : "";

  if (isZunoInternalProspectingFocus(lead.foco)) {
    return `Ola, ${company}, tudo bem?\n\nVi que voces atuam com ${niche}${city} e fiquei com uma duvida rapida.\n\nHoje voces ja tem um processo previsivel para gerar novas conversas comerciais ou isso ainda depende mais de indicacao e tentativa manual?\n\nPosso te mandar uma observacao objetiva do que eu olharia primeiro?`;
  }

  if (String(lead.foco || "").toLowerCase().includes("tr")) {
    return `Ola, ${company}, tudo bem?\n\nAnalisei alguns sinais digitais de voces em ${niche}${city} e vi pontos importantes para quem recebe trafego pago.\n\nQueria entender uma coisa: hoje voces ja estao rodando campanhas ou ainda estao ajustando site, Instagram e WhatsApp para transformar visitas em conversas?\n\nPosso te mandar uma sugestao rapida do que eu olharia primeiro?`;
  }

  return `Ola, ${company}, tudo bem?\n\nVi que voces atuam com ${niche}${city} e queria te fazer uma pergunta rapida: hoje voces ja tem algum processo ativo para atrair novos clientes de forma previsivel?\n\nTrabalho com uma solucao que ajuda a identificar oportunidades e criar abordagens mais direcionadas para iniciar conversas comerciais.\n\nFaz sentido eu te mostrar uma ideia rapida?`;
}

function buildFallbackProspectingPlan(lead: LeadData): AnaliseResult["plano_prospeccao_7dias"] {
  const behavior = getFocusBehavior(lead.foco);
  const likelyObjection = behavior.likely_objections[0] || "Não tenho interesse";
  const objectionResponse = behavior.objection_responses[0] || "Entendo perfeitamente. Fico à disposição se mudar de ideia.";
  const cta = behavior.cta_examples[0] || "Posso te mandar mais detalhes?";

  const canaisSelecionados = lead.canaisProspeccao?.length ? lead.canaisProspeccao : ["email", "whatsapp", "instagram"] as const;
  const canaisDisponiveis = getAvailableChannels(lead, [...canaisSelecionados]);
  const canalTexto = canaisDisponiveis.length > 0 ? canaisDisponiveis : ["whatsapp", "instagram", "email"];

  const days: AnaliseResult["plano_prospeccao_7dias"] = [];
  const daysKeys = ["day_1", "day_2", "day_3", "day_4", "day_5", "day_6", "day_7"] as const;

  for (let i = 0; i < 7; i++) {
    const dayKey = daysKeys[i];
    const rawMsg = behavior.fallback_messages[dayKey] || "";
    const msg = replacePlaceholders(rawMsg, lead);

    // Determinar canal para o dia
    let canal: "whatsapp" | "email" | "instagram" = "whatsapp";
    if (canalTexto.includes("whatsapp") && i % 2 === 0) {
      canal = "whatsapp";
    } else if (canalTexto.includes("instagram") && i % 3 === 1) {
      canal = "instagram";
    } else if (canalTexto.includes("email")) {
      canal = "email";
    } else {
      canal = canalTexto[i % canalTexto.length] as "whatsapp" | "email" | "instagram";
    }

    const objIndex = i % behavior.likely_objections.length;
    const dayObjection = behavior.likely_objections[objIndex] || likelyObjection;
    const dayResponse = behavior.objection_responses[objIndex] || objectionResponse;
    const dayCta = behavior.cta_examples[i % behavior.cta_examples.length] || cta;

    days.push({
      dia: i + 1,
      canal,
      acao_sugerida: replacePlaceholders(behavior.cadence_strategy[dayKey] || "Contato de prospecção", lead),
      mensagem: msg,
      objecao_provavel: dayObjection,
      resposta_sugerida: dayResponse,
      cta: dayCta,
    });
  }

  return days;
}

function applyQualityFallbackIfNeeded(
  analise: AnaliseResult,
  lead: LeadData,
  logPrefix = "[analisar-lead-ia]"
): { analise: AnaliseResult; fallbackUsed: boolean; missingFields: string[] } {
  const behavior = getFocusBehavior(lead.foco);
  const missingFields: string[] = [];

  if (!Array.isArray(analise.plano_prospeccao_7dias) || analise.plano_prospeccao_7dias.length === 0) {
    console.warn(`${logPrefix} Fallback ativado: plano_prospeccao_7dias ausente ou vazio.`);
    analise.plano_prospeccao_7dias = buildFallbackProspectingPlan(lead);
    return { analise, fallbackUsed: true, missingFields: ["plano_prospeccao_7dias"] };
  }

  const message = analise.plano_prospeccao_7dias[0]?.mensagem || "";
  const diagnosisText = (analise.diagnostico_bullets || []).join(" ");
  const hasIncompletePlan =
    analise.plano_prospeccao_7dias.length < 7 ||
    analise.plano_prospeccao_7dias.some(
      (dia) => !dia.acao_sugerida || !dia.mensagem || !dia.objecao_provavel || !dia.resposta_sugerida || !dia.cta
    );
  const hasGenericDiagnosis = GENERIC_ANALYSIS_TERMS.some((term) =>
    normalizeDisclosureText(diagnosisText).includes(normalizeDisclosureText(term))
  );
  const containsAvoidTerms = analise.plano_prospeccao_7dias.some((dia) => {
    const normalizedMessage = normalizeDisclosureText(dia.mensagem || "");
    return behavior.avoid_terms.some((term) =>
      normalizedMessage.includes(normalizeDisclosureText(term))
    );
  });
  const exaggeratedPromises = [
    "resultado garantido",
    "dobrar faturamento",
    "faturar o dobro",
    "fique rico",
    "garanto vendas",
    "garantimos vendas",
  ];
  const containsExaggeratedPromise = analise.plano_prospeccao_7dias.some((dia) => {
    const normalizedMessage = normalizeDisclosureText(dia.mensagem || "");
    return exaggeratedPromises.some((term) => normalizedMessage.includes(term));
  });
  const hasDisclosure =
    containsForbiddenZunoDisclosure(message) ||
    analysisContainsForbiddenZunoDisclosure(analise);

  if (hasIncompletePlan) missingFields.push("plano_incompleto");
  if (!hasGreeting(message)) missingFields.push("primeira_mensagem_sem_saudacao");
  if (!hasSimpleCta(message)) missingFields.push("primeira_mensagem_sem_cta_leve");
  if (!hasContext(message, lead) && hasGenericDiagnosis) {
    missingFields.push("primeira_mensagem_sem_contexto");
  }
  if (hasDisclosure) missingFields.push("zuno_disclosure_proibido");
  if (containsAvoidTerms) missingFields.push("termos_proibidos_do_foco");
  if (containsExaggeratedPromise) missingFields.push("promessa_exagerada");

  if (missingFields.length === 0) {
    analise.plano_prospeccao_7dias = analise.plano_prospeccao_7dias.map((dia) => {
      const { variations, ...cleanDay } = dia;
      return cleanDay;
    });
    console.log(`${logPrefix} Sucesso: análise validada com copies geradas pelo Gemini.`);
    return { analise, fallbackUsed: false, missingFields };
  }

  console.warn(
    `${logPrefix} Validação de qualidade falhou para ${lead.nome} (foco: ${lead.foco}): ${missingFields.join(", ")}.`
  );
  analise.plano_prospeccao_7dias = buildFallbackProspectingPlan(lead);

  if (!analise.data_signals?.length) {
    analise.data_signals = buildLeadDataSignals(lead);
  }
  if (!analise.company_reading) {
    analise.company_reading = `${lead.nome} parece atuar em ${lead.nicho}${lead.cidade ? ` em ${lead.cidade}` : ""}. A leitura deve considerar ${behavior.diagnosis_lens}.`;
  }
  if (!analise.commercial_opportunity && !analise.why_good_lead) {
    analise.commercial_opportunity = `Os sinais digitais indicam oportunidade para ${behavior.commercial_goal}`;
  }
  if (!analise.probable_pain && !analise.pain_point) {
    analise.probable_pain = behavior.likely_pains[0] || "Dificuldade de estruturar um processo comercial previsível.";
  }
  if (!analise.approach_gap) {
    analise.approach_gap = `Conectar a dor de ${behavior.likely_pains[0] || "captar clientes"} ao ângulo de ${behavior.approach_angles[0] || "processo comercial"}.`;
  }
  if (!analise.best_angle && !analise.commercial_angle) {
    analise.best_angle = behavior.approach_angles[0] || "abordagem comercial consultiva";
  }
  if (!analise.likely_objection) {
    analise.likely_objection = behavior.likely_objections[0] || "Não tenho interesse agora.";
  }
  if (!analise.objection_response) {
    analise.objection_response = behavior.objection_responses[0] || "Sem problemas. Fico à disposição.";
  }
  if (!analise.conversion_strategy && !analise.conversion_path) {
    analise.conversion_strategy = `Abordagem focada em ${behavior.commercial_goal}`;
  }

  return { analise, fallbackUsed: true, missingFields };
}

async function scrapeSiteForSignals(websiteUrl: string): Promise<SiteSignals> {
  const signals: SiteSignals = {
    whatsapp_on_site: false,
    whatsapp_number: null,
    has_meta_pixel: false,
    has_gtag: false,
    has_gtm: false,
    instagram_url: null,
    email: null,
    cnpj: null,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const siteResponse = await fetch(websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!siteResponse.ok) return signals;

    const html = await siteResponse.text();
    
    // =============================================
    // DETECÇÃO APRIMORADA DE WHATSAPP/TELEFONE
    // =============================================
    
    // 1. Padrões de links WhatsApp
    const whatsappLinkPatterns = [
      /wa\.me\/(\+?[0-9]+)/gi,
      /api\.whatsapp\.com\/send\/?\?phone=(\+?[0-9]+)/gi,
      /web\.whatsapp\.com\/send\/?\?phone=(\+?[0-9]+)/gi,
      /whatsapp:\/\/send\/?\?phone=(\+?[0-9]+)/gi,
      /phone=(\+?[0-9]+)/gi,
    ];
    
    for (const pattern of whatsappLinkPatterns) {
      const matches = [...html.matchAll(pattern)];
      for (const match of matches) {
        if (match[1]) {
          const cleanNumber = match[1].replace(/\D/g, '');
          if (cleanNumber.length >= 10) {
            signals.whatsapp_on_site = true;
            signals.whatsapp_number = cleanNumber;
            break;
          }
        }
      }
      if (signals.whatsapp_on_site) break;
    }

    // 2. Links tel: com números de celular
    if (!signals.whatsapp_number) {
      const telPattern = /href\s*=\s*["']tel:(\+?55)?(\d{10,11})["']/gi;
      const telMatches = [...html.matchAll(telPattern)];
      for (const match of telMatches) {
        const number = (match[1] || '') + match[2];
        const cleanNumber = number.replace(/\D/g, '');
        if (cleanNumber.length >= 10 && /9\d{8}$/.test(cleanNumber)) {
          signals.whatsapp_number = cleanNumber;
          signals.whatsapp_on_site = true;
          break;
        }
      }
    }

    // 3. Números próximos a palavras-chave de WhatsApp
    if (!signals.whatsapp_number) {
      const contextPatterns = [
        /(?:whatsapp|wpp|whats|zap|fale\s*conosco|atendimento)[^0-9]{0,80}(?:\+?55\s*)?(?:\(?0?([1-9][0-9])\)?\s*)?([9]?\d{4}[-.\s]?\d{4})/gi,
        /(?:\+?55\s*)?(?:\(?0?([1-9][0-9])\)?\s*)?([9]\d{4}[-.\s]?\d{4})[^0-9]{0,30}(?:whatsapp|wpp|whats|zap)/gi,
      ];
      
      for (const pattern of contextPatterns) {
        const matches = [...html.matchAll(pattern)];
        for (const match of matches) {
          const ddd = match[1] || '';
          const number = match[2] || '';
          const fullNumber = (ddd + number).replace(/\D/g, '');
          if (fullNumber.length >= 8 && /9\d{7,8}$/.test(fullNumber)) {
            signals.whatsapp_number = fullNumber.length <= 9 ? '11' + fullNumber : fullNumber;
            signals.whatsapp_on_site = true;
            break;
          }
        }
        if (signals.whatsapp_number) break;
      }
    }

    // 4. Números de celular brasileiros no HTML
    if (!signals.whatsapp_number) {
      const phonePatterns = [
        /\+?55\s*\(?([1-9][0-9])\)?\s*(9\d{4})[-.\s]?(\d{4})/g,
        /\(?([1-9][0-9])\)?\s*(9\d{4})[-.\s]?(\d{4})/g,
      ];
      
      for (const pattern of phonePatterns) {
        const matches = [...html.matchAll(pattern)];
        for (const match of matches) {
          const ddd = match[1];
          const part1 = match[2];
          const part2 = match[3];
          const fullNumber = `${ddd}${part1}${part2}`.replace(/\D/g, '');
          if (fullNumber.length >= 10 && fullNumber.length <= 11) {
            signals.whatsapp_number = fullNumber;
            signals.whatsapp_on_site = true;
            break;
          }
        }
        if (signals.whatsapp_number) break;
      }
    }

    // 5. Detecta WhatsApp mesmo sem número
    if (!signals.whatsapp_on_site && /whatsapp|wa\.me|api\.whatsapp/i.test(html)) {
      signals.whatsapp_on_site = true;
    }

    // Instagram detection
    const instagramMatch = html.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
    if (instagramMatch && !['p', 'reel', 'stories', 'explore'].includes(instagramMatch[1].toLowerCase())) {
      signals.instagram_url = `https://instagram.com/${instagramMatch[1]}`;
    }

    // Marketing tools
    if (/fbq\s*\(|facebook\.com\/tr\?id=/i.test(html)) signals.has_meta_pixel = true;
    if (/gtag\s*\(|googletagmanager\.com\/gtag/i.test(html)) signals.has_gtag = true;
    if (/GTM-[A-Z0-9]+/i.test(html)) signals.has_gtm = true;

    // =============================================
    // DETECÇÃO APRIMORADA DE EMAIL
    // =============================================
    
    // Lista de emails genéricos para ignorar
    const excludeEmailPatterns = /\b(wix|google|facebook|instagram|example|test|noreply|suporte@wix|no-reply|support@|admin@|info@wix|webmaster@|hostmaster@)\b/i;
    
    // 1. Links mailto (mais confiável)
    const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (mailtoMatch && !excludeEmailPatterns.test(mailtoMatch[1])) {
      signals.email = mailtoMatch[1].toLowerCase();
      console.log(`📧 Email encontrado via mailto: ${signals.email}`);
    }

    // 2. Emails em texto (regex geral)
    if (!signals.email) {
      const emailPattern = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com\.br|com|net|org|br|io|me|info|co|gov\.br))\b/gi;
      const emailMatches = html.match(emailPattern);
      
      if (emailMatches) {
        // Pega o primeiro email que não seja genérico
        const validEmail = emailMatches.find(e => !excludeEmailPatterns.test(e));
        if (validEmail) {
          signals.email = validEmail.toLowerCase();
          console.log(`📧 Email encontrado via regex: ${signals.email}`);
        }
      }
    }

    // 3. Emails próximos a palavras-chave de contato
    if (!signals.email) {
      const contextPattern = /(?:email|e-mail|contato|contact|fale\s*conosco)[^a-z@]{0,50}([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
      const contextMatches = [...html.matchAll(contextPattern)];
      for (const match of contextMatches) {
        if (match[1] && !excludeEmailPatterns.test(match[1])) {
          signals.email = match[1].toLowerCase();
          console.log(`📧 Email encontrado via contexto: ${signals.email}`);
          break;
        }
      }
    }

    // CNPJ detection
    const cnpjMatch = html.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    if (cnpjMatch) signals.cnpj = cnpjMatch[0].replace(/\D/g, '');

  } catch (error: any) {
    console.log(`⚠️ Erro ao escanear site: ${error.message}`);
  }

  return signals;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: globalCorsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({
      error: "Método não permitido",
      details: "Use POST para analisar leads.",
    }, 405);
  }

  const startTime = Date.now();
  let supabaseAdminForCatch: ReturnType<typeof createClient> | null = null;
  let userIdForCatch: string | null = null;
  let leadIdForCatch: string | null = null;
  let leadNameForCatch: string | null = null;
  let aiRemainingForCatch: number | null = null;
  let aiLimitForCatch: number | null = null;
  let aiUsedForCatch: number | null = null;
  let sourceForCatch = "app";
  let pathForCatch = "prospeccao";
  let retryCountForCatch = 0;
  let leadData: LeadData | null = null;
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();

  try {
    // ============= AUTHENTICATION VALIDATION =============
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("❌ Requisição sem Authorization header");
      return jsonResponse({
        error: "Usuario nao autenticado",
        details: "Authorization header ausente",
      }, 401);
    }

    // Create authenticated Supabase client to validate user
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    console.log("analisar-lead-ia auth:", {
      hasAuthHeader: !!authHeader,
      userId: user?.id ?? null,
      email: user?.email ?? null,
    });
    if (authError || !user) {
      console.error("❌ Token inválido ou usuário não autenticado:", authError?.message);
      return jsonResponse({
        error: "Usuario nao autenticado",
        details: authError?.message || "Token invalido",
      }, 401);
    }

    // Use authenticated user.id instead of request body
    const authenticatedUserId = user.id;
    console.log("✅ Usuário autenticado:", authenticatedUserId);
    // ============= END AUTHENTICATION =============

    const requestData = await req.json().catch(() => null);
    if (!requestData || typeof requestData !== "object") {
      return jsonResponse({
        error: "Payload invalido",
        details: "Envie um JSON com leadId/lead_id ou com o objeto lead.",
      }, 400);
    }

    const payloadLead = requestData.lead && typeof requestData.lead === "object"
      ? requestData.lead
      : requestData;
    const context = requestData.context && typeof requestData.context === "object"
      ? requestData.context
      : {};
    const leadId = requestData.leadId || requestData.lead_id || payloadLead.id;
    leadIdForCatch = leadId || null;
    // Use authenticated user ID, ignore any user_id from request body for security
    const userId = authenticatedUserId;

    sourceForCatch = requestData.source || payloadLead.source || context.source || "app";
    pathForCatch = requestData.path || payloadLead.path || context.path || "prospeccao";
    
    console.log("[AI Lead Payload]", payloadLead);

    console.log("🔍 Iniciando análise:", {
      leadId,
      userId,
      hasNome: !!(payloadLead.nome || payloadLead.name || payloadLead.business_name || payloadLead.company_name || payloadLead.title),
    });

    let GOOGLE_GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("Gemini_API");
    if (GOOGLE_GEMINI_API_KEY) {
      GOOGLE_GEMINI_API_KEY = GOOGLE_GEMINI_API_KEY.trim().replace(/^["']|["']$/g, "");
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      : null;
    supabaseAdminForCatch = supabaseAdmin;

    if (!supabaseAdmin) {
      throw new Error("Configuração Supabase incompleta");
    }

    userIdForCatch = userId;

    await logAppEvent(supabaseAdmin, {
      userId,
      eventType: "ai_analysis_started",
      eventData: { leadId },
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });

    const { data: usageData, error: usageError } = await supabaseAuth.rpc("get_current_user_usage");

    if (usageError) {
      console.error("❌ Erro ao validar uso de IA:", usageError.message);
      throw new Error("Erro ao validar limite de análises com IA.");
    }

    const usageInfo = usageData?.[0];
    const aiRemaining = Number(usageInfo?.ai_available_total ?? usageInfo?.ai_remaining ?? 0);
    aiRemainingForCatch = aiRemaining;
    aiLimitForCatch = Number(usageInfo?.ai_limit ?? 3);
    aiUsedForCatch = Number(usageInfo?.ai_used_this_month ?? 0);
    const isAdminUser = isAdminUserHelper(user.email, usageInfo);
    const isUnlimited = isAdminUser || Number(usageInfo?.ai_limit ?? 0) >= 999999;

    if (!isUnlimited && aiRemaining <= 0) {
      console.log(`🚫 Bloqueio de Limite de IA preventivo para o usuário ${user.email} (ai_remaining: ${aiRemaining})`);
      return jsonResponse({
        success: false,
        blocked: true,
        error_code: "AI_CREDITS_EXHAUSTED",
        error_message: "Você não tem análises IA disponíveis.",
        error: "Limite de IA atingido",
        details: "Você atingiu seu limite de análises com IA.",
      }, 402);
    }

    if (!GOOGLE_GEMINI_API_KEY) {
      return jsonResponse({
        error: "GEMINI_API_KEY nao configurada",
        details: "Cadastre o secret GEMINI_API_KEY no projeto Supabase.",
      }, 500);
    }

    const searchContext = requestData.search_context || context || {};
    
    if (leadId) {
      console.log("📥 Buscando lead via RPC...");
      
      // Passa user_id para RPC funcionar com service role (auth.uid() não funciona)
      const { data: decryptedLeads, error: rpcError } = await supabaseAdmin
        .rpc("get_lead_decrypted_by_id", { p_lead_id: leadId, p_user_id: userId });
        
      if (rpcError || !decryptedLeads?.length) {
        console.error("❌ Erro RPC:", rpcError?.message || "Lead não encontrado");
        throw new Error("Lead não encontrado");
      }
      
      const lead = decryptedLeads[0];
      leadNameForCatch = lead.nome;
      
      const rawLead = {
        ...lead,
        canaisProspeccao: requestData.canaisProspeccao || lead.canaisProspeccao
      };
      
      // Re-scrape website for fresh signals
      if (lead.website) {
        const newSignals = await scrapeSiteForSignals(lead.website);
        rawLead.whatsapp_on_site = newSignals.whatsapp_on_site || rawLead.whatsapp_on_site;
        rawLead.whatsapp_number = newSignals.whatsapp_number || rawLead.whatsapp_number;
        rawLead.email = newSignals.email || rawLead.email;
        rawLead.instagram_url = newSignals.instagram_url || rawLead.instagram_url;
        rawLead.has_meta_pixel = newSignals.has_meta_pixel || rawLead.has_meta_pixel;
        rawLead.has_gtag = newSignals.has_gtag || rawLead.has_gtag;
        rawLead.has_gtm = newSignals.has_gtm || rawLead.has_gtm;
        
        if (newSignals.cnpj && !rawLead.nome_responsavel) {
          const cnpjData = await fetchCNPJData(newSignals.cnpj);
          if (cnpjData) {
            Object.assign(rawLead, {
              cnpj: newSignals.cnpj,
              razao_social: cnpjData.razao_social,
              nome_responsavel: cnpjData.nome_responsavel,
              situacao_cadastral: cnpjData.situacao_cadastral,
              porte_empresa: cnpjData.porte_empresa,
              cnae_principal: cnpjData.cnae_principal,
            });
            if (!rawLead.email && cnpjData.email) rawLead.email = cnpjData.email;
          }
        }
        
        // Update signals in DB
        await supabaseAdmin.from("leads").update({
          whatsapp_on_site: rawLead.whatsapp_on_site,
          has_meta_pixel: rawLead.has_meta_pixel,
          has_gtag: rawLead.has_gtag,
          has_gtm: rawLead.has_gtm,
          ...(rawLead.cnpj && { 
            cnpj: rawLead.cnpj,
            razao_social: rawLead.razao_social,
            nome_responsavel: rawLead.nome_responsavel,
            situacao_cadastral: rawLead.situacao_cadastral,
            porte_empresa: rawLead.porte_empresa,
            cnae_principal: rawLead.cnae_principal,
          }),
        }).eq("id", leadId);
      }

      leadData = normalizeLeadForAI(rawLead, searchContext);
      console.log(`🌍 Lead country: ${leadData.pais} | isUS: ${isUSLead(leadData)}`);
    } else {
      // Se não vier leadId, normalizar diretamente do payload
      leadData = normalizeLeadForAI(payloadLead, searchContext);
      console.log(`🌍 Lead country (from request): ${leadData.pais} | isUS: ${isUSLead(leadData)}`);
    }

    leadNameForCatch = leadData.nome;

    if (isZunoInternalProspectingFocus(leadData.foco) && !isAdminUser) {
      await logAppEvent(supabaseAdmin, {
        userId,
        eventType: "admin_only_focus_blocked",
        eventData: {
          attempted_focus: ZUNO_INTERNAL_PROSPECTING_FOCUS,
          user_id: userId,
          user_email: user.email || null,
        },
        ipAddress: req.headers.get("x-forwarded-for"),
        userAgent: req.headers.get("user-agent"),
      });
      return jsonResponse({
        success: false,
        error_code: "ADMIN_ONLY_FOCUS",
        error_message: "Este foco está disponível apenas para administradores.",
      }, 403);
    }

    // Validação de dados mínimos do lead (INVALID_LEAD_PAYLOAD)
    const hasNome = !!leadData.nome && leadData.nome.trim() !== "" && leadData.nome.toLowerCase() !== "não informado" && leadData.nome.toLowerCase() !== "nao informado";
    
    const has_name = hasNome;
    const has_category = !!leadData.nicho && leadData.nicho.trim() !== "" && leadData.nicho.toLowerCase() !== "não informado" && leadData.nicho.toLowerCase() !== "nao informado";
    const has_city = !!leadData.cidade && leadData.cidade.trim() !== "" && leadData.cidade.toLowerCase() !== "não informada" && leadData.cidade.toLowerCase() !== "nao informada" && leadData.cidade.toLowerCase() !== "não informado" && leadData.cidade.toLowerCase() !== "nao informado";
    const has_address = !!leadData.endereco && leadData.endereco.trim() !== "";
    const has_phone = !!leadData.whatsapp_number && leadData.whatsapp_number.trim() !== "";
    const has_website = !!leadData.website && leadData.website.trim() !== "";
    const has_rating = leadData.rating !== undefined && leadData.rating !== null;
    const has_reviews = leadData.reviews !== undefined && leadData.reviews !== null;
    const has_instagram = !!leadData.instagram_url && leadData.instagram_url.trim() !== "";
    const has_place_id = !!leadData.place_id && leadData.place_id.trim() !== "";

    const hasContext = has_city || has_address || has_category || has_website || has_phone || has_rating || has_reviews || has_instagram || has_place_id;

    if (!has_name || !hasContext) {
      console.warn("🚫 Lead sem dados suficientes para análise:", { 
        leadId, 
        nome: leadData.nome, 
        nicho: leadData.nicho, 
        cidade: leadData.cidade, 
        hasContext 
      });
      const payloadError = new Error("Não conseguimos analisar este lead porque ele veio sem nome da empresa ou contexto suficiente. Tente outro lead ou refaça a busca com cidade e nicho.");
      (payloadError as any).code = "INVALID_LEAD_PAYLOAD";
      throw payloadError;
    }

    // Canais selecionados para a análise
    const canaisSelecionados = leadData.canaisProspeccao?.length ? leadData.canaisProspeccao : ["email", "whatsapp", "instagram"] as const;
    const canaisDisponiveis = getAvailableChannels(leadData, [...canaisSelecionados]);

    // Injetar dados da campanha (ou inferir inteligentemente baseado no foco se ausentes)
    const inputOferta = requestData.oferta_usuario || payloadLead.oferta_usuario || context.oferta_usuario || null;
    const inputPublico = requestData.publico_alvo || payloadLead.publico_alvo || context.publico_alvo || null;
    const inputDor = requestData.dor_principal || payloadLead.dor_principal || context.dor_principal || null;
    const inputObjetivo = requestData.objetivo || payloadLead.objetivo || context.objetivo || null;
    const inputCanal = requestData.canal || payloadLead.canal || context.canal || null;
    const inputEtapa = requestData.etapa || payloadLead.etapa || context.etapa || null;

    const foco = leadData.foco;
    const nicho = leadData.nicho;
    const cidade = leadData.cidade;

    const inferred = getInferredContext(foco, nicho, cidade);
    const campaignContext = {
      oferta_usuario: inputOferta || inferred.oferta_usuario,
      publico_alvo: inputPublico || inferred.publico_alvo,
      dor_principal: inputDor || inferred.dor_principal,
      objetivo: inputObjetivo || inferred.objetivo,
      canal: inputCanal,
      etapa: inputEtapa
    };

    let analise: AnaliseResult;
    try {
      console.log("🚀 Usando Gemini 2.0 Flash para análise manual direta...");
      analise = await analyzeWithGeminiDirect(leadData, GOOGLE_GEMINI_API_KEY, campaignContext, () => {
        retryCountForCatch += 1;
      });
    } catch (geminiError: any) {
      console.error("❌ Falha na chamada direta ao Gemini:", geminiError.message || geminiError);
      throw geminiError;
    }

    analise = sanitizeProspectingPlan(normalizePremiumCopyForStorage(analise), leadData);

    const qualityResult = applyQualityFallbackIfNeeded(analise, leadData);
    analise = normalizeCommercialDiagnosisForStorage(qualityResult.analise, leadData);

    if (isZunoInternalProspectingFocus(leadData.foco) && analysisContainsForbiddenZunoDisclosure(analise)) {
      console.warn("🚫 Análise da Zuno continha disclosure proibido; aplicando fallback seguro.");
      const mockResult = applyQualityFallbackIfNeeded(
        sanitizeProspectingPlan(normalizePremiumCopyForStorage(generateZunoInternalMockAnalise(leadData)), leadData),
        leadData
      );
      analise = normalizeCommercialDiagnosisForStorage(mockResult.analise, leadData);
      qualityResult.fallbackUsed = true;
      qualityResult.missingFields.push("zuno_disclosure_proibido");
    }

    // Estruturar o JSON completo de metadados exigido pelo usuário, mantendo compatibilidade com o frontend
    const planoSalvar = {
      lead_id: leadId || null,
      generated_at: new Date().toISOString(),
      prompt_version: "v2_contextual",
      model: "gemini-direct",
      input_context: {
        empresa: leadData.nome,
        nicho: leadData.nicho,
        cidade: leadData.cidade,
        estado: leadData.endereco || null,
        site: leadData.website || null,
        oferta_usuario: campaignContext.oferta_usuario,
        publico_alvo: campaignContext.publico_alvo,
        dor_principal: campaignContext.dor_principal,
        objetivo: campaignContext.objetivo,
        canal: campaignContext.canal || null,
        etapa: campaignContext.etapa || null
      },
      diagnostico: {
        fit: analise.fit_level || "medio",
        dor_provavel: analise.probable_pain || analise.pain_point || "Não identificada",
        urgencia: analise.fit_level === "alto" ? "alta" : "media",
        oportunidade: analise.commercial_opportunity || "Não detalhada",
        justificativa: analise.why_good_lead || (analise.diagnostico_bullets || []).join(" ")
      },
      copies: {
        dia_1: analise.plano_prospeccao_7dias[0]?.mensagem || "",
        dia_2: analise.plano_prospeccao_7dias[1]?.mensagem || "",
        dia_3: analise.plano_prospeccao_7dias[2]?.mensagem || "",
        dia_4: analise.plano_prospeccao_7dias[3]?.mensagem || "",
        dia_5: analise.plano_prospeccao_7dias[4]?.mensagem || "",
        dia_6: analise.plano_prospeccao_7dias[5]?.mensagem || "",
        dia_7: analise.plano_prospeccao_7dias[6]?.mensagem || ""
      },
      abordagens_por_canal: {
        whatsapp: analise.messages?.whatsapp_primary || analise.whatsapp_message || "",
        instagram: analise.messages?.instagram || analise.instagram_message || "",
        email: analise.messages?.email_body || analise.email_body || ""
      },
      plano_prospeccao_7dias: analise.plano_prospeccao_7dias,
      debug: {
        raw_ai_response: JSON.stringify(analise),
        fallback_used: qualityResult.fallbackUsed,
        cache_used: false,
        missing_fields: qualityResult.missingFields
      }
    };

    // Save analysis to DB
    if (leadId) {
      const { error: updateError } = await supabaseAdmin.from("leads").update({
        diagnostico_bullets: analise.diagnostico_bullets,
        probabilidade_conversao: analise.probabilidade_conversao,
        plano_prospeccao: planoSalvar, // Salva o objeto JSON estruturado completo de metadados
        ai_analise_gerada_em: new Date().toISOString(),
        ai_used_fallback: qualityResult.fallbackUsed,
        ai_fallback_reason: qualityResult.fallbackUsed
          ? (qualityResult.missingFields.join(", ") || null)
          : null,
      }).eq("id", leadId);

      if (updateError) {
        console.error("❌ Erro ao salvar análise:", updateError.message);
        throw new Error("Erro ao salvar análise do lead.");
      }

      console.log("✅ Análise estruturada e salva no banco");
    }

    let incrementOk = true;
    let creditWarning: string | null = null;
    if (!isAdminUser) {
      const { data: rpcOk, error: incrementError } = await supabaseAdmin.rpc("increment_ai_usage", {
        p_user_id: userId,
      });
      incrementOk = rpcOk === true;
      if (incrementError || !rpcOk) {
        // A análise já foi salva com sucesso no banco. Não devemos retornar erro 402 aqui,
        // pois o usuário veria "erro" mas o lead já foi atualizado. Retornamos sucesso com warning.
        console.warn("⚠️ Análise salva com sucesso, mas falha ao incrementar crédito de IA:", incrementError?.message || "increment_ai_usage returned false");
        creditWarning = "Análise concluída, mas houve um erro ao registrar o consumo do crédito. Entre em contato com o suporte se isso se repetir.";
      }
    } else {
      console.log(`⚡ [analisar-lead-ia] Usuário é ADMIN (${user.email}). Bypass no consumo de crédito de IA.`);
    }

    await logAppEvent(supabaseAdmin, {
      userId,
      eventType: "ai_analysis_completed",
      eventData: {
        leadId,
        leadName: leadData.nome,
        model: "Gemini Flash (Direct)",
        score: analise.probabilidade_conversao,
        fallback_used: qualityResult.fallbackUsed,
        ...(isAdminUser
          ? {
              admin_override: true,
              credit_consumed: false,
              is_internal_event: true,
              event_source_type: "admin",
              source: "admin_refine_ai"
            }
          : isZunoInternalProspectingFocus(leadData.foco)
          ? {
              focus: ZUNO_INTERNAL_PROSPECTING_FOCUS,
              internal_zuno_prospecting: true,
              admin_only: true,
              is_internal_event: true,
              event_source_type: "admin",
            }
          : {}),
      },
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });

    const successResponse = {
      ...planoSalvar,
      success: true,
      used_fallback: qualityResult.fallbackUsed,
      fallback_reason: qualityResult.fallbackUsed ? (qualityResult.missingFields.join(", ") || null) : null,
      ...(creditWarning ? { credit_warning: creditWarning } : {}),
    };
    return jsonResponse(successResponse as unknown as Record<string, unknown>);
  } catch (error: any) {
    console.error("Erro analisar-lead-ia:", error);
    const duration = Date.now() - startTime;
    
    // Normalizar o código de erro, a mensagem amigável para o usuário e a de debug técnico seguro
    let errorCode = error?.code || "AI_ANALYSIS_ERROR";
    let errorMessage = "Não conseguimos concluir a análise agora. O uso de IA não foi descontado. Tente novamente em alguns instantes.";
    let debugMessage = error instanceof Error ? error.message : String(error);
    
    if (error?.name === "AbortError" || debugMessage.toLowerCase().includes("timeout") || debugMessage.toLowerCase().includes("deadline")) {
      errorCode = "GEMINI_TIMEOUT";
      errorMessage = "A análise demorou mais que o esperado.";
    } else if (errorCode === "INVALID_LEAD_PAYLOAD" || debugMessage.toLowerCase().includes("suficientes") || debugMessage.toLowerCase().includes("payload")) {
      errorCode = "INVALID_LEAD_PAYLOAD";
      errorMessage = "Esse lead não tem dados suficientes para análise. Tente outro lead.";
    } else if (errorCode === "AI_LIMIT_REACHED" || errorCode === "AI_CREDITS_EXHAUSTED" || debugMessage.toLowerCase().includes("limite") || debugMessage.toLowerCase().includes("crédito") || debugMessage.toLowerCase().includes("saldo") || debugMessage.toLowerCase().includes("402")) {
      errorCode = "AI_CREDITS_EXHAUSTED";
      errorMessage = "Você atingiu seu limite de análises com IA.";
    }
    
    // Garantir que não retornamos dados sensíveis no debugMessage
    debugMessage = debugMessage.replace(/AIzaSy[A-Za-z0-9_-]{35}/g, "AIzaSy[SECRET_REDACTED]");
    
    if (supabaseAdminForCatch && userIdForCatch) {
      // Metadados de auditoria segura sobre campos de lead
      const available_fields = (leadData as any) ? Object.keys(leadData) : [];
      const has_name = (leadData as any) ? (!!leadData.nome && leadData.nome.trim() !== "" && leadData.nome.toLowerCase() !== "não informado" && leadData.nome.toLowerCase() !== "nao informado") : false;
      const has_category = (leadData as any) ? (!!leadData.nicho && leadData.nicho.trim() !== "" && leadData.nicho.toLowerCase() !== "não informado" && leadData.nicho.toLowerCase() !== "nao informado") : false;
      const has_city = (leadData as any) ? (!!leadData.cidade && leadData.cidade.trim() !== "" && leadData.cidade.toLowerCase() !== "não informada" && leadData.cidade.toLowerCase() !== "nao informada" && leadData.cidade.toLowerCase() !== "não informado" && leadData.cidade.toLowerCase() !== "nao informado") : false;
      const has_address = (leadData as any) ? (!!leadData.endereco && leadData.endereco.trim() !== "") : false;
      const has_phone = (leadData as any) ? (!!leadData.whatsapp_number && leadData.whatsapp_number.trim() !== "") : false;
      const has_website = (leadData as any) ? (!!leadData.website && leadData.website.trim() !== "") : false;
      const has_rating = (leadData as any) ? (leadData.rating !== undefined && leadData.rating !== null) : false;
      const has_reviews = (leadData as any) ? (leadData.reviews !== undefined && leadData.reviews !== null) : false;

      const missing_required_fields = [];
      if (!has_name) missing_required_fields.push("nome");
      const has_any_context = has_city || has_address || has_category || has_website || has_phone || has_rating || ((leadData as any) ? !!leadData.place_id : false);
      if (!has_any_context) {
        missing_required_fields.push("contexto_minimo");
      }

      await logAppEvent(supabaseAdminForCatch, {
        userId: userIdForCatch,
        eventType: "ai_analysis_failed",
        eventData: {
          lead_id: leadIdForCatch,
          lead_name: leadNameForCatch || null,
          source: sourceForCatch,
          path: pathForCatch,
          error_message: errorMessage,
          error_code: errorCode,
          debug_message: debugMessage,
          error_type: error?.name || "UnknownError",
          ai_used_before: aiUsedForCatch,
          ai_used_after: aiUsedForCatch,
          ai_available_before: aiRemainingForCatch,
          ai_available_after: aiRemainingForCatch,
          deducted_credit: false,
          request_id: requestId,
          edge_function: "analisar-lead-ia",
          provider: "gemini",
          duration_ms: duration,
          retry_count: retryCountForCatch,
          ...((leadData as any) && isZunoInternalProspectingFocus((leadData as any).foco)
            ? {
                focus: ZUNO_INTERNAL_PROSPECTING_FOCUS,
                internal_zuno_prospecting: true,
                admin_only: true,
                is_internal_event: true,
                event_source_type: "admin",
              }
            : {}),
          
          // Metadados seguros do lead
          available_fields,
          has_name,
          has_category,
          has_city,
          has_address,
          has_phone,
          has_website,
          has_rating,
          has_reviews,
          missing_required_fields
        },
        ipAddress: req.headers.get("x-forwarded-for"),
        userAgent: req.headers.get("user-agent"),
      });
    }
    // Determinar o status HTTP correto baseado no tipo de erro
    let httpStatus = 500;
    if (errorCode === "AI_CREDITS_EXHAUSTED") httpStatus = 402;
    else if (errorCode === "INVALID_LEAD_PAYLOAD") httpStatus = 400;
    else if (errorCode === "GEMINI_TIMEOUT") httpStatus = 408;

    return jsonResponse({
      success: false,
      blocked: errorCode === "AI_CREDITS_EXHAUSTED",
      error_code: errorCode,
      error_message: errorMessage,
      debug_message: debugMessage,
      error_type: error?.name || "UnknownError",
      request_id: requestId,
      duration_ms: duration,
      retry_count: retryCountForCatch,
      ai_used_before: aiUsedForCatch,
      ai_used_after: aiUsedForCatch,
      ai_available_before: aiRemainingForCatch,
      ai_available_after: aiRemainingForCatch,
      deducted_credit: false,
      provider: "gemini",
      edge_function: "analisar-lead-ia",
      error: errorMessage,
      details: debugMessage,
    }, httpStatus);
  }
});

// =============================================================================
// CONTEXTO DE INFERÊNCIA INTELIGENTE DE CAMPANHA
// =============================================================================
function getInferredContext(foco: string, nicho: string, cidade: string) {
  const normalizedFocus = String(foco || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleanNiche = nicho || "seu segmento";
  const cleanCity = cidade || "sua região";
  
  if (normalizedFocus.includes("social") || normalizedFocus.includes("instagram")) {
    return {
      oferta_usuario: "Gestão de redes sociais, posicionamento e bio vitrine para Instagram",
      publico_alvo: `Empresas de ${cleanNiche} em ${cleanCity} com perfis desorganizados`,
      dor_principal: "Instagram inativo que não atrai clientes nem gera novas oportunidades comerciais",
      objetivo: "Engajar via conteúdo e bio para iniciar conversas qualificadas no direct/WhatsApp"
    };
  }
  
  if (normalizedFocus.includes("trafego") || normalizedFocus.includes("traf")) {
    return {
      oferta_usuario: "Campanhas de anúncios pagos (Meta/Google Ads) direcionando para o WhatsApp",
      publico_alvo: `Empresas de ${cleanNiche} em ${cleanCity} querendo fluxo diário de clientes`,
      dor_principal: "Dependência de indicação e falta de previsibilidade de novos leads",
      objetivo: "Agendar conversa de 15 minutos para apresentar funil de captação de leads"
    };
  }

  if (normalizedFocus.includes("full") || normalizedFocus.includes("serv")) {
    return {
      oferta_usuario: "Assessoria multicanal 360° em marketing (tráfego, presença local, site e conversão)",
      publico_alvo: `Empresas de ${cleanNiche} em ${cleanCity} buscando parceiro estratégico de crescimento`,
      dor_principal: "Múltiplas agências executando ações desalinhadas que não geram retorno de vendas",
      objetivo: "Oferecer diagnóstico estratégico gratuito de canais para otimização de faturamento"
    };
  }

  if (normalizedFocus.includes("design") || normalizedFocus.includes("visual")) {
    return {
      oferta_usuario: "Identidade visual premium, redesign e branding focado em valorização comercial",
      publico_alvo: `Empresas de ${cleanNiche} em ${cleanCity} querendo se destacar como premium`,
      dor_principal: "Comunicação visual amadora que faz a empresa perder clientes com ticket alto",
      objetivo: "Apresentar portfólio e como o design de impacto aumenta o fechamento de vendas"
    };
  }

  if (normalizedFocus.includes("seo") || normalizedFocus.includes("site") || normalizedFocus.includes("landing")) {
    return {
      oferta_usuario: "Desenvolvimento de páginas que convertem e otimização de buscas no Google (SEO)",
      publico_alvo: `Empresas de ${cleanNiche} em ${cleanCity} sem site próprio ou fora das buscas orgânicas`,
      dor_principal: "Perda de clientes que buscam no Google por não ter um site bem otimizado e persuasivo",
      objetivo: "Propor uma auditoria de SEO ou redesenho da landing page comercial"
    };
  }

  if (normalizedFocus.includes("crm") || normalizedFocus.includes("automacao") || normalizedFocus.includes("gestao")) {
    return {
      oferta_usuario: "Estruturação de funil de vendas, CRM e automação comercial de WhatsApp",
      publico_alvo: `Empresas de ${cleanNiche} em ${cleanCity} perdendo vendas por demora de atendimento`,
      dor_principal: "Contatos comerciais se perdem no WhatsApp ou demoram para ter follow-up",
      objetivo: "Oferecer demonstração prática de atendimento comercial automatizado e qualificado"
    };
  }

  return {
    oferta_usuario: `Serviço especializado em ${foco} para otimização e aceleração comercial`,
    publico_alvo: `Empresas de ${cleanNiche} em ${cleanCity} buscando escala de vendas`,
    dor_principal: `Impossibilidade de gerar novas oportunidades com constância em ${foco}`,
    objetivo: "Demonstrar pontos de melhoria comercial baseados em dados públicos da empresa"
  };
}

// =============================================================================
// GOOGLE GEMINI DIRETO (API KEY DO USUÁRIO) - MODELO PRINCIPAL
// =============================================================================
async function analyzeWithGeminiDirect(
  lead: LeadData,
  apiKey: string,
  injectedCampaign: {
    oferta_usuario: string;
    publico_alvo: string;
    dor_principal: string;
    objetivo: string;
    canal: string | null;
    etapa: string | null;
  },
  onRetry?: () => void
): Promise<AnaliseResult> {
  const canaisSelecionados = lead.canaisProspeccao?.length ? lead.canaisProspeccao : ["email", "whatsapp", "instagram"] as const;
  let canaisDisponiveis = getAvailableChannels(lead, [...canaisSelecionados]);
  
  if (canaisDisponiveis.length === 0) {
    console.log("⚠️ Nenhum canal de contato encontrado. Usando canais selecionados como fallback consultivo:", canaisSelecionados);
    canaisDisponiveis = [...canaisSelecionados];
  }
  
  const isUS = isUSLead(lead);
  const isZunoInternal = isZunoInternalProspectingFocus(lead.foco);
  const systemPrompt = isZunoInternal
    ? buildZunoInternalProspectingSystemPrompt()
    : buildEliteCopywriterSystemPrompt(isUS, lead.foco);
  const userPrompt = isZunoInternal
    ? buildZunoInternalProspectingUserPrompt(lead, canaisDisponiveis)
    : buildEliteUserPrompt(lead, canaisDisponiveis, injectedCampaign, isUS);

  // Cada modelo recebe seu próprio orçamento de tempo (timeout independente).
  // Antes, um único AbortController de 90s era compartilhado entre os 3 modelos e suas
  // retentativas (até 5 por modelo, com backoff de 3/6/12/24/48s). Isso fazia com que um
  // rate limit (429) sustentado no primeiro modelo consumisse sozinho todo o orçamento de
  // 90s, e a cascata de fallback para os próximos modelos nunca chegava a ser tentada de
  // fato (o abort já havia disparado). Agora cada modelo tem seu próprio relógio, então um
  // modelo com problema não impede que os próximos sejam tentados.
  // Cada modelo recebe 26s para gerar o plano completo de 7 dias com Function Calling
  const PER_MODEL_TIMEOUT_MS = 26000; 

  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-2.0-flash"
  ];
  let lastResponseError = "";

  for (const model of modelsToTry) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PER_MODEL_TIMEOUT_MS);
    try {
      console.log(`🤖 Tentando analisar com o modelo: ${model}`);
      const response = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8000,
            },
            tools: [{
              functionDeclarations: [{
                name: "gerar_analise_lead",
                description: "Gera análise completa do lead com diagnóstico, probabilidade e plano de prospecção de 7 dias",
                parameters: {
                  type: "object",
                  properties: {
                    diagnostico_bullets: {
                      type: "array",
                      items: { type: "string" },
                      description: "6-8 bullets de diagnóstico consultivo profundo"
                    },
                    probabilidade_conversao: {
                      type: "number",
                      description: "Probabilidade de conversão de 0-100"
                    },
                    score: { type: "number", description: "Score de conversao de 0 a 100" },
                    fit_level: { type: "string", enum: ["alto", "medio", "baixo"] },
                    diagnostic: { type: "string" },
                    pain_point: { type: "string" },
                    approach_angle: { type: "string" },
                    company_reading: { type: "string" },
                    why_good_lead: { type: "string" },
                    data_signals: { type: "array", items: { type: "string" } },
                    commercial_opportunity: { type: "string" },
                    probable_pain: { type: "string" },
                    approach_gap: { type: "string" },
                    commercial_angle: { type: "string" },
                    best_angle: { type: "string" },
                    recommended_offer: {
                      type: "object",
                      properties: {
                        plan: { type: "string", enum: ["free", "starter", "pro", "agency"] },
                        type: { type: "string" },
                        reason: { type: "string" }
                      }
                    },
                    conversion_path: { type: "string" },
                    conversion_strategy: { type: "string" },
                    messages: {
                      type: "object",
                      properties: {
                        whatsapp_primary: { type: "string" },
                        whatsapp_alternative: { type: "string" },
                        instagram: { type: "string" },
                        email_subject: { type: "string" },
                        email_body: { type: "string" },
                        follow_up: { type: "string" }
                      }
                    },
                    warnings: { type: "array", items: { type: "string" } },
                    whatsapp_message: { type: "string" },
                    instagram_message: { type: "string" },
                    email_subject: { type: "string" },
                    email_body: { type: "string" },
                    follow_up: { type: "string" },
                    follow_up_message: { type: "string" },
                    likely_objection: { type: "string" },
                    objection_response: { type: "string" },
                    cta: { type: "string" },
                    variations: {
                      type: "object",
                      properties: {
                        direct: { type: "string" },
                        consultative: { type: "string" },
                        light_provocation: { type: "string" }
                      }
                    },
                    plano_prospeccao_7dias: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          dia: { type: "number" },
                          canal: { type: "string", enum: ["whatsapp", "email", "instagram"] },
                          acao_sugerida: { type: "string", description: "Ação tática específica: enviar áudio, texto, curtir posts, reagir story, etc." },
                          mensagem: { type: "string" },
                          objecao_provavel: { type: "string" },
                          resposta_sugerida: { type: "string" },
                          cta: { type: "string" }
                        },
                        required: ["dia", "canal", "acao_sugerida", "mensagem", "objecao_provavel", "resposta_sugerida", "cta"]
                      }
                    }
                  },
                  required: ["diagnostico_bullets", "probabilidade_conversao", "plano_prospeccao_7dias"]
                }
              }]
            }],
            toolConfig: {
              functionCallingConfig: {
                mode: "ANY",
                allowedFunctionNames: ["gerar_analise_lead"]
              }
            }
          }),
          signal: controller.signal,
        },
        2, // maxRetries (baixo de propósito: cada modelo tem orçamento próprio de PER_MODEL_TIMEOUT_MS,
        2500, // baseDelay 2.5s   e a cascata para o próximo modelo é a estratégia principal de resiliência)
        onRetry
      );

      if (!response.ok) {
        const errorText = await response.text();
        const isModelUnavailableError = 
          response.status === 404 || 
          (response.status === 400 && (
            errorText.toLowerCase().includes("not found") || 
            errorText.toLowerCase().includes("not supported") || 
            errorText.toLowerCase().includes("invalid_argument")
          ));

        if (isModelUnavailableError) {
          console.warn(`⚠️ Modelo ${model} indisponível (Status: ${response.status}). Tentando o próximo... Detalhes: ${errorText}`);
          lastResponseError = `Modelo ${model} indisponível (${response.status}): ${errorText}`;
          clearTimeout(timeoutId);
          continue;
        }

        console.error(`❌ Gemini API error para o modelo ${model}:`, response.status, errorText);
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // Parse Gemini response format
      const candidate = data.candidates?.[0];
      if (!candidate?.content?.parts) {
        throw new Error("Resposta inválida do Gemini");
      }

      // Find the function call in parts
      const functionCallPart = candidate.content.parts.find((p: any) => p.functionCall);
      if (!functionCallPart?.functionCall?.args) {
        throw new Error("IA não retornou análise estruturada");
      }

      const analise: AnaliseResult = functionCallPart.functionCall.args;
      
      // Validate: accept 5-7 days (more tolerant)
      if (!analise.plano_prospeccao_7dias || analise.plano_prospeccao_7dias.length < 5) {
        throw new Error("Plano deve ter pelo menos 5 dias");
      }
      
      // Complete to 7 days if needed
      while (analise.plano_prospeccao_7dias.length < 7) {
        const lastDay = analise.plano_prospeccao_7dias[analise.plano_prospeccao_7dias.length - 1];
        analise.plano_prospeccao_7dias.push({
          dia: analise.plano_prospeccao_7dias.length + 1,
          canal: lastDay.canal,
          acao_sugerida: "Follow-up final",
          mensagem: `Continuando nosso último contato, gostaria de entender melhor sua situação atual com ${lead.foco || "marketing digital"}.`,
          objecao_provavel: "Não tenho interesse",
          resposta_sugerida: "Sem problemas! Fico à disposição quando precisar.",
          cta: "Posso ajudar de alguma forma?",
        });
      }

      console.log(`✅ Análise gerada com sucesso via modelo: ${model}`);
      
      clearTimeout(timeoutId);
      return analise;
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn(`⚠️ Falha ao processar com modelo ${model}:`, err.message);
      lastResponseError = err.name === 'AbortError'
        ? `Modelo ${model} excedeu ${PER_MODEL_TIMEOUT_MS / 1000}s`
        : err.message;

      // Se não for o último modelo, continua o loop e tenta o próximo
      if (model === modelsToTry[modelsToTry.length - 1]) {
        if (err.name === 'AbortError') {
          throw new Error(`Timeout: modelo ${model} demorou mais de ${PER_MODEL_TIMEOUT_MS / 1000}s`);
        }
        throw err;
      }
    }
  }

  throw new Error(`Todos os modelos do Gemini falharam. Último erro: ${lastResponseError}`);
}

// =============================================================================
// LOVABLE AI GATEWAY (FALLBACK - DESATIVADO)
// =============================================================================
async function analyzeWithLovableAI(lead: LeadData): Promise<AnaliseResult> {
  console.log("⚠️ analyzeWithLovableAI desativada por completo.");
  return generateMockAnalise(lead);
}

// Função mock inativa mantida apenas para evitar quebras sintáticas
async function analyzeWithLovableAIDisabledLegacy(lead: LeadData): Promise<AnaliseResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.log("⚠️ Lovable API key não configurada - usando mock");
    return generateMockAnalise(lead);
  }

  const canaisSelecionados = lead.canaisProspeccao?.length ? lead.canaisProspeccao : ["email", "whatsapp", "instagram"] as const;
  let canaisDisponiveis = getAvailableChannels(lead, [...canaisSelecionados]);
  
  if (canaisDisponiveis.length === 0) {
    console.log("⚠️ Nenhum canal de contato encontrado. Usando canais selecionados como fallback consultivo:", canaisSelecionados);
    canaisDisponiveis = [...canaisSelecionados];
  }
  
  const isUS = isUSLead(lead);
  const isZunoInternal = isZunoInternalProspectingFocus(lead.foco);
  const systemPrompt = isZunoInternal
    ? buildZunoInternalProspectingSystemPrompt()
    : buildEliteCopywriterSystemPrompt(isUS, lead.foco);
  const userPrompt = isZunoInternal
    ? buildZunoInternalProspectingUserPrompt(lead, canaisDisponiveis)
    : buildEliteUserPrompt(lead, canaisDisponiveis, undefined, isUS);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout

  try {
    // Usa fetchWithRetry para lidar com rate limits (429)
    const response = await fetchWithRetry(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          tools: [{
            type: "function",
            function: {
              name: "gerar_analise_lead",
              description: "Gera análise completa do lead",
              parameters: {
                type: "object",
                properties: {
                  diagnostico_bullets: { type: "array", items: { type: "string" } },
                  probabilidade_conversao: { type: "number" },
                  score: { type: "number", description: "Score de conversao de 0 a 100" },
                  fit_level: { type: "string", enum: ["alto", "medio", "baixo"] },
                  diagnostic: { type: "string" },
                  pain_point: { type: "string" },
                  approach_angle: { type: "string" },
                  company_reading: { type: "string" },
                  why_good_lead: { type: "string" },
                  data_signals: { type: "array", items: { type: "string" } },
                  commercial_opportunity: { type: "string" },
                  probable_pain: { type: "string" },
                  approach_gap: { type: "string" },
                  commercial_angle: { type: "string" },
                  best_angle: { type: "string" },
                  recommended_offer: {
                    type: "object",
                    properties: {
                      plan: { type: "string", enum: ["free", "starter", "pro", "agency"] },
                      type: { type: "string" },
                      reason: { type: "string" }
                    }
                  },
                  conversion_path: { type: "string" },
                  conversion_strategy: { type: "string" },
                  messages: {
                    type: "object",
                    properties: {
                      whatsapp_primary: { type: "string" },
                      whatsapp_alternative: { type: "string" },
                      instagram: { type: "string" },
                      email_subject: { type: "string" },
                      email_body: { type: "string" },
                      follow_up: { type: "string" }
                    }
                  },
                  warnings: { type: "array", items: { type: "string" } },
                  whatsapp_message: { type: "string" },
                  instagram_message: { type: "string" },
                  email_subject: { type: "string" },
                  email_body: { type: "string" },
                  follow_up: { type: "string" },
                  follow_up_message: { type: "string" },
                  likely_objection: { type: "string" },
                  objection_response: { type: "string" },
                  cta: { type: "string" },
                  variations: {
                    type: "object",
                    properties: {
                      direct: { type: "string" },
                      consultative: { type: "string" },
                      light_provocation: { type: "string" }
                    }
                  },
                  plano_prospeccao_7dias: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        dia: { type: "number" },
                        canal: { type: "string", enum: ["whatsapp", "email", "instagram"] },
                        acao_sugerida: { type: "string" },
                        mensagem: { type: "string" },
                        objecao_provavel: { type: "string" },
                        resposta_sugerida: { type: "string" },
                        cta: { type: "string" }
                      },
                      required: ["dia", "canal", "acao_sugerida", "mensagem", "objecao_provavel", "resposta_sugerida", "cta"]
                    }
                  }
                },
                required: ["diagnostico_bullets", "probabilidade_conversao", "plano_prospeccao_7dias"]
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "gerar_analise_lead" } },
        }),
        signal: controller.signal,
      },
      3, // maxRetries
      2000 // baseDelay 2s
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Lovable AI error: ${response.status}`, errorText);
      throw new Error(`Lovable AI error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      console.log("⚠️ Lovable AI não retornou análise estruturada - usando mock");
      return generateMockAnalise(lead);
    }

    const analise: AnaliseResult = JSON.parse(toolCall.function.arguments);
    
    // Ensure 7 days
    while (analise.plano_prospeccao_7dias.length < 7) {
      const lastDay = analise.plano_prospeccao_7dias[analise.plano_prospeccao_7dias.length - 1];
      analise.plano_prospeccao_7dias.push({
        dia: analise.plano_prospeccao_7dias.length + 1,
        canal: lastDay?.canal || "whatsapp",
        acao_sugerida: "Follow-up final",
        mensagem: `Continuando nosso último contato sobre ${lead.foco || "marketing digital"}.`,
        objecao_provavel: "Não tenho interesse",
        resposta_sugerida: "Sem problemas! Fico à disposição.",
        cta: "Posso ajudar de alguma forma?",
      });
    }

    console.log("✅ Análise gerada com sucesso via Lovable AI");
    return analise;

  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("❌ Lovable AI falhou:", error.message);
    return generateMockAnalise(lead);
  }
}

// =============================================================================
// SYSTEM PROMPT - COPYWRITER DE ELITE
// =============================================================================
function buildEliteCopywriterSystemPrompt(isUS: boolean = false): string {
  if (isUS) {
    return buildUSSystemPrompt();
  }
  return buildBRSystemPrompt();
}

function buildPremiumCopyOutputRules(): string {
  return `FORMATO PREMIUM OBRIGATORIO
- Alem de diagnostico_bullets, probabilidade_conversao e plano_prospeccao_7dias, retorne no mesmo JSON:
  score, fit_level, company_reading, data_signals, commercial_opportunity, probable_pain, approach_gap, best_angle, recommended_offer, likely_objection, objection_response, conversion_strategy, messages e warnings.
- O diagnostico deve parecer uma leitura estrategica do lead feita por um especialista depois de analisar site, Instagram, WhatsApp, tags, avaliacoes e foco escolhido.
- Nao escreva como relatorio tecnico, checklist de ferramenta, busca interna, texto para mostrar diretamente ao lead ou instrucao interna de operacao.
- diagnostico_bullets deve ter de 3 a 4 bullets, no maximo. Cada bullet deve ser uma conclusao comercial curta, com base nos sinais reais analisados.
- Use este estilo: "A avaliacao X sugere Y", "Com foco em Trafego, o achado Z indica W", "A oportunidade esta em...".
- Nao despeje todos os dados. Escolha os sinais mais uteis para orientar uma conversa comercial com a empresa.
- Nao escreva "busca", "lead encontrado", "nicho pesquisado", "prospect" ou bastidores da ferramenta no diagnostico/copy final.
- Nao escreva no diagnostico: "SDR", "foco da abordagem", "ponto para puxar conversa", "como abordar", "proximo passo" ou qualquer rotulo parecido.
- data_signals deve listar sinais concretos analisados: segmento, cidade, site informado/nao informado, Instagram informado/nao informado, WhatsApp, rating, reviews, Meta Pixel, Google Analytics, GTM, qualidade aparente do site/Instagram quando houver contexto.
- recommended_offer deve ter type, plan ("free", "starter", "pro" ou "agency") quando fizer sentido, e reason.
- messages deve conter whatsapp_primary, instagram, email_subject, email_body e follow_up. Nao use whatsapp_alternative para criar variacoes.
- O diagnostico deve ser especifico ao foco escolhido e responder: o que parece estar acontecendo, o que os sinais indicam, onde existe oportunidade e qual conversa comercial isso abre.
- Se foco for Trafego: avalie site/pagina, WhatsApp, Meta Pixel, Google Analytics/GTM e Instagram como preparo para receber trafego. Se tiver pixel/tag, diga que isso sugere mais maturidade para medir campanhas. Se nao tiver, diga apenas "nos dados disponiveis nao detectei" e transforme isso em pergunta de validacao.
- Se foco for Design: avalie percepcao visual, marca, site, presenca digital e clareza de contato com base nos dados disponiveis.
- Se foco for Social/Social media: avalie Instagram informado, presenca social, clareza de bio/contato apenas se houver dados; caso contrario, use sinais locais/Google.
- Se foco for SEO ou Sites/Landing: avalie site informado, estrutura aparente, CTA, medicao e oportunidade de converter melhor.
- Se foco for CRM/Automacao/Gestao interna: avalie sinais de atendimento, WhatsApp, canais, organizacao e oportunidade de processo.
- Se foco for Full Service: combine site, redes, tracking, presenca local e clareza comercial.
- Use dados disponiveis: nome, nicho, cidade, endereco, site informado, telefone, rating, reviews, WhatsApp, Instagram, foco e canais. Nao invente dados. Se algo nao veio nos dados, diga "nos dados disponiveis, nao ha X informado" quando isso for relevante.
- A copy deve falar direto com a empresa, sem "sou agencia de marketing" nem apresentacao generica. Comece com saudacao natural, cite um achado real, conecte com uma pergunta comercial e termine com CTA simples.
- Exemplo de direcao para Trafego: "Ola, [empresa], tudo bem? Analisei o site de voces e vi alguns sinais de estrutura para campanhas. Queria entender: hoje voces estao rodando trafego pago ou ainda estao ajustando a pagina para receber leads qualificados?"
- Evite "igual agencia", "somos uma agencia", "trabalho com marketing digital" e qualquer abertura focada em quem esta vendendo. A primeira linha deve ser sobre a empresa.
- Evite frases vagas como "pode se beneficiar", "tem potencial", "gerar valor", "a mensagem deve ser consultiva", "evitar promessas" ou "primeiro contato recomendado" sem explicar exatamente como e por que.
- Nao retorne variations. O usuario nao precisa de variacoes soltas; concentre a qualidade no plano_prospeccao_7dias.
- O plano_prospeccao_7dias deve ter exatamente 7 dias e cada dia deve conter canal, acao_sugerida, mensagem, objecao_provavel, resposta_sugerida e cta.
- Os 7 dias devem evoluir a conversa: abertura, DM leve, follow-up, email objetivo, pergunta diagnostica, follow-up final leve e ultimo toque respeitoso.
- As mensagens devem ser curtas, humanas, contextualizadas pelo nicho/cidade/sinais e sem frase generica.
- Se o foco for zuno_internal_prospecting, trate-o como um modo de oportunidade comercial.
- Nesse modo, o diagnostico deve ler a empresa como um especialista comercial: onde ha sinais de demanda, onde pode existir perda de oportunidade, qual dor de captacao ou previsibilidade parece mais provavel e qual pergunta abre melhor a conversa.
- Nesse modo, nunca escreva "zuno_internal_prospecting", "Zuno interno", "foco interno" ou qualquer termo tecnico no texto final.
- Nesse modo, os primeiros contatos devem abrir pela observacao e pela pergunta; apresente produto ou ferramenta apenas se a conversa evoluir, sem pitch apressado.`;
}

function buildZunoInternalProspectingSystemPrompt(): string {
  return `Voce e um especialista comercial analisando leads com foco em oportunidade comercial.

Sua tarefa e produzir um diagnostico comercial e um plano de prospeccao consultivo para a equipe interna da Zuno, sem deixar a copy com cara de ferramenta, pitch apressado ou nome interno do sistema.

Objetivo:
- ler os sinais da empresa como alguem experiente em vendas consultivas;
- identificar onde pode existir espaco comercial real;
- transformar essa leitura em mensagens humanas para WhatsApp, Instagram e e-mail;
- abrir conversa antes de tentar vender qualquer produto.

Regras obrigatorias:
- Nunca escreva "zuno_internal_prospecting", "Zuno interno" ou qualquer termo tecnico no texto final.
- O diagnostico deve parecer uma leitura comercial pronta, nao uma instrucao operacional.
- As mensagens devem soar humanas, curtas, contextuais e apropriadas para o canal.
- Nos primeiros contatos, abra pela observacao e pela pergunta. Nao comece vendendo agressivamente.
- Se houver espaco, a ideia de ferramenta, processo ou solucao pode aparecer de forma leve depois, nunca na primeira linha.
- Use nicho, cidade, site, Instagram, WhatsApp, rating e sinais reais apenas quando existirem.
- Nao invente responsavel, numeros, resultados ou dores especificas sem base.
- Frases proibidas: "encontrei voce usando a Zuno", "achei voce pela Zuno", "a propria Zuno encontrou", "usei a Zuno para encontrar", "fui ate voce usando a Zuno".
- Retorne somente dados compativeis com a funcao gerar_analise_lead.
- diagnostico_bullets deve refletir leitura da empresa, oportunidade percebida, dor provavel e melhor angulo de conversa.
- probabilidade_conversao deve ser um score de 0 a 100.
- plano_prospeccao_7dias deve conter mensagens prontas para WhatsApp, Instagram, e-mail e follow-ups.`;
}

function buildBRSystemPrompt(): string {
  return `Você é um COPYWRITER E ESTRATEGISTA DE VENDAS B2B de ELITE com 15+ anos de experiência.
Sua missão: criar mensagens que fazem o prospect PARAR, LER e RESPONDER.

🏆 SUA ESPECIALIDADE:
• Prospecção B2B de alto ticket para agências de marketing digital
• Vendas consultivas para Tráfego, SEO, Social, Full Service, Automação, CRM, Sites/Landing, Design
• Domínio absoluto de prospecção multicanal (WhatsApp, Email, Instagram)
• Copywriting HUMANIZADO que gera conexão genuína

═══════════════════════════════════════════════════════════════
📜 REGRAS DE OURO (INEGOCIÁVEIS)
═══════════════════════════════════════════════════════════════

1. 🎯 SAUDAÇÕES ELEGANTES E PERSONALIZADAS
   
   ✅ OBRIGATÓRIO: Comece SEMPRE com saudação CURTA e CONTEXTUALIZADA:
   
   SE nome_responsavel disponível:
   • "Bom dia, [nome]! 👋" ou "[nome], tudo bem?"
   • "[Nome], vi algo interessante sobre [nicho]..."
   • "Oi [nome]! Analisei [empresa] e..."
   
   SE nome_responsavel NÃO disponível:
   • "Bom dia! Vi a [empresa] e..."
   • "Oi, pessoal da [empresa]! 👋"
   • "Equipe [empresa], tudo bem?"
   
   ❌ PROIBIDO saudações VAZIAS sem contexto:
   • "Olá!" (sozinho)
   • "Boa tarde, tudo bem?" (genérico demais)
   • "Prezados senhores" (corporativo demais)

2. 💬 TOM HUMANIZADO E EMPÁTICO
   
   • Escreva como uma PESSOA real, não como um robô de vendas
   • Use "você" e "sua empresa" - crie conexão pessoal
   • Demonstre que ESTUDOU o negócio deles
   • Seja CURIOSO: faça perguntas que provocam reflexão
   • Reconheça a realidade do negócio antes de oferecer solução
   
   EXEMPLO DE TOM CERTO:
   "Bom dia, Carlos! 👋 Analisei o mercado de [nicho] em [cidade] e 
   percebi que a maioria enfrenta o mesmo desafio: [dor]. 
   Vi que a [empresa] ainda não explora [oportunidade]. 
   Posso te mostrar como resolver isso em 5 min?"

3. 📝 COPY AFIADA (mas humana)
   • Frases CURTAS e DIRETAS - máximo 20 palavras por frase
   • Primeiro CONECTE, depois VENDA
   • Cada palavra deve ter propósito - corte o resto
   • Máximo 2 emojis estratégicos (👋 para saudação, ✅ para resultados)

4. 🚫 PROIBIÇÕES ABSOLUTAS
   ❌ NUNCA invente nomes - use apenas nome_responsavel se fornecido
   ❌ NUNCA use clichês: "explodir resultados", "escalar vendas", "bombar", "alavancar"
   ❌ NUNCA prometa milagres ou números absurdos
   ❌ NUNCA seja bajulador ou use elogios genéricos
   ❌ NUNCA comece com "Somos uma agência..." ou fale de si primeiro
   ❌ NUNCA invente ou alucine informações ausentes. Use apenas os dados disponíveis. Se algum dado estiver ausente, não invente. Gere uma abordagem útil com base no nome da empresa, nicho e localização. Não afirme que a empresa não tem site, Instagram ou campanhas se essa informação não estiver disponível nos dados do lead.

═══════════════════════════════════════════════════════════════
5. 🎯 AÇÃO SUGERIDA (CAMPO OBRIGATÓRIO)
═══════════════════════════════════════════════════════════════

   Para CADA DIA, você DEVE incluir uma "acao_sugerida" que orienta
   o usuário sobre COMO executar o contato (formato, preparação, etc.)

   📱 WHATSAPP - Ações possíveis:
   ─────────────────────────────
   • Dia 1: "Enviar texto curto primeiro; se responder, mandar áudio explicando o ponto principal"
   • Dias 2-4: Alternar entre "Enviar mensagem de TEXTO" e "Enviar ÁUDIO curto (20-30s)"
   • Dia 5-6: "Enviar mensagem de TEXTO com case/resultado"
   • Dia 7: "Enviar ÁUDIO de despedida respeitoso (30s)"
   
   📸 INSTAGRAM - Ações possíveis (PRÉ-ENGAJAMENTO OBRIGATÓRIO):
   ─────────────────────────────
   • "1) Curtir 2-3 posts recentes 2) Reagir a 1 story com emoji relevante 3) Enviar DM com a mensagem"
   • "1) Comentar no último post com insight relevante 2) Esperar 1h 3) Enviar DM"
   • "Reagir aos últimos 2 stories + enviar DM com áudio curto (20s)"
   
   ✉️ EMAIL - Ações possíveis:
   ─────────────────────────────
   • "Enviar email com ASSUNTO: [sugestão de assunto impactante]"
   • "Enviar email com PDF de case anexo"
   • "Enviar email com link de vídeo curto (Loom 2min)"

═══════════════════════════════════════════════════════════════
6. 📱 ESTRUTURA POR CANAL
═══════════════════════════════════════════════════════════════

   📱 WHATSAPP (máx 5 linhas):
   ─────────────────────────────
   • Linha 1: Saudação personalizada + emoji 👋
   • Linha 2: Insight específico sobre o negócio deles
   • Linha 3: Oportunidade/gap identificado
   • Linha 4: Proposta de valor rápida
   • Linha 5: CTA de baixo compromisso
   
   EXEMPLO WHATSAPP:
   "Bom dia, [nome]! 👋
   Analisei o setor de [nicho] em [cidade] e encontrei algo interessante.
   Empresas similares estão usando [estratégia] e gerando [resultado].
   Vi que a [empresa] ainda não explora isso.
   Vale 5 min para eu te mostrar?"

   ✉️ EMAIL (máx 150 palavras):
   ─────────────────────────────
   • Assunto: [Nome], + 6-8 palavras direto ao benefício
   • Saudação: "[Nome], tudo bem?" ou "Bom dia, [nome]!"
   • Abertura: Empatia + contexto do mercado
   • Corpo: Problema + insight + oportunidade
   • Fechamento: CTA claro e específico
   • Assinatura: Simples, profissional
   
   EXEMPLO EMAIL:
   Assunto: [Nome], achei algo sobre [nicho] em [cidade]
   
   [Nome], tudo bem?
   
   Estava analisando empresas de [nicho] na região e percebi que 
   a maioria enfrenta o mesmo desafio: [dor específica].
   
   O que chamou minha atenção na [empresa] é que [insight].
   Empresas similares que resolveram isso viram [resultado].
   
   Posso te enviar um diagnóstico rápido mostrando como?
   
   Abraço,
   [nome]

   📸 INSTAGRAM DM (máx 4 linhas):
   ─────────────────────────────
   • Linha 1: Saudação + referência ao conteúdo deles
   • Linha 2-3: Conexão com oportunidade
   • Linha 4: CTA leve
   • IMPORTANTE: Recomende pré-engajamento (curtir 2-3 posts antes)
   
   EXEMPLO INSTAGRAM:
   "Oi [nome]! 😊 Vi seu post sobre [tema] - curti a abordagem!
   Trabalho com [foco] e identifiquei algo que pode ajudar [nicho] como vocês.
   Posso mandar uma ideia rápida?"

═══════════════════════════════════════════════════════════════
6. 🎭 OBJEÇÕES E RESPOSTAS
═══════════════════════════════════════════════════════════════
   • Objeções: FRASES EXATAS que clientes dizem no dia a dia
   • Respostas com técnica: Validar → Reposicionar → Evidência → Próximo passo
   • Tom: empático, nunca defensivo
   
   EXEMPLO:
   Objeção: "Já trabalho com outra agência"
   Resposta: "Entendo, [nome]! Muitos clientes nossos também tinham. 
   O que mudou foi quando viram [benefício específico]. 
   Posso te mostrar em 10 min como funciona, sem compromisso?"

═══════════════════════════════════════════════════════════════
7. 📅 PROGRESSÃO DOS 7 DIAS (Tom Humanizado)
═══════════════════════════════════════════════════════════════
   
   • Dia 1: CONEXÃO + INSIGHT
     Saudação calorosa + dado específico que gera curiosidade
     "Bom dia, [nome]! Analisei [empresa] e achei algo interessante..."
   
   • Dia 2: EMPATIA + DOR
     "Sei que [nicho] enfrenta [desafio]..." - reconhece realidade
   
   • Dia 3: OPORTUNIDADE CLARA
     "Vi que empresas similares estão..." - benchmarking
   
   • Dia 4: VALOR TANGÍVEL
     Oferece framework/diagnóstico gratuito
   
   • Dia 5: PROVA SOCIAL
     Cita resultados ou tendências do setor
   
   • Dia 6: PARCERIA
     Tom de "vamos juntos", não de vendedor
   
   • Dia 7: DESPEDIDA ELEGANTE
     "[Nome], essa é minha última mensagem sobre isso.
     Fico à disposição quando fizer sentido para vocês. Abraço! 👋"

═══════════════════════════════════════════════════════════════
8. 📊 DIAGNÓSTICO CONSULTIVO (6-8 bullets)
═══════════════════════════════════════════════════════════════
   • Avaliação de maturidade digital real
   • Gaps críticos com impacto no negócio
   • Oportunidades específicas para o foco
   • Comparativo com mercado/concorrentes
   • Potencial de ROI estimado

═══════════════════════════════════════════════════════════════
🎯 LEMBRE-SE: VOCÊ É HUMANO, NÃO UM ROBÔ
═══════════════════════════════════════════════════════════════
Cada mensagem deve parecer escrita por uma PESSOA real que:
• Estudou o negócio do prospect
• Se importa genuinamente em ajudar
• Respeita o tempo e a inteligência do outro
• Oferece valor antes de pedir algo

Mensagens frias e robóticas = ignoradas.
Mensagens humanas e personalizadas = respondidas.`;
}

// =============================================================================
// US SYSTEM PROMPT - ENGLISH PROSPECTING FOR USA LEADS
// =============================================================================
function buildUSSystemPrompt(foco: string = ""): string {
  const isProfessional = foco === "servicos_profissionais" || foco === "Serviços Profissionais";
  
  const especialidade = isProfessional 
    ? `• B2B outreach, strategic partnerships, referral networks, and technical connections for professional service providers, consultants, lawyers, accountants, brokers, and real estate appraisers.
• Consultative, humanized approach focused on complementary utility, audience synergy, professional credibility, and long-term relationships.
• Absolute mastery of commercial prospecting via Email, LinkedIn, and Instagram without aggressive digital marketing language or direct pitches.`
    : `• B2B outreach for digital marketing agencies
• Consultative sales for Paid Ads, SEO, Social Media, Full Service, Automation, CRM, Websites/Landing, Design
• Multichannel prospecting mastery (Email, LinkedIn, Instagram)
• HUMANIZED copywriting that builds genuine connection`;

  return `You are an ELITE B2B SALES STRATEGIST AND COPYWRITER with 15+ years of experience.
Your mission: craft messages that make prospects STOP, READ, and RESPOND.

🏆 YOUR SPECIALTY:
${especialidade}

⚠️ CRITICAL LANGUAGE INSTRUCTIONS:
• ALL prospecting messages, CTAs, and responses → IN ENGLISH
• The diagnostic/analysis section → IN PORTUGUESE (the user reading it is Brazilian)
• Use American English conventions and casual business tone

═══════════════════════════════════════════════════════════════
📜 GOLDEN RULES (NON-NEGOTIABLE)
═══════════════════════════════════════════════════════════════

1. 🎯 ELEGANT & PERSONALIZED GREETINGS
   
   ✅ REQUIRED: Always start with SHORT, CONTEXTUALIZED greeting:
   
   IF contact_name available:
   • "Hey [name]! 👋" or "Hi [name],"
   • "[Name], noticed something about [niche]..."
   • "Hi [name]! Checked out [company] and..."
   
   IF contact_name NOT available:
   • "Hey there! Noticed [company]..."
   • "Hi [company] team! 👋"
   • "Hey team,"
   
   ❌ FORBIDDEN empty greetings:
   • "Hello!" (alone)
   • "To whom it may concern"
   • "Dear Sir/Madam"

2. 💬 HUMANIZED & EMPATHETIC TONE
   
   • Write like a REAL person, not a sales robot
   • Use "you" and "your business" - create personal connection
   • Show you've STUDIED their business
   • Be CURIOUS: ask questions that provoke thought
   • Acknowledge their reality before offering solutions
   
   EXAMPLE OF RIGHT TONE:
   "Hey Mike! 👋 Looked into the [niche] market in [city] and 
   noticed most face the same challenge: [pain point]. 
   Saw that [company] isn't leveraging [opportunity] yet. 
   Mind if I show you how to fix this in 5 min?"

3. 📝 SHARP COPY (but human)
   • SHORT, DIRECT sentences - max 20 words each
   • First CONNECT, then SELL
   • Every word must have purpose - cut the rest
   • Max 2 strategic emojis (👋 for greeting, ✅ for results)

4. 🚫 ABSOLUTE PROHIBITIONS
   ❌ NEVER invent names - only use contact_name if provided
   ❌ NEVER use clichés: "skyrocket", "game-changer", "crush it", "supercharge"
   ❌ NEVER promise miracles or absurd numbers
   ❌ NEVER be overly flattering or use generic praise
   ❌ NEVER start with "We're an agency..." or talk about yourself first
   ❌ NEVER invent or hallucinate missing information. Only use the provided data. If any information is missing, do not make it up. Generate a useful outreach plan based on the company's name, niche, and location. Do not state that the company does not have a website, Instagram, or campaigns unless that is explicitly stated in the lead data.

═══════════════════════════════════════════════════════════════
5. 🎯 SUGGESTED ACTION (REQUIRED FIELD)
═══════════════════════════════════════════════════════════════

   For EACH DAY, you MUST include an "acao_sugerida" (in Portuguese) that guides
   the user on HOW to execute the contact (format, preparation, etc.)

   ✉️ EMAIL - Possible actions:
   ─────────────────────────────
   • "Enviar email com ASSUNTO: [impactful subject line suggestion]"
   • "Enviar email com PDF de case em anexo"
   • "Enviar email com link de vídeo curto (Loom 2min)"
   
   📸 INSTAGRAM - Possible actions (PRE-ENGAGEMENT REQUIRED):
   ─────────────────────────────
   • "1) Curtir 2-3 posts recentes 2) Reagir a 1 story 3) Enviar DM com a mensagem"
   • "1) Comentar no último post com insight 2) Esperar 1h 3) Enviar DM"
   • "Reagir aos últimos 2 stories + enviar DM"

   🔗 LINKEDIN - Possible actions:
   ─────────────────────────────
   • "Enviar convite de conexão com nota personalizada"
   • "Enviar mensagem InMail com proposta de valor"
   • "Comentar em post recente + enviar mensagem"

═══════════════════════════════════════════════════════════════
6. 📱 STRUCTURE BY CHANNEL (ALL IN ENGLISH)
═══════════════════════════════════════════════════════════════

   ✉️ EMAIL (max 150 words):
   ─────────────────────────────
   • Subject: [Name], + 6-8 words direct to benefit
   • Greeting: "Hi [name]," or "Hey [name]!"
   • Opening: Empathy + market context
   • Body: Problem + insight + opportunity
   • Closing: Clear, specific CTA
   • Signature: Simple, professional
   
   EXAMPLE EMAIL:
   Subject: [Name], found something about [niche] in [city]
   
   Hi [name],
   
   Was researching [niche] companies in the area and noticed 
   most face the same challenge: [specific pain].
   
   What caught my attention about [company] is that [insight].
   Similar businesses that solved this saw [result].
   
   Mind if I send over a quick analysis showing how?
   
   Best,
   [signature]

   📸 INSTAGRAM DM (max 4 lines):
   ─────────────────────────────
   • Line 1: Greeting + reference to their content
   • Lines 2-3: Connection to opportunity
   • Line 4: Light CTA
   
   EXAMPLE:
   "Hey [name]! 😊 Loved your post about [topic]!
   I work with [focus] and spotted something that could help [niche] businesses like yours.
   Mind if I share a quick idea?"

═══════════════════════════════════════════════════════════════
7. 🎭 OBJECTIONS & RESPONSES (IN ENGLISH)
═══════════════════════════════════════════════════════════════
   • Objections: EXACT phrases clients say day-to-day
   • Responses with technique: Validate → Reframe → Evidence → Next step
   • Tone: empathetic, never defensive
   
   EXAMPLE:
   Objection: "We already work with another agency"
   Response: "Totally get it, [name]! Many of our clients did too. 
   What changed was when they saw [specific benefit]. 
   Mind if I show you how it works in 10 min, no strings attached?"

═══════════════════════════════════════════════════════════════
8. 📅 7-DAY PROGRESSION (Humanized Tone - ALL IN ENGLISH)
═══════════════════════════════════════════════════════════════
   
   • Day 1: CONNECTION + INSIGHT
     Warm greeting + specific data that sparks curiosity
     "Hey [name]! Looked into [company] and found something interesting..."
   
   • Day 2: EMPATHY + PAIN
     "I know [niche] businesses often deal with [challenge]..." - acknowledge reality
   
   • Day 3: CLEAR OPPORTUNITY
     "Noticed similar companies are..." - benchmarking
   
   • Day 4: TANGIBLE VALUE
     Offer framework/free diagnosis
   
   • Day 5: SOCIAL PROOF
     Cite results or industry trends
   
   • Day 6: PARTNERSHIP
     "Let's figure this out together" tone, not salesy
   
   • Day 7: ELEGANT FAREWELL
     "[Name], this is my last message on this.
     I'm here whenever it makes sense for you. Take care! 👋"

═══════════════════════════════════════════════════════════════
9. 📊 DIAGNOSTIC (6-8 bullets - IN PORTUGUESE!)
═══════════════════════════════════════════════════════════════
   ⚠️ THIS SECTION ONLY → Write in Portuguese
   The Brazilian user needs to understand the analysis
   
   • Avaliação de maturidade digital
   • Gaps críticos identificados
   • Oportunidades específicas para o foco
   • Comparativo com mercado americano
   • Potencial de ROI estimado

═══════════════════════════════════════════════════════════════
🎯 REMEMBER: YOU'RE HUMAN, NOT A ROBOT
═══════════════════════════════════════════════════════════════
Every message should feel written by a REAL person who:
• Studied the prospect's business
• Genuinely cares about helping
• Respects their time and intelligence
• Offers value before asking for anything

Cold, robotic messages = ignored.
Human, personalized messages = answered.

⚠️ FINAL REMINDER:
• Prospecting plan (messages, CTAs, objections, responses) → ALL IN ENGLISH
• Diagnostic bullets → IN PORTUGUESE`;
}

// =============================================================================
// BIBLIOTECA DE NICHOS COM EXEMPLOS ESPECÍFICOS
// =============================================================================
interface NichoContext {
  dor_principal: string;
  dor_secundaria: string;
  ganho_principal: string;
  metrica_chave: string;
  exemplo_whatsapp: string;
  exemplo_email: string;
  exemplo_instagram: string;
  objecoes: { objecao: string; resposta: string }[];
  jargoes: string[];
}

const NICHO_DATABASE: Record<string, NichoContext> = {
  // ═══════════════════════════════════════
  // SAÚDE & ESTÉTICA
  // ═══════════════════════════════════════
  "clinica_estetica": {
    dor_principal: "agenda com buracos e dependência de indicação boca-a-boca",
    dor_secundaria: "concorrência com clínicas que fazem promoção de procedimentos",
    ganho_principal: "agenda lotada de procedimentos de alto ticket (harmonização, lipo, skincare)",
    metrica_chave: "taxa de ocupação da agenda e ticket médio",
    exemplo_whatsapp: `Bom dia, [nome]! 👋 
Vi que a [empresa] trabalha com estética em [cidade].
Muitas clínicas aqui estão usando tráfego pago para lotar a agenda de harmonização e lipo.
Reparei que vocês ainda não exploram isso.
Posso te mostrar como funciona em 5 min?`,
    exemplo_email: `Assunto: [Nome], agenda de estética em [cidade]

[Nome], tudo bem?

Analisei clínicas de estética em [cidade] e percebi um padrão: as que investem em anúncios online lotam agenda de lipo, harmonização e skincare.
As que não investem dependem de indicação e têm buracos na agenda.

Vi que a [empresa] ainda não explora isso. Posso te enviar um diagnóstico gratuito?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi seu antes/depois de harmonização - resultado incrível!
Trabalho ajudando clínicas a lotar agenda com pacientes de alto ticket.
Posso te mandar uma ideia rápida?`,
    objecoes: [
      { objecao: "Minha agenda já é cheia por indicação", resposta: "Ótimo sinal de qualidade! Mas indicação é imprevisível - você não controla quantos pacientes entram por semana. Com tráfego, você decide: 'quero 10 agendamentos de harmonização essa semana'. Posso mostrar como funciona?" },
      { objecao: "Meu público é mais velho, não usa internet", resposta: "Interessante - e onde esse público pesquisa quando quer fazer um procedimento estético? Google. 78% das pessoas de 40+ buscam 'clínica de estética perto de mim' antes de agendar. Posso mostrar como aparecer primeiro?" }
    ],
    jargoes: ["ticket médio", "recorrência", "protocolos", "agenda lotada", "procedimento de alto valor"]
  },

  "dentista": {
    dor_principal: "agenda vazia às segundas e horários ociosos à tarde",
    dor_secundaria: "pacientes que somem depois do orçamento por causa do preço",
    ganho_principal: "pacientes novos toda semana para implantes e harmonização facial",
    metrica_chave: "taxa de conversão de orçamento e novos pacientes/mês",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei consultórios odontológicos em [cidade] e percebi algo.
Muitos dentistas têm agenda vazia às segundas e horários ociosos.
A [empresa] está captando pacientes novos toda semana ou depende de indicação?
Posso mostrar como resolver isso em 5 min?`,
    exemplo_email: `Assunto: [Nome], agenda de implantes em [cidade]

[Nome], tudo bem?

Consultórios que dependem só de indicação têm um problema: não controlam quantos pacientes novos entram por mês.

Vi que a [empresa] pode estar perdendo pacientes de implante e harmonização para concorrentes que aparecem primeiro no Google.

Posso te mostrar como mudar isso?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi que vocês fazem harmonização - área que está explodindo!
Ajudo dentistas a lotar agenda de implantes e harmô sem depender de indicação.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Paciente de implante vem por indicação", resposta: "Verdade, indicação é o melhor canal. Mas você controla quantas indicações recebe por mês? Com tráfego pago, você decide: 'quero 5 orçamentos de implante essa semana'. Posso mostrar como funciona sem compromisso?" },
      { objecao: "Já fiz Google Ads e não deu certo", resposta: "Entendo - infelizmente muitas campanhas são mal configuradas. O segredo está na página de destino e no follow-up. Posso analisar o que pode ter dado errado e mostrar a estratégia correta?" }
    ],
    jargoes: ["conversão de orçamento", "ticket médio de implante", "recorrência", "harmô", "pacientes qualificados"]
  },

  "psicologo": {
    dor_principal: "dificuldade em lotar agenda de sessões particulares",
    dor_secundaria: "pacientes que abandonam terapia após poucas sessões",
    ganho_principal: "agenda cheia de pacientes particulares com recorrência mensal",
    metrica_chave: "taxa de retenção e novos pacientes/mês",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Vi que você atende em [cidade] como psicóloga.
Muitos psicólogos dependem de plano de saúde e têm agenda vazia no particular.
Consegue lotar agenda só com pacientes particulares ou ainda depende de convênio?
Posso mostrar uma estratégia em 5 min?`,
    exemplo_email: `Assunto: [Nome], pacientes particulares em [cidade]

[Nome], tudo bem?

A maioria dos psicólogos depende de convênio e tem horários vagos no particular.
Mas existe uma estratégia para atrair pacientes que buscam atendimento de qualidade e pagam bem.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi seu conteúdo sobre ansiedade - muito relevante!
Ajudo psicólogos a lotar agenda de particulares sem depender de convênio.
Posso mandar uma ideia rápida?`,
    objecoes: [
      { objecao: "Meus pacientes vêm por indicação", resposta: "Indicação é ótimo sinal de competência! Mas você consegue prever quantos novos pacientes terá mês que vem? Com uma estratégia de conteúdo + anúncios, você atrai pessoas que já estão buscando ajuda. Posso mostrar?" },
      { objecao: "Não gosto de me expor nas redes", resposta: "Entendo perfeitamente. A boa notícia: dá pra atrair pacientes sem dançar no TikTok. Usamos conteúdo educativo + Google Ads para quem já está buscando. Posso mostrar essa abordagem mais discreta?" }
    ],
    jargoes: ["recorrência mensal", "pacientes particulares", "taxa de retenção", "agenda lotada"]
  },

  "veterinario": {
    dor_principal: "dependência de emergências e baixa recorrência de consultas preventivas",
    dor_secundaria: "tutores que só aparecem quando o pet está doente",
    ganho_principal: "agenda cheia de consultas preventivas e pacotes de acompanhamento",
    metrica_chave: "recorrência de clientes e ticket médio por pet",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei clínicas veterinárias em [cidade] e vi um padrão.
A maioria depende de emergências e perde faturamento por não ter recorrência.
A [empresa] já trabalha com pacotes de acompanhamento ou planos de saúde pet?
Posso mostrar como implementar?`,
    exemplo_email: `Assunto: [Nome], recorrência na clínica veterinária

[Nome], tudo bem?

Clínicas que dependem só de emergências têm faturamento imprevisível.
Mas dá pra criar recorrência com pacotes de acompanhamento e planos de saúde pet.

Posso te mostrar como outras clínicas em [cidade] estão fazendo isso?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi as fotos dos pets que vocês atendem - fofura demais!
Ajudo clínicas a criar recorrência com planos de saúde pet.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Tutor não paga plano de saúde pra pet", resposta: "Entendo a preocupação. Mas 62% dos tutores consideram o pet um membro da família. Com a comunicação certa, eles veem o plano como proteção, não gasto. Posso mostrar como apresentar?" },
      { objecao: "Já tenho clientes fiéis", resposta: "Ótimo! E você sabe quantos deles têm outros pets que não trazem pra você? Com uma estratégia de retenção, você atende toda a família e aumenta ticket. Posso mostrar como?" }
    ],
    jargoes: ["recorrência", "ticket médio", "plano de saúde pet", "consulta preventiva"]
  },

  // ═══════════════════════════════════════
  // SERVIÇOS PROFISSIONAIS
  // ═══════════════════════════════════════
  "advocacia": {
    dor_principal: "dependência de indicação e dificuldade em captar clientes corporativos",
    dor_secundaria: "precificação por hora que limita faturamento",
    ganho_principal: "fluxo previsível de consultas qualificadas em sua área de especialidade",
    metrica_chave: "leads qualificados por mês e taxa de conversão",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Vi que o escritório atua em [cidade] na área de [especialidade].
Muitos advogados dependem de indicação e têm meses imprevisíveis.
Vocês conseguem prever quantos clientes novos entram por mês?
Posso mostrar uma estratégia em 5 min?`,
    exemplo_email: `Assunto: [Nome], captação de clientes para o escritório

[Nome], tudo bem?

A maioria dos escritórios depende de indicação - o que significa faturamento imprevisível.
Mas existe uma estratégia para atrair clientes que já estão buscando advogado na sua área.

Posso te mostrar como funciona para escritórios de [cidade]?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi seu conteúdo sobre [área jurídica] - muito didático!
Ajudo advogados a captar clientes qualificados sem depender só de indicação.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Cliente de advocacia vem por indicação", resposta: "Indicação é o melhor canal, concordo. Mas você controla quantas indicações recebe por mês? Com uma estratégia de Google Ads, você atrai quem já está buscando advogado na sua área. Posso mostrar?" },
      { objecao: "OAB tem restrições de publicidade", resposta: "Verdade, e respeitamos 100%. A estratégia que usamos é educativa - conteúdo que posiciona você como autoridade, não anúncio de 'advogado barato'. Posso mostrar exemplos que funcionam dentro das regras?" }
    ],
    jargoes: ["leads qualificados", "taxa de conversão", "autoridade na área", "posicionamento"]
  },

  "contabilidade": {
    dor_principal: "clientes que pedem desconto e veem contabilidade como custo",
    dor_secundaria: "dificuldade em vender serviços consultivos além do básico",
    ganho_principal: "carteira de clientes que valorizam consultoria e pagam ticket maior",
    metrica_chave: "ticket médio e retenção de clientes",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei escritórios de contabilidade em [cidade].
A maioria reclama que cliente só quer preço baixo e não valoriza o serviço.
Vocês conseguem vender consultoria além do básico ou ficam presos no honorário mínimo?
Posso mostrar como mudar isso?`,
    exemplo_email: `Assunto: [Nome], ticket maior na contabilidade

[Nome], tudo bem?

O maior desafio dos contadores: cliente que compara preço e não vê valor.
Mas existe uma estratégia para atrair empresas que buscam consultoria, não só obrigações.

Posso te mostrar como outros escritórios em [cidade] estão aumentando ticket?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi seu conteúdo sobre impostos - super didático!
Ajudo contadores a atrair clientes que pagam bem por consultoria.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Empresário só quer pagar barato", resposta: "Entendo a frustração. Mas existe um perfil de empresário que quer conselho, não só guias. O segredo está na comunicação - mostrar que você resolve problemas, não só cumpre obrigações. Posso mostrar como atrair esse perfil?" },
      { objecao: "Mercado está saturado", resposta: "Concordo que tem muito contador. Mas poucos se posicionam como consultores. Quando você muda a comunicação de 'abro empresas' para 'ajudo empresas a pagar menos impostos legalmente', atrai outro público. Posso mostrar?" }
    ],
    jargoes: ["ticket médio", "serviços consultivos", "retenção", "carteira qualificada"]
  },

  "imobiliaria": {
    dor_principal: "leads frios que somem depois da visita ao imóvel",
    dor_secundaria: "corretores que dependem de plantão e não têm carteira própria",
    ganho_principal: "fluxo constante de leads qualificados prontos para comprar/alugar",
    metrica_chave: "taxa de conversão de visita e ciclo de venda",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Vi que a [empresa] atua no mercado imobiliário de [cidade].
Muitas imobiliárias reclamam: lead entra, faz visita, some.
Vocês conseguem converter quantos % dos leads que entram?
Posso mostrar como melhorar isso em 5 min?`,
    exemplo_email: `Assunto: [Nome], conversão de leads imobiliários

[Nome], tudo bem?

O maior desafio do mercado imobiliário: leads que fazem visita e desaparecem.
Mas existe uma estratégia de follow-up que aumenta conversão em até 40%.

Posso te mostrar como funciona para imobiliárias de [cidade]?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os imóveis que vocês trabalham em [cidade] - carteira bonita!
Ajudo imobiliárias a converter mais leads em vendas.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Lead imobiliário é muito frio", resposta: "Verdade, a maioria está só pesquisando. Mas você sabe quem está pronto pra comprar? Com um sistema de qualificação, você identifica os 20% que estão prontos e foca energia neles. Posso mostrar como?" },
      { objecao: "Corretor não segue processo", resposta: "Entendo - é o maior desafio da gestão. Por isso usamos automação: o sistema faz follow-up mesmo que o corretor esqueça. Posso mostrar como funciona?" }
    ],
    jargoes: ["taxa de conversão", "lead qualificado", "ciclo de venda", "follow-up", "fechamento"]
  },

  // ═══════════════════════════════════════
  // FITNESS & ACADEMIAS
  // ═══════════════════════════════════════
  "academia": {
    dor_principal: "alta taxa de cancelamento e sazonalidade (verão lotado, inverno vazio)",
    dor_secundaria: "dificuldade em vender planos anuais em vez de mensais",
    ganho_principal: "retenção alta e fluxo constante de novos alunos o ano todo",
    metrica_chave: "taxa de retenção e novos alunos/mês",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei academias em [cidade] e vi um padrão.
A maioria lota em janeiro e esvazia em abril.
A [empresa] consegue manter retenção alta o ano todo?
Posso mostrar como resolver isso?`,
    exemplo_email: `Assunto: [Nome], retenção na academia

[Nome], tudo bem?

O maior desafio das academias: aluno entra em janeiro, cancela em março.
Mas existe uma estratégia de engajamento que mantém retenção acima de 80%.

Posso te mostrar como funciona para academias de [cidade]?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os treinos que vocês postam - estrutura top!
Ajudo academias a manter retenção alta o ano todo.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Aluno cancela porque é preguiçoso", resposta: "Entendo a frustração. Mas academias com alta retenção não dependem da motivação do aluno - elas criam sistemas de engajamento. App de treino, desafios, comunidade. Posso mostrar como implementar?" },
      { objecao: "Concorrência de preço é muito forte", resposta: "Verdade, low cost cresceu muito. Mas você não compete com eles em preço - compete em experiência. O segredo está em atrair quem busca resultado, não quem busca barato. Posso mostrar como?" }
    ],
    jargoes: ["taxa de retenção", "churn", "plano anual", "engajamento", "LTV"]
  },

  "personal": {
    dor_principal: "agenda que depende de poucos clientes que podem cancelar a qualquer momento",
    dor_secundaria: "dificuldade em cobrar mais caro sem perder alunos",
    ganho_principal: "carteira diversificada de clientes que valorizam seu trabalho",
    metrica_chave: "ticket médio e recorrência",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Vi que você atua como personal trainer em [cidade].
A maioria dos personais depende de 5-10 clientes - se 2 cancelam, o mês quebra.
Você consegue atrair clientes novos toda semana ou depende de indicação?
Posso mostrar uma estratégia em 5 min?`,
    exemplo_email: `Assunto: [Nome], carteira de clientes de personal

[Nome], tudo bem?

O maior risco do personal: depender de poucos clientes.
Mas existe uma estratégia para atrair clientes de alto ticket que valorizam seu trabalho.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os resultados dos seus alunos - transformações incríveis!
Ajudo personais a atrair clientes que pagam bem.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Meus clientes vêm por indicação", resposta: "Indicação é o melhor canal! Mas você controla quantas indicações recebe por mês? Com uma estratégia de conteúdo, você atrai quem já está buscando personal e não conhece ninguém. Posso mostrar?" },
      { objecao: "Personal é muito caro pra maioria", resposta: "Verdade pra maioria. Mas existe um público que quer resultado e paga bem por isso. O segredo está em atrair esse público certo. Posso mostrar como?" }
    ],
    jargoes: ["ticket médio", "recorrência", "carteira diversificada", "resultado"]
  },

  // ═══════════════════════════════════════
  // ALIMENTAÇÃO
  // ═══════════════════════════════════════
  "restaurante": {
    dor_principal: "movimento concentrado no fim de semana e mesas vazias durante a semana",
    dor_secundaria: "dependência de apps de delivery que cobram 30% de comissão",
    ganho_principal: "casa cheia todos os dias e delivery próprio com margem saudável",
    metrica_chave: "ticket médio e fluxo por dia da semana",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei restaurantes em [cidade] e vi um padrão.
A maioria lota sexta e sábado, mas fica vazio terça e quarta.
A [empresa] consegue manter movimento durante a semana?
Posso mostrar como resolver isso?`,
    exemplo_email: `Assunto: [Nome], movimento durante a semana

[Nome], tudo bem?

O maior desafio dos restaurantes: fim de semana lotado, semana vazia.
Mas existe uma estratégia para atrair clientes nos dias mais fracos.

Posso te mostrar como funciona para restaurantes de [cidade]?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os pratos que vocês postam - deu água na boca!
Ajudo restaurantes a lotar durante a semana, não só fim de semana.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Meu movimento já é bom", resposta: "Ótimo sinal! E durante a semana, como está? A maioria dos restaurantes perde dinheiro terça e quarta. Se você já está bem nesses dias, parabéns - é exceção. Se não, posso mostrar como melhorar?" },
      { objecao: "iFood já traz pedidos", resposta: "Traz, mas quanto você paga de comissão? 30%? Com delivery próprio e uma base de clientes, você paga 0% e ainda fideliza. Posso mostrar como montar?" }
    ],
    jargoes: ["ticket médio", "giro de mesas", "delivery próprio", "fidelização"]
  },

  "pizzaria": {
    dor_principal: "guerra de preço com concorrentes e dependência de promoção",
    dor_secundaria: "comissões altas de apps de delivery",
    ganho_principal: "clientes fiéis que pedem direto sem precisar de desconto",
    metrica_chave: "pedidos diretos vs apps e ticket médio",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei pizzarias em [cidade] e percebi algo.
A maioria compete por preço e perde margem no iFood.
A [empresa] consegue ter pedidos diretos ou depende muito dos apps?
Posso mostrar como mudar isso?`,
    exemplo_email: `Assunto: [Nome], pedidos diretos na pizzaria

[Nome], tudo bem?

Pizzarias que dependem de iFood pagam 30% de comissão.
Mas existe uma estratégia para ter base própria de clientes que pedem direto.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi as pizzas que vocês postam - massa linda!
Ajudo pizzarias a ter mais pedidos diretos e depender menos de apps.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Preciso do iFood pra ter movimento", resposta: "Entendo - o app traz visibilidade. Mas cada pedido do iFood, você paga 30%. Se você converter esses clientes pra pedir direto, a margem muda completamente. Posso mostrar como fazer essa conversão?" },
      { objecao: "Cliente só quer promoção", resposta: "Alguns sim. Mas existe um público que quer qualidade e conveniência, não só preço. O segredo está em atrair esse público certo com a comunicação certa. Posso mostrar?" }
    ],
    jargoes: ["pedido direto", "margem", "fidelização", "ticket médio", "recorrência"]
  },

  "confeitaria": {
    dor_principal: "demanda concentrada em datas comemorativas e meses parados",
    dor_secundaria: "dificuldade em mostrar valor para cobrar mais caro",
    ganho_principal: "encomendas constantes o ano todo e clientes que pagam pelo diferencial",
    metrica_chave: "encomendas/mês e ticket médio",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Vi que a [empresa] trabalha com confeitaria em [cidade].
A maioria das confeiteiras lota em Páscoa e Natal, mas fica parada no resto do ano.
Você consegue ter encomendas constantes?
Posso mostrar uma estratégia?`,
    exemplo_email: `Assunto: [Nome], encomendas o ano todo

[Nome], tudo bem?

O maior desafio das confeitarias: datas comemorativas lotam, resto do ano esvazia.
Mas existe uma estratégia para ter fluxo constante de encomendas.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os bolos que você posta - arte pura!
Ajudo confeitarias a ter encomendas o ano todo, não só em datas.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Meu produto é mais caro que mercado", resposta: "E deve ser mesmo! Você faz arte, não bolo de supermercado. O desafio é atrair quem valoriza isso. Com a comunicação certa, você atrai clientes que pagam pelo diferencial. Posso mostrar como?" },
      { objecao: "Cliente pede muito desconto", resposta: "Alguns sim. Mas você quer trabalhar pra quem não valoriza seu trabalho? Com posicionamento certo, você atrai quem paga bem. Posso mostrar como?" }
    ],
    jargoes: ["encomendas", "ticket médio", "posicionamento premium", "diferencial"]
  },

  // ═══════════════════════════════════════
  // COMÉRCIO
  // ═══════════════════════════════════════
  "loja_roupas": {
    dor_principal: "estoque parado e dificuldade em competir com e-commerce",
    dor_secundaria: "clientes que olham na loja e compram online mais barato",
    ganho_principal: "clientes fiéis que voltam todo mês e indicam amigos",
    metrica_chave: "giro de estoque e recorrência de clientes",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei lojas de roupa em [cidade] e vi um padrão.
A maioria reclama de estoque parado e concorrência online.
A [empresa] consegue girar estoque rápido ou tem peças há meses?
Posso mostrar uma estratégia?`,
    exemplo_email: `Assunto: [Nome], giro de estoque da loja

[Nome], tudo bem?

Lojas físicas que competem só em preço perdem pra online.
Mas lojas que criam experiência e relacionamento vendem mais caro e giram estoque.

Posso te mostrar como funciona para lojas de [cidade]?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os looks que vocês postam - estilo incrível!
Ajudo lojas a girar estoque e fidelizar clientes.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Cliente compara preço com online", resposta: "Alguns sim. Mas você oferece algo que a internet não tem: experimentar, tocar, ter consultoria. O segredo está em destacar esses diferenciais. Posso mostrar como comunicar isso?" },
      { objecao: "Loja física está morrendo", resposta: "Loja genérica sim. Mas loja com experiência e comunidade está crescendo. As pessoas querem conexão, não só produto. Posso mostrar como criar isso?" }
    ],
    jargoes: ["giro de estoque", "recorrência", "ticket médio", "experiência de compra"]
  },

  "petshop": {
    dor_principal: "concorrência de preço com grandes redes e e-commerce",
    dor_secundaria: "dificuldade em fidelizar além do banho e tosa",
    ganho_principal: "clientes que compram de tudo e voltam toda semana",
    metrica_chave: "ticket médio e frequência de visita",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei petshops em [cidade] e percebi algo.
A maioria vende banho e ração, mas perde pro preço da internet.
A [empresa] consegue vender acessórios, brinquedos, produtos premium?
Posso mostrar como aumentar ticket?`,
    exemplo_email: `Assunto: [Nome], ticket médio do petshop

[Nome], tudo bem?

Petshops que vendem só banho e ração competem em preço.
Mas petshops que vendem experiência e consultoria cobram mais e fidelizam.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os pets que passam por vocês - fofura demais!
Ajudo petshops a aumentar ticket e fidelizar tutores.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Cliente compara preço com Cobasi", resposta: "Alguns sim. Mas você oferece algo que rede grande não tem: atendimento personalizado, conhecer o pet pelo nome, recomendação certeira. O segredo está em destacar isso. Posso mostrar como?" },
      { objecao: "Banho e tosa já dá trabalho demais", resposta: "Entendo - serviço é puxado. Mas e se você vendesse mais produtos sem aumentar mão de obra? Com uma estratégia de venda consultiva, você aumenta ticket sem mais trabalho. Posso mostrar?" }
    ],
    jargoes: ["ticket médio", "recorrência", "venda consultiva", "fidelização"]
  },

  // ═══════════════════════════════════════
  // BELEZA
  // ═══════════════════════════════════════
  "salao_beleza": {
    dor_principal: "agenda com buracos e dependência de promoção para atrair clientes",
    dor_secundaria: "profissionais que levam clientes quando saem",
    ganho_principal: "agenda lotada com clientes que voltam todo mês",
    metrica_chave: "taxa de retorno e ticket médio",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei salões de beleza em [cidade] e vi um padrão.
A maioria depende de promoção pra lotar - o que corrói margem.
A [empresa] consegue lotar agenda sem desconto?
Posso mostrar como?`,
    exemplo_email: `Assunto: [Nome], agenda lotada sem promoção

[Nome], tudo bem?

Salões que dependem de promoção atraem clientes de preço, não de valor.
Mas existe uma estratégia para lotar agenda com clientes que pagam bem.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os trabalhos que vocês postam - técnica impecável!
Ajudo salões a lotar agenda sem depender de promoção.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Concorrência de preço é muito forte", resposta: "Verdade, tem muito salão barato. Mas você não quer competir com eles - quer atrair quem paga por qualidade. O segredo está no posicionamento. Posso mostrar como atrair esse público?" },
      { objecao: "Profissional boa sai e leva clientes", resposta: "Infelizmente acontece. Por isso é importante a marca do salão ser mais forte que a marca do profissional. Posso mostrar como construir isso?" }
    ],
    jargoes: ["taxa de retorno", "ticket médio", "agenda lotada", "posicionamento"]
  },

  "barbearia": {
    dor_principal: "cliente que vai em qualquer barbearia e não tem fidelidade",
    dor_secundaria: "dificuldade em vender serviços além do corte básico",
    ganho_principal: "clientes fiéis que cortam todo mês e indicam amigos",
    metrica_chave: "frequência de retorno e serviços adicionais/cliente",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei barbearias em [cidade] e percebi algo.
A maioria tem clientes que vão em qualquer lugar - sem fidelidade.
A [empresa] consegue ter clientes que voltam todo mês certinho?
Posso mostrar como criar isso?`,
    exemplo_email: `Assunto: [Nome], clientes fiéis na barbearia

[Nome], tudo bem?

Barbearias que vendem só corte competem em preço.
Mas barbearias que criam experiência e comunidade têm clientes fiéis.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os cortes que vocês postam - nível premium!
Ajudo barbearias a criar clientes fiéis que voltam todo mês.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Homem vai onde é mais perto", resposta: "Alguns sim. Mas existe um público que quer experiência, não só corte. Cerveja, papo, ambiente. O segredo está em atrair esse público. Posso mostrar como?" },
      { objecao: "Já tenho bastante movimento", resposta: "Ótimo! E você consegue vender barba, produtos, assinatura? Muitas barbearias aumentam 40% o faturamento sem aumentar cadeiras. Posso mostrar como?" }
    ],
    jargoes: ["recorrência", "ticket médio", "experiência", "comunidade", "assinatura"]
  },

  // ═══════════════════════════════════════
  // EDUCAÇÃO
  // ═══════════════════════════════════════
  "escola_idiomas": {
    dor_principal: "alta taxa de desistência após 3-6 meses",
    dor_secundaria: "concorrência de apps gratuitos e cursos online baratos",
    ganho_principal: "alunos que completam o curso e indicam amigos",
    metrica_chave: "taxa de retenção e NPS",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei escolas de idiomas em [cidade] e vi um padrão.
A maioria perde alunos depois de 3-6 meses - antes de fluência.
A [empresa] consegue manter alunos até o final?
Posso mostrar como melhorar retenção?`,
    exemplo_email: `Assunto: [Nome], retenção de alunos de idiomas

[Nome], tudo bem?

O maior desafio das escolas: aluno entra motivado, desiste em 6 meses.
Mas existe uma estratégia de engajamento que mantém alunos até a fluência.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi que vocês trabalham com [idioma] em [cidade]!
Ajudo escolas a manter alunos até a fluência, não só matricular.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Aluno desiste porque não tem tempo", resposta: "Verdade, tempo é desafio. Mas escolas com alta retenção criam sistemas que cabem na rotina do aluno. App, microaulas, acompanhamento. Posso mostrar como implementar?" },
      { objecao: "Duolingo é de graça", resposta: "É sim, e 95% desiste em 3 meses. Seu diferencial é o acompanhamento humano, a correção personalizada, a comunidade. O segredo está em destacar isso. Posso mostrar como?" }
    ],
    jargoes: ["taxa de retenção", "LTV", "NPS", "engajamento", "fluência"]
  },

  "curso_profissionalizante": {
    dor_principal: "alunos que não completam o curso ou não conseguem emprego depois",
    dor_secundaria: "concorrência de cursos online gratuitos",
    ganho_principal: "alunos empregados que indicam a escola como diferencial na carreira",
    metrica_chave: "taxa de conclusão e empregabilidade",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei cursos profissionalizantes em [cidade] e percebi algo.
Muitos alunos se matriculam, mas não completam ou não conseguem emprego.
A [empresa] acompanha empregabilidade dos formandos?
Posso mostrar uma estratégia?`,
    exemplo_email: `Assunto: [Nome], empregabilidade dos alunos

[Nome], tudo bem?

O maior diferencial de um curso: aluno empregado que indica.
Mas a maioria das escolas não acompanha isso.

Posso te mostrar como criar um sistema de empregabilidade que vira marketing?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi que vocês formam profissionais em [área]!
Ajudo cursos a ter alunos empregados que viram cases de sucesso.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Mercado de trabalho está difícil", resposta: "Verdade, mas isso é ainda mais motivo pra você se diferenciar. Cursos que entregam empregabilidade se destacam. Posso mostrar como criar parcerias com empresas?" },
      { objecao: "YouTube ensina de graça", resposta: "Ensina, mas não dá certificado, não acompanha, não coloca no mercado. Seu diferencial é o caminho completo. Posso mostrar como comunicar isso?" }
    ],
    jargoes: ["empregabilidade", "taxa de conclusão", "cases de sucesso", "parceria empresas"]
  },

  // ═══════════════════════════════════════
  // AUTOMOTIVO
  // ═══════════════════════════════════════
  "oficina_mecanica": {
    dor_principal: "cliente que só aparece quando quebra e não faz manutenção preventiva",
    dor_secundaria: "desconfiança do cliente sobre serviços 'desnecessários'",
    ganho_principal: "clientes recorrentes que fazem manutenção regular e indicam",
    metrica_chave: "recorrência e ticket médio",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei oficinas mecânicas em [cidade] e vi um padrão.
A maioria depende de emergência - cliente só aparece quando quebra.
A [empresa] consegue ter clientes de manutenção preventiva?
Posso mostrar como criar recorrência?`,
    exemplo_email: `Assunto: [Nome], recorrência na oficina

[Nome], tudo bem?

Oficinas que dependem de emergência têm faturamento imprevisível.
Mas existe uma estratégia para criar recorrência com manutenção preventiva.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os serviços que vocês fazem - trabalho caprichado!
Ajudo oficinas a ter clientes recorrentes, não só emergências.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Cliente não quer gastar com prevenção", resposta: "Alguns não. Mas quando você mostra quanto custa o conserto vs quanto custa a prevenção, muitos mudam de ideia. O segredo está na comunicação. Posso mostrar como?" },
      { objecao: "Mercado muito informal", resposta: "Verdade, tem muita oficina de fundo de quintal. Mas você pode se posicionar como premium - cliente que quer qualidade paga mais. Posso mostrar como atrair esse público?" }
    ],
    jargoes: ["recorrência", "manutenção preventiva", "ticket médio", "confiança"]
  },

  "lava_jato": {
    dor_principal: "demanda concentrada no fim de semana e capacidade ociosa na semana",
    dor_secundaria: "concorrência de preço e guerra de promoção",
    ganho_principal: "clientes com plano mensal que vêm regularmente",
    metrica_chave: "assinaturas ativas e frequência",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei lava-jatos em [cidade] e percebi algo.
A maioria lota sábado e fica vazio segunda a quinta.
A [empresa] consegue ter movimento durante a semana?
Posso mostrar uma estratégia?`,
    exemplo_email: `Assunto: [Nome], movimento durante a semana

[Nome], tudo bem?

Lava-jatos que dependem de fim de semana têm capacidade ociosa.
Mas existe uma estratégia de assinatura mensal que garante fluxo constante.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os carros que vocês cuidam - acabamento impecável!
Ajudo lava-jatos a ter movimento o dia todo com assinaturas.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Cliente só quer promoção", resposta: "Alguns sim. Mas existe um público que quer praticidade - lavar toda semana sem pensar. Com assinatura, você atrai esse público e garante receita previsível. Posso mostrar como?" },
      { objecao: "Lava-jato é commodity", resposta: "Básico sim. Mas você pode se diferenciar: higienização interna, proteção de pintura, serviços premium. Posso mostrar como posicionar?" }
    ],
    jargoes: ["assinatura mensal", "recorrência", "ticket médio", "capacidade ociosa"]
  }
};

function getNichoExamples(nicho: string): NichoContext | null {
  const nichoLower = nicho.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Direct match first
  const patterns: Record<string, string[]> = {
    "clinica_estetica": ["clinica de estetica", "estetica", "clinica estetica", "estetica facial", "harmonizacao", "estetica corporal"],
    "dentista": ["dentista", "odontologia", "odonto", "clinica odontologica", "consultorio odontologico", "clinica dentaria"],
    "psicologo": ["psicologo", "psicologia", "psicologa", "terapeuta", "terapia", "consultorio psicologico"],
    "veterinario": ["veterinario", "clinica veterinaria", "pet care", "hospital veterinario", "vet"],
    "advocacia": ["advocacia", "advogado", "escritorio de advocacia", "advogados", "juridico"],
    "contabilidade": ["contabilidade", "contador", "escritorio contabil", "contadores"],
    "imobiliaria": ["imobiliaria", "corretor", "imobiliarias", "corretor de imoveis"],
    "academia": ["academia", "fitness", "musculacao", "treino"],
    "personal": ["personal", "personal trainer", "treinador pessoal"],
    "restaurante": ["restaurante", "gastronomia", "self service", "buffet"],
    "pizzaria": ["pizzaria", "pizza", "pizzas"],
    "confeitaria": ["confeitaria", "confeiteira", "bolos", "doces", "cake designer"],
    "loja_roupas": ["loja de roupas", "moda", "boutique", "vestuario", "roupa feminina", "roupa masculina"],
    "petshop": ["petshop", "pet shop", "loja de pet", "agropet"],
    "salao_beleza": ["salao de beleza", "salao", "cabeleireiro", "hair", "cabelos"],
    "barbearia": ["barbearia", "barbeiro", "barber", "barba"],
    "escola_idiomas": ["escola de idiomas", "ingles", "idiomas", "espanhol", "curso de ingles"],
    "curso_profissionalizante": ["curso profissionalizante", "curso tecnico", "escola tecnica", "formacao profissional"],
    "oficina_mecanica": ["oficina mecanica", "mecanica", "oficina", "mecanico", "auto center"],
    "lava_jato": ["lava jato", "lavajato", "lavagem", "lava car", "lava rapido"]
  };
  
  // Find best match
  for (const [key, keywords] of Object.entries(patterns)) {
    for (const keyword of keywords) {
      if (nichoLower.includes(keyword)) {
        return NICHO_DATABASE[key] || null;
      }
    }
  }
  
  // Partial match fallback
  for (const [key, context] of Object.entries(NICHO_DATABASE)) {
    const keyNormalized = key.replace(/_/g, " ");
    if (nichoLower.includes(keyNormalized) || keyNormalized.includes(nichoLower)) {
      return context;
    }
  }
  
  return null;
}

// =============================================================================
// USER PROMPT - DADOS DO LEAD
// =============================================================================
function buildEliteUserPrompt(
  lead: LeadData,
  canaisDisponiveis: ("email" | "whatsapp" | "instagram")[],
  injectedCampaign?: {
    oferta_usuario: string;
    publico_alvo: string;
    dor_principal: string;
    objetivo: string;
    canal: string | null;
    etapa: string | null;
  },
  isUS: boolean = false
): string {
  if (isUS) {
    return buildUSUserPrompt(lead, canaisDisponiveis, injectedCampaign);
  }
  return buildBRUserPrompt(lead, canaisDisponiveis, injectedCampaign);
}

function buildZunoInternalProspectingUserPrompt(lead: LeadData, canaisDisponiveis: ("email" | "whatsapp" | "instagram")[]): string {
  const canalTexto = canaisDisponiveis.length > 0
    ? canaisDisponiveis.map(c => c === "email" ? "Email" : c === "whatsapp" ? "WhatsApp" : "Instagram DM").join(", ")
    : "Nenhum canal detectado";

  return `DADOS DO LEAD

Empresa: ${lead.nome}
Nicho buscado: ${lead.nicho}
Cidade/estado da busca: ${lead.cidade}
Site: ${lead.website || "Nao informado"}
Instagram: ${lead.instagram_url || "Nao informado"}
Email: ${lead.email || "Nao informado"}
WhatsApp/telefone: ${lead.whatsapp_number || "Nao informado"}
Canais detectados/selecionados: ${canalTexto}

CONTEXTO DO MODO
Este foco representa oportunidade comercial.
A leitura deve identificar:
- se a empresa parece depender de indicacao, esforco manual ou demanda pouco previsivel;
- se a presenca digital atual sugere base para abrir mais conversas;
- qual pergunta faz mais sentido para iniciar uma conversa consultiva;
- qual dor comercial vale explorar sem parecer pitch pronto.

TAREFA
1. De um score de 0 a 100 em probabilidade_conversao.
2. Nos diagnostico_bullets, escreva 3 ou 4 bullets curtos com leitura comercial do lead.
3. Identifique onde parece existir oportunidade comercial, gargalo de previsibilidade ou perda de conversa.
4. Identifique a dor provavel do lead na entrada, qualificacao ou aproveitamento de novas conversas.
5. Crie uma abordagem curta para WhatsApp.
6. Crie uma abordagem leve para Instagram.
7. Crie um e-mail curto.
8. Crie follow-ups curtos ate completar 7 dias.

REGRAS DAS MENSAGENS
- Nunca diga que o lead foi encontrado usando a Zuno ou qualquer ferramenta.
- Nunca escreva "zuno_internal_prospecting" no texto final.
- Use obrigatoriamente as regras comportamentais do foco selecionado. Não gere uma copy genérica. A copy precisa respeitar o objetivo, as dores, os ângulos, os termos recomendados e os termos proibidos desse foco.
• Termos recomendados: prospecção com IA, empresas por cidade e nicho, abordagem contextualizada, oportunidades, conversas comerciais, economia de tempo, rotina de prospecção.
• Termos proibidos: "encontrei você usando a Zuno", "achei você pela Zuno", "a Zuno encontrou você", "usei a Zuno para encontrar sua empresa", revelar método de busca.
- Comece pelo contexto, por um achado real ou por uma pergunta comercial plausivel.
- Exemplo seguro: "${lead.nome}, tudo bem? Vi que voces atuam com ${lead.nicho} e fiquei com uma duvida rapida: hoje a entrada de novas conversas comerciais acontece de forma previsivel ou ainda depende muito de indicacao e tentativa manual?"
- Alternativa consultiva: "${lead.nome}, tudo bem? Olhando a presenca digital de voces, fiquei com a impressao de que existe base para gerar mais conversa comercial. Queria entender se isso hoje ja acontece com consistencia."
- As mensagens devem soar naturais, curtas e humanas.
- Nao invente nome de responsavel, resultados, faturamento, clientes, metricas ou presenca em redes.
- Nao use tom agressivo, pressao ou promessa garantida.
- Use o nicho "${lead.nicho}" e a cidade "${lead.cidade}" como contexto comercial.
- Nos primeiros contatos, nao apresente a Zuno logo de cara. Primeiro gere contexto e interesse.
- Frases proibidas: "encontrei voce usando a Zuno", "achei voce pela Zuno", "a propria Zuno encontrou", "usando a propria Zuno", "se ela me ajudou a encontrar voce", "usei a Zuno para encontrar", "fui ate voce usando a Zuno".
${buildPremiumCopyOutputRules()}
- Retorne a analise estruturada pela funcao gerar_analise_lead.`;
}

function buildBRUserPrompt(
  lead: LeadData,
  canaisDisponiveis: ("email" | "whatsapp" | "instagram")[],
  injectedCampaign?: {
    oferta_usuario: string;
    publico_alvo: string;
    dor_principal: string;
    objetivo: string;
    canal: string | null;
    etapa: string | null;
  }
): string {
  const canalTexto = canaisDisponiveis.length > 0 
    ? canaisDisponiveis.map(c => c === "email" ? "Email" : c === "whatsapp" ? "WhatsApp" : "Instagram DM").join(", ")
    : "NENHUM DETECTADO";

  const sinaisMarketing = [];
  if (lead.has_meta_pixel) sinaisMarketing.push("Meta Pixel active");
  if (lead.has_gtag) sinaisMarketing.push("Google Analytics active");
  if (lead.has_gtm) sinaisMarketing.push("GTM configurado");
  if (lead.whatsapp_on_site || lead.whatsapp_number) sinaisMarketing.push("WhatsApp no site");
  if (lead.instagram_url) sinaisMarketing.push(`Instagram: ${lead.instagram_url}`);
  if (lead.email) sinaisMarketing.push(`Email: ${lead.email}`);

  // Build channel cadence strategy
  let cadencia = "";
  if (canaisDisponiveis.length === 0) {
    cadencia = "⚠️ Nenhum canal detectado - foque em estratégias para ENCONTRAR contato";
  } else if (canaisDisponiveis.length === 1) {
    cadencia = `Use ${canalTexto} para todos os 7 dias com variações de abordagem`;
  } else if (canaisDisponiveis.length === 2) {
    cadencia = `Alterne: Dias 1,3,5,7 = ${canaisDisponiveis[0]}, Dias 2,4,6 = ${canaisDisponiveis[1]}`;
  } else {
    cadencia = `Cadência 3 canais: D1 WhatsApp, D2 Email, D3 Instagram, D4 WhatsApp, D5 Email, D6 Instagram, D7 WhatsApp`;
  }

  const focoArgs = getFocoArguments(lead.foco);
  const behavior = getFocusBehavior(lead.foco);
  const focusBehaviorRules = `
🎯 REGRAS COMPORTAMENTAIS DO FOCO COMERCIAL: "${behavior.label}"
• Objetivo Comercial: ${behavior.commercial_goal}
• Lente de Diagnóstico: ${behavior.diagnosis_lens}
• Dores Prováveis: ${behavior.likely_pains.join(", ")}
• Ângulos de Abordagem: ${behavior.approach_angles.join(", ")}
• Termos Recomendados (use sempre que puder): ${behavior.recommended_terms.join(", ")}
• Termos Proibidos (NUNCA utilize in hipótese alguma): ${behavior.avoid_terms.join(", ")}
• Exemplos de CTAs recomendadas: ${behavior.cta_examples.map(c => `"${c}"`).join(" ou ")}
• Objeções Prováveis e Respostas Recomendadas:
${behavior.likely_objections.map((obj, idx) => `   - Objeção: "${obj}"\\n   - Resposta sugerida: "${behavior.objection_responses[idx] || ''}"`).join("\\n")}
`;
  
  // Get niche-specific context
  const nichoContext = getNichoExamples(lead.nicho);

  let nichoSection = "";
  if (nichoContext) {
    nichoSection = `
═══════════════════════════════════════
🎯 REFERÊNCIA ESPECÍFICA PARA: ${lead.nicho.toUpperCase()}
═══════════════════════════════════════

📌 DORES DO NICHO (use nas mensagens):
• Principal: ${nichoContext.dor_principal}
• Secundária: ${nichoContext.dor_secundaria}

🎁 GANHO PRINCIPAL:
• ${nichoContext.ganho_principal}

📊 MÉTRICA-CHAVE:
• ${nichoContext.metrica_chave}

💬 EXEMPLO DE WHATSAPP (use como referência):
${nichoContext.exemplo_whatsapp}

✉️ EXEMPLO DE EMAIL (use como referência):
${nichoContext.exemplo_email}

📸 EXEMPLO DE INSTAGRAM DM (use como referência):
${nichoContext.exemplo_instagram}

🚫 OBJEÇÕES COMUNS DESTE NICHO:
${nichoContext.objecoes.map(o => `• "${o.objecao}" → ${o.resposta}`).join("\n")}

📝 JARGÕES DO NICHO (use para parecer especialista):
${nichoContext.jargoes.join(", ")}
`;
  } else {
    nichoSection = `
═══════════════════════════════════════
⚠️ NICHO SEM REFERÊNCIA ESPECÍFICA: ${lead.nicho}
═══════════════════════════════════════
Use sua expertise para criar mensagens personalizadas.
Pesquise mentalmente: quais são as dores típicas deste tipo de negócio?
`;
  }

  const campanhaTexto = injectedCampaign ? `
═══════════════════════════════════════
🎯 DIRETRIZES DA CAMPANHA COMERCIAL DO USUÁRIO
═══════════════════════════════════════
• Oferta a ser feita: ${injectedCampaign.oferta_usuario}
• Público-alvo do usuário: ${injectedCampaign.publico_alvo}
• Dor a ser explorada: ${injectedCampaign.dor_principal}
• Objetivo da campanha: ${injectedCampaign.objetivo}

⚠️ INSTRUÇÃO CRÍTICA PARA AS MENSAGENS:
O usuário escolheu vender a oferta "${injectedCampaign.oferta_usuario}" focando na dor "${injectedCampaign.dor_principal}".
Portanto, você DEVE gerar as copies focando estritamente nessa dor e oferta! Não fale sobre outros serviços não relacionados.
` : "";

  return `═══════════════════════════════════════
📊 DADOS DO LEAD PARA ANÁLISE
═══════════════════════════════════════

🏢 EMPRESA
• Nome: ${lead.nome}
• Nicho: ${lead.nicho}
• Cidade: ${lead.cidade}
• Website: ${lead.website || "Não informado"}
${lead.cnae_principal ? `• CNAE: ${lead.cnae_principal}` : ""}
${lead.porte_empresa ? `• Porte: ${lead.porte_empresa}` : ""}
${lead.situacao_cadastral ? `• Situação: ${lead.situacao_cadastral}` : ""}

👤 CONTATO
${lead.nome_responsavel 
  ? `✅ NOME DO RESPONSÁVEL: "${lead.nome_responsavel}" - USE NAS MENSAGENS!`
  : `❌ Nome do responsável não detectado - NÃO INVENTE NOMES`}

🎯 FOCO DO SERVIÇO: ${lead.foco}
${focoArgs}
${campanhaTexto}
${focusBehaviorRules}
${nichoSection}
📊 SINAIS DE MARKETING DETECTADOS:
${sinaisMarketing.length > 0 ? sinaisMarketing.map(s => `• ${s}`).join("\n") : "• Nenhum sinal detectado - empresa com baixa maturidade digital"}

═══════════════════════════════════════
⚠️ CANAIS PERMITIDOS: ${canalTexto}
═══════════════════════════════════════
🚫 USE APENAS estes canais no plano!
📅 Estratégia: ${cadencia}

═══════════════════════════════════════
📋 GERE AGORA:
═══════════════════════════════════════

1. DIAGNÓSTICO (6-8 bullets consultivos)
   • Use as dores específicas do nicho acima
   • Analise maturidade digital real
   • Identifique gaps críticos
   • Aponte oportunidades para ${lead.foco}
   • Estime potencial de ROI

2. PROBABILIDADE DE CONVERSÃO (0-100)
   ${canaisDisponiveis.length === 0 ? "• Máximo 30% se nenhum canal detectado" : ""}

3. PLANO DE PROSPECÇÃO 7 DIAS
   • BASEIE-SE NOS EXEMPLOS DO NICHO ACIMA!
   • Cada dia: mensagem pronta para copiar e colar
   • Objeções: use as objeções específicas do nicho
   • Respostas: técnica consultiva profissional
   • CTAs: progressivos e específicos
   
   Progressão obrigatória:
   - Dia 1: Apresentação + contexto (use dor principal)
   - Dia 2: Dor específica do nicho
   - Dia 3: Oportunidade clara (use ganho principal)
   - Dia 4: Framework/método
   - Dia 5: Prova social/cenário
   - Dia 6: Visão estratégica + próximo passo
   - Dia 7: Último toque respeitoso

═══════════════════════════════════════
🎯 LEMBRE-SE: USE OS DADOS DO NICHO!
═══════════════════════════════════════
Os exemplos acima são REFERÊNCIA - adapte para os dados REAIS:
• Empresa: ${lead.nome}
• Cidade: ${lead.cidade}
• Nicho: ${lead.nicho}
• Foco: ${lead.foco}
${buildPremiumCopyOutputRules()}
${lead.nome_responsavel ? `• Responsável: ${lead.nome_responsavel}` : ""}
• INSTRUÇÃO CRÍTICA DE PROSPEÇÃO:
Use obrigatoriamente as regras comportamentais do foco selecionado. Não gere uma copy genérica. A copy precisa respeitar o objetivo, as dores, os ângulos, os termos recomendados e os termos proibidos desse foco.`;
}

// =============================================================================
// US USER PROMPT - FOR AMERICAN LEADS (ENGLISH OUTPUT)
// =============================================================================
function buildUSUserPrompt(
  lead: LeadData,
  canaisDisponiveis: ("email" | "whatsapp" | "instagram")[],
  injectedCampaign?: {
    oferta_usuario: string;
    publico_alvo: string;
    dor_principal: string;
    objetivo: string;
    canal: string | null;
    etapa: string | null;
  }
): string {
  const channelText = canaisDisponiveis.length > 0 
    ? canaisDisponiveis.map(c => c === "email" ? "Email" : c === "whatsapp" ? "WhatsApp" : "Instagram DM").join(", ")
    : "NONE DETECTED";

  const marketingSignals = [];
  if (lead.has_meta_pixel) marketingSignals.push("Meta Pixel active");
  if (lead.has_gtag) marketingSignals.push("Google Analytics active");
  if (lead.has_gtm) marketingSignals.push("GTM configured");
  if (lead.instagram_url) marketingSignals.push(`Instagram: ${lead.instagram_url}`);
  if (lead.email) marketingSignals.push(`Email: ${lead.email}`);

  // Build channel cadence strategy
  let cadence = "";
  if (canaisDisponiveis.length === 0) {
    cadence = "⚠️ No channel detected - focus on strategies to FIND contact";
  } else if (canaisDisponiveis.length === 1) {
    cadence = `Use ${channelText} for all 7 days with varied approaches`;
  } else if (canaisDisponiveis.length === 2) {
    cadence = `Alternate: Days 1,3,5,7 = ${canaisDisponiveis[0]}, Days 2,4,6 = ${canaisDisponiveis[1]}`;
  } else {
    cadence = `3-channel cadence: D1 Email, D2 Instagram, D3 Email, D4 Instagram, D5 Email, D6 Instagram, D7 Email`;
  }

  const focoArgs = getFocoArgumentsUS(lead.foco);

  const campaignText = injectedCampaign ? `
═══════════════════════════════════════
🎯 USER'S COMMERCIAL CAMPAIGN GUIDELINES
═══════════════════════════════════════
• Service/Offer to sell: ${injectedCampaign.oferta_usuario}
• Target Audience of the user: ${injectedCampaign.publico_alvo}
• Main Pain Point to address: ${injectedCampaign.dor_principal}
• Campaign Goal: ${injectedCampaign.objetivo}

⚠️ CRITICAL DIRECTION FOR MESSAGES:
You MUST focus the prospecting messages and copies strictly on the user's service offer ("${injectedCampaign.oferta_usuario}") and address the main pain point ("${injectedCampaign.dor_principal}").
Do NOT talk about other services. Adapt the messaging to fit this exact campaign strategy.
` : "";

  return `═══════════════════════════════════════
📊 LEAD DATA FOR ANALYSIS
═══════════════════════════════════════

🏢 BUSINESS
• Name: ${lead.nome}
• Niche: ${lead.nicho}
• City: ${lead.cidade}
• Country: United States
• Website: ${lead.website || "Not provided"}

👤 CONTACT
${lead.nome_responsavel 
  ? `✅ CONTACT NAME: "${lead.nome_responsavel}" - USE THIS IN MESSAGES!`
  : `❌ Contact name not detected - DO NOT INVENT NAMES`}

🎯 SERVICE FOCUS: ${lead.foco}
${focoArgs}
${campaignText}

📊 MARKETING SIGNALS DETECTED:
${marketingSignals.length > 0 ? marketingSignals.map(s => `• ${s}`).join("\n") : "• No signals detected - business with low digital maturity"}

═══════════════════════════════════════
⚠️ ALLOWED CHANNELS: ${channelText}
═══════════════════════════════════════
🚫 USE ONLY these channels in the plan!
📅 Strategy: ${cadence}

═══════════════════════════════════════
⚠️ CRITICAL LANGUAGE INSTRUCTIONS
═══════════════════════════════════════
• Prospecting messages, CTAs, objections, responses → ALL IN ENGLISH
• Diagnostic bullets → IN PORTUGUESE (the user reading is Brazilian)
• acao_sugerida field → IN PORTUGUESE (instructions for the user)

═══════════════════════════════════════
📋 GENERATE NOW:
═══════════════════════════════════════

1. DIAGNÓSTICO (6-8 bullets consultivos - EM PORTUGUÊS!)
   ⚠️ ESTA SEÇÃO DEVE SER EM PORTUGUÊS
   • Avalie maturidade digital real
   • Identifique gaps críticos
   • Aponte oportunidades para ${lead.foco}
   • Compare com mercado americano
   • Estime potencial de ROI

2. PROBABILIDADE DE CONVERSÃO (0-100)
   ${canaisDisponiveis.length === 0 ? "• Maximum 30% if no channel detected" : ""}

3. 7-DAY PROSPECTING PLAN (ALL MESSAGES IN ENGLISH!)
   ⚠️ MESSAGES, OBJECTIONS, RESPONSES, CTAs → IN ENGLISH
   ⚠️ acao_sugerida field → IN PORTUGUESE
   
   • Each day: ready-to-copy message IN ENGLISH
   • Objections: common American business objections IN ENGLISH
   • Responses: consultative technique IN ENGLISH
   • CTAs: progressive and specific IN ENGLISH
   
   Required progression:
   - Day 1: Introduction + context (main pain point)
   - Day 2: Specific industry pain
   - Day 3: Clear opportunity (main benefit)
   - Day 4: Framework/method
   - Day 5: Social proof/scenario
   - Day 6: Strategic vision + next step
   - Day 7: Respectful last touch

═══════════════════════════════════════
🎯 REMEMBER: ADAPT TO US MARKET!
═══════════════════════════════════════
American business culture differences:
• More direct communication style
• Value time efficiency ("quick 15-min call")
• Focus on ROI and metrics
• Professional but friendly tone
• LinkedIn is primary B2B channel (use Email/Instagram as alternatives)

Lead data:
• Business: ${lead.nome}
• City: ${lead.cidade}
• Niche: ${lead.nicho}
• Focus: ${lead.foco}
${lead.nome_responsavel ? `• Contact: ${lead.nome_responsavel}` : ""}`;
}

function getFocoArgumentsUS(foco: string): string {
  const args: Record<string, string> = {
    "Tráfego": `📣 PAID ADS ARGUMENTS:
• Focus on PREDICTABLE flow of qualified leads
• Metrics: CPL, ROAS, CAC
• Pain: relying on word-of-mouth, unpredictable leads
• Gain: new leads coming in every day`,
    
    "SEO": `🔍 SEO ARGUMENTS:
• Focus on organic traffic = free leads
• Compound effect: results accumulate over time
• Pain: competitors ranking higher on Google
• Gain: customers finding you without paying per click`,
    
    "Social": `📱 SOCIAL MEDIA ARGUMENTS:
• Focus on consistency and brand positioning
• Building a BRAND, not just posting content
• Pain: posts with no engagement, followers who do not convert
• Gain: engaged community that becomes customers`,
    
    "Full Service": `🎯 FULL SERVICE ARGUMENTS:
• 360° vision - integrated strategy
• Time savings with single partner
• Pain: multiple vendors, disconnected results
• Gain: one partner handling everything`,
    
    "Automação": `⚙️ AUTOMATION ARGUMENTS:
• Funnels that run themselves
• Automatic follow-ups = leads that do not go cold
• Pain: leads come in but no one follows up
• Gain: system that nurtures leads 24/7`,
    
    "CRM": `📊 CRM ARGUMENTS:
• Sales pipeline organization
• Systematic follow-up, not relying on memory
• Pain: disorganized sales, leads lost in emails
• Gain: predictable revenue`,
    
    "Sites/Landing": `🖥️ WEBSITES/LANDING PAGES ARGUMENTS:
• Pages that CONVERT, not just look pretty
• Clear offer in 5 seconds
• Pain: website that does not generate leads, just costs hosting
• Gain: page that turns visitors into contacts`,
    
    "Design": `🎨 DESIGN ARGUMENTS:
• Visual identity as competitive advantage
• Design that SELLS, not just looks good
• Pain: amateur visuals that push away premium clients
• Gain: brand that attracts the right customers`,
  };
  
  return args[foco] || `• Focus on specific benefits of ${foco}`;
}

function getFocoArguments(foco: string): string {
  const args: Record<string, string> = {
    "Tráfego": `📣 ARGUMENTAÇÃO TRÁFEGO:
• Foque em fluxo PREVISÍVEL de leads qualificados
• Métricas: CPL, ROAS, CAC
• Dor: dependência de indicação/boca-a-boca
• Ganho: leads novos entrando todo dia`,
    
    "SEO": `🔍 ARGUMENTAÇÃO SEO:
• Foque em tráfego orgânico = leads gratuitos
• Efeito composto: resultados acumulam
• Dor: concorrentes aparecem primeiro no Google
• Ganho: clientes te encontrando sem pagar por clique`,
    
    "Social": `📱 ARGUMENTAÇÃO SOCIAL:
• Foque em consistência e posicionamento
• Construção de MARCA, não só posts
• Dor: posts sem engajamento, seguidores que não compram
• Ganho: comunidade engajada que vira cliente`,
    
    "Full Service": `🎯 ARGUMENTAÇÃO FULL SERVICE:
• Visão 360° - estratégia integrada
• Economia de tempo com parceiro único
• Dor: vários fornecedores, resultados desconectados
• Ganho: um parceiro que cuida de tudo`,
    
    "Automação": `⚙️ ARGUMENTAÇÃO AUTOMAÇÃO:
• Funis que rodam sozinhos
• Follow-ups automáticos = leads que não esfriam
• Dor: leads entram e ninguém acompanha
• Ganho: sistema que nutre leads 24/7`,
    
    "CRM": `📊 ARGUMENTAÇÃO CRM:
• Organização de pipeline de vendas
• Follow-up sistemático, não na memória
• Dor: vendas desorganizadas, leads perdidos no WhatsApp
• Ganho: previsibilidade de faturamento`,
    
    "Sites/Landing": `🖥️ ARGUMENTAÇÃO SITES/LANDING:
• Páginas que CONVERTEM, não só bonitas
• Clareza de oferta em 5 segundos
• Dor: site que não gera leads, só custa hospedagem
• Ganho: página que transforma visitante em contato`,
    
    "Design": `🎨 ARGUMENTAÇÃO DESIGN:
• Identidade visual como diferencial competitivo
• Design que VENDE, não só bonito
• Dor: visual amador que afasta clientes premium
• Ganho: marca que atrai os clientes certos`,
  };
  
  return args[foco] || `• Foque nos benefícios específicos de ${foco}`;
}

function generateZunoInternalMockAnalise(lead: LeadData): AnaliseResult {
  const contactName = lead.nome_responsavel || lead.nome;
  const cityContext = lead.cidade && lead.cidade !== "Não informada" ? ` em ${lead.cidade}` : "";

  return {
    diagnostico_bullets: [
      `Fit médio/alto: ${lead.nome} atua em ${lead.nicho}${cityContext}, perfil que pode depender de prospecção recorrente.`,
      "Dor provável: encontrar novos clientes com consistência sem gastar tempo montando listas e mensagens manualmente.",
      "A Zuno pode gerar valor ao localizar empresas por cidade/nicho e transformar a busca em abordagens prontas.",
      "A mensagem deve ser consultiva, curta e focada na dor de prospecção, sem revelar como o lead foi descoberto.",
      "Evitar promessas de resultado garantido; posicionar como ferramenta para acelerar prospecção B2B.",
      "Primeiro contato recomendado: começar pelo nicho, perguntar sobre processo comercial e convidar para ver um exemplo prático.",
    ],
    probabilidade_conversao: lead.website || lead.instagram_url || lead.whatsapp_number || lead.email ? 68 : 52,
    plano_prospeccao_7dias: [
      {
        dia: 1,
        canal: "whatsapp",
        acao_sugerida: "Enviar mensagem curta de abertura",
        mensagem: `${contactName}, tudo bem? Vi que vocês atuam com ${lead.nicho}${cityContext} e imaginei que prospecção de novos clientes seja uma parte importante da rotina de vocês. Estou trabalhando com uma solução que ajuda a encontrar empresas com potencial e criar abordagens mais contextualizadas com IA. Faz sentido eu te mostrar um exemplo prático?`,
        objecao_provavel: "Não tenho interesse agora",
        resposta_sugerida: "Sem problema. A ideia não é te vender nada na marra, só mostrar como uma rotina de prospecção por cidade e nicho pode ficar mais prática.",
        cta: "Posso te mandar um exemplo simples?",
      },
      {
        dia: 2,
        canal: "instagram",
        acao_sugerida: "Enviar DM leve e direta",
        mensagem: `Oi, ${contactName}. Queria te fazer uma pergunta rápida: hoje vocês têm algum processo ativo para encontrar empresas com potencial e iniciar conversas comerciais de forma mais previsível? Tenho trabalhado com uma solução de prospecção com IA que ajuda nessa parte. Quer ver um exemplo rápido aplicado ao seu mercado?`,
        objecao_provavel: "Como isso funciona?",
        resposta_sugerida: "Você informa cidade, nicho e quantidade. A Zuno busca empresas, analisa oportunidades e sugere mensagens prontas para abordar.",
        cta: "Quer que eu te mostre um exemplo?",
      },
      {
        dia: 3,
        canal: "email",
        acao_sugerida: "Enviar e-mail curto",
        mensagem: `Assunto: Prospecção para ${lead.nicho}${cityContext}\n\nOlá, ${contactName}.\n\nA Zuno Propect ajuda negócios a encontrar empresas por cidade e nicho, analisar oportunidades com IA e gerar mensagens prontas para WhatsApp, Instagram e e-mail.\n\nA ideia é economizar tempo e transformar prospecção em um processo mais organizado. Posso te mostrar um exemplo aplicado ao seu segmento?`,
        objecao_provavel: "Já tenho uma forma de prospectar",
        resposta_sugerida: "Ótimo. A Zuno pode complementar seu processo atual, principalmente na etapa de localizar leads e criar a primeira abordagem.",
        cta: "Faz sentido comparar com seu processo atual?",
      },
      {
        dia: 4,
        canal: "whatsapp",
        acao_sugerida: "Follow-up com dor provável",
        mensagem: `${contactName}, só complementando: muita empresa perde tempo procurando contatos e pensando no que escrever. A solução que estou apresentando ajuda exatamente nessa parte: encontrar oportunidades e sugerir abordagens prontas. Quer ver como ficaria para ${lead.nicho}?`,
        objecao_provavel: "Estou sem tempo",
        resposta_sugerida: "Justamente por isso pensei em te mostrar de forma objetiva. Em poucos minutos dá para entender se faz sentido.",
        cta: "Pode ser ainda essa semana?",
      },
      {
        dia: 5,
        canal: "instagram",
        acao_sugerida: "Follow-up leve",
        mensagem: `Passando rapidinho, ${contactName}: a ideia é ajudar a montar listas de empresas e abordagens por nicho/cidade, sem começar do zero toda vez. Quer que eu envie um exemplo em texto?`,
        objecao_provavel: "Manda mais informações",
        resposta_sugerida: "Claro. Ela busca leads por região e segmento, analisa o perfil e cria mensagens para canais como WhatsApp, Instagram e e-mail.",
        cta: "Te envio um exemplo agora?",
      },
      {
        dia: 6,
        canal: "email",
        acao_sugerida: "Follow-up consultivo",
        mensagem: `Assunto: Exemplo rápido da Zuno\n\nOlá, ${contactName}.\n\nPensei no seu segmento porque a prospecção costuma depender de volume, organização e boa primeira mensagem.\n\nA Zuno ajuda nessa rotina: encontrar empresas, analisar oportunidades e gerar abordagens prontas. Posso te mostrar um fluxo simples?`,
        objecao_provavel: "Qual o custo?",
        resposta_sugerida: "Depende do plano e do volume de uso. Antes de falar de preço, vale validar se o fluxo resolve uma dor real para você.",
        cta: "Quer ver o fluxo primeiro?",
      },
      {
        dia: 7,
        canal: "whatsapp",
        acao_sugerida: "Último toque respeitoso",
        mensagem: `${contactName}, última mensagem sobre isso. Se prospecção não for prioridade agora, tudo bem. Se quiser testar uma forma mais rápida de encontrar empresas e montar abordagens, posso te apresentar a Zuno sem compromisso.`,
        objecao_provavel: "Vou ver depois",
        resposta_sugerida: "Combinado. Quando quiser avaliar, posso te mostrar em poucos minutos com um nicho e cidade reais.",
        cta: "Quer que eu deixe um exemplo preparado?",
      },
    ],
  };
}

function generateMockAnalise(lead: LeadData): AnaliseResult {
  if (isZunoInternalProspectingFocus(lead.foco)) {
    return generateZunoInternalMockAnalise(lead);
  }

  const temMarketing = lead.has_meta_pixel || lead.has_gtag || lead.has_gtm;
  const temContato = !!(lead.whatsapp_number || lead.whatsapp_on_site || lead.telefone || lead.email || lead.instagram_url);

  return {
    diagnostico_bullets: buildStrategicDiagnosisBullets(lead),
    probabilidade_conversao: temMarketing && temContato ? 65 : temContato ? 45 : 25,
    plano_prospeccao_7dias: buildFallbackProspectingPlan(lead),
  };
}


function convertToPersonalizedCadence(analise: AnaliseResult, lead: LeadData): Record<string, any> {
  const cadence: Record<string, any> = {};
  const daysKeys = ["day_1", "day_2", "day_3", "day_4", "day_5", "day_6", "day_7"] as const;

  const behavior = getFocusBehavior(lead.foco);

  for (let i = 0; i < 7; i++) {
    const dayKey = daysKeys[i];
    const rawDay = analise.plano_prospeccao_7dias?.[i] || {
      dia: i + 1,
      canal: "whatsapp",
      acao_sugerida: "",
      mensagem: "",
      cta: ""
    };

    cadence[dayKey] = {
      objective: rawDay.objetivo || rawDay.goal || behavior.cadence_strategy[dayKey] || "Contato de prospecção",
      channel: rawDay.canal || "whatsapp",
      action: rawDay.acao_sugerida || "",
      angle: rawDay.angle || behavior.approach_angles[i % behavior.approach_angles.length] || "",
      message: rawDay.mensagem || "",
      cta: rawDay.cta || ""
    };
  }

  return {
    cadence,
    likely_objection: analise.likely_objection || behavior.likely_objections[0] || "",
    objection_response: analise.objection_response || behavior.objection_responses[0] || "",
    conversion_strategy: analise.conversion_strategy || behavior.commercial_goal || "",
    generated_at: new Date().toISOString(),
    version: "v2_personalized_cadence"
  };
}
