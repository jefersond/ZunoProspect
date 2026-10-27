import type { SellerProfile } from "./lead-analysis";

// FIXTURES escritos à mão para exercitar o validador. NÃO são saídas do Gemini.
export const profile: SellerProfile = {
  display_name: "Marina Costa",
  company_name: "Costa Digital",
  service_category: "sites",
  service_offered: "Criação de sites para negócios locais",
  offer_description: "Faço sites de uma página com serviços, horário, mapa e botão de WhatsApp para oficinas e lojas.",
  target_audience: "Oficinas e comércio local",
};

export const lead = {
  nome: "Auto Mecânica Irmãos Lima",
  nicho: "oficina mecânica",
  cidade: "Serra",
  endereco: "Av. Principal, 100 - Serra, ES",
  website: null,
  instagram: null,
  email: null,
  phone: "27996543210",
  rating: 4.7,
  reviews: 46,
  status: "novo",
  notas: null,
};

export const day = (dia: number, over: Record<string, unknown> = {}) => ({
  dia, tipo: "sem_mensagem", canal: "nenhum", titulo: `Dia ${dia}`, objetivo: "Aguardar", acao: "Aguardar resposta",
  mensagem: "", assunto_email: "", justificativa: "Sem fato novo para justificar contato.", condicao: "",
  objecao_provavel: "", resposta_sugerida: "", ...over,
});

export const goodRaw = () => ({
  diagnostico: {
    observado: ["Oficina em Serra com 46 avaliações no Google (nota 4,7) e celular cadastrado; nenhum site no perfil."],
    permite_concluir: "Há reputação construída e um canal direto por celular.",
    nao_permite_concluir: "Não permite concluir se existe site fora do perfil nem se o dono quer um.",
    hipotese_comercial: "Uma página única com serviços e horário pode complementar o perfil do Google, se o dono sentir falta disso.",
    pergunta_de_validacao: "Vocês já têm site ou preferem usar só o Google e o WhatsApp?",
  },
  resumo_estrategia: "Abrir com uma pergunta factual sobre site e só depois falar da página.",
  plano: [
    day(1, { tipo: "mensagem", canal: "whatsapp", acao: "Enviar a abertura", objetivo: "Abrir conversa",
      mensagem: "Oi, tudo bem? Aqui é a Marina, da Costa Digital. Faço sites simples para oficinas: serviços, horário e WhatsApp numa página só. A Irmãos Lima tem 46 avaliações no Google, mas não achei site no perfil. Vocês já têm um?",
      objecao_provavel: "Já temos Instagram.", resposta_sugerida: "O site complementa; ele reúne serviços e horário num só lugar." }),
    day(2, { tipo: "tarefa", acao: "Pesquise o nome da oficina e confirme se existe site ou Facebook fora do perfil do Google." }),
    day(3),
    day(4, { tipo: "acompanhamento", canal: "whatsapp", condicao: "Só se o Dia 1 foi enviado e não houve resposta há 3 dias, e o Dia 2 confirmou que não há site.",
      mensagem: "Oi, aqui é a Marina de novo. Confirmei que o Google mostra as avaliações e o telefone da Irmãos Lima, mas não há uma página com serviços e horário. Posso te explicar como ficaria, em 5 minutos?" }),
    day(5),
    day(6),
    day(7, { acao: "Registrar o resultado e encerrar a sequência sem insistência." }),
  ],
});

