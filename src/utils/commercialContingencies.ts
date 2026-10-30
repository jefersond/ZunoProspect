import type { LeadProspeccao } from "@/types/lead";
import type { SellerProfile } from "../../supabase/functions/_shared/lead-analysis";

export interface CommercialContingencyItem {
  id: string;
  cenario: string;
  situacao: string;
  respostaSugerida: string;
  orientacaoCrm: string;
  proximaAcao: string;
  canalRecomendado: "whatsapp" | "email" | "instagram" | "qualquer";
}

export interface CommercialContingenciesPackage {
  empresa: string;
  servico: string;
  nicho: string;
  cidade: string;
  items: CommercialContingencyItem[];
}

interface BuildContingencyOptions {
  lead: Partial<LeadProspeccao> | null | undefined;
  sellerProfile?: SellerProfile | null;
  foco?: string | null;
}

const resolveServiceLabel = (options: BuildContingencyOptions): string => {
  if (options.sellerProfile?.service_offered?.trim()) {
    return options.sellerProfile.service_offered.trim();
  }
  if (options.foco?.trim()) {
    return options.foco.trim();
  }
  if (options.lead?.foco?.trim()) {
    return options.lead.foco.trim();
  }
  return "soluções comerciais";
};

const resolveCategory = (options: BuildContingencyOptions): string => {
  if (options.sellerProfile?.service_category) {
    return options.sellerProfile.service_category;
  }
  const foco = (options.foco || options.lead?.foco || "").toLowerCase();
  if (foco.includes("crm")) return "crm";
  if (foco.includes("auto")) return "automacao";
  if (foco.includes("site") || foco.includes("landing")) return "sites";
  if (foco.includes("tráfego") || foco.includes("trafego")) return "trafego";
  if (foco.includes("social") || foco.includes("instagram")) return "social_media";
  if (foco.includes("profissionais")) return "servicos_profissionais";
  return "outro";
};

/**
 * Constrói as etapas metodológicas para a resposta de "mais informações" de acordo com
 * o serviço real prestado pelo vendedor, evitando jargões de marketing quando a oferta
 * for de processos, CRM, sites ou automação operacional.
 */
function buildMethodologySteps(category: string, servico: string, nicho: string, localSuffix: string): string {
  switch (category) {
    case "crm":
      return `1. Mapeamos como os orçamentos e solicitações chegam hoje na empresa e onde ocorrem perdas ou atrasos no retorno.\n2. Estruturamos o funil de atendimento e acompanhamento para que nenhum contato de ${nicho} fique sem resposta.\n3. Acompanhamos a agilidade de retorno e o controle das negociações.`;
    case "automacao":
      return `1. Mapeamos as dúvidas e perguntas mais frequentes que chegam no atendimento de ${nicho}${localSuffix}.\n2. Implementamos triagem rápida, confirmações e respostas automáticas para que os clientes não fiquem esperando.\n3. Acompanhamos a redução no tempo de espera e a organização das conversas.`;
    case "sites":
      return `1. Analisamos como a empresa e seus produtos/serviços são apresentados hoje para quem pesquisa ou recebe indicação.\n2. Desenvolvemos uma página rápida, clara e adaptada para celular, com botão direto de contato e apresentação clara.\n3. Facilitamos para que quem se interessar consiga tirar dúvidas ou pedir orçamento em poucos segundos.`;
    case "social_media":
      return `1. Alinhamos a comunicação e os destaques visuais para valorizar a imagem de ${nicho}${localSuffix}.\n2. Estruturamos postagens e orientações visuais pensadas para despertar interesse e gerar conversas reais.\n3. Organizamos os canais para transformar visualizações em contatos comerciais diretos.`;
    case "trafego":
      return `1. Mapeamos os termos e intenções reais de compra de quem procura por ${nicho}${localSuffix}.\n2. Estruturamos campanhas direcionadas para pessoas com necessidade ativa no momento exato da busca.\n3. Acompanhamos semanalmente os contatos e pedidos de orçamento gerados.`;
    default:
      return `1. Mapeamos as demandas e necessidades práticas de clientes de ${nicho}${localSuffix}.\n2. Ajustamos o processo para que os contatos cheguem direto ao atendimento com o menor atrito possível.\n3. Acompanhamos semanalmente as oportunidades reais geradas.`;
  }
}

/**
 * Constrói as 7 respostas de contingência tática personalizadas com base nos dados reais do lead
 * e no serviço/oferta do assinante, cobrindo os cenários mais frequentes de resposta e silêncio.
 */
