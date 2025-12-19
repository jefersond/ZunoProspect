// Avatar imports
import avatar1 from "@/assets/avatars/avatar-1.jpg";
import avatar2 from "@/assets/avatars/avatar-2.jpg";
import avatar3 from "@/assets/avatars/avatar-3.jpg";
import avatar4 from "@/assets/avatars/avatar-4.jpg";
import avatar5 from "@/assets/avatars/avatar-5.jpg";
import avatar6 from "@/assets/avatars/avatar-6.jpg";

import { Building2, TrendingUp, LineChart, Megaphone, Palette, Code, LucideIcon } from "lucide-react";

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
    texto: "Em 2 semanas consegui 15 reuniões com leads qualificados. O plano de prospecção de 7 dias é genial, economizo umas 10h por semana."
  },
  {
    id: 2,
    nome: "Camila Santos",
    cargo: "Owner de Agência",
    empresa: "Agência Sete Marketing",
    texto: "Antes eu passava horas no Google procurando empresas. Agora em minutos tenho uma lista pronta com diagnóstico e até as mensagens de abordagem."
  },
  {
    id: 3,
    nome: "Felipe Oliveira",
    cargo: "Freela de Social Media",
    empresa: "Autônomo",
    texto: "O diferencial é a análise de sinais digitais. Consigo identificar quem realmente precisa dos meus serviços antes de abordar."
  },
  {
    id: 4,
    nome: "Juliana Costa",
    cargo: "Especialista em SEO",
    empresa: "Consultoria Digital JC",
    texto: "Finalmente uma ferramenta que entende o mercado de marketing. Os leads vêm com contexto e eu sei exatamente como abordar cada um."
  },
  {
    id: 5,
    nome: "Bruno Almeida",
    cargo: "Webdesigner",
    empresa: "BA Design",
    texto: "Minha taxa de resposta subiu muito depois que comecei a usar os planos de prospecção. As mensagens são personalizadas e não parecem spam."
  }
];

export const METRICAS = [
  { numero: "+2.300", label: "Leads gerados", descricao: "por usuários da plataforma" },
  { numero: "5x", label: "Mais reuniões", descricao: "em média comparado à prospecção manual" },
  { numero: "10h", label: "Economizadas por semana", descricao: "em tempo de prospecção" },
  { numero: "87%", label: "Taxa de satisfação", descricao: "dos usuários recomendam" }
];

export const LOGOS_CLIENTES = [
  { nome: "Agência Pulso Digital" },
  { nome: "Traffic Masters" },
  { nome: "Studio Criativo" },
  { nome: "SEO Pro Brasil" },
  { nome: "Social Hub" },
  { nome: "Growth Labs" }
];

export interface PerfilAlvo {
  titulo: string;
  icone: LucideIcon;
  bullets: string[];
}

export const PERFIS_ALVO: PerfilAlvo[] = [
  {
    titulo: "Agências Full Service",
    icone: Building2,
    bullets: ["Escale sua operação de prospecção sem contratar mais SDRs", "Tenha um pipeline previsível de novos clientes"]
  },
  {
    titulo: "Gestores de Tráfego",
    icone: TrendingUp,
    bullets: ["Encontre empresas que ainda não fazem anúncios pagos", "Aborde com diagnóstico pronto sobre a presença digital"]
  },
  {
    titulo: "Especialistas em SEO",
    icone: LineChart,
    bullets: ["Identifique sites sem otimização básica", "Use dados técnicos na sua abordagem comercial"]
  },
  {
    titulo: "Social Media",
    icone: Megaphone,
    bullets: ["Prospecte negócios locais que precisam de redes sociais", "Tenha cadências prontas para Instagram e WhatsApp"]
  },
  {
    titulo: "Webdesigners",
    icone: Palette,
    bullets: ["Encontre empresas com sites desatualizados", "Aborde com proposta de valor clara"]
  },
  {
    titulo: "Desenvolvedores",
    icone: Code,
    bullets: ["Prospecte PMEs que precisam de soluções digitais", "Identifique oportunidades de sistemas e automações"]
  }
];

export interface Plano {
  nome: string;
  precoMensal: number;
  precoAnual: number;
  descricao: string;
  destaque: boolean;
  features: string[];
  cta: string;
  gratuito: boolean;
}

export const PLANOS: Plano[] = [
  {
    nome: "Starter",
    precoMensal: 0,
    precoAnual: 0,
    descricao: "Para testar a plataforma",
    destaque: false,
    features: ["Até 10 leads por mês", "Análise básica de leads", "1 plano de prospecção por lead", "Exportação para Excel"],
    cta: "Começar grátis",
    gratuito: true
  },
  {
    nome: "Pro",
    precoMensal: 97,
    precoAnual: 970,
    descricao: "Para freelancers e profissionais",
    destaque: true,
    features: ["Até 100 leads por mês", "Análise completa com IA", "Plano de 7 dias personalizado", "Diagnóstico de sinais digitais", "Exportação ilimitada", "Suporte prioritário"],
    cta: "Assinar Pro",
    gratuito: false
  },
  {
    nome: "Agência",
    precoMensal: 247,
    precoAnual: 2470,
    descricao: "Para agências e times",
    destaque: false,
    features: ["Leads ilimitados", "Tudo do plano Pro", "Múltiplos usuários", "API de integração", "Relatórios avançados", "Gerente de sucesso dedicado"],
    cta: "Assinar Agência",
    gratuito: false
  }
];

export const FAQ_ITEMS = [
  {
    pergunta: "Preciso saber programar para usar?",
    resposta: "Não! A plataforma foi feita para profissionais de marketing, não para devs. Basta informar o nicho, cidade e quantidade de leads que você quer encontrar. Todo o resto é automático."
  },
  {
    pergunta: "Quantos leads posso gerar por mês?",
    resposta: "Depende do seu plano. No plano gratuito você pode fazer buscas limitadas para testar. Nos planos pagos, você tem acesso a volumes maiores de leads por mês."
  },
  {
    pergunta: "Posso exportar os leads para Excel ou CRM?",
    resposta: "Sim! Você pode exportar todos os leads encontrados para Excel com um clique. A integração com CRMs está no roadmap."
  },
  {
    pergunta: "Vocês já mandam mensagem automática no WhatsApp?",
    resposta: "Hoje o app gera o plano de prospecção completo com as mensagens prontas para cada dia. Você copia e envia manualmente. Estamos desenvolvendo um SDR com IA que vai automatizar esse envio no futuro."
  },
  {
    pergunta: "Os leads são realmente qualificados?",
    resposta: "Sim! Além de encontrar as empresas, analisamos o site, presença em redes sociais e sinais de marketing digital. Você recebe um diagnóstico completo e probabilidade de conversão para cada lead."
  },
  {
    pergunta: "Funciona para qualquer cidade do Brasil?",
    resposta: "Sim! Usamos o Google Places como base, então qualquer cidade com empresas cadastradas no Google funciona. Quanto maior a cidade, mais resultados."
  },
  {
    pergunta: "Tem teste grátis?",
    resposta: "Sim! Você pode criar uma conta e fazer suas primeiras buscas gratuitamente para conhecer a plataforma antes de assinar."
  }
];
