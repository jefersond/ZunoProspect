import { isAdminEmail } from "@/config/admin";

export interface LabUserIdentity {
  id?: string | null;
  email?: string | null;
}

export interface LabProfileIdentity {
  id?: string | null;
  email?: string | null;
  role?: string | null;
  is_admin?: boolean | null;
}

export interface LabSecurityAuditResult {
  allowed: boolean;
  isAdminVerified: boolean;
  labFlagEnabled: boolean;
  attemptedUrlBypassDetected: boolean;
  reason: string;
}

export interface RoadmapEvolutionItem {
  id: number;
  title: string;
  phase: "fase_1_laboratorio_admin" | "fase_2_addons_comerciais" | "fase_3_avancada";
  status: "ativo_no_laboratorio" | "planejado_addon" | "arquitetura_futura";
  category: "missoes" | "plano_7_dias" | "sdr_copy" | "dossie_score" | "governanca";
  summary: string;
  userBenefit: string;
}

export interface CopyReviewComparisonItem {
  id: string;
  section:
    | "analise_leads"
    | "sdr_3_estilos"
    | "plano_7_dias"
    | "landing_beneficios"
    | "planos_starter_pro_agency";
  sectionLabel: string;
  contextLabel: string;
  beforeText: string;
  afterText: string;
  whyImproved: string;
}

const LAB_FLAG_STORAGE_PREFIX = "zuno_next_v2_lab_enabled_";
const memoryStorageMap = new Map<string, string>();

const memoryStorageFallback: Pick<Storage, "getItem" | "setItem" | "clear"> = {
  getItem: (key: string) => (memoryStorageMap.has(key) ? memoryStorageMap.get(key)! : null),
  setItem: (key: string, value: string) => {
    memoryStorageMap.set(key, value);
  },
  clear: () => {
    memoryStorageMap.clear();
  },
};

export function clearZunoNextLabMemoryStorage(): void {
  memoryStorageMap.clear();
}

function getSafeStorage(): Pick<Storage, "getItem" | "setItem" | "clear"> {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // fallback silencioso em ambientes restritos
  }
  return memoryStorageFallback;
}

/**
 * Verifica se o usuário autenticado possui permissão real de Admin.
 *
 * REGRAS DE SEGURANÇA INVIOLÁVEIS:
 * 1. NUNCA confia em parâmetros de URL (?admin=true, ?lab=true).
 * 2. NUNCA permite elevação de privilégios por campos de perfil modificáveis pelo próprio usuário
 *    (ex: role: 'admin' ou is_admin: true em contas de e-mail comuns).
 * 3. Exige estritamente que o e-mail autenticado no Supabase Auth pertença à allowlist oficial.
 */
export function canAccessZunoNextLab(
  user?: LabUserIdentity | null,
  profile?: LabProfileIdentity | null
): boolean {
  if (!user || (!user.id && !user.email)) {
    return false;
  }
  const email = user.email || profile?.email;
  return isAdminEmail(email);
}

/**
 * Audita a tentativa de acesso ao Laboratório Zuno, detectando e bloqueando
 * qualquer tentativa de bypass via query string (?admin=true ou ?lab=true).
 */
export function validateLabAccessSecurity({
  user,
  profile,
  urlSearch = "",
}: {
  user?: LabUserIdentity | null;
  profile?: LabProfileIdentity | null;
  urlSearch?: string;
}): LabSecurityAuditResult {
  const params = new URLSearchParams(urlSearch || "");
  const hasUrlBypassAttempt =
    params.get("admin") === "true" ||
    params.get("admin") === "1" ||
    params.get("lab") === "true" ||
    params.get("is_admin") === "true";

  const isAdminVerified = canAccessZunoNextLab(user, profile);

  if (!isAdminVerified) {
    return {
      allowed: false,
      isAdminVerified: false,
      labFlagEnabled: false,
      attemptedUrlBypassDetected: hasUrlBypassAttempt,
      reason: hasUrlBypassAttempt
        ? "Acesso negado: parâmetros de URL (?admin=true) não concedem acesso ao Laboratório Zuno."
        : "Acesso restrito exclusivamente ao e-mail de administrador autenticado.",
    };
  }

  const labFlagEnabled = isZunoNextLabEnabled(user?.id || "admin_default");

  return {
    allowed: labFlagEnabled,
    isAdminVerified: true,
    labFlagEnabled,
    attemptedUrlBypassDetected: false,
    reason: labFlagEnabled
      ? "Acesso autorizado ao Laboratório Zuno (Admin verificado + Feature Flag ativa)."
      : "Laboratório Zuno pausado pelo Kill-Switch local do administrador.",
  };
}

