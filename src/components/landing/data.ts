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

export const METRICAS = [
  { numero: "Cidade + nicho", label: "Busca direcionada", descricao: "para sair da pesquisa manual genérica" },
  { numero: "IA sob demanda", label: "Análise do lead", descricao: "usada somente quando você pedir" },
  { numero: "3 canais", label: "Abordagens prontas", descricao: "para WhatsApp, Instagram e e-mail" },
  { numero: "7 dias", label: "Plano de sequência", descricao: "para manter a prospecção em movimento" },
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
    bullets: ["Encontre empresas que podem precisar de anúncios e receba abordagens prontas para iniciar conversa."],
  },
  {
    titulo: "Social medias",
    icone: Megaphone,
    bullets: ["Identifique negócios com presença digital fraca e crie uma abordagem mais estratégica."],
  },
  {
    titulo: "Freelancers",
    icone: Palette,
    bullets: ["Comece a prospectar com mais clareza, sem depender só de indicação."],
  },
  {
    titulo: "Consultores",
    icone: LineChart,
    bullets: ["Encontre empresas com sinais de oportunidade e priorize quem abordar primeiro."],
  },
  {
    titulo: "Agências pequenas",
    icone: Building2,
    bullets: ["Gere listas de oportunidades por nicho e região para alimentar sua rotina comercial."],
  },
  {
    titulo: "SDRs",
    icone: BriefcaseBusiness,
    bullets: ["Use dados e IA para organizar a primeira abordagem."],
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
    pergunta: "O que o Zuno faz?",
    resposta: "O Zuno ajuda você a encontrar empresas por cidade e nicho, analisar oportunidades com IA e gerar abordagens prontas para iniciar conversas.",
  },
  {
    pergunta: "De onde vêm os leads?",
    resposta: "A busca usa dados públicos de empresas disponíveis em fontes como o Google Places. A disponibilidade dos contatos pode variar conforme as informações públicas de cada empresa.",
  },
  {
    pergunta: "A IA consome meu limite automaticamente?",
    resposta: "Não. A IA só é usada quando você clica em \"Analisar com IA\".",
  },
  {
    pergunta: "O plano grátis tem limite?",
    resposta: "Sim. O plano grátis inclui 20 leads por mês e 3 análises com IA.",
  },
  {
    pergunta: "O que acontece quando meu limite acaba?",
    resposta: "Você pode fazer upgrade para liberar mais leads e análises.",
  },
  {
    pergunta: "Posso cancelar quando quiser?",
    resposta: "Sim. Nos planos mensais, você pode cancelar quando quiser.",
  },
  {
    pergunta: "Como funciona a indicação?",
    resposta: "Você ganha 100 buscas extras quando uma pessoa indicada pelo seu link assina qualquer plano pago. Cadastros gratuitos ficam como pendentes.",
  },
  {
    pergunta: "Preciso instalar alguma coisa?",
    resposta: "Não. O Zuno funciona direto no navegador.",
  },
  {
    pergunta: "Posso exportar os leads?",
    resposta: "Sim. Você pode exportar leads para Excel conforme os recursos disponíveis no seu plano.",
  },
  {
    pergunta: "O Zuno envia mensagens automaticamente?",
    resposta: "Não. O Zuno gera abordagens prontas para você revisar, copiar e enviar pelo canal que preferir.",
  },
];
