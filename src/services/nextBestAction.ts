import { hasExplicitOptOut } from "@/services/intelligentSevenDayPlan";
import { sanitizeBrazilianPhoneNumber } from "@/services/sdrProspectingService";
import { getRecommendedPlanDay, validateLeadChannelForDay } from "@/utils/analysisPresentation";
import type { LeadProspeccao, PlanoProspeccaoDia } from "@/types/lead";
import type { CommercialMaturity } from "@/types/commercialMaturity";

export type NextBestActionCategory =
  | "primeira_abordagem"
  | "pausa_espera"
  | "follow_up_cadencia"
  | "qualificacao"
  | "responder_duvida"
  | "negociacao"
  | "pos_venda"
  | "bloqueado_recusa"
  | "pesquisa_canal";

export interface NextBestAction {
  /** Categoria semântica da decisão comercial */
  category: NextBestActionCategory;
  /** Título direto e acionável em destaque */
  title: string;
  /** Rótulo para badge visual */
  badgeLabel: string;
  badgeClass: string;
  /** O motivo objetivo: por que esta é a ação certa agora */
  reason: string;
  /** Orientação prática de execução */
  guidance: string;
  /** Canal indicado para a ação */
  channel?: "whatsapp" | "email" | "instagram" | "telefone" | "nenhum";
  /** Ação primária clicável, se aplicável */
  primaryAction?: {
    label: string;
    actionType: "execute_sdr" | "scroll_to_plan" | "open_confirm_contact" | "none";
    dayNumber?: number;
  };
  /** Se a cadência fria de 7 dias ainda deve ser apresentada como orientação ativa */
  isColdCadenceActive: boolean;
  /** Follow-up agendado previamente detectado no CRM */
  scheduledFollowUp?: {
    date: string;
    action: string;
    isOverdue: boolean;
    isToday: boolean;
  } | null;
  /** Nível de maturidade comercial do assinante aplicado nesta recomendação */
  commercialMaturity?: CommercialMaturity;
}

export interface BuildNextBestActionOptions {
  diagnosisBullets?: readonly string[] | null;
  plano?: readonly PlanoProspeccaoDia[] | null;
  sellerService?: string | null;
  now?: Date;
  commercialMaturity?: CommercialMaturity;
}

export interface TimeIntervalMetrics {
  calendarHours: number;
  businessDays: number;
  businessHours: number;
  isWeekend: boolean;
  dayOfWeekName: string;
}

/**
 * Calcula intervalos em horas corridas vs dias/horas úteis comerciais,
 * identificando fins de semana e respeitando o ritmo de atendimento B2B.
 */
export function calculateTimeIntervalMetrics(startDate: Date, endDate: Date): TimeIntervalMetrics {
  const calendarHours = Math.max(0, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));
  const isWeekend = endDate.getDay() === 0 || endDate.getDay() === 6;
  const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const dayOfWeekName = dayNames[endDate.getDay()];

  let businessDays = 0;
  if (endDate > startDate) {
    const cur = new Date(startDate);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (cur < end) {
      cur.setDate(cur.getDate() + 1);
      const day = cur.getDay();
      if (day !== 0 && day !== 6) {
        businessDays++;
      }
    }
  }

  const businessHours = businessDays * 24;

  return {
    calendarHours,
    businessDays,
    businessHours,
    isWeekend,
    dayOfWeekName,
  };
}

/** Expressões que indicam pedido pontual de informação ou valores nas anotações */
const INFO_OR_PRICE_REGEX = /(?:quanto\s+custa|qual\s+(?:[eé]|o)\s+(?:valor|pre[cç]o)|tabela\s+de\s+pre[cç]o|pediu\s+(?:valores|or[cç]amento|pre[cç]o|info)|d[uú]vida\s+sobre\s+escopo)/i;

/** Expressões que indicam interesse comercial formal nas anotações */
const EXPLICIT_INTEREST_REGEX = /(?:demonstrou\s+interesse|tem\s+interesse|pediu\s+demonstra[cç][aã]o|quer\s+saber\s+mais|gostou\s+da\s+proposta|pediu\s+reuni[aã]o|solicitou\s+contato)/i;

/**
 * Motor determinístico da Próxima Melhor Ação (Next Best Action - NBA).
 * Analisa o contexto completo do lead (status, canal, histórico, anotações e intervalos)
 * e gera uma única recomendação comercial precisa, sem consumir IA probabilística.
 */