/**
 * Consulta o estado da feature flag do Laboratório Zuno isolado por user_id.
 * ESCOPO: Opera no armazenamento deste navegador/dispositivo específico.
 */
export function isZunoNextLabEnabled(userId?: string | null): boolean {
  const safeId = (userId || "admin_default").trim();
  const storage = getSafeStorage();
  const raw = storage.getItem(`${LAB_FLAG_STORAGE_PREFIX}${safeId}`);
  if (raw === null) return true;
  return raw === "true";
}

/**
 * Ativa ou desativa a feature flag do Laboratório Zuno para o Admin atual neste navegador.
 */
export function setZunoNextLabEnabled(userId: string | null | undefined, enabled: boolean): boolean {
  const safeId = (userId || "admin_default").trim();
  const storage = getSafeStorage();
  storage.setItem(`${LAB_FLAG_STORAGE_PREFIX}${safeId}`, enabled ? "true" : "false");
  return enabled;
}

/**
 * Kill-Switch Local do Navegador: desativa imediatamente as funcionalidades experimentais
 * nesta sessão/dispositivo sem afetar assinantes nem alterar banco de dados.
 *
 * ARQUITETURA DE DESLIGAMENTO CENTRALIZADO (Para produção futura, se autorizado):
 * - Leitura de flag remota em tabela de controle ou Edge Function check-feature-flags
 *   com cache curto e kill-switch no backend.
 */
export function triggerLabKillSwitch(userId?: string | null): {
  disabled: boolean;
  timestamp: string;
  scope: "local_browser";
} {
  setZunoNextLabEnabled(userId, false);
  return {
    disabled: true,
    timestamp: new Date().toISOString(),
    scope: "local_browser",
  };
}

/**
 * Retorna true SOMENTE se o usuário for Admin autenticado E a feature flag estiver ativa.
 * Para assinantes comuns ou visitantes, SEMPRE retorna false.
 */
export function isZunoNextLabActiveForUser(
  user?: LabUserIdentity | null,
  profile?: LabProfileIdentity | null
): boolean {
  if (!canAccessZunoNextLab(user, profile)) {
    return false;
  }
  return isZunoNextLabEnabled(user?.id);
}

/**
 * Catálogo das 20 evoluções do produto organizadas em Fase 1 (Laboratório Admin),
 * Fase 2 (Add-ons Comerciais) e Fase 3 (Avançada).
 */
