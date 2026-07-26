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
  if (Array.isArray(plano) && plano.length > 0) return plano;
  
  if (typeof plano === 'object') {
    // 1. Caso venha de `plano_prospeccao_7dias` (formato principal)
    if (Array.isArray(plano.plano_prospeccao_7dias) && plano.plano_prospeccao_7dias.length > 0) {
      return plano.plano_prospeccao_7dias;
    }

    // 2. Caso venha de `plano_prospeccao` interno
    if (Array.isArray(plano.plano_prospeccao) && plano.plano_prospeccao.length > 0) {
      return plano.plano_prospeccao;
    }

    // 3. Caso venha de `copies` ({ dia_1, dia_2, ... })
    if (plano.copies && typeof plano.copies === 'object') {
      const planoArray: any[] = [];
      const canais: ("whatsapp" | "email" | "instagram")[] = ["whatsapp", "instagram", "email", "whatsapp", "email", "instagram", "whatsapp"];
      for (let i = 1; i <= 7; i++) {
        const msgKey = `dia_${i}` as keyof typeof plano.copies;
        const msg = plano.copies[msgKey];
        if (msg) {
          planoArray.push({
            dia: i,
            canal: canais[(i - 1) % canais.length],
            acao_sugerida: i === 1 ? "Envio de mensagem inicial no WhatsApp" : `Follow-up do dia ${i}`,
            mensagem: msg,
            objecao_provavel: "Sem tempo para conversar agora",
            resposta_sugerida: "Compreendo perfeitamente. Qual o melhor horário para um contato rápido de 3 minutos?",
            cta: "Podemos agendar para amanhã?",
          });
        }
      }
      if (planoArray.length > 0) return planoArray;
    }

    // 4. Caso venha de `abordagens_por_canal` ({ whatsapp, instagram, email })
    if (plano.abordagens_por_canal && typeof plano.abordagens_por_canal === 'object') {
      const planoArray: any[] = [];
      if (plano.abordagens_por_canal.whatsapp) {
        planoArray.push({
          dia: 1,
          canal: "whatsapp",
          acao_sugerida: "Contato direto via WhatsApp",
          mensagem: plano.abordagens_por_canal.whatsapp,
          objecao_provavel: "Não estou buscando novos serviços no momento",
          resposta_sugerida: "Entendo perfeitamente! Fico à disposição para quando surgir a necessidade.",
          cta: "Qual o melhor canal para manter contato?",
        });
      }
      if (plano.abordagens_por_canal.instagram) {
        planoArray.push({
          dia: 2,
          canal: "instagram",
          acao_sugerida: "Interação e mensagem no Instagram",
          mensagem: plano.abordagens_por_canal.instagram,
          objecao_provavel: "Já temos agência responsável",
          resposta_sugerida: "Ótimo! Podemos atuar como parceiros em demandas específicas ou auditoria sem custo.",
          cta: "Posso te mandar nosso portfólio?",
        });
      }
      if (plano.abordagens_por_canal.email) {
        planoArray.push({
          dia: 3,
          canal: "email",
          acao_sugerida: "Envio de proposta/diagnóstico por E-mail",
          mensagem: plano.abordagens_por_canal.email,
          objecao_provavel: "Qual o valor do investimento?",
          resposta_sugerida: "Nosso modelo é totalmente personalizado após entender seu objetivo atual.",
          cta: "Consegue falar 5 minutos esta semana?",
        });
      }
      if (planoArray.length > 0) return planoArray;
    }

    // 5. Suporte legado a `cadence`
    if (plano.cadence && typeof plano.cadence === 'object') {
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
      if (planoArray.length > 0) return planoArray;
    }
  }

  return Array.isArray(plano) ? plano : [];
}

export function normalizeDiagnosticoBullets(bullets: any, lead?: any): string[] {
  if (Array.isArray(bullets) && bullets.length > 0) {
    return bullets.filter((b) => typeof b === 'string' && b.trim() !== '');
  }

  if (lead && lead.plano_prospeccao && typeof lead.plano_prospeccao === 'object') {
    const diag = lead.plano_prospeccao.diagnostico;
    if (diag) {
      const extracted: string[] = [];
      if (diag.justificativa) extracted.push(`Oportunidade: ${diag.justificativa}`);
      if (diag.dor_provavel) extracted.push(`Ponto de dor principal: ${diag.dor_provavel}`);
      if (diag.oportunidade) extracted.push(`Ângulo comercial recomendado: ${diag.oportunidade}`);
      if (diag.urgencia) extracted.push(`Urgência estimada para contato: ${diag.urgencia}`);
      if (extracted.length > 0) return extracted;
    }
  }

  const nome = lead?.nome || "a empresa";
  const nicho = lead?.nicho || "seu segmento";
  const cidade = lead?.cidade || "sua região";
  const foco = lead?.foco || "Full Service";

  return [
    `Análise estratégica identificada para ${nome} no segmento de ${nicho} em ${cidade}.`,
    `Abordagem consultiva focada no modelo de serviço ${foco}.`,
    `Presença digital e canais de contato verificados para máxima taxa de resposta.`,
    `Sequência de prospecção em 7 dias personalizada para conversão direta.`
  ];
}
