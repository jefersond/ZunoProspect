export type CommercialMaturity = "equilibrado" | "iniciante" | "intermediario" | "avancado";

export interface CommercialMaturityMeta {
  id: CommercialMaturity;
  label: string;
  shortLabel: string;
  badgeClass: string;
  description: string;
  guidanceStyle: string;
  approachTone: string;
}

export const COMMERCIAL_MATURITY_METAS: Record<CommercialMaturity, CommercialMaturityMeta> = {
  equilibrado: {
    id: "equilibrado",
    label: "Equilibrado (Padrão)",
    shortLabel: "Equilibrado",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    description: "Orientação neutra e profissional. O padrão da Zuno, equilibrando respeito comercial e assertividade.",
    guidanceStyle: "Instruções claras e objetivas, balanceando assertividade e prudência comercial.",
    approachTone: "Mensagem comercial natural, direta e respeitosa, sem jargões artificiais nem simplificações excessivas.",
  },
  iniciante: {
    id: "iniciante",
    label: "Iniciante",
    shortLabel: "Iniciante",
    badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    description: "Para quem está começando a prospectar, sozinho ou como freelancer. Foco em postura e segurança.",
    guidanceStyle: "Passo a passo didático, orientando a postura do vendedor, reduzindo ansiedade e explicando o porquê de cada etapa.",
    approachTone: "Mesma mensagem natural e profissional, com apoio ao vendedor para abrir a conversa sem pressa de fechar no primeiro contato.",
  },
  intermediario: {
    id: "intermediario",
    label: "Intermediário",
    shortLabel: "Intermediário",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    description: "Para quem já vende e prospecta, mas busca melhorar o ritmo de qualificação e tratamento de objeções.",
    guidanceStyle: "Diretrizes práticas de qualificação da rotina, condução de diálogo consultivo e contorno ágil de objeções.",
    approachTone: "Mesma mensagem natural e profissional, com apoio ao vendedor para qualificar a rotina e investigar gargalos após o retorno.",
  },
  avancado: {
    id: "avancado",
    label: "Avançado",
    shortLabel: "Avançado",
    badgeClass: "border-purple-500/30 bg-purple-500/10 text-purple-300",
    description: "Para quem opera vendas estruturadas e processos consultivos. Foco em decisores e valor estratégico.",
    guidanceStyle: "Direcionamento estratégico para mapeamento de canal, identificação de decisores e gestão de pipeline sem atrito.",
    approachTone: "Mesma mensagem natural e profissional, com apoio ao vendedor para mapear o interlocutor e avançar com objetividade.",
  },
};
