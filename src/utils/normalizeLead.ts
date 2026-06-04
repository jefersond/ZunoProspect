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
}

const ZUNO_INTERNAL_PROSPECTING_FOCUS = "zuno_internal_prospecting";
const ZUNO_COMMERCIAL_FOCUS_LABEL = "Oportunidade comercial";

function getSafeFocusLabel(foco?: string | null): string {
  if (!foco || foco === ZUNO_INTERNAL_PROSPECTING_FOCUS) {
    return ZUNO_COMMERCIAL_FOCUS_LABEL;
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

  return {
    nome: String(nome).trim(),
    nicho: nicho ? String(nicho).trim() : "Não informado",
    cidade: city ? String(city).trim() : "Não informada",
    website: website ? String(website).trim() : null,
    foco: getSafeFocusLabel(lead.foco || searchContext.focus || "Full Service"),
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