export const ZUNO_NEXT_ROADMAP_20: RoadmapEvolutionItem[] = [
  {
    id: 1,
    title: "Zuno Missões (Missão Comercial Guiada)",
    phase: "fase_1_laboratorio_admin",
    status: "ativo_no_laboratorio",
    category: "missoes",
    summary: "Configuração orientada de missão com serviço oferecido, cidade, segmento, objetivo e compatibilidade mínima.",
    userBenefit: "Transforma a busca solta em uma operação diária com meta e prioridade claras.",
  },
  {
    id: 2,
    title: "Score de Compatibilidade Configurável (0 a 100)",
    phase: "fase_1_laboratorio_admin",
    status: "ativo_no_laboratorio",
    category: "dossie_score",
    summary: "Índice explicável baseado apenas em dados verificáveis, com filtro editável (padrão 70/100) e transparência de motivos.",
    userBenefit: "Permite focar imediatamente nas empresas com melhores canais e aderência cadastral.",
  },
  {
    id: 3,
    title: "Dossiê Comercial por Empresa",
    phase: "fase_1_laboratorio_admin",
    status: "ativo_no_laboratorio",
    category: "dossie_score",
    summary: "Separação rigorosa entre 'O QUE SABEMOS' (fatos) e 'POSSÍVEIS ÂNGULOS COMERCIAIS' (hipóteses para investigar).",
    userBenefit: "Evita gafes comerciais e prepara o assinante com contexto real antes do contato.",
  },
  {
    id: 4,
    title: "Plano Inteligente de 7 Dias (Adaptativo por Histórico)",
    phase: "fase_1_laboratorio_admin",
    status: "ativo_no_laboratorio",
    category: "plano_7_dias",
    summary: "Evolução dos 7 dias com instruções passo a passo, critério de conclusão e adaptação real conforme resposta ou opt-out.",
    userBenefit: "Impede sugerir mensagem fria se o lead já respondeu, agendou reunião ou pediu para não receber contato.",
  },
  {
    id: 5,
    title: "Fila Diária de Execução Comercial Priorizada",
    phase: "fase_1_laboratorio_admin",
    status: "ativo_no_laboratorio",
    category: "missoes",
    summary: "Ordenação automática das oportunidades prioritárias da missão com bloqueio de duplicidades.",
    userBenefit: "Reduz o tempo de escolha de quem abordar primeiro a cada manhã.",
  },
  {
    id: 6,
    title: "SDR Personalizado por Serviço e Sinal Verificável",
    phase: "fase_1_laboratorio_admin",
    status: "ativo_no_laboratorio",
    category: "sdr_copy",
    summary: "Mudança real de argumento comercial conforme o serviço (Tráfego, Sites, Social Media, Clínicas) nos 3 estilos.",
    userBenefit: "Elimina mensagens com cara de robô e aumenta a naturalidade da abertura no WhatsApp.",
  },
  {
    id: 7,
    title: "Memória do Perfil Comercial do Assinante",
    phase: "fase_1_laboratorio_admin",
    status: "ativo_no_laboratorio",
    category: "missoes",
    summary: "Persistência isolada por usuário do serviço oferecido, cidade-alvo, nicho, estilo preferido e nota mínima.",
    userBenefit: "Evita redigitar o serviço e mantém todas as mensagens alinhadas à especialidade do assinante.",
  },
  {
    id: 10,
    title: "Detector de Dados Incompletos e Limitações de Análise",
    phase: "fase_1_laboratorio_admin",
    status: "ativo_no_laboratorio",
    category: "dossie_score",
    summary: "Identifica lacunas cadastrais (ex: sem site ou sem WhatsApp móvel) e adapta o tom para abordagem neutra.",
    userBenefit: "Protege a credibilidade do assinante evitando citar canais que a empresa não possui.",
  },
  {
    id: 14,
    title: "Modo 'Próxima Melhor Ação' por Lead e Missão",
    phase: "fase_1_laboratorio_admin",
    status: "ativo_no_laboratorio",
    category: "plano_7_dias",
    summary: "Recomendação determinística do próximo passo exato com base no último status e dia concluído.",
    userBenefit: "Garante continuidade no dia seguinte sem avançar artificialmente etapas não executadas.",
  },
  {
    id: 19,
    title: "Biblioteca de Objeções Reais e Respostas Consultivas",
    phase: "fase_1_laboratorio_admin",
    status: "ativo_no_laboratorio",
    category: "sdr_copy",
    summary: "Mapeamento de objeções frequentes por etapa e serviço com respostas tranquilas e sem pressão.",
    userBenefit: "Ajuda o assinante a contornar 'já tenho agência' ou 'estou sem tempo' com segurança.",
  },
  {
    id: 8,
    title: "Matriz Avançada de Sazonalidade por Nicho Local",
    phase: "fase_2_addons_comerciais",
    status: "planejado_addon",
    category: "sdr_copy",
    summary: "Sugestão de ganchos comerciais conforme calendário comercial de cada segmento (estética, saúde, varejo).",
    userBenefit: "Conecta a abordagem a demandas reais do mês da empresa.",
  },
  {
    id: 9,
    title: "Lembretes Inteligentes de Follow-up Sem Insistência",
    phase: "fase_2_addons_comerciais",
    status: "planejado_addon",
    category: "plano_7_dias",
    summary: "Agenda interna de retorno para leads que pediram contato na semana seguinte.",
    userBenefit: "Evita esquecer leads mornos sem ser invasivo.",
  },
  {
    id: 11,
    title: "Simulador Interativo de Treino de Objeções",
    phase: "fase_2_addons_comerciais",
    status: "planejado_addon",
    category: "sdr_copy",
    summary: "Ambiente de prática rápida para freelancers treinarem respostas antes de ligar ou enviar áudio.",
    userBenefit: "Aumenta a confiança comercial de quem está começando a prospectar.",
  },
  {
    id: 12,
    title: "Preparador de Reunião Expressa de 15 Minutos",
    phase: "fase_2_addons_comerciais",
    status: "planejado_addon",
    category: "dossie_score",
    summary: "Checklist de 5 perguntas diagnósticas geradas a partir do dossiê quando o lead aceita conversar.",
    userBenefit: "Transforma respostas positivas em reuniões estruturadas.",
  },
  {
    id: 13,
    title: "Gerador de Resumo Pós-Conversa e Proposta Enxuta",
    phase: "fase_2_addons_comerciais",
    status: "planejado_addon",
    category: "sdr_copy",
    summary: "Template estruturado para enviar no WhatsApp logo após uma conversa produtiva.",
    userBenefit: "Acelera o fechamento mantendo os pontos combinados claros.",
  },
  {
    id: 16,
    title: "Painel de Consistência Semanal da Rotina Comercial",
    phase: "fase_2_addons_comerciais",
    status: "planejado_addon",
    category: "missoes",
    summary: "Acompanhamento de dias ativos, abordagens iniciadas, taxa de resposta e reuniões da semana.",
    userBenefit: "Mostra o progresso real da execução sem métricas de vaidade.",
  },
  {
    id: 18,
    title: "Playbooks Especializados por Perfil de Assinante",
    phase: "fase_2_addons_comerciais",
    status: "planejado_addon",
    category: "missoes",
    summary: "Roteiros dedicados para Gestor de Tráfego, Web Designer, Social Media e Consultor de CRM.",
    userBenefit: "Entrega linguagem técnica na medida certa para cada profissão.",
  },
  {
    id: 20,
    title: "Modo Agência: Múltiplas Missões por Carteira",
    phase: "fase_2_addons_comerciais",
    status: "planejado_addon",
    category: "missoes",
    summary: "Organização de missões separadas por vertical ou cliente atendido pela agência.",
    userBenefit: "Permite que agências operem várias frentes comerciais sem misturar listas.",
  },
  {
    id: 15,
    title: "Comparador de Densidade Comercial entre Cidades e Nichos",
    phase: "fase_3_avancada",
    status: "arquitetura_futura",
    category: "dossie_score",
    summary: "Visão comparativa de quais regiões possuem mais empresas com canais verificados.",
    userBenefit: "Ajuda a escolher praças menos saturadas para prospectar.",
  },
  {
    id: 17,
    title: "Envio Oficial via WhatsApp Business Cloud API (Com Opt-in Verificado)",
    phase: "fase_3_avancada",
    status: "arquitetura_futura",
    category: "governanca",
    summary: "Integração oficial futura condicionada a WABA própria, opt-in comprovado, templates Meta e kill-switch.",
    userBenefit: "Mantém conformidade total sem risco de banimento por automações piratas ou QR Code.",
  },
];

