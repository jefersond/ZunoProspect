import type { LeadProspeccao, PlanoProspeccaoDia } from "@/types/lead";

const baseLead = {
  id: "lead-fixture-1",
  placeId: null,
  nome: "Auto Mecânica Irmãos Lima",
  telefone: "27996543210",
  whatsapp_link: null,
  email: null,
  website: null,
  instagram_url: null,
  instagram_context: null,
  endereco: null,
  cidade: "Serra",
  nicho: "oficina mecânica",
  proximidadeAtiva: false,
  raioKm: null,
  sinais: { has_whatsapp_on_site: false, has_meta_pixel: false, has_gtag: false, has_gtm: false },
  rating: 4.7,
  total_reviews: 46,
  status: "novo",
  created_at: "2026-10-20T10:00:00.000Z",
  ai_analise_gerada_em: "2026-10-21T10:00:00.000Z",
  salvo: true,
  notas: null,
  cnpj: null,
  razao_social: null,
  nome_responsavel: null,
  cnpj_telefone: null,
  cnpj_email: null,
  situacao_cadastral: null,
  porte_empresa: null,
  cnae_principal: null,
};

const emptyDay = (dia: number): PlanoProspeccaoDia => ({
  dia,
  tipo_dia: "sem_mensagem",
  canal: "nenhum",
  titulo: `Dia ${dia}`,
  objetivo: "Aguardar",
  acao_sugerida: "Aguardar resposta ao primeiro contato.",
  mensagem: "",
  objecao_provavel: "",
  resposta_sugerida: "",
  cta: "",
  copy_version: "fixture",
  fonte: "gemini",
});

/** Textos do FIXTURE de teste: escritos à mão para exercitar a interface. NÃO são saída do Gemini. */
export const FIXTURE_DAY1_TEXT =
  "Oi, tudo bem? Aqui é a Marina, da Costa Digital. Faço sites simples para oficinas: serviços, horário e WhatsApp numa página só.\n\nA Irmãos Lima tem 46 avaliações (nota 4,7), mas não achei site no perfil. Vocês já têm um?";
export const FIXTURE_DAY4_TEXT =
  "Oi, aqui é a Marina de novo. Confirmei que o Google mostra as avaliações e o telefone da Irmãos Lima, mas não há uma página com serviços e horário. Posso te explicar como ficaria, em 5 minutos?";

export const FIXTURE_DIAGNOSTICO = [
  "Observado: Oficina em Serra com 46 avaliações (nota 4,7) e celular cadastrado; nenhum site no perfil.",
  "O que isso permite concluir: Há reputação construída e canal direto por celular.",
  "O que isso não permite concluir: Se existe site fora do perfil ou se o dono quer um.",
  "Hipótese comercial: Uma página única pode complementar o perfil do Google, se o dono sentir falta disso.",
  "Pergunta para validar: Vocês já têm site ou preferem usar só o Google e o WhatsApp?",
];

export function makeGeminiPlanDays(): PlanoProspeccaoDia[] {
  return [
    {
      ...emptyDay(1),
      tipo_dia: "mensagem",
      canal: "whatsapp",
      objetivo: "Abrir conversa",
      acao_sugerida: "Enviar a abertura pelo WhatsApp.",
      mensagem: FIXTURE_DAY1_TEXT,
      objecao_provavel: "Já temos Instagram.",
      resposta_sugerida: "O site reúne serviços e horário num só lugar.",
      justificativa: "Apresenta quem fala, o serviço e pede o menor passo.",
    },
    {
      ...emptyDay(2),
      tipo_dia: "tarefa",
      objetivo: "Confirmar que não há site",
      acao_sugerida: "Pesquise o nome da oficina e confirme se existe site fora do perfil do Google.",
    },
    emptyDay(3),
    {
      ...emptyDay(4),
      tipo_dia: "acompanhamento",
      canal: "whatsapp",
      objetivo: "Retomar com fato novo",
      acao_sugerida: "Enviar somente se o Dia 1 foi enviado e não houve resposta.",
      condicao: "Só se o Dia 1 foi enviado e não houve resposta há 3 dias.",
      mensagem: FIXTURE_DAY4_TEXT,
    },
    emptyDay(5),
    { ...emptyDay(6), canal: "telefone", tipo_dia: "tarefa", acao_sugerida: "Ligar para a oficina em horário comercial." },
    { ...emptyDay(7), acao_sugerida: "Registrar o resultado e encerrar a sequência sem insistência." },
  ];
}

/** Lead com plano no formato novo (tipos de dia variados). */
export function makeNewLead(): LeadProspeccao {
  return {
    ...baseLead,
    foco: "Sites/Landing",
    diagnostico_bullets: FIXTURE_DIAGNOSTICO,
    probabilidade_conversao: null,
    plano_prospecao_7dias: makeGeminiPlanDays(),
  } as unknown as LeadProspeccao;
}

/** Lead antigo: probabilidade legada, foco nulo, plano no formato anterior (sem tipo_dia, sem assunto_email/objetivo). */
export function makeLegacyLead(): LeadProspeccao {
  const plano: PlanoProspeccaoDia[] = Array.from({ length: 7 }, (_, i) => ({
    dia: i + 1,
    canal: i === 2 ? "email" : i === 1 ? "instagram" : "whatsapp",
    titulo: `Dia ${i + 1}`,
    mensagem: `Mensagem antiga personalizada do dia ${i + 1}`,
    acao_sugerida: `Ação antiga ${i + 1}`,
    objecao_provavel: `Objeção antiga ${i + 1}`,
    resposta_sugerida: `Resposta antiga ${i + 1}`,
    cta: `CTA antigo ${i + 1}`,
  }));

  return {
    ...baseLead,
    id: "lead-fixture-legacy",
    nome: "Auto Peças Litoral",
    cidade: "Guarapari",
    nicho: "autopeças",
    website: null,
    sinais: null,
    foco: null,
    diagnostico_bullets: ["Diagnóstico antigo 1", "Diagnóstico antigo 2"],
    probabilidade_conversao: 85,
    plano_prospecao_7dias: plano,
  } as unknown as LeadProspeccao;
}

/** Lead que nunca teve análise. */
export function makeLeadWithoutPlan(): LeadProspeccao {
  return {
    ...baseLead,
    id: "lead-fixture-noplan",
    foco: "Tráfego",
    diagnostico_bullets: [],
    probabilidade_conversao: 0,
    plano_prospecao_7dias: [],
    ai_analise_gerada_em: null,
  } as unknown as LeadProspeccao;
}

export const COMPLETE_SELLER_PROFILE = {
  display_name: "Marina Costa",
  company_name: "Costa Digital",
  service_offered: "Criação de sites para negócios locais",
  offer_description: "Faço sites de uma página com serviços, horário, mapa e botão de WhatsApp para oficinas e lojas.",
  target_audience: "Oficinas e comércio local",
};
