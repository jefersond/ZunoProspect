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
  const foco = focoRaw === "zuno_internal_prospecting" ? "aquisição de clientes" : focoRaw;
  const hasWebsite = Boolean(lead?.website && String(lead.website).trim().length > 4);
  const observationLine = hasWebsite
    ? `Vi o site e os canais de atendimento da ${nome} em ${cidade}`
    : `Vi a atuação da ${nome} em ${cidade} no segmento de ${nicho}`;

  return [
    {
      dia: 1,
      canal: "whatsapp",
      titulo_dia: "Qualificação do Dossiê e Primeira Abordagem",
      objetivo: "Validar os canais verificados da empresa e realizar o primeiro contato consultivo sem pressão",
      acao_sugerida: "Conferir os sinais da empresa e iniciar conversa curta no WhatsApp comercial",
      explicacao_tarefa: "Revise os dados verificados (site, telefone e avaliações) e envie a mensagem inicial adaptada ao seu serviço.",
      informacoes_necessarias: ["Telefone/WhatsApp comercial", "Cidade e nicho verificados", "Serviço oferecido definido"],
      criterio_conclusao: "Primeira mensagem aberta no WhatsApp e status atualizado para Abertura Iniciada ou Contato Realizado.",
      proxima_acao_sugerida: "Aguardar retorno por 24h; se responder, avançar para triagem; se não, avaliar canal complementar no Dia 2.",
      mensagem: `Oi, ${nome}! Tudo bem?\n\n${observationLine}. Trabalho com ${foco} para negócios de ${nicho} e preparei uma demonstração prática de aproximadamente um minuto sobre como organizar a captação local de clientes em ${cidade}.\n\nFaz sentido eu compartilhar esse resumo rápido por aqui?`,
      objecao_provavel: "Quem é você e onde conseguiu meu contato?",
      resposta_sugerida: `Atuo com ${foco} para empresas de ${nicho} e localizei o contato comercial público de vocês nas buscas de ${cidade}.`,
      cta: "Posso te enviar esse vídeo de 1 minuto por aqui?"
    },
    {
      dia: 2,
      canal: "instagram",
      titulo_dia: "Mapeamento de Posicionamento e Ponto de Contato Leve",
      objetivo: "Verificar presença ativa nas redes sociais ou reforçar contexto sem fingir intimidade",
      acao_sugerida: "Observar canais públicos da empresa e enviar nota contextual breve",
      explicacao_tarefa: "Se o lead ainda não respondeu ao Dia 1, observe como a empresa apresenta seus serviços e envie uma mensagem curta focada em contexto local.",
      informacoes_necessarias: ["Canal secundário ou perfil público", "Status da abordagem do Dia 1"],
      criterio_conclusao: "Verificação de posicionamento concluída e observação registrada nas notas do lead.",
      proxima_acao_sugerida: "Se houver retorno, responder dúvida específica; caso contrário, preparar abordagem estruturada do Dia 3.",
      mensagem: `Olá, pessoal da ${nome}! Vi a atuação de vocês no segmento de ${nicho} em ${cidade}. Trabalho com ${foco} e estruturei uma ideia prática para facilitar que clientes da região encontrem o atendimento de vocês. Quem cuida dessa parte comercial por aí?`,
      objecao_provavel: "Não temos interesse no momento",
      resposta_sugerida: "Perfeito, agradeço a transparência! Deixo meu contato à disposição caso retomem esse tema mais adiante.",
      cta: "Quem seria a pessoa ideal para avaliar essa ideia rápida?"
    },
    {
      dia: 3,
      canal: "email",
      titulo_dia: "Apresentação Estruturada de Valor Comercial",
      objetivo: "Formalizar uma hipótese comercial clara para o responsável sem jargões técnicos",
      acao_sugerida: "Enviar resumo consultivo por e-mail ou mensagem estruturada",
      explicacao_tarefa: "Apresente de forma objetiva qual problema prático o seu serviço resolve para empresas desse segmento na cidade.",
      informacoes_necessarias: ["E-mail comercial ou canal principal", "Ângulo comercial do dossiê"],
      criterio_conclusao: "Resumo consultivo enviado ou registrado para o decisor.",
      proxima_acao_sugerida: "Acompanhar resposta; se demonstrar interesse, preparar roteiro de conversa curta.",
      mensagem: `Assunto: Ideia prática de ${foco} para a ${nome} em ${cidade}\n\nOlá, equipe da ${nome},\n\nObservei a presença comercial de vocês em ${cidade} no setor de ${nicho}.\n\nTrabalho com ${foco} ajudando empresas locais a estruturarem uma rotina consistente de novos pedidos de orçamento.\n\nFaz sentido eu enviar uma demonstração curta de aproximadamente um minuto mostrando como aplicamos isso na prática?`,
      objecao_provavel: "Qual o custo envolvido?",
      resposta_sugerida: "O escopo varia conforme a meta e a estrutura atual da empresa. Posso te mandar um resumo de 1 minuto para você ver se faz sentido antes de falarmos de valores.",
      cta: "Posso encaminhar a demonstração curta por aqui?"
    },
    {
      dia: 4,
      canal: "whatsapp",
      titulo_dia: "Acompanhamento Consultivo com Novo Ângulo (Sem Cobrança)",
      objetivo: "Retomar contato agregando uma pergunta útil do segmento, sem cobrar leitura anterior",
      acao_sugerida: "Enviar pergunta consultiva curta baseada na rotina do nicho",
      explicacao_tarefa: "Nunca envie 'passando para saber se viu minha mensagem'. Traga uma pergunta rápida e útil sobre a demanda atual da empresa.",
      informacoes_necessarias: ["Histórico de sem resposta no Dia 1", "Hipótese comercial do serviço"],
      criterio_conclusao: "Follow-up de valor realizado ou adaptado conforme resposta prévia.",
      proxima_acao_sugerida: "Se o lead responder, iniciar qualificação; se não responder, aguardar até a etapa de exemplo prático.",
      mensagem: `Oi, pessoal da ${nome}! Tudo bem por aí?\n\nDeixando uma pergunta rápida sobre a operação de vocês em ${cidade}: hoje a maior parte dos novos clientes de ${nicho} chega por indicação ou pelas buscas digitais da região?\n\nPergunto porque tenho um exemplo prático de 1 minuto de ${foco} bem alinhado a esse cenário.`,
      objecao_provavel: "Estava muito corrido aqui na empresa",
      resposta_sugerida: "Imagino! Por isso mesmo resumi em um exemplo de 1 minuto que você pode ver no seu tempo, sem precisar de reunião.",
      cta: "Quer que eu deixe o link do exemplo por aqui?"
    },
    {
      dia: 5,
      canal: "email",
      titulo_dia: "Compartilhamento de Exemplo Prático Aplicado ao Nicho",
      objetivo: "Tangibilizar como o serviço funciona no dia a dia sem inventar números ou casos falsos",
      acao_sugerida: "Compartilhar explicação prática de aplicação para o segmento",
      explicacao_tarefa: "Mostre os 3 passos práticos de como você organiza o serviço para empresas do mesmo segmento na região.",
      informacoes_necessarias: ["Serviço oferecido", "Segmento e cidade da empresa"],
      criterio_conclusao: "Exemplo prático enviado ou conversa de qualificação avançada.",
      proxima_acao_sugerida: "Identificar sinais de interesse para sugerir alinhamento rápido.",
      mensagem: `Assunto: Exemplo prático de ${foco} para ${nicho} em ${cidade}\n\nOlá, pessoal da ${nome}!\n\nOrganizei um passo a passo objetivo mostrando como negócios de ${nicho} em ${cidade} estruturam ${foco} para receber contatos mais qualificados no atendimento.\n\nSe quiserem dar uma olhada sem compromisso, me avisem por aqui que envio o material de 1 minuto.`,
      objecao_provavel: "Já fazemos isso internamente ou com parceiro",
      resposta_sugerida: "Excelente que já tenham essa frente ativa! Se quiserem apenas comparar a estrutura atual com esse modelo prático, envio sem compromisso.",
      cta: "Faz sentido receber esse comparativo rápido?"
    },
    {
      dia: 6,
      canal: "instagram",
      titulo_dia: "Validação de Prioridade Comercial",
      objetivo: "Entender se a aquisição de novos clientes é prioridade para a empresa neste mês",
      acao_sugerida: "Fazer pergunta leve de validação de momento comercial",
      explicacao_tarefa: "Verifique se a empresa tem interesse em avaliar o tema agora ou se prefere deixar para um próximo trimestre.",
      informacoes_necessarias: ["Status atualizado do lead no pipeline"],
      criterio_conclusao: "Momento comercial validado (prioridade atual vs. futuro).",
      proxima_acao_sugerida: "Preparar encerramento elegante do ciclo no Dia 7 caso continue sem retorno.",
      mensagem: `Olá, equipe da ${nome}! Para eu não ser insistente por aqui: organizar novas frentes de ${foco} em ${cidade} é algo que faz sentido avaliar neste mês ou hoje o foco de vocês está em outra prioridade?`,
      objecao_provavel: "Agora estamos focados em outra prioridade",
      resposta_sugerida: "Perfeito, faz todo sentido manter o foco! Agradeço o retorno sincero.",
      cta: "É uma prioridade para agora ou melhor deixarmos para mais adiante?"
    },
    {
      dia: 7,
      canal: "whatsapp",
      titulo_dia: "Encerramento Elegante do Ciclo e Organização do Pipeline",
      objetivo: "Encerrar a cadência com respeito, deixando a porta aberta e limpando a fila ativa",
      acao_sugerida: "Enviar mensagem final cordial e atualizar status do lead no CRM",
      explicacao_tarefa: "Finalize o ciclo de 7 dias sem pressão. Atualize o status do lead para manter seu pipeline organizado.",
      informacoes_necessarias: ["Histórico consolidado dos 6 dias anteriores"],
      criterio_conclusao: "Ciclo de 7 dias concluído e status final registrado no Zuno.",
      proxima_acao_sugerida: "Arquivar com respeito ou agendar revisão futura caso o cliente tenha pedido retorno.",
      mensagem: `Oi, pessoal da ${nome}! Passando apenas para encerrar meus contatos por aqui e não tomar o tempo de vocês na rotina.\n\nCaso em algum momento queiram avaliar ideias práticas de ${foco} para o segmento de ${nicho} em ${cidade}, fico à disposição neste número.\n\nDesejo excelentes negócios para vocês!`,
      objecao_provavel: "Obrigado pelo contato!",
      resposta_sugerida: "Por nada! Sucesso para toda a equipe da " + nome + ".",
      cta: "Fico à disposição quando precisarem. Bom trabalho!"
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
            acao_sugerida: i === 1 ? "Envio de mensagem inicial no WhatsApp" : `Acompanhamento consultivo do dia ${i}`,
            mensagem: msg,
            objecao_provavel: "Sem tempo para conversar agora",
            resposta_sugerida: "Compreendo perfeitamente. Posso te enviar um resumo prático de 1 minuto para ver quando puder?",
            cta: "Faz sentido enviar por aqui?",
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
          resposta_sugerida: "Ótimo! Podemos compartilhar apenas um exemplo específico para avaliarem sem compromisso.",
          cta: "Posso te mandar um resumo curto?",
        });
      }
      if (plano.abordagens_por_canal.email) {
        planoArray.push({
          dia: 3,
          canal: "email",
          acao_sugerida: "Envio de proposta/diagnóstico por E-mail",
          mensagem: plano.abordagens_por_canal.email,
          objecao_provavel: "Qual o valor do investimento?",
          resposta_sugerida: "Nosso modelo é dimensionado após entender seu objetivo atual na cidade.",
          cta: "Posso compartilhar uma demonstração de 1 minuto?",
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
      if (diag.justificativa) list.push(`Fato observado: ${diag.justificativa}`);
      if (diag.dor_provavel) list.push(`Hipótese comercial para investigar: ${diag.dor_provavel}`);
      if (diag.oportunidade) list.push(`Ângulo comercial recomendado: ${diag.oportunidade}`);
      if (diag.urgencia) list.push(`Prioridade sugerida de abordagem: ${diag.urgencia}`);
    }
  }

  if (list.length === 0) {
    const nome = lead?.nome || "a empresa";
    const nicho = lead?.nicho || "seu segmento";
    const cidade = lead?.cidade || "sua região";
    const focoRaw = lead?.foco || "Full Service";
    const foco = focoRaw === "zuno_internal_prospecting" ? "Oportunidade comercial" : focoRaw;

    list = [
      `Fato verificado: ${nome} localizada no segmento de ${nicho} em ${cidade}.`,
      `Ângulo comercial sugerido: abordagem consultiva adaptada ao serviço de ${foco}.`,
      `Canais públicos verificados para abertura de conversa sem promessas irreais.`,
      `Plano de prospecção em 7 dias com continuidade orientada conforme resposta do lead.`
    ];
  }

  return list.map(b => b.replace(/zuno_internal_prospecting/g, "Oportunidade comercial"));
}