/**
 * Revisão completa das copies comerciais: ANTES -> DEPOIS -> POR QUE MELHOROU
 */
export const ZUNO_COPY_REVIEW_COMPARISON: CopyReviewComparisonItem[] = [
  {
    id: "copy-analise-1",
    section: "analise_leads",
    sectionLabel: "A. Painel de Análise dos Leads",
    contextLabel: "Indicador numérico do lead",
    beforeText: "Probabilidade de Conversão: 85% — Alta chance de fechamento imediato com base em IA.",
    afterText: "Índice de Compatibilidade Comercial: 85/100 — Mapeamento baseado em dados comerciais verificáveis. Não representa probabilidade estatística de fechamento.",
    whyImproved: "Elimina promessa estatística irreal de fechamento e explica com transparência quais dados públicos compõem a nota.",
  },
  {
    id: "copy-analise-2",
    section: "analise_leads",
    sectionLabel: "A. Painel de Análise dos Leads",
    contextLabel: "Diagnóstico de presença digital",
    beforeText: "Gap comercial crítico identificado: a empresa está perdendo clientes diariamente por falhas no funil digital.",
    afterText: "O QUE SABEMOS (Fatos verificados) vs. POSSÍVEIS ÂNGULOS COMERCIAIS (Hipóteses para investigar na conversa).",
    whyImproved: "Separa fatos observados de hipóteses comerciais, evitando acusar a empresa de problemas não verificados.",
  },
  {
    id: "copy-sdr-1",
    section: "sdr_3_estilos",
    sectionLabel: "B. Mensagens Preparadas pelo SDR (3 Estilos)",
    contextLabel: "Estilo Consultivo (Gestão de Tráfego para Clínicas)",
    beforeText: "Olá! Identificamos oportunidades de melhoria na sua presença digital para alavancar suas vendas exponencialmente. Posso mandar um diagnóstico de 2 minutos?",
    afterText: "Oi, pessoal da Clínica! Vi que vocês atuam com odontologia em Vila Velha e contam com site cadastrado e boa reputação no Google. Trabalho com gestão de tráfego local para clínicas e estruturei uma ideia rápida para atrair pacientes procurando avaliação na região. Faz sentido trocarmos uma ideia rápida por aqui sobre como funciona na prática?",
    whyImproved: "Substitui jargões robóticos e promessa automática de vídeo por observação real da cidade, nicho e convite para conversa consultiva natural.",
  },
  {
    id: "copy-sdr-2",
    section: "sdr_3_estilos",
    sectionLabel: "B. Mensagens Preparadas pelo SDR (3 Estilos)",
    contextLabel: "Estilo Direto",
    beforeText: "Olá! Queremos potencializar seus resultados comerciais com nossa metodologia exclusiva. Quem é o decisor?",
    afterText: "Oi, tudo bem? Localizei o contato comercial de vocês em Vila Velha. Atuo com campanhas de anúncios para clínicas odontológicas da região e gostaria de saber quem cuida da agenda e captação de pacientes aí na clínica para eu compartilhar uma ideia objetiva. Se preferirem não receber contato, é só me avisar.",
    whyImproved: "Direto ao ponto, respeitoso, sem adjetivos vazios e com saída honesta de opt-out.",
  },
  {
    id: "copy-sdr-3",
    section: "sdr_3_estilos",
    sectionLabel: "B. Mensagens Preparadas pelo SDR (3 Estilos)",
    contextLabel: "Estilo Exemplo Prático",
    beforeText: "Ajudamos uma empresa igual à sua a gerar +40% de vendas no primeiro mês. Vamos agendar uma call hoje?",
    afterText: "Olá, equipe! Vi a atuação de vocês em Vila Velha. Organizei um passo a passo prático mostrando como clínicas odontológicas da cidade estruturam campanhas locais para gerar pedidos de avaliação pelo WhatsApp. Posso te enviar esse resumo em 3 pontos por aqui?",
    whyImproved: "Remove prova social inventada ('+40%') e promessa automática de vídeo, entregando um resumo prático de baixo atrito diretamente no texto.",
  },
  {
    id: "copy-7dias-1",
    section: "plano_7_dias",
    sectionLabel: "C. Instruções e Mensagens do Plano de 7 Dias",
    contextLabel: "Dia 2 e Dia 4 (Follow-up e Redes Sociais)",
    beforeText: "Dia 2: 'Acompanho o perfil de vocês!' | Dia 4: 'Passando só para saber se conseguiu dar uma olhada na mensagem anterior.'",
    afterText: "Dia 2: Observação genuína do canal verificado sem fingir intimidade. | Dia 4: Acompanhamento consultivo trazendo um novo recorte útil do nicho, sem cobrar resposta.",
    whyImproved: "Elimina intimidade falsa e cobranças passivo-agressivas, além de adaptar automaticamente o plano se o lead já respondeu.",
  },
  {
    id: "copy-7dias-2",
    section: "plano_7_dias",
    sectionLabel: "C. Instruções e Mensagens do Plano de 7 Dias",
    contextLabel: "Dia 5 (Estudo de Caso / Exemplo)",
    beforeText: "Dia 5: 'Ajudamos uma empresa parecida com a [nome] a estruturar um funil comercial que gerou +40% de contatos qualificados no primeiro mês.'",
    afterText: "Dia 5: Compartilhamento de exemplo prático de estrutura comercial aplicável ao segmento, sem inventar percentuais ou clientes fictícios.",
    whyImproved: "Garante 100% de integridade factual e evita que o assinante envie números inventados para leads reais.",
  },
  {
    id: "copy-lp-1",
    section: "landing_beneficios",
    sectionLabel: "D. Benefícios da Landing Page",
    contextLabel: "Seção de Benefícios Principais",
    beforeText: "IA que encontra clientes prontos para comprar em segundos.",
    afterText: "Mapeamento de Empresas B2B + Índice de Compatibilidade (0 a 100) + Prospecção Assistida no seu WhatsApp.",
    whyImproved: "Alinha a promessa comercial exatamente ao que o produto entrega em código, valorizando a execução comercial orientada.",
  },
  {
    id: "copy-planos-1",
    section: "planos_starter_pro_agency",
    sectionLabel: "E. Descrições dos Planos Starter, Pro e Agency",
    contextLabel: "Descrições e recursos em src/config/plans.ts",
    beforeText: "Textos genéricos de busca de leads.",
    afterText: "Starter (R$ 47/mês - 300 leads, 30 análises IA), Pro (R$ 97/mês - 800 leads, 100 análises IA) e Agency (R$ 247/mês - 2.000 leads, 300 análises IA) com Índice de Compatibilidade (0-100), Plano de prospecção de {trialDays} dias e SDR Assistido.",
    whyImproved: "Preserva integralmente os preços, limites e regras de trial existentes enquanto destaca o valor prático da rotina comercial.",
  },
];
