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
    bullets: ["Encontre empresas que podem precisar de anúncios."],
  },
  {
    titulo: "Social medias",
    icone: Megaphone,
    bullets: ["Ache negócios com presença digital fraca."],
  },
  {
    titulo: "Freelancers",
    icone: Palette,
    bullets: ["Comece a prospectar sem depender só de indicação."],
  },
  {
    titulo: "Consultores",
    icone: LineChart,
    bullets: ["Priorize empresas com sinais de oportunidade."],
  },
  {
    titulo: "Agências pequenas",
    icone: Building2,
    bullets: ["Crie listas por nicho e região para alimentar o comercial."],
  },
  {
    titulo: "SDRs",
    icone: BriefcaseBusiness,
    bullets: ["Organize a primeira abordagem com dados e IA."],
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
    pergunta: "O que é o Zuno Propect?",
    resposta: "O Zuno é uma plataforma de prospecção com IA que ajuda você a encontrar empresas por cidade e nicho, analisar oportunidades e gerar abordagens prontas.",
  },
  {
    pergunta: "Preciso de cartão para começar?",
    resposta: "Não. Você pode testar com 20 leads e 3 análises IA no plano grátis.",
  },
  {
    pergunta: "Quantos leads tenho no plano grátis?",
    resposta: "O plano grátis inclui 20 leads por mês e 3 análises com IA.",
  },
  {
    pergunta: "A IA gera mensagens para quais canais?",
    resposta: "O Zuno gera abordagens prontas para WhatsApp, Instagram e e-mail.",
  },
  {
    pergunta: "A IA consome meus créditos automaticamente?",
    resposta: "Não. A IA só é usada quando você clica para analisar um lead.",
  },
  {
    pergunta: "Posso cancelar quando quiser?",
    resposta: "Sim. Nos planos mensais, você pode cancelar quando quiser.",
  },
  {
    pergunta: "Como funciona a indicação?",
    resposta: "Você ganha 100 buscas extras quando uma pessoa indicada assina qualquer plano pago. Cadastros gratuitos ficam como pendentes.",
  },
];
