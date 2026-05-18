import avatar1 from "@/assets/avatars/avatar-1.jpg";
import avatar2 from "@/assets/avatars/avatar-2.jpg";
import avatar3 from "@/assets/avatars/avatar-3.jpg";
import avatar4 from "@/assets/avatars/avatar-4.jpg";
import avatar5 from "@/assets/avatars/avatar-5.jpg";
import avatar6 from "@/assets/avatars/avatar-6.jpg";

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

export const HERO_AVATARS = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6];

export interface Depoimento {
  id: number;
  nome: string;
  cargo: string;
  empresa: string;
  texto: string;
}

export const DEPOIMENTOS: Depoimento[] = [
  {
    id: 1,
    nome: "Ricardo Mendes",
    cargo: "Gestor de Tráfego",
    empresa: "Freelancer",
    texto: "Antes eu passava horas procurando empresas. Agora chego na abordagem com contexto e uma mensagem muito mais clara.",
  },
  {
    id: 2,
    nome: "Camila Santos",
    cargo: "Owner de Agência",
    empresa: "Agência Sete Marketing",
    texto: "O Zuno ajudou nossa rotina comercial a sair do improviso. Buscamos por nicho, salvamos leads e seguimos com mais organização.",
  },
  {
    id: 3,
    nome: "Felipe Oliveira",
    cargo: "Freela de Social Media",
    empresa: "Autônomo",
    texto: "O melhor é identificar sinais digitais antes de abordar. Eu consigo explicar melhor por que estou chamando aquele lead.",
  },
  {
    id: 4,
    nome: "Juliana Costa",
    cargo: "Especialista em SEO",
    empresa: "Consultoria Digital JC",
    texto: "A ferramenta entrega contexto comercial rápido. Fica mais fácil priorizar quem faz sentido abordar primeiro.",
  },
  {
    id: 5,
    nome: "Bruno Almeida",
    cargo: "Webdesigner",
    empresa: "BA Design",
    texto: "As abordagens prontas economizam muito tempo na primeira mensagem e nos follow-ups.",
  },
];

export const METRICAS = [
  { numero: "Cidade + nicho", label: "Busca direcionada", descricao: "para sair da pesquisa manual genérica" },
  { numero: "IA sob demanda", label: "Análise do lead", descricao: "usada somente quando você pedir" },
  { numero: "3 canais", label: "Abordagens prontas", descricao: "para WhatsApp, Instagram e e-mail" },
  { numero: "7 dias", label: "Plano de sequência", descricao: "para manter a prospecção em movimento" },
];

export const LOGOS_CLIENTES = [
  { nome: "Agência Pulso Digital" },
  { nome: "Traffic Masters" },
  { nome: "Studio Criativo" },
  { nome: "SEO Pro Brasil" },
  { nome: "Social Hub" },
  { nome: "Growth Labs" },
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
