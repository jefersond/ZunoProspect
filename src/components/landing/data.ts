import {
  BriefcaseBusiness,
  Building2,
  LineChart,
  LucideIcon,
  Megaphone,
  Palette,
  TrendingUp,
} from "lucide-react";
import { PLAN_LIST, PLANS } from "@/config/plans";

export const buildMetricas = (trialDurationDays: number | null) => [
  { numero: "Cidade + nicho", label: "Busca direcionada", descricao: "para sair da pesquisa manual genérica" },
  { numero: "IA sob demanda", label: "Análise do lead", descricao: "usada somente quando você pedir" },
  { numero: "3 canais", label: "Abordagens prontas", descricao: "para WhatsApp, Instagram e e-mail" },
  { numero: trialDurationDays ? `${trialDurationDays} dias` : "Teste", label: "Plano de sequência", descricao: "para manter a prospecção em movimento" },
];

export interface PerfilAlvo {
  titulo: string;
  icone: LucideIcon;
  bullets: string[];
}

export const PERFIS_ALVO: PerfilAlvo[] = [
  {
    titulo: "Gestores de tráfego",
    icone: TrendingUp,
    bullets: ["Encontre clínicas, estéticas e negócios locais que precisam de anúncios e campanhas."],
  },
  {
    titulo: "Social medias",
    icone: Megaphone,
    bullets: ["Ache restaurantes, lojas e prestadores de serviços que precisam melhorar a presença digital."],
  },
  {
    titulo: "Designers",
    icone: Palette,
    bullets: ["Identifique empresas com marcas desatualizadas e que necessitam de nova identidade visual."],
  },
  {
    titulo: "Freelancers",
    icone: BriefcaseBusiness,
    bullets: ["Prospecte clientes ativamente por região para vender seus serviços sem depender apenas de indicações."],
  },
  {
    titulo: "Agências",
    icone: Building2,
    bullets: ["Mapeie segmentos inteiros na sua cidade e alimente seu time de vendas com leads qualificados."],
  },
];

export interface Plano {
  nome: string;
  planKey: string;
  precoBase: number;
  leadsLimit: number;
  aiLimit: number;
  descricao: string;
  destaque: boolean;
  features: string[];
  cta: string;
  gratuito: boolean;
}

export const PLANOS: Plano[] = [
  PLANS.starter,
  PLANS.pro,
].map((plan) => ({
  nome: plan.displayName,
  planKey: plan.legacyPlanKey,
  precoBase: plan.monthlyPrice,
  leadsLimit: plan.leadsLimit,
  aiLimit: plan.aiLimit,
  descricao: plan.subtitle,
  destaque: plan.highlighted,
  features: [...plan.features],
  cta: plan.cta,
  gratuito: false,
}));

export const PLANO_AGENCIA: Plano = {
  nome: PLANS.agency.displayName,
  planKey: PLANS.agency.legacyPlanKey,
  precoBase: PLANS.agency.monthlyPrice,
  leadsLimit: PLANS.agency.leadsLimit,
  aiLimit: PLANS.agency.aiLimit,
  descricao: PLANS.agency.subtitle,
  destaque: PLANS.agency.highlighted,
  features: [...PLANS.agency.features],
  cta: PLANS.agency.cta,
  gratuito: false,
};

export const PLANOS_OFICIAIS: Plano[] = PLAN_LIST.map((plan) => ({
  nome: plan.displayName,
  planKey: plan.legacyPlanKey,
  precoBase: plan.monthlyPrice,
  leadsLimit: plan.leadsLimit,
  aiLimit: plan.aiLimit,
  descricao: plan.subtitle,
  destaque: plan.highlighted,
  features: [...plan.features],
  cta: plan.cta,
  gratuito: false,
}));

export const LEAD_PRICING_CONFIG = {
  baseLeads: 300,
  incrementLeads: 0,
  incrementPrice: 0,
  maxLeads: 2000,
  annualDiscountMonths: 0,
};

export const LEAD_QUANTITIES = [300, 800, 2000];

export const FAQ_ITEMS = [
  {
    pergunta: "Isso é diferente do Google Maps?",
    resposta: "Sim. O Google Maps ajuda a localizar empresas. O Zuno usa fontes públicas para organizar a prospecção por cidade e nicho, reúne canais disponíveis, adiciona contexto de presença digital e sugere uma abordagem para você iniciar a conversa.",
  },
  {
    pergunta: "Os dados são atuais?",
    resposta: "A Zuno consulta fontes públicas durante a busca. A disponibilidade e a completude dos dados dependem de cada fonte e podem mudar com o tempo.",
  },
  {
    pergunta: "Preciso saber prospectar?",
    resposta: "Não precisa chegar com um roteiro pronto. O Zuno organiza o contexto e sugere uma abordagem. Você continua no controle da mensagem, da conversa e da negociação.",
  },
  {
    pergunta: "O Zuno envia mensagens sozinho?",
    resposta: "Não. O Zuno ajuda a preparar a abordagem e organiza os canais públicos disponíveis. Você revisa a mensagem e decide quando e onde enviar.",
  },
  {
    pergunta: "Preciso cadastrar cartão?",
    resposta: "Sim. O cartão é necessário para ativar o teste do plano escolhido. Você paga R$0 hoje e vê a duração vigente antes de concluir o checkout.",
  },
  {
    pergunta: "Quando começa a cobrança?",
    resposta: "A primeira cobrança acontece depois do período de teste informado no checkout, conforme o plano e a periodicidade escolhidos.",
  },
  {
    pergunta: "Posso cancelar antes?",
    resposta: "Sim. Você pode cancelar antes do fim do teste para evitar a primeira cobrança.",
  },
  {
    pergunta: "Quais dados públicos são utilizados?",
    resposta: "A Zuno trabalha com informações publicamente disponíveis sobre empresas, como presença em mapas, sites, redes sociais e canais de contato quando publicados. Nenhuma informação privada é acessada.",
  },
];
