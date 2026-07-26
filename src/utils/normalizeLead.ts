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

function generateFallback7Days(lead?: any): any[] {
  const nome = lead?.nome || "Empresa";
  const nicho = lead?.nicho || "seu segmento";
  const cidade = lead?.cidade || "sua região";
  const focoRaw = lead?.foco || "Full Service";
  const foco = focoRaw === "zuno_internal_prospecting" ? "Oportunidade comercial" : focoRaw;

  return [
    {
      dia: 1,
      canal: "whatsapp",
      acao_sugerida: "Envio de áudio ou mensagem curta no WhatsApp comercial",
      mensagem: `Olá, tudo bem? Vi o perfil da ${nome} aqui em ${cidade} no segmento de ${nicho}. Analisei a presença de vocês e notei uma oportunidade excelente para acelerar novos clientes com foco em ${foco}. Posso te enviar um diagnóstico de 2 minutos sem compromisso?`,
      objecao_provavel: "Quem é você e onde conseguiu meu contato?",
      resposta_sugerida: "Sou especialista em aquisição para empresas de " + nicho + ". Encontrei seu contato na busca comercial pública.",
      cta: "Posso mandar por aqui?"
    },
    {
      dia: 2,
      canal: "instagram",
      acao_sugerida: "Interação com publicação recente e envio de Direct",
      mensagem: `Olá equipe da ${nome}! Acompanho o perfil de vocês em ${cidade}. Gostei muito do posicionamento, mas reparei que há um grande potencial para transformar visualizações em contatos diários no WhatsApp. Como está a demanda de vocês atualmente?`,
      objecao_provavel: "Não temos interesse no momento",
      resposta_sugerida: "Tranquilo! Nós atuamos como parceiros estratégicos focado em performance de receita.",
      cta: "Vale 3 minutos para dar uma olhada?"
    },
    {
      dia: 3,
      canal: "email",
      acao_sugerida: "Envio de e-mail consultivo curto com diagnóstico",
      mensagem: `Assunto: Oportunidade de aquisição comercial - ${nome}\n\nOlá,\n\nAnalisei o posicionamento digital da ${nome} em ${cidade} e mapeamos um gap comercial importante no segmento de ${nicho}.\n\nFormatamos uma proposta estratégica em ${foco} focada em previsibilidade de vendas.\n\nQual o melhor dia esta semana para apresentarmos em 5 minutos?`,
      objecao_provavel: "Qual o custo envolvido?",
      resposta_sugerida: "Nosso investimento é flexível e condicionado ao retorno das metas acordadas.",
      cta: "Consegue falar quinta-feira às 14h?"
    },
    {
      dia: 4,
      canal: "whatsapp",
      acao_sugerida: "Follow-up objetivo com pergunta direta",
      mensagem: `Passando só para saber se conseguiu dar uma olhada na mensagem anterior sobre a ${nome}. Sei que a rotina aí em ${cidade} é corrida!`,
      objecao_provavel: "Estava muito corrido aqui",
      resposta_sugerida: "Sem problemas! Quando a rotina aliviar um pouco me avisa por aqui.",
      cta: "Podemos agendar 3 minutos na próxima semana?"
    },
    {
      dia: 5,
      canal: "email",
      acao_sugerida: "Compartilhamento de estudo de caso do mesmo nicho",
      mensagem: `Assunto: Estudo de caso - Crescimento em ${nicho}\n\nOlá!\n\nAjudamos uma empresa parecida com a ${nome} a estruturar um funil comercial que gerou +40% de contatos qualificados no primeiro mês.\n\nConsegue ver 5 minutos amanhã para um bate-papo rápido?`,
      objecao_provavel: "Já fazemos isso internamente",
      resposta_sugerida: "Excelente! Nosso trabalho entra para potencializar a equipe interna com novas frentes de tráfego e conversão.",
      cta: "Posso enviar a apresentação?"
    },
    {
      dia: 6,
      canal: "instagram",
      acao_sugerida: "Reação a story ou post recente da empresa",
      mensagem: `Muito bom esse post recente de vocês! É exatamente esse diferencial da ${nome} em ${cidade} que pode ser amplificado para gerar clientes todos os dias.`,
      objecao_provavel: "Obrigado pelo feedback!",
      resposta_sugerida: "Por nada! Se quiser entender como escalar esse resultado, fico à disposição.",
      cta: "Bora marcar um papo rápido?"
    },
    {
      dia: 7,
      canal: "whatsapp",
      acao_sugerida: "Último contato com ultimato sutil e convite aberto",
      mensagem: `Último contato por aqui para não tomar seu tempo! Vou deixar o canal aberto se em algum momento a ${nome} quiser estruturar um canal forte de aquisição de clientes em ${cidade}. Grande abraço e sucesso!`,
      objecao_provavel: "Obrigado pelo contato!",
      resposta_sugerida: "Disponha! Bom trabalho para vocês aí.",
      cta: "Ficamos em contato!"
    }
  ];
}

export function normalizePlanoProspeccao(plano: any, lead?: any): any[] {
  if (Array.isArray(plano) && plano.length > 0) return plano;
  
  if (plano && typeof plano === 'object') {
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

  return generateFallback7Days(lead);
}

export function normalizeDiagnosticoBullets(bullets: any, lead?: any): string[] {
  let list: string[] = [];

  if (Array.isArray(bullets) && bullets.length > 0) {
    list = bullets.filter((b) => typeof b === 'string' && b.trim() !== '');
  }

  if (list.length === 0 && lead && lead.plano_prospeccao && typeof lead.plano_prospeccao === 'object') {
    const diag = lead.plano_prospeccao.diagnostico;
    if (diag) {
      if (diag.justificativa) list.push(`Oportunidade: ${diag.justificativa}`);
      if (diag.dor_provavel) list.push(`Ponto de dor principal: ${diag.dor_provavel}`);
      if (diag.oportunidade) list.push(`Ângulo comercial recomendado: ${diag.oportunidade}`);
      if (diag.urgencia) list.push(`Urgência estimada para contato: ${diag.urgencia}`);
    }
  }

  if (list.length === 0) {
    const nome = lead?.nome || "a empresa";
    const nicho = lead?.nicho || "seu segmento";
    const cidade = lead?.cidade || "sua região";
    const focoRaw = lead?.foco || "Full Service";
    const foco = focoRaw === "zuno_internal_prospecting" ? "Oportunidade comercial" : focoRaw;

    list = [
      `Análise estratégica identificada para ${nome} no segmento de ${nicho} em ${cidade}.`,
      `Abordagem consultiva focada no modelo de serviço ${foco}.`,
      `Presença digital e canais de contato verificados para máxima taxa de resposta.`,
      `Sequência de prospecção em 7 dias personalizada para conversão direta.`
    ];
  }

  return list.map(b => b.replace(/zuno_internal_prospecting/g, "Oportunidade comercial"));
}