export function buildNextBestAction(
  lead: Partial<LeadProspeccao> | null | undefined,
  options: BuildNextBestActionOptions = {},
): NextBestAction {
  const now = options.now || new Date();
  const maturity: CommercialMaturity = options.commercialMaturity || "equilibrado";
  const rawStatus = (lead?.status || "novo").toLowerCase().trim();
  const servico = lead?.foco || options.sellerService || "seu serviço";
  const empresa = lead?.nome || "esta empresa";
  const segmento = lead?.nicho ? `no segmento de ${lead.nicho}` : "no seu segmento";
  const notas = [lead?.notas, (lead as any)?.custom_fields?.crm_flow?.observacao_rapida].filter(Boolean).join(" ");

  // 0. Checagem de follow-up programado no fluxo operacional do CRM
  const crmFlow = (lead as any)?.custom_fields?.crm_flow;
  let scheduledFollowUp: NextBestAction["scheduledFollowUp"] = null;
  if (crmFlow?.proximo_follow_up_em) {
    try {
      const scheduledDate = new Date(crmFlow.proximo_follow_up_em);
      if (!isNaN(scheduledDate.getTime())) {
        const todayStr = now.toISOString().split("T")[0];
        const schedStr = scheduledDate.toISOString().split("T")[0];
        scheduledFollowUp = {
          date: crmFlow.proximo_follow_up_em,
          action: crmFlow.proxima_acao || "Retomar contato planejado",
          isToday: schedStr === todayStr,
          isOverdue: schedStr < todayStr,
        };
      }
    } catch {
      // Ignora erro de parsing de data
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REGRA 7: Recusa formal / Opt-out ou Oportunidade perdida
  // ──────────────────────────────────────────────────────────────────────────
  if (lead && hasExplicitOptOut(lead)) {
    let guidance = `Nenhuma abordagem ativa deve ser enviada para ${empresa}. A recusa está registrada para proteger a reputação comercial e respeitar a LGPD.`;
    if (maturity === "iniciante") {
      guidance = `Esta empresa pediu para não receber mensagens. Não se preocupe, isso faz parte da prospecção! O importante é respeitar a decisão e focar em novos contatos.`;
    } else if (maturity === "intermediario") {
      guidance = `Recusa formal registrada. Respeite o opt-out, atualize o CRM e encerre tentativas ativas para manter sua reputação comercial protegida.`;
    } else if (maturity === "avancado") {
      guidance = `Opt-out registrado em conformidade com a LGPD e governança de canal. Bloqueio definitivo de novas tentativas para preservar o domínio e histórico da marca.`;
    }

    return {
      category: "bloqueado_recusa",
      title: "Respeitar Recusa e Suspender Novas Abordagens",
      badgeLabel: "Recusa / Opt-out",
      badgeClass: "border-destructive/40 bg-destructive/10 text-destructive",
      reason: "A empresa registrou recusa formal ou solicitou exclusão de contatos.",
      guidance,
      channel: "nenhum",
      primaryAction: { label: "Consultar Histórico", actionType: "scroll_to_plan" },
      isColdCadenceActive: false,
      scheduledFollowUp,
      commercialMaturity: maturity,
    };
  }

  if (rawStatus === "perdido") {
    let guidance = "A cadência fria foi finalizada. O lead foi marcado como perdido no funil. O histórico do plano de 7 dias abaixo permanece disponível apenas para consulta.";
    if (maturity === "iniciante") {
      guidance = "O lead foi arquivado no funil. Ciclo encerrado com tranquilidade; consulte os textos salvos caso queira revisar no futuro.";
    } else if (maturity === "intermediario") {
      guidance = "Oportunidade marcada como perdida no ciclo atual. Cadência fria suspensa para reavaliação em 90 dias.";
    } else if (maturity === "avancado") {
      guidance = "Oportunidade desqualificada ou encerrada no CRM. Histórico arquivado para inteligência comercial futura.";
    }

    return {
      category: "bloqueado_recusa",
      title: "Oportunidade Encerrada (Perdido)",
      badgeLabel: "Oportunidade Arquivada",
      badgeClass: "border-zinc-700 bg-zinc-800/80 text-zinc-400",
      reason: "O lead foi classificado como perdido ou sem aderência comercial no ciclo atual.",
      guidance,
      channel: "nenhum",
      primaryAction: { label: "Ver Histórico de Cópias", actionType: "scroll_to_plan" },
      isColdCadenceActive: false,
      scheduledFollowUp,
      commercialMaturity: maturity,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REGRA 6: Lead convertido em cliente
  // ──────────────────────────────────────────────────────────────────────────
  if (rawStatus === "convertido") {
    let guidance = `Parabéns! Este lead já foi convertido em cliente. A prospecção foi concluída com sucesso. Encaminhe ${empresa} para o processo de boas-vindas e início da entrega de ${servico}.`;
    if (maturity === "iniciante") {
      guidance = `Parabéns pela venda! O lead fechou com você. Agora dê as boas-vindas e comece a entrega de ${servico} com atenção.`;
    } else if (maturity === "intermediario") {
      guidance = `Lead convertido com sucesso! Inicie o alinhamento de onboarding e cronograma de entrega de ${servico}.`;
    } else if (maturity === "avancado") {
      guidance = `Contrato ganho. Conduza ${empresa} para o handoff de implantação, alinhando marcos de entrega e SLA de ${servico}.`;
    }

    return {
      category: "pos_venda",
      title: "Lead Convertido com Sucesso",
      badgeLabel: "Convertido · Cliente Ganho",
      badgeClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
      reason: "A prospecção foi concluída com sucesso e o lead fechou negócio.",
      guidance,
      channel: "nenhum",
      primaryAction: { label: "Ver Análise Salva", actionType: "scroll_to_plan" },
      isColdCadenceActive: false,
      scheduledFollowUp,
      commercialMaturity: maturity,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REGRA 5: Lead em negociação comercial ativa
  // ──────────────────────────────────────────────────────────────────────────
  if (rawStatus === "negociacao") {
    let guidance = `A cadência fria está desativada. O lead está em fase de proposta ou negociação comercial. Entre em contato direto com o decisor de ${empresa} para sanar dúvidas sobre o escopo de ${servico}, prazos e condições de fechamento.`;
    if (maturity === "iniciante") {
      guidance = `O cliente está conversando sobre a proposta! Fale com quem decide na ${empresa} para tirar as últimas dúvidas com calma e combinar o início.`;
    } else if (maturity === "intermediario") {
      guidance = `Lead em fase de proposta. Acompanhe ativamente: alinhe prazos, formato de entrega de ${servico} e contorne dúvidas finais de contratação.`;
    } else if (maturity === "avancado") {
      guidance = `Monitore a esteira de fechamento: mapeie eventuais aprovadores pendentes, valide termos contratuais de ${servico} e estabeleça data limite de validação da proposta.`;
    }

    return {
      category: "negociacao",
      title: "Lead em Negociação Ativa",
      badgeLabel: "Negociação Comercial",
      badgeClass: "border-orange-500/40 bg-orange-500/10 text-orange-300",
      reason: "O lead está avaliando proposta ou alinhando termos contratuais.",
      guidance,
      channel: "whatsapp",
      primaryAction: { label: "Registrar Andamento da Proposta", actionType: "open_confirm_contact" },
      isColdCadenceActive: false,
      scheduledFollowUp,
      commercialMaturity: maturity,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REGRA 4: Lead solicitou informações pontuais ou valores
  // ──────────────────────────────────────────────────────────────────────────
  if (INFO_OR_PRICE_REGEX.test(notas)) {
    let guidance = `Não envie mensagens de prospecção genéricas. Responda diretamente à dúvida sobre ${servico}, esclarecendo a lógica do investimento e fazendo uma pergunta simples ao final para manter a conversa fluida.`;
    if (maturity === "iniciante") {
      guidance = `Não envie textos longos de vendas. Responda com clareza à dúvida sobre ${servico} e faça uma pergunta simples no final para saber se a resposta ajudou.`;
    } else if (maturity === "intermediario") {
      guidance = `Responda à dúvida de escopo ou investimento de ${servico} de forma objetiva, fazendo uma pergunta prática sobre a rotina da empresa para manter o controle da conversa.`;
    } else if (maturity === "avancado") {
      guidance = `Apresente a faixa de investimento e critérios de precificação atrelados à complexidade operacional de ${servico}. Conduza para uma conversa técnica de alinhamento de necessidades.`;
    }

    return {
      category: "responder_duvida",
      title: "Responder Solicitação de Informações / Valores",
      badgeLabel: "Solicitou Informações",
      badgeClass: "border-blue-500/40 bg-blue-500/10 text-blue-300",
      reason: "A empresa fez uma pergunta pontual sobre preço, escopo ou formato do serviço.",
      guidance,
      channel: "whatsapp",
      primaryAction: { label: "Registrar Resposta Enviada", actionType: "open_confirm_contact" },
      isColdCadenceActive: false,
      scheduledFollowUp,
      commercialMaturity: maturity,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REGRA 3: Lead respondeu com interesse / Qualificação
  // ──────────────────────────────────────────────────────────────────────────
  if (rawStatus === "qualificacao" || EXPLICIT_INTEREST_REGEX.test(notas)) {
    let reason = "A empresa respondeu demonstrando abertura. A cadência fria foi interrompida imediatamente.";
    let guidance = `A cadência de prospecção fria foi pausada porque a empresa respondeu. Prossiga o atendimento no canal onde ela interagiu, aprofundando o diagnóstico da rotina de ${servico} e alinhando os próximos passos.`;

    if (maturity === "iniciante") {
      reason = "Boas notícias! A empresa respondeu e mostrou interesse em conversar.";
      guidance = `A cadência automática fria parou. Responda com simpatia no canal onde ela falou, agradecendo a atenção e fazendo uma pergunta simples para entender como eles trabalham hoje, sem afobação.`;
    } else if (maturity === "intermediario") {
      reason = "Interesse demonstrado. O lead avançou de prospecção fria para qualificação comercial.";
      guidance = `Cadência fria interrompida. Aprofunde a qualificação: entenda a rotina atual de atendimento da ${empresa}, valide quem é o responsável pela decisão e avalie se faz sentido agendar uma conversa breve sobre ${servico}.`;
    } else if (maturity === "avancado") {
      reason = "Sinal de engajamento positivo capturado. Lead qualificado para diagnóstico consultivo.";
      guidance = `Transicione o lead para discovery consultivo. Mapeie critérios de decisão, rotina de atendimento e disponibilidade do responsável para uma apresentação objetiva de proposta.`;
    }

    return {
      category: "qualificacao",
      title: "Lead em Qualificação (Interesse Demonstrado)",
      badgeLabel: "Qualificação · Interesse",
      badgeClass: "border-amber-500/40 bg-amber-500/10 text-amber-300",
      reason,
      guidance,
      channel: "whatsapp",
      primaryAction: { label: "Registrar Avanço da Qualificação", actionType: "open_confirm_contact" },
      isColdCadenceActive: false,
      scheduledFollowUp,
      commercialMaturity: maturity,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REGRA 2: Contato realizado, sem resposta registrada (Status 'em_contato')
  // IMPORTANTE: Status 'Em Contato' NÃO comprova resposta do lead!
  // ──────────────────────────────────────────────────────────────────────────
  if (rawStatus === "em_contato") {
    const lastInteractionAt = crmFlow?.ultima_interacao_em;
    let metrics: TimeIntervalMetrics = {
      calendarHours: 999,
      businessDays: 999,
      businessHours: 999,
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
      dayOfWeekName: ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"][now.getDay()],
    };

    if (lastInteractionAt) {
      const lastDate = new Date(lastInteractionAt);
      if (!isNaN(lastDate.getTime())) {
        metrics = calculateTimeIntervalMetrics(lastDate, now);
      }
    }

    // 2A. Se a data fictícia/atual cair em fim de semana (sábado ou domingo), pausa preventiva
    if (metrics.isWeekend && lastInteractionAt) {
      let guidance = `Não envie mensagens ativas hoje. Aguarde a reabertura comercial na segunda-feira às 09h para retomar a cadência no canal da recepção de ${empresa}.`;
      if (maturity === "iniciante") {
        guidance = "Hoje é fim de semana. Nada de mandar mensagem agora! Aproveite para descansar e retome na segunda-feira pela manhã.";
      } else if (maturity === "intermediario") {
        guidance = "Não envie mensagens comerciais em fins de semana. Aguarde a reabertura na segunda-feira às 09h para retomar a cadência com foco comercial.";
      } else if (maturity === "avancado") {
        guidance = "Mantenha a janela de proteção de fim de semana. Prospecção B2B em dias não úteis reduz a percepção de autoridade. Reative a cadência na segunda-feira às 09h.";
      }

      return {
        category: "pausa_espera",
        title: `Pausa de Fim de Semana (${metrics.dayOfWeekName})`,
        badgeLabel: "Fim de Semana · Aguardar",
        badgeClass: "border-zinc-700 bg-zinc-800/80 text-zinc-300",
        reason: `Hoje é ${metrics.dayOfWeekName.toLowerCase()} (${Math.round(metrics.calendarHours)}h corridas desde a abordagem). Disparos comerciais a frio em fins de semana reduzem drasticamente a conversão.`,
        guidance,
        channel: "nenhum",
        primaryAction: { label: "Consultar Plano de Cadência", actionType: "scroll_to_plan" },
        isColdCadenceActive: true,
        scheduledFollowUp,
        commercialMaturity: maturity,
      };
    }

    // 2B. Contato recente (menos de 48h úteis ou menos de 2 dias úteis transcorridos)
    if ((metrics.calendarHours < 48 || metrics.businessDays < 2) && lastInteractionAt) {
      let reason = `Abordagem realizada recentemente há ${Math.round(metrics.calendarHours)}h (${metrics.businessDays} dia útil transcorrido). Contatos diários consecutivos geram percepção de insistência desagradável.`;
      let guidance = `Dê tempo para ${empresa} visualizar a mensagem anterior. Mantenha a pausa técnica de 48h úteis e não envie novas mensagens hoje.`;

      if (maturity === "iniciante") {
        reason = `Você já mandou mensagem há ${Math.round(metrics.calendarHours)}h. Agora é normal a empresa demorar um pouco para ver.`;
        guidance = "Tenha calma e não mande outra mensagem hoje. No começo, a vontade de cobrar resposta pode parecer insistência. Dê o intervalo de 48h úteis e anote o contato no seu CRM.";
      } else if (maturity === "intermediario") {
        reason = `Abordagem realizada há ${Math.round(metrics.calendarHours)}h (${metrics.businessDays} dia útil). O timing comercial exige respeitar a rotina do lead.`;
        guidance = `Mantenha a pausa técnica de 48h úteis. Não repita a mensagem anterior. Enquanto aguarda, prepare o ângulo do Dia 3 para trazer um novo ponto de reflexão sobre ${servico} caso o silêncio persista.`;
      } else if (maturity === "avancado") {
        reason = `Primeira sondagem despachada há ${Math.round(metrics.calendarHours)}h (${metrics.businessDays} dia útil). Cadência respeitando janela de SLA operacional.`;
        guidance = "Mantenha o status 'Em Contato' em observação. Evite tocar o lead antes de 48h úteis. Se o silêncio persistir pós-intervalo, ative follow-up focado em processo ou avalie canal alternativo.";
      }

      return {
        category: "pausa_espera",
        title: "Aguardar Retorno Natural da Recepção (Pausa Técnica)",
        badgeLabel: "Intervalo Técnico · Em Espera",
        badgeClass: "border-zinc-700 bg-zinc-800/80 text-zinc-300",
        reason,
        guidance,
        channel: "nenhum",
        primaryAction: { label: "Consultar Plano de Cadência", actionType: "scroll_to_plan" },
        isColdCadenceActive: true,
        scheduledFollowUp,
        commercialMaturity: maturity,
      };
    }

    // 2C. Mais de 48h de silêncio: Recomenda próxima tentativa relevante da cadência
    const recommendedDay = getRecommendedPlanDay(options.plano);
    if (recommendedDay && recommendedDay.dia <= 5) {
      const channelVal = validateLeadChannelForDay(lead, recommendedDay.canal);
      let reason = `Intervalo técnico de 48h concluído (${Math.round(metrics.calendarHours)}h corridas / ${metrics.businessDays} dias úteis) sem retorno registrado da abordagem anterior.`;
      let guidance = channelVal.isAvailable
        ? `Envie a mensagem do Dia ${recommendedDay.dia} (${recommendedDay.canal}) abordando um novo ângulo de ${servico}, sem cobranças do tipo 'você viu minha mensagem'.`
        : `A etapa sugerida é via ${recommendedDay.canal}, mas o canal não está disponível no cadastro. ${channelVal.suggestedAlternative || "Utilize o WhatsApp comercial como alternativa."}`;

      if (maturity === "iniciante") {
        reason = `Já se passaram ${metrics.businessDays} dias úteis desde a primeira mensagem e a empresa ainda não respondeu.`;
        guidance = channelVal.isAvailable
          ? `É hora de um acompanhamento gentil (Dia ${recommendedDay.dia}). Envie uma mensagem leve trazendo uma dúvida rápida sobre ${servico}, sem cobrar ('você viu minha mensagem?').`
          : `A etapa sugerida é via ${recommendedDay.canal}, mas o canal não está cadastrado. Utilize o WhatsApp comercial com mensagem gentil.`;
      } else if (maturity === "intermediario") {
        reason = `Janela de 48h úteis cumprida sem retorno. Hora de avançar para a próxima etapa da cadência.`;
        guidance = channelVal.isAvailable
          ? `Envie o acompanhamento do Dia ${recommendedDay.dia} (${recommendedDay.canal}) trazendo um novo ponto consultivo sobre a rotina de ${servico}, sem cobranças passivo-agressivas.`
          : `A etapa sugerida é via ${recommendedDay.canal}, mas o canal não está no cadastro. Utilize o WhatsApp comercial como alternativa.`;
      } else if (maturity === "avancado") {
        reason = `Intervalo técnico de cadência esgotado sem retorno (${metrics.businessDays} dias úteis).`;
        guidance = channelVal.isAvailable
          ? `Despache o follow-up estruturado do Dia ${recommendedDay.dia} (${recommendedDay.canal}) abordando impacto operacional de ${servico}. Mantenha tom executivo antes de avaliar descarte.`
          : `Canal ${recommendedDay.canal} indisponível no cadastro. Utilize canal corporativo principal para o follow-up.`;
      }

      return {
        category: "follow_up_cadencia",
        title: `Enviar Acompanhamento Consultivo (Dia ${recommendedDay.dia})`,
        badgeLabel: `Cadência · Dia ${recommendedDay.dia}`,
        badgeClass: "border-[#10d98a]/40 bg-[#10d98a]/10 text-[#10d98a]",
        reason,
        guidance,
        channel: recommendedDay.canal,
        primaryAction: {
          label: `Ver Mensagem do Dia ${recommendedDay.dia}`,
          actionType: "scroll_to_plan",
          dayNumber: recommendedDay.dia,
        },
        isColdCadenceActive: true,
        scheduledFollowUp,
        commercialMaturity: maturity,
      };
    }

    // 2D. 3 tentativas esgotadas sem resposta: Encerramento interno no CRM
    let guidance = `Encerre o envio de mensagens ativas para respeitar o tempo de ${empresa}. Atualize o status para 'perdido' ou arquivado e programe reavaliação para daqui a 90 dias.`;
    if (maturity === "iniciante") {
      guidance = "Você fez as 3 tentativas certinho e eles não responderam. Tudo bem! Encerre esta conversa no CRM sem peso e parta para a próxima empresa.";
    } else if (maturity === "intermediario") {
      guidance = "3 tentativas concluídas sem retorno. Encerre a cadência fria, marque como 'perdido' e agende uma reavaliação no CRM para daqui a 90 dias.";
    } else if (maturity === "avancado") {
      guidance = "Ciclo de 3 toques atômicos esgotado sem engajamento. Arquive a oportunidade no CRM e libere o pipeline para prospects com maior prontidão.";
    }

    return {
      category: "follow_up_cadencia",
      title: "Encerrar Cadência Fria e Arquivar no CRM",
      badgeLabel: "Ciclo Concluído · Sem Resposta",
      badgeClass: "border-zinc-700 bg-zinc-800/80 text-zinc-400",
      reason: "As 3 tentativas ativas de contato foram realizadas sem retorno da empresa.",
      guidance,
      channel: "nenhum",
      primaryAction: { label: "Registrar Conclusão no CRM", actionType: "open_confirm_contact" },
      isColdCadenceActive: false,
      scheduledFollowUp,
      commercialMaturity: maturity,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REGRA 1: Lead novo, sem abordagem registrada (Status 'novo')
  // ──────────────────────────────────────────────────────────────────────────
  const dia1 = options.plano?.find((d) => d.dia === 1);
  const whatsappChannelVal = validateLeadChannelForDay(lead, "whatsapp");

  // Se o WhatsApp estiver verificado e pronto
  if (whatsappChannelVal.isAvailable) {
    let reason = `Empresa recém-capturada ${segmento} sem histórico de contato registrado.`;
    let guidance = `Inicie com uma abordagem profissional e objetiva focada em ${servico}, confirmando se este WhatsApp é o canal da recepção para novos agendamentos sem presumir intimidade.`;

    if (maturity === "iniciante") {
      reason = `Empresa recém-capturada ${segmento}. Você ainda não enviou nenhuma mensagem para ela.`;
      guidance = `Dê um primeiro passo simples: envie a mensagem pelo WhatsApp e aguarde a resposta. Não se preocupe em vender nem falar de preços agora; o único objetivo deste contato inicial é confirmar se este número recebe agendamentos e abrir uma conversa com naturalidade.`;
    } else if (maturity === "intermediario") {
      reason = `Empresa sem abordagem anterior registrada ${segmento}. Oportunidade de abertura e qualificação inicial.`;
      guidance = `Inicie o contato via WhatsApp para validar o canal de agendamentos da ${empresa}. Caso confirmem, faça uma pergunta objetiva de qualificação para entender como organizam a rotina de atendimento e se há interesse em conhecer ${servico}.`;
    } else if (maturity === "avancado") {
      reason = `Novo prospect identificado ${segmento}. Mapeamento de canal e contato comercial pendente.`;
      guidance = `Inicie a abordagem mapeando com objetividade se este WhatsApp concentra os agendamentos da ${empresa} ou se há outro contato da gestão. Mantenha a condução direta e profissional, qualificando rapidamente o canal para apresentar ${servico}.`;
    }

    return {
      category: "primeira_abordagem",
      title: "Enviar Primeira Abordagem via WhatsApp",
      badgeLabel: "Primeira Abordagem · Novo",
      badgeClass: "border-[#10d98a]/40 bg-[#10d98a]/10 text-[#10d98a]",
      reason,
      guidance,
      channel: "whatsapp",
      primaryAction: {
        label: "Executar Dia 1 no SDR",
        actionType: "execute_sdr",
        dayNumber: 1,
      },
      isColdCadenceActive: true,
      scheduledFollowUp,
      commercialMaturity: maturity,
    };
  }

  // Se o telefone for fixo e não tiver WhatsApp verificado
  if (lead?.telefone && !whatsappChannelVal.isAvailable) {
    let guidance = "Ligue no número da recepção para solicitar o contato direto de WhatsApp ou pesquise o celular comercial no Google Maps antes de disparar mensagens.";
    if (maturity === "iniciante") {
      guidance = "O telefone parece ser fixo da recepção. Ligue com educação, diga seu nome e peça o contato de WhatsApp da pessoa que cuida do atendimento.";
    } else if (maturity === "intermediario") {
      guidance = "Telefone fixo cadastrado. Faça uma ligação rápida para a recepção a fim de mapear o WhatsApp comercial direto ou o contato do responsável.";
    } else if (maturity === "avancado") {
      guidance = `Telefone fixo da recepção. Identifique o contato direto ou WhatsApp de atendimento da ${empresa} antes de iniciar o envio de mensagens.`;
    }

    return {
      category: "pesquisa_canal",
      title: "Confirmar Canal de Atendimento da Recepção",
      badgeLabel: "Canal Pendente · Telefone Fixo",
      badgeClass: "border-amber-500/40 bg-amber-500/10 text-amber-300",
      reason: "O telefone cadastrado aparenta ser fixo e o WhatsApp não foi confirmado no site.",
      guidance,
      channel: "telefone",
      primaryAction: { label: "Consultar Plano de 7 Dias", actionType: "scroll_to_plan" },
      isColdCadenceActive: true,
      scheduledFollowUp,
      commercialMaturity: maturity,
    };
  }

  // Se não houver nem telefone nem e-mail
  return {
    category: "pesquisa_canal",
    title: "Localizar Contato Público da Empresa",
    badgeLabel: "Dados Ausentes · Pesquisa",
    badgeClass: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    reason: "A empresa não possui telefone ou e-mail registrado no cadastro público.",
    guidance: `Pesquise o site oficial ou o perfil no Google Maps de ${empresa} para obter o contato comercial antes de iniciar a cadência de prospecção.`,
    channel: "nenhum",
    primaryAction: { label: "Consultar Plano", actionType: "scroll_to_plan" },
    isColdCadenceActive: true,
    scheduledFollowUp,
    commercialMaturity: maturity,
  };
}