export function buildCommercialContingencies(options: BuildContingencyOptions): CommercialContingenciesPackage {
  const lead = options.lead;
  const empresa = (lead?.nome || "a empresa").trim();
  const nicho = (lead?.nicho || "o segmento").trim();
  const cidade = (lead?.cidade || "").trim();
  const servico = resolveServiceLabel(options);
  const category = resolveCategory(options);
  const sellerName = options.sellerProfile?.display_name?.trim() || "";

  const localSuffix = cidade ? ` em ${cidade}` : "";
  const steps = buildMethodologySteps(category, servico, nicho, localSuffix);

  const items: CommercialContingencyItem[] = [
    {
      id: "interesse",
      cenario: "O lead demonstrou interesse",
      situacao: "A empresa respondeu positivamente, disse que quer saber mais ou perguntou como funciona.",
      respostaSugerida: `Excelente! Agradeço pelo retorno, ${empresa}. Para alinharmos de forma rápida e prática: você prefere que eu te mande um resumo objetivo de como aplicamos ${servico} para empresas de ${nicho}${localSuffix}, ou fica mais fácil falarmos 5 a 10 minutos esta semana?`,
      orientacaoCrm: "Atualizar status do lead para 'qualificacao' ou 'interessado' e agendar follow-up de alinhamento.",
      proximaAcao: "Definir horário para demonstração ou alinhamento direto.",
      canalRecomendado: "whatsapp",
    },
    {
      id: "mais_informacoes",
      cenario: "O lead pediu mais informações",
      situacao: "A empresa quer entender o método de trabalho, etapas ou formato antes de se comprometer com uma reunião.",
      respostaSugerida: `Com certeza! Nosso trabalho com ${servico} é bem direto:\n${steps}\n\nFaz sentido avaliarmos como isso se aplicaria na rotina de vocês?`,
      orientacaoCrm: "Registrar a explicação no histórico e aguardar retorno por até 48h.",
      proximaAcao: "Aguardar retorno; se houver silêncio, enviar pergunta de validação em 2 dias.",
      canalRecomendado: "whatsapp",
    },
    {
      id: "ja_possui_fornecedor",
      cenario: "O lead disse que já possui fornecedor",
      situacao: "A empresa informou que já tem agência, profissional interno ou parceiro cuidando dessa área.",
      respostaSugerida: `Compreendo perfeitamente, ${empresa}! É ótimo saber que vocês já contam com alguém cuidando disso. Minha intenção não é substituir nada que já esteja funcionando bem, mas sim somar ou apresentar um ângulo específico de ${servico} para ${nicho}. Se em algum momento fizer sentido comparar ideias ou trocar uma experiência, meu contato fica à disposição por aqui!`,
      orientacaoCrm: "Não confrontar o fornecedor atual. Manter relacionamento cordial e registrar anotação no CRM.",
      proximaAcao: "Arquivar ou programar reativação de relacionamento para 60 a 90 dias.",
      canalRecomendado: "whatsapp",
    },
    {
      id: "nao_e_o_momento",
      cenario: "O lead disse que não é o momento",
      situacao: "A empresa alegou falta de tempo, orçamento apertado ou prioridades internas no período.",
      respostaSugerida: `Perfeito, agradeço muito pela franqueza! O momento da empresa sempre vem em primeiro lugar. Vou deixar nosso contato registrado por aqui e, se fizer sentido para vocês, retomo contato daqui a 30 ou 60 dias para saber como estão os projetos de ${nicho}. Desejo muito sucesso na rotina de vocês!`,
      orientacaoCrm: "Respeitar a resposta sem insistência comercial. Definir tarefa futura no CRM.",
      proximaAcao: "Programar lembrete de follow-up para daqui a 30-45 dias.",
      canalRecomendado: "whatsapp",
    },
    {
      id: "contato_nao_e_responsavel",
      cenario: "O contato não é o responsável",
      situacao: "A mensagem foi recebida por recepcionista, atendente ou pessoa que não toma decisões comerciais.",
      respostaSugerida: `Entendido! Muito obrigado pela ajuda. Você saberia me orientar com quem seria melhor eu falar sobre ${servico} para a ${empresa}, ou conseguiria repassar meu contato para a pessoa responsável? Desde já, agradeço pela atenção!`,
      orientacaoCrm: "Identificar o nome e canal do decisor correto e atualizar o cadastro do lead.",
      proximaAcao: "Registrar contato do responsável ou enviar abertura direta pelo canal indicado.",
      canalRecomendado: "whatsapp",
    },
    {
      id: "nao_respondeu",
      cenario: "O lead não respondeu (silêncio)",
      situacao: "A mensagem foi entregue, mas a empresa ainda não visualizou ou não retornou o contato.",
      respostaSugerida: `Regra de cadência: Respeite o intervalo mínimo de 2 a 3 dias úteis. NUNCA envie mensagens de cobrança passiva como 'conseguiu ver minha mensagem?' ou 'passando só para lembrar'. No próximo contato agendado no plano de 7 dias, traga uma nova perspectiva prática ou uma pergunta simples de rotina sobre ${nicho}.`,
      orientacaoCrm: "Seguir estritamente o cronograma do plano de 7 dias sem disparos em duplicidade.",
      proximaAcao: "Executar o próximo dia previsto na cadência comercial.",
      canalRecomendado: "whatsapp",
    },
    {
      id: "pediu_para_parar",
      cenario: "O lead pediu para não receber mensagens (Opt-out)",
      situacao: "A empresa solicitou explicitamente para não ser mais contatada ou pediu para sair da lista.",
      respostaSugerida: `Compreendido e respeitado perfeitamente! Já registrei aqui e não enviarei novos contatos. Desejo muito sucesso aos negócios de vocês${localSuffix}!`,
      orientacaoCrm: "IMEDIATO: Alterar status do lead para 'recusou_optout'. O sistema bloqueia disparos subsequentes.",
      proximaAcao: "Encerrar o ciclo. Nenhuma nova abordagem permitida para este registro.",
      canalRecomendado: "whatsapp",
    },
  ];

  return {
    empresa,
    servico,
    nicho,
    cidade,
    items,
  };
}
