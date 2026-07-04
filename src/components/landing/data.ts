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
    pergunta: "Os dados incluem WhatsApp e Instagram reais?",
    resposta: "Sim. A Zuno busca, quando disponível, o WhatsApp ativo, o perfil do Instagram, o site e outros canais de contato da empresa. Os dados são consultados ao vivo a cada busca — não usamos listas estáticas ou bases desatualizadas.",
  },
  {
    pergunta: "Quanto tempo leva para achar os primeiros leads?",
    resposta: "Em média menos de 5 minutos. Você escolhe cidade e nicho, a Zuno localiza empresas e já entrega os dados de contato e presença digital. A análise de IA e geração de abordagem levam mais alguns segundos por lead.",
  },
  {
    pergunta: "Como a Zuno encontra esses dados?",
    resposta: "A Zuno combina dados públicos de presença digital (Google Maps, sites, redes sociais) com análise de IA para mapear empresas por região e nicho. Nenhuma informação privada é acessada — só o que está disponível publicamente.",
  },
  {
    pergunta: "Vou ser cobrado hoje?",
    resposta: "Não. Ao ativar o teste de 7 dias, você paga R$0 hoje.",
  },
  {
    pergunta: "Por que preciso colocar cartão?",
    resposta: "O cartão é usado para ativar o teste do plano escolhido e evitar cadastros sem intenção real. A cobrança só acontece depois dos 7 dias, se você não cancelar antes.",
  },
  {
    pergunta: "Posso cancelar antes da cobrança?",
    resposta: "Sim. Você pode cancelar antes do fim do teste para não ser cobrado.",
  },
  {
    pergunta: "O que acontece depois dos 7 dias?",
    resposta: "Após os 7 dias, sua assinatura começa automaticamente no plano escolhido e a cobrança mensal é realizada.",
  },
  {
    pergunta: "Qual a diferença da Zuno para o Google Maps?",
    resposta: "O Google Maps deixa você ver empresas uma por uma, sem dados de contato estruturados, sem análise de oportunidade e sem geração de abordagem. A Zuno entrega uma lista de empresas por cidade e nicho com WhatsApp, Instagram e site compilados, mais diagnóstico de presença digital e copy pronta para cada lead — tudo em um fluxo de prospecção, não em uma busca manual.",
  },
  {
    pergunta: "Funciona para qualquer cidade do Brasil?",
    resposta: "Sim. A Zuno localiza empresas em qualquer cidade brasileira. Você escolhe a cidade e o nicho (ex: 'Clínica estética em Campinas') e o sistema busca empresas naquela região específica.",
  },
  {
    pergunta: "A Zuno garante clientes?",
    resposta: "Não. A Zuno não garante clientes. Ela ajuda você a encontrar empresas, analisar oportunidades e gerar abordagens com mais contexto. O resultado depende da sua oferta, abordagem e execução comercial.",
  },
  {
    pergunta: "Para quem a Zuno é indicada?",
    resposta: "Para gestores de tráfego, social medias, designers, freelancers, agências e operações que precisam prospectar empresas com mais clareza.",
  },
  {
    pergunta: "Posso usar a Zuno sem cartão?",
    resposta: "A principal forma de acesso é o teste grátis de 7 dias nos planos pagos, que exige cartão para ativação. Existe também um plano Free com acesso limitado (20 leads e 3 análises por mês) que não requer cartão — disponível na tela de cadastro.",
  },
];
