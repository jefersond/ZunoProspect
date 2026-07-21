export interface NormalizedLead {
  nome: string;
  nicho: string;
  cidade: string;
  website: string | null;
  foco: string;
  whatsapp_on_site: boolean;
  whatsapp_number: string | null;
  email: string | null;
  has_meta_pixel: boolean;
  has_gtag: boolean;
  has_gtm: boolean;
  instagram_url: string | null;
  instagram_context: string | null;
  canaisProspeccao?: string[];
  cnpj?: string | null;
  razao_social?: string | null;
  nome_responsavel?: string | null;
  situacao_cadastral?: string | null;
  porte_empresa?: string | null;
  cnae_principal?: string | null;
  pais?: string;
  place_id?: string | null;
  rating?: number | null;
  reviews?: number | null;
  endereco?: string | null;
  
  // Novos campos para Serviços Profissionais B2B
  categoria_prospeccao?: string;
  categoria_label?: string;
  servico_oferecido?: string;
  publico_desejado?: string;
  possiveis_indicadores?: string;
  estado?: string;
  canal?: string;
  objetivo?: string;
}

const ZUNO_INTERNAL_PROSPECTING_FOCUS = "zuno_internal_prospecting";
const ZUNO_COMMERCIAL_FOCUS_LABEL = "Oportunidade comercial";

function getSafeFocusLabel(foco?: string | null): string {
  if (!foco || foco === ZUNO_INTERNAL_PROSPECTING_FOCUS) {
    return ZUNO_COMMERCIAL_FOCUS_LABEL;
  }
  if (foco === "servicos_profissionais") {
    return "Serviços Profissionais";
  }
  return foco;
}

export function normalizeLeadForAI(lead: any, searchContext: any = {}): NormalizedLead {
  if (!lead) return {} as NormalizedLead;

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

  const rawFocus = lead.foco || searchContext.focus || "Full Service";
  const isProfessional = rawFocus === "servicos_profissionais" || rawFocus === "Serviços Profissionais";

  return {
    nome: String(nome).trim(),
    nicho: nicho ? String(nicho).trim() : "Não informado",
    cidade: city ? String(city).trim() : "Não informada",
    website: website ? String(website).trim() : null,
    foco: getSafeFocusLabel(rawFocus),
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
    
    // Novos campos de Serviços Profissionais
    categoria_prospeccao: isProfessional ? "servicos_profissionais" : undefined,
    categoria_label: isProfessional ? "Serviços Profissionais" : undefined,
    servico_oferecido: isProfessional ? (lead.servico_oferecido || lead.nicho || searchContext.niche || "Serviço especializado") : undefined,
    publico_desejado: isProfessional ? (lead.publico_desejado || lead.nicho || searchContext.niche || "Empresas e parceiros B2B") : undefined,
    possiveis_indicadores: isProfessional ? (lead.possiveis_indicadores || "Parceiros estratégicos, advogados, contadores, imobiliárias e contatos B2B") : undefined,
    estado: isProfessional ? (lead.estado || searchContext.state || lead.uf || "Não informado") : undefined,
    canal: isProfessional ? (lead.canal || (lead.canaisProspeccao && lead.canaisProspeccao.join(", ")) || "whatsapp, email, instagram") : undefined,
    objetivo: isProfessional ? (lead.objetivo || "parceria comercial e rede de indicações") : undefined,
  };
}

export function normalizePlanoProspeccao(plano: any): any[] {
  if (!plano) return [];
  if (Array.isArray(plano)) return plano;
  if (typeof plano === 'object' && plano.cadence) {
    const cadence = plano.cadence;
    const likelyObjection = plano.likely_objection || '';
    const objectionResponse = plano.objection_response || '';
    const planoArray: any[] = [];
    const daysKeys = ["day_1", "day_2", "day_3", "day_4", "day_5", "day_6", "day_7"] as const;
    for (let i = 0; i < 7; i++) {
      const dayKey = daysKeys[i];
      const dayData = cadence[dayKey];
      if (dayData) {
        planoArray.push({
          dia: i + 1,
          canal: dayData.channel || 'whatsapp',
          objetivo: dayData.objective || '',
          acao_sugerida: dayData.action || '',
          mensagem: dayData.message || '',
          objecao_provavel: dayData.likely_objection || likelyObjection,
          resposta_sugerida: dayData.objection_response || objectionResponse,
          cta: dayData.cta || '',
          angle: dayData.angle || ''
        });
      }
    }
    return planoArray;
  }
  return [];
}
