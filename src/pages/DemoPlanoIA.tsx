import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Sparkles, RefreshCw, CheckCircle2, Eye, MapPin, Phone, MessageSquare, Globe, Bookmark, UserCheck, Clock } from "lucide-react";
import { LeadPlanDialog } from "@/components/prospeccao/LeadPlanDialog";
import { ConfirmContactModal } from "@/components/prospeccao/ConfirmContactModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { enableDemoSellerProfile, disableDemoSellerProfile, openSellerProfileDialog } from "@/lib/sellerProfile";
import { COMMERCIAL_MATURITY_METAS, type CommercialMaturity } from "@/types/commercialMaturity";
import { Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadProspeccao, PlanoProspeccaoDia } from "@/types/lead";

const SIMULATED_LEAD: LeadProspeccao = {
  id: "demo-lead-sorriso-prime",
  user_id: "demo-user",
  nome: "Clínica Sorriso Prime",
  nicho: "clínica odontológica",
  cidade: "Curitiba",
  foco: "Automação",
  telefone: "41999887766",
  whatsapp_number: "41999887766",
  whatsapp_link: "https://wa.me/5541999887766",
  website: "https://sorrisoprime.com.br",
  instagram: "@sorrisoprime",
  rating: 4.8,
  reviews: 142,
  total_reviews: 142,
  data_sources: ["google_places", "website_scrape"],
  status: "novo",
  sinais: {
    has_whatsapp_on_site: true,
    has_meta_pixel: false,
    has_gtag: false,
    has_gtm: false,
  },
  plano_prospecao_7dias: [],
  diagnostico_bullets: [
    "Observado: Clínica odontológica com endereço público em Curitiba e 142 avaliações no Google (nota 4.8).",
    "O que isso permite concluir: Empresa ativa com fluxo contínuo de atendimento presencial e recepção de contatos digitais.",
    "O que isso não permite concluir: Não foi medido o tempo de resposta da recepção nem a perda de mensagens fora de horário.",
    "Hipótese comercial: A implantação de triagem e confirmação automática no WhatsApp pode agilizar o atendimento de novos pacientes e reduzir ausências na agenda.",
    "Pergunta para validar: Como vocês organizam hoje a confirmação de consultas para evitar horários ociosos na agenda?",
  ],
  probabilidade_conversao: null,
  ai_analise_gerada_em: null,
  ai_used_fallback: false,
  salvo: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const CANONICAL_OUTREACH_MESSAGES = {
  dia1: "Oi, pessoal da Clínica Sorriso Prime! Tudo bem?\n\nSou o Rodrigo Silva, da AutoAtende em Curitiba. Trabalhamos com organização de triagem e confirmação de consultas no WhatsApp para clínicas odontológicas.\n\nLocalizei o contato de vocês no Google e gostaria de confirmar: este canal atende os agendamentos da clínica ou haveria outro contato da recepção para conversarmos?",
  dia3Subject: "Confirmação de consultas e triagem no WhatsApp - Clínica Sorriso Prime",
  dia3: "Olá, equipe da Clínica Sorriso Prime!\n\nEnviei uma mensagem recente pelo WhatsApp sobre nossa atuação com rotinas de triagem e confirmação de consultas para clínicas odontológicas aqui em Curitiba.\n\nAjudamos a organizar o fluxo de confirmações e dúvidas de pacientes pelo WhatsApp, evitando horários ociosos na agenda sem sobrecarregar o atendimento com mensagens manuais repetitivas.\n\nCaso faça sentido para a rotina da clínica, podemos conversar brevemente sobre como vocês organizam essa demanda hoje?\n\nAtenciosamente,\nRodrigo Silva · AutoAtende Soluções",
  dia5: "Oi, pessoal da Clínica Sorriso Prime! Tudo bem?\n\nPassando apenas para uma última checagem de rotina: vocês costumam realizar a confirmação de consultas manualmente pelo WhatsApp ou já possuem alguma rotina organizada para isso?\n\nSe fizer sentido conversar mais adiante, fico à disposição por aqui.\n\nAbraço,\nRodrigo Silva",
};

const SIMULATED_INITIAL_DAYS: PlanoProspeccaoDia[] = [
  {
    dia: 1,
    tipo_dia: "mensagem",
    canal: "whatsapp",
    titulo: "Dia 1 — WhatsApp de Abertura",
    titulo_dia: "Dia 1 — WhatsApp de Abertura",
    objetivo: "Iniciar primeiro contato neutro para identificar o canal comercial da recepção",
    acao_sugerida: "Enviar WhatsApp para a recepção da Clínica Sorriso Prime",
    mensagem: CANONICAL_OUTREACH_MESSAGES.dia1,
    objecao_provavel: "Quem é você e como conseguiu nosso número?",
    resposta_sugerida: "Sou o Rodrigo Silva, da AutoAtende. Localizei o contato público da Clínica Sorriso Prime na pesquisa local do Google em Curitiba.",
    justificativa: "Abertura neutra que não presume intimidade nem afirma problemas internos.",
    status_dia: "disponivel",
  },
  {
    dia: 2,
    tipo_dia: "tarefa",
    canal: "nenhum",
    titulo: "Dia 2 — Pausa Técnica e Observação de Retorno",
    titulo_dia: "Dia 2 — Pausa Técnica e Observação de Retorno",
    objetivo: "Aguardar retorno natural da equipe da clínica sem cobranças prematuras",
    acao_sugerida: "Não enviar mensagens hoje. Aguardar resposta e verificar horários de funcionamento no perfil público.",
    mensagem: "",
    justificativa: "Respeitar o tempo da recepção odontológica. Evitar insistência consecutiva nas primeiras 24 horas.",
    condicao: "Se a empresa responder ao Dia 1: interromper a cadência fria e prosseguir com a qualificação no WhatsApp.",
    status_dia: "pendente",
  },
  {
    dia: 3,
    tipo_dia: "mensagem",
    canal: "email",
    titulo: "Dia 3 — Envio de Ângulo Consultivo Estruturado",
    titulo_dia: "Dia 3 — Envio de Ângulo Consultivo Estruturado",
    objetivo: "Apresentar hipótese comercial clara conectada ao serviço sem promessas mirabolantes",
    acao_sugerida: "Enviar e-mail explicando a lógica de automação para o segmento odontológico",
    assunto_email: CANONICAL_OUTREACH_MESSAGES.dia3Subject,
    mensagem: CANONICAL_OUTREACH_MESSAGES.dia3,
    objecao_provavel: "Qual é o valor do investimento?",
    resposta_sugerida: "O investimento varia conforme a quantidade de profissionais e o volume de agendamentos. A ideia inicial é só entender o cenário de vocês para ver se faz sentido.",
    justificativa: "Separação de assunto e corpo com pergunta final simples.",
    condicao: "Enviar somente se o Dia 1 não tiver tido retorno após 48h úteis.",
    status_dia: "pendente",
  },
  {
    dia: 4,
    tipo_dia: "tarefa",
    canal: "nenhum",
    titulo: "Dia 4 — Análise de Serviços e Contexto da Recepção",
    titulo_dia: "Dia 4 — Análise de Serviços e Contexto da Recepção",
    objetivo: "Mapear especialidades da clínica para personalizar futuros argumentos caso respondam",
    acao_sugerida: "Não enviar mensagens hoje. Analisar quais especialidades têm destaque no site e nas avaliações da clínica.",
    mensagem: "",
    justificativa: "Permite digestão da mensagem anterior e prepara repertório consultivo.",
    condicao: "Se a empresa responder por e-mail ou WhatsApp: pausar a cadência e atender prontamente.",
    status_dia: "pendente",
  },
  {
    dia: 5,
    tipo_dia: "mensagem",
    canal: "whatsapp",
    titulo: "Dia 5 — Acompanhamento Leve sem Cobrança Passiva",
    titulo_dia: "Dia 5 — Acompanhamento Leve sem Cobrança Passiva",
    objetivo: "Retomar contato com pergunta nova sem cobranças do tipo 'viu minha mensagem'",
    acao_sugerida: "Enviar WhatsApp trazendo reflexão prática sobre a rotina da recepção",
    mensagem: CANONICAL_OUTREACH_MESSAGES.dia5,
    objecao_provavel: "Já temos secretárias cuidando disso.",
    resposta_sugerida: "Perfeito! O objetivo não é substituir o atendimento humano, mas liberar as secretárias de tarefas repetitivas para focarem no paciente presencial.",
    justificativa: "Pergunta consultiva rápida que reabre o diálogo sem pressão. 3ª e última tentativa ativa de contato.",
    condicao: "Enviar somente se não houver resposta anterior após 48h do e-mail.",
    status_dia: "pendente",
  },
  {
    dia: 6,
    tipo_dia: "tarefa",
    canal: "nenhum",
    titulo: "Dia 6 — Organização do Pipeline e Checagem de Silêncio",
    titulo_dia: "Dia 6 — Organização do Pipeline e Checagem de Silêncio",
    objetivo: "Avaliar o histórico de interações e atualizar o status no CRM",
    acao_sugerida: "Não enviar mensagens. Registrar o andamento da abordagem no CRM da Zuno.",
    mensagem: "",
    justificativa: "Evita contatos excessivos e mantém o pipeline comercial atualizado.",
    condicao: "Caso a clínica solicite não receber contatos, registrar recusa imediatamente.",
    status_dia: "pendente",
  },
  {
    dia: 7,
    tipo_dia: "tarefa",
    canal: "nenhum",
    titulo: "Dia 7 — Encerramento Interno da Cadência (CRM)",
    titulo_dia: "Dia 7 — Encerramento Interno da Cadência (CRM)",
    objetivo: "Concluir a cadência no CRM e arquivar o lead sem insistência adicional",
    acao_sugerida: "Não enviar nova mensagem. Atualizar o status do lead no CRM para 'sem_resposta' ou arquivado, programando reavaliação futura em 90 dias.",
    mensagem: "",
    objecao_provavel: "",
    resposta_sugerida: "",
    justificativa: "Encerramento formal de ciclo comercial interno. Não ultrapassa as 3 tentativas ativas de prospecção.",
    condicao: "Se não houve retorno às 3 mensagens enviadas (Dias 1, 3 e 5), encerrar a cadência no CRM.",
    status_dia: "pendente",
  },
];

/**
 * Retorna cópias e orientações adaptadas para o MESMO lead sob a ótica de maturidade comercial:
 * A MENSAGEM enviada ao prospect permanece a MESMA mensagem comercial de alta qualidade em todos os níveis.
 * O que MODIFICA é a profundidade das orientações, justificativas de conduta e dicas ao vendedor!
 */
function getSimulatedPlanForMaturity(maturity: CommercialMaturity, isRefined: boolean): PlanoProspeccaoDia[] {
  const baseDays = isRefined ? SIMULATED_REFINED_DAYS : SIMULATED_INITIAL_DAYS;

  if (maturity === "iniciante") {
    return baseDays.map((d) => {
      if (d.dia === 1) {
        return {
          ...d,
          titulo: "Dia 1 — WhatsApp de Abertura (Orientação Iniciante)",
          titulo_dia: "Dia 1 — WhatsApp de Abertura (Orientação Iniciante)",
          objetivo: "Abrir o primeiro contato com calma e descobrir se este número recebe agendamentos",
          mensagem: CANONICAL_OUTREACH_MESSAGES.dia1,
          objecao_provavel: "Quem é você e como conseguiu nosso número?",
          resposta_sugerida: "Mantenha a calma e responda com simpatia: 'Sou o Rodrigo Silva, da AutoAtende. Localizei o contato público de vocês no Google ao pesquisar clínicas odontológicas em Curitiba. Foi só para entender se este é o canal certo da recepção, desculpe se interrompi!'",
          justificativa: "Dê um primeiro passo simples: envie a mensagem pelo WhatsApp e aguarde a resposta. Não tente explicar todo o serviço nem falar de preços agora; o único objetivo deste contato inicial é confirmar se este número recebe agendamentos e abrir uma conversa com naturalidade.",
        };
      }
      if (d.dia === 2) {
        return {
          ...d,
          justificativa: "Não envie mensagens hoje. É normal a empresa demorar um pouco para responder. Dê o intervalo de 48h úteis e anote o contato no seu CRM.",
        };
      }
      if (d.dia === 3 && d.canal === "email") {
        return {
          ...d,
          titulo: "Dia 3 — E-mail Consultivo (Orientação Iniciante)",
          titulo_dia: "Dia 3 — E-mail Consultivo (Orientação Iniciante)",
          assunto_email: CANONICAL_OUTREACH_MESSAGES.dia3Subject,
          mensagem: CANONICAL_OUTREACH_MESSAGES.dia3,
          objecao_provavel: "Qual é o valor?",
          resposta_sugerida: "Explique com calma: 'O investimento depende do formato de atendimento da clínica. Se fizer sentido, posso mostrar um exemplo rápido de como funciona na prática, sem compromisso!'",
          justificativa: "O e-mail serve para dar uma alternativa profissional caso o WhatsApp esteja corrido. Não cobre resposta da mensagem anterior. Se eles não responderem, fique tranquilo e aguarde a pausa técnica de 48h úteis.",
        };
      }
      if (d.dia === 5) {
        return {
          ...d,
          titulo: "Dia 5 — Acompanhamento Leve (Orientação Iniciante)",
          titulo_dia: "Dia 5 — Acompanhamento Leve (Orientação Iniciante)",
          mensagem: CANONICAL_OUTREACH_MESSAGES.dia5,
          objecao_provavel: "Já temos quem cuide disso.",
          resposta_sugerida: "Agradeça com simpatia: 'Perfeito! Ter alguém cuidando do atendimento é essencial. Nosso trabalho só ajuda a tirar as mensagens repetitivas da frente para que a recepção foque no paciente presencial. Fico à disposição!'",
          justificativa: "Esta é a sua 3ª e última tentativa de contato. Envie de forma leve e cordial. Se não responderem, não insista: a prospecção profissional sabe a hora de encerrar com elegância.",
        };
      }
      if (d.dia === 7) {
        return {
          ...d,
          justificativa: "Ciclo de 7 dias concluído. Como não houve resposta após as 3 tentativas, marque o lead como encerrado no CRM. Parabéns pela disciplina de não insistir além da conta!",
        };
      }
      return d;
    });
  }

  if (maturity === "intermediario") {
    return baseDays.map((d) => {
      if (d.dia === 1) {
        return {
          ...d,
          titulo: "Dia 1 — WhatsApp de Abertura (Orientação Intermediária)",
          titulo_dia: "Dia 1 — WhatsApp de Abertura (Orientação Intermediária)",
          objetivo: "Validar canal da recepção e preparar terreno para qualificação da rotina",
          mensagem: CANONICAL_OUTREACH_MESSAGES.dia1,
          objecao_provavel: "Já temos secretárias cuidando disso.",
          resposta_sugerida: "Excelente! O objetivo não é substituir o atendimento humano, e sim apoiar a recepção na triagem e confirmações para que a equipe possa focar no acolhimento do paciente presencial.",
          justificativa: "Valide o canal de atendimento. Se confirmarem que recebem agendamentos por aqui, faça uma pergunta de qualificação simples para entender como lidam hoje com confirmação de consultas e faltas de pacientes, sem forçar uma demonstração de imediato.",
        };
      }
      if (d.dia === 2) {
        return {
          ...d,
          justificativa: "Mantenha a pausa técnica de 48h úteis. Não repita a mensagem anterior. Enquanto aguarda, prepare o ângulo do Dia 3 para trazer uma nova perspectiva prática.",
        };
      }
      if (d.dia === 3 && d.canal === "email") {
        return {
          ...d,
          titulo: "Dia 3 — E-mail Consultivo (Orientação Intermediária)",
          titulo_dia: "Dia 3 — E-mail Consultivo (Orientação Intermediária)",
          assunto_email: CANONICAL_OUTREACH_MESSAGES.dia3Subject,
          mensagem: CANONICAL_OUTREACH_MESSAGES.dia3,
          objecao_provavel: "Quanto custa o serviço?",
          resposta_sugerida: "O investimento varia conforme o fluxo de atendimento da clínica. Faz sentido batermos um papo rápido de 5 minutos para entender seu cenário?",
          justificativa: "Envio estruturado após 48h úteis sem retorno no WhatsApp. Apresente o valor prático da rotina de confirmação e observe se o e-mail gera resposta ou encaminhamento interno.",
        };
      }
      if (d.dia === 5) {
        return {
          ...d,
          titulo: "Dia 5 — Acompanhamento Leve (Orientação Intermediária)",
          titulo_dia: "Dia 5 — Acompanhamento Leve (Orientação Intermediária)",
          mensagem: CANONICAL_OUTREACH_MESSAGES.dia5,
          objecao_provavel: "Não temos interesse no momento.",
          resposta_sugerida: "Sem problemas! Agradeço pelo retorno sincero. Fico à disposição caso precisem otimizar essa rotina mais adiante.",
          justificativa: "3ª tentativa ativa da cadência. Uma pergunta simples de rotina. Caso permaneçam em silêncio após 48h úteis, encerre a cadência no CRM e programe follow-up futuro para daqui a 90 dias.",
        };
      }
      if (d.dia === 7) {
        return {
          ...d,
          justificativa: "Encerramento formal do ciclo no CRM. Registre o status como 'sem_resposta' e programe reavaliação de contato em 90 dias.",
        };
      }
      return d;
    });
  }

  if (maturity === "avancado") {
    return baseDays.map((d) => {
      if (d.dia === 1) {
        return {
          ...d,
          titulo: "Dia 1 — WhatsApp de Abertura (Orientação Avançada)",
          titulo_dia: "Dia 1 — WhatsApp de Abertura (Orientação Avançada)",
          objetivo: "Mapeamento rápido de canal e qualificação objetiva de interlocutor",
          mensagem: CANONICAL_OUTREACH_MESSAGES.dia1,
          objecao_provavel: "Pode adiantar o assunto por aqui ou enviar apresentação?",
          resposta_sugerida: "Com certeza. Atuamos com triagem e confirmação no WhatsApp para evitar horários ociosos na agenda odontológica. Se fizer sentido para o momento da clínica, podemos agendar 10 minutos para avaliar o cenário de vocês.",
          justificativa: "Abordagem inicial focada em qualificar o canal e mapear o interlocutor responsável pela rotina de atendimento. Evite excesso de preliminares: caso confirmem o canal, avance diretamente para qualificar o fluxo de agendamentos e identificar o decisor.",
        };
      }
      if (d.dia === 2) {
        return {
          ...d,
          justificativa: "Janela de SLA operacional. Mantenha em observação e evite tocar o lead antes de 48h úteis para não queimar o canal de prospecção.",
        };
      }
      if (d.dia === 3 && d.canal === "email") {
        return {
          ...d,
          titulo: "Dia 3 — E-mail Consultivo (Orientação Avançada)",
          titulo_dia: "Dia 3 — E-mail Consultivo (Orientação Avançada)",
          assunto_email: CANONICAL_OUTREACH_MESSAGES.dia3Subject,
          mensagem: CANONICAL_OUTREACH_MESSAGES.dia3,
          objecao_provavel: "Já temos sistema de gestão/prontuário.",
          resposta_sugerida: "Perfeito. Nossa solução atua exclusivamente na triagem e confirmação do primeiro contato no WhatsApp, sem concorrer com o prontuário eletrônico da clínica.",
          justificativa: "Ponto de contato assíncrono via e-mail. Se houver retorno positivo ou pedido de escopo, qualifique o decisor e proponha uma demonstração breve e objetiva.",
        };
      }
      if (d.dia === 5) {
        return {
          ...d,
          titulo: "Dia 5 — Acompanhamento Leve (Orientação Avançada)",
          titulo_dia: "Dia 5 — Acompanhamento Leve (Orientação Avançada)",
          mensagem: CANONICAL_OUTREACH_MESSAGES.dia5,
          objecao_provavel: "Não temos demanda para isso.",
          resposta_sugerida: "Compreendido perfeitamente. Registramos a posição para respeitar o ciclo da clínica e evitar contatos desnecessários.",
          justificativa: "Último touchpoint ativo da sequência fria. Respeite o teto de 3 tentativas para proteger a reputação do canal e o domínio. Em caso de ausência de retorno, marque como 'sem_resposta' e libere a capacidade operacional para novos prospects.",
        };
      }
      if (d.dia === 7) {
        return {
          ...d,
          justificativa: "Fim de cadência. Aplique governança de pipeline: encerre a sequência fria no CRM (status 'sem_resposta'), programando reavaliação de base para daqui a 90 dias.",
        };
      }
      return d;
    });
  }

  // Fallback padrão: Equilibrado
  return baseDays;
}

const SIMULATED_REFINED_DAYS: PlanoProspeccaoDia[] = [
  {
    dia: 1,
    tipo_dia: "mensagem",
    canal: "whatsapp",
    titulo: "Dia 1 — WhatsApp de Abertura",
    titulo_dia: "Dia 1 — WhatsApp de Abertura",
    objetivo: "Confirmar se o WhatsApp é o canal da recepção odontológica para novos agendamentos",
    acao_sugerida: "Enviar WhatsApp para a recepção da Clínica Sorriso Prime",
    mensagem: CANONICAL_OUTREACH_MESSAGES.dia1,
    objecao_provavel: "Como você conseguiu nosso número?",
    resposta_sugerida: "Localizei o contato público da Clínica Sorriso Prime na pesquisa local do Google em Curitiba.",
    justificativa: "Abertura neutra e direta, apresentando o profissional e o serviço com as próprias palavras.",
    status_dia: "disponivel",
  },
  {
    dia: 2,
    tipo_dia: "tarefa",
    canal: "nenhum",
    titulo: "Dia 2 — Pausa Técnica de Resposta e Observação",
    titulo_dia: "Dia 2 — Pausa Técnica de Resposta e Observação",
    objetivo: "Permitir tempo hábil de resposta para a recepção sem sobrecarga no canal",
    acao_sugerida: "Não enviar mensagem hoje. Aguardar resposta e conferir o horário de funcionamento da clínica.",
    mensagem: "",
    justificativa: "Respeitar a rotina de consultas da clínica. Contatos diários consecutivos geram percepção de spam.",
    condicao: "Se a empresa responder ao Dia 1: interromper a cadência e qualificar a demanda no mesmo canal.",
    status_dia: "pendente",
  },
  {
    dia: 3,
    tipo_dia: "mensagem",
    canal: "email",
    titulo: "Dia 3 — E-mail Consultivo de Acompanhamento",
    titulo_dia: "Dia 3 — E-mail Consultivo de Acompanhamento",
    objetivo: "Apresentar como lembretes e triagem evitam horários vagos na agenda",
    acao_sugerida: "Enviar e-mail estruturado abordando confirmação de consultas",
    assunto_email: CANONICAL_OUTREACH_MESSAGES.dia3Subject,
    mensagem: CANONICAL_OUTREACH_MESSAGES.dia3,
    objecao_provavel: "Qual é o custo dessa implantação?",
    resposta_sugerida: "O formato depende do número de dentistas e agendas da clínica. Se fizer sentido, podemos alinhar em 5 minutos para ver se é o momento certo.",
    justificativa: "Explora o impacto das ausências na agenda odontológica com foco em rotina e sem inventar promessas mirabolantes.",
    condicao: "Enviar somente se o Dia 1 não tiver tido retorno após 48h úteis.",
    status_dia: "pendente",
  },
  {
    dia: 4,
    tipo_dia: "tarefa",
    canal: "nenhum",
    titulo: "Dia 4 — Mapeamento de Especialidades e Demanda",
    titulo_dia: "Dia 4 — Mapeamento de Especialidades e Demanda",
    objetivo: "Verificar serviços de maior valor na clínica para embasar futura conversa",
    acao_sugerida: "Não enviar mensagem hoje. Analisar no site da clínica quais tratamentos demandam maior esforço de agendamento.",
    mensagem: "",
    justificativa: "Evita excesso de contatos e prepara argumentos técnicos contextualizados caso o prospect responda.",
    condicao: "Se houver retorno por e-mail ou WhatsApp, pausar a cadência e responder em até 1 hora.",
    status_dia: "pendente",
  },
  {
    dia: 5,
    tipo_dia: "mensagem",
    canal: "whatsapp",
    titulo: "Dia 5 — Acompanhamento Leve sem Cobrança",
    titulo_dia: "Dia 5 — Acompanhamento Leve sem Cobrança",
    objetivo: "Realizar última tentativa ativa com pergunta de rotina",
    acao_sugerida: "Enviar WhatsApp para a recepção da Clínica Sorriso Prime",
    mensagem: CANONICAL_OUTREACH_MESSAGES.dia5,
    objecao_provavel: "Já temos secretárias cuidando disso.",
    resposta_sugerida: "Perfeito! A ideia não é substituir a recepção, e sim dar suporte operacional nas confirmações repetitivas.",
    justificativa: "Terceira e última abordagem ativa de contato. Respeita o teto de 3 tentativas em 7 dias.",
    condicao: "Enviar somente se não houver resposta anterior após 48h do e-mail.",
    status_dia: "pendente",
  },
  {
    dia: 6,
    tipo_dia: "tarefa",
    canal: "nenhum",
    titulo: "Dia 6 — Avaliação de Interações e Atualização no CRM",
    titulo_dia: "Dia 6 — Avaliação de Interações e Atualização no CRM",
    objetivo: "Registrar a cadência executada e verificar se houve visualização",
    acao_sugerida: "Não enviar mensagens. Acessar o histórico do lead no CRM e registrar a data da última tentativa.",
    mensagem: "",
    justificativa: "Manter a disciplina de registro no CRM sem enviar contatos desnecessários.",
    condicao: "Se a clínica solicitar exclusão de contato, registrar imediatamente o opt-out no CRM.",
    status_dia: "pendente",
  },
  {
    dia: 7,
    tipo_dia: "tarefa",
    canal: "nenhum",
    titulo: "Dia 7 — Encerramento Interno da Cadência (CRM)",
    titulo_dia: "Dia 7 — Encerramento Interno da Cadência (CRM)",
    objetivo: "Concluir a cadência no CRM e arquivar o lead sem insistência adicional",
    acao_sugerida: "Não enviar nova mensagem. Atualizar o status do lead no CRM para 'sem_resposta' ou arquivado, programando reavaliação futura em 90 dias.",
    mensagem: "",
    objecao_provavel: "",
    resposta_sugerida: "",
    justificativa: "Encerramento formal de ciclo comercial interno. Não ultrapassa as 3 tentativas ativas de prospecção.",
    condicao: "Se não houve retorno às 3 mensagens enviadas (Dias 1, 3 e 5), encerrar a cadência no CRM.",
    status_dia: "pendente",
  },
];

export default function DemoPlanoIA() {
  const [isRefined, setIsRefined] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("modal") === "false") return false;
    }
    return true;
  });
  const [quickContactOpen, setQuickContactOpen] = useState(false);
  const [simulatedNow, setSimulatedNow] = useState<Date>(() => new Date());
  const [initialBaseDate] = useState<Date>(() => new Date());
  const [commercialMaturity, setCommercialMaturity] = useState<CommercialMaturity>("equilibrado");
  const [offerScenario, setOfferScenario] = useState<"incompleto" | "detalhado">("incompleto");
  const [leadState, setLeadState] = useState<LeadProspeccao>({
    ...SIMULATED_LEAD,
    plano_prospecao_7dias: SIMULATED_INITIAL_DAYS,
  });
  const { toast } = useToast();

  const INCOMPLETE_OFFER_PROFILE = {
    display_name: "Rodrigo Silva",
    company_name: "AutoAtende Soluções",
    service_category: "automacao",
    service_offered: "Automação de WhatsApp",
    offer_description: "",
    target_audience: "Clínicas odontológicas",
  };

  const DETAILED_OFFER_PROFILE = {
    display_name: "Rodrigo Silva",
    company_name: "AutoAtende Soluções",
    service_category: "automacao",
    service_offered: "Automação de WhatsApp",
    offer_description: "Implantamos triagem automática e confirmação de consultas no WhatsApp para clínicas odontológicas, reduzindo faltas e liberando a recepção.",
    target_audience: "Clínicas odontológicas",
  };

  const handleSelectOfferScenario = (scenario: "incompleto" | "detalhado") => {
    setOfferScenario(scenario);
    if (scenario === "incompleto") {
      enableDemoSellerProfile({
        ...INCOMPLETE_OFFER_PROFILE,
        commercial_maturity: commercialMaturity,
      });
      toast({
        title: "Cenário 1: Perfil Incompleto",
        description: "Ao clicar em Gerar com IA, o Zuno acionará a Pergunta Única Contextual antes de gerar o plano.",
      });
    } else {
      enableDemoSellerProfile({
        ...DETAILED_OFFER_PROFILE,
        commercial_maturity: commercialMaturity,
      });
      toast({
        title: "Cenário 2: Perfil Suficientemente Detalhado",
        description: "A oferta já está clara. O plano será gerado diretamente sem perguntas adicionais.",
      });
    }
  };

  useEffect(() => {
    enableDemoSellerProfile({
      ...INCOMPLETE_OFFER_PROFILE,
      commercial_maturity: "equilibrado",
    });
    return () => {
      disableDemoSellerProfile();
    };
  }, []);

  const handleTimeAdvance = (hours: number) => {
    if (hours === 0) {
      const resetDate = new Date();
      setSimulatedNow(resetDate);
      toast({
        title: "Relógio: Agora",
        description: `Horário resetado para o momento atual: ${resetDate.toLocaleString("pt-BR")}.`,
      });
      return;
    }

    const nextDate = new Date(simulatedNow.getTime() + hours * 3600 * 1000);
    setSimulatedNow(nextDate);

    const diffHours = Math.round((nextDate.getTime() - initialBaseDate.getTime()) / (3600 * 1000));
    const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const dayName = dayNames[nextDate.getDay()];
    const isWeekend = nextDate.getDay() === 0 || nextDate.getDay() === 6;

    toast({
      title: `Avançado +${hours >= 24 ? `${hours / 24} dia(s)` : `${hours}h`} (Total: +${diffHours}h)`,
      description: `Nova data simulada: ${dayName}, ${nextDate.toLocaleString("pt-BR")}${isWeekend ? " (Fim de Semana)" : " (Dia Útil)"}.`,
    });
  };

  const handleResetSimulation = () => {
    const freshDate = new Date();
    setSimulatedNow(freshDate);
    setIsRefined(false);
    handleSelectOfferScenario("incompleto");
    setLeadState({
      ...SIMULATED_LEAD,
      plano_prospecao_7dias: SIMULATED_INITIAL_DAYS,
      ai_analise_gerada_em: null,
      custom_fields: {},
      notas: "",
      status: "novo",
    });
    toast({
      title: "Simulação Reiniciada",
      description: "Relógio fictício voltou para Agora e o lead foi restaurado para o estado inicial.",
    });
  };

  const handleDemoReanalyze = async (): Promise<LeadProspeccao> => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const refined: LeadProspeccao = {
      ...leadState,
      ai_analise_gerada_em: new Date().toISOString(),
      ai_used_fallback: false,
      plano_prospecao_7dias: SIMULATED_REFINED_DAYS,
    };
    setIsRefined(true);
    setLeadState(refined);
    return refined;
  };

  const handleReset = () => {
    setIsRefined(false);
    setLeadState({
      ...SIMULATED_LEAD,
      plano_prospecao_7dias: SIMULATED_INITIAL_DAYS,
      ai_analise_gerada_em: null,
    });
    toast({
      title: "Sugestão Inicial Restaurada",
      description: "Você voltou para a visão determinística com o botão verde 'Gerar plano comercial completo com IA'.",
    });
  };

  const handleToggleSaveLead = () => {
    const next = !leadState.salvo;
    setLeadState((prev) => ({ ...prev, salvo: next }));
    toast({
      title: next ? "Lead salvo com sucesso! (Demonstração)" : "Lead removido dos salvos (Demonstração)",
      description: next
        ? "Lead marcado como salvo em memória (zero chamadas ao Supabase)."
        : "Lead desmarcado em memória.",
    });
  };

  const handleDirectToggleRefine = () => {
    if (isRefined) {
      handleReset();
    } else {
      setIsRefined(true);
      setLeadState({
        ...SIMULATED_LEAD,
        ai_analise_gerada_em: new Date().toISOString(),
        ai_used_fallback: false,
        plano_prospecao_7dias: SIMULATED_REFINED_DAYS,
      });
      toast({
        title: "Alternado para Plano Refinado IA",
        description: "Visualizando a análise completa e cadência do Gemini 2.5 Flash.",
      });
    }
  };

  const applyScenario = (type: string) => {
    switch (type) {
      case "novo":
        setLeadState((prev) => ({
          ...prev,
          status: "novo",
          notas: "",
          custom_fields: {},
          plano_prospecao_7dias: prev.plano_prospecao_7dias?.map((d) => ({ ...d, status_dia: "pendente" as const })),
        }));
        toast({ title: "Cenário: Lead Novo", description: "Sem contato anterior. NBA recomenda primeira abordagem via WhatsApp." });
        break;
      case "espera_recente":
        setLeadState((prev) => ({
          ...prev,
          status: "em_contato",
          notas: "Primeira abordagem enviada pela manhã.",
          custom_fields: {
            crm_flow: {
              ultima_interacao_em: new Date(simulatedNow.getTime() - 6 * 3600 * 1000).toISOString(),
              ultimo_canal_interacao: "whatsapp",
            },
          },
          plano_prospecao_7dias: prev.plano_prospecao_7dias?.map((d) =>
            d.dia === 1 ? { ...d, status_dia: "concluido" as const } : d
          ),
        }));
        toast({ title: "Cenário: Contato Recente (< 48h)", description: "NBA recomenda pausa técnica e aguardar retorno natural." });
        break;
      case "followup_48h":
        setLeadState((prev) => ({
          ...prev,
          status: "em_contato",
          notas: "Abordagem inicial sem retorno após 54h.",
          custom_fields: {
            crm_flow: {
              ultima_interacao_em: new Date(simulatedNow.getTime() - 54 * 3600 * 1000).toISOString(),
              ultimo_canal_interacao: "whatsapp",
            },
          },
          plano_prospecao_7dias: prev.plano_prospecao_7dias?.map((d) =>
            d.dia === 1 ? { ...d, status_dia: "concluido" as const } : d
          ),
        }));
        toast({ title: "Cenário: Silêncio > 48h", description: "NBA recomenda follow-up consultivo (Dia 3) com novo ângulo comercial." });
        break;
      case "tres_tentativas":
        setLeadState((prev) => ({
          ...prev,
          status: "em_contato",
          notas: "3 tentativas enviadas (Dias 1, 3 e 5) sem retorno da recepção.",
          custom_fields: {
            crm_flow: {
              ultima_interacao_em: new Date(simulatedNow.getTime() - 72 * 3600 * 1000).toISOString(),
              ultimo_canal_interacao: "whatsapp",
            },
          },
          plano_prospecao_7dias: prev.plano_prospecao_7dias?.map((d) =>
            [1, 3, 5].includes(d.dia) ? { ...d, status_dia: "concluido" as const } : d
          ),
        }));
        toast({ title: "Cenário: 3 Tentativas Concluídas", description: "NBA orienta encerramento formal da cadência no CRM." });
        break;
      case "duvida_preco":
        setLeadState((prev) => ({
          ...prev,
          status: "em_contato",
          notas: "Recepcionista visualizou e perguntou qual o valor da implantação da automação.",
          custom_fields: {
            crm_flow: {
              ultima_interacao_em: new Date(simulatedNow.getTime() - 2 * 3600 * 1000).toISOString(),
              ultimo_canal_interacao: "whatsapp",
            },
          },
        }));
        toast({ title: "Cenário: Solicitou Informações/Preço", description: "NBA orienta resposta consultiva à dúvida sem disparo frio." });
        break;
      case "qualificacao":
        setLeadState((prev) => ({
          ...prev,
          status: "qualificacao",
          notas: "Dra. Paula demonstrou interesse em automatizar confirmações de consulta.",
          custom_fields: {
            crm_flow: {
              proximo_follow_up_em: new Date(simulatedNow.getTime() + 24 * 3600 * 1000).toISOString(),
              proxima_acao: "Ligar para qualificar fluxo de agendamento e decisores",
              ultima_interacao_em: new Date(simulatedNow.getTime() - 4 * 3600 * 1000).toISOString(),
              ultimo_canal_interacao: "whatsapp",
            },
          },
        }));
        toast({ title: "Cenário: Qualificação / Interesse", description: "Cadência fria pausada; NBA orienta qualificação consultiva e follow-up." });
        break;
      case "negociacao":
        setLeadState((prev) => ({
          ...prev,
          status: "negociacao",
          notas: "Proposta enviada avaliando implantação de triagem para 4 consultórios.",
          custom_fields: {
            crm_flow: {
              proximo_follow_up_em: new Date(simulatedNow.getTime() + 48 * 3600 * 1000).toISOString(),
              proxima_acao: "Retomar com Dr. Marcelo para alinhar fechamento do contrato",
              ultima_interacao_em: new Date(simulatedNow.getTime() - 24 * 3600 * 1000).toISOString(),
              ultimo_canal_interacao: "whatsapp",
            },
          },
        }));
        toast({ title: "Cenário: Negociação Ativa", description: "NBA orienta acompanhamento da proposta comercial e fechamento." });
        break;
      case "convertido":
        setLeadState((prev) => ({
          ...prev,
          status: "convertido",
          notas: "Contrato assinado! Início da implantação agendado.",
          custom_fields: {},
        }));
        toast({ title: "Cenário: Convertido em Cliente", description: "NBA orienta onboarding e alinhamento pós-venda." });
        break;
      case "recusa":
        setLeadState((prev) => ({
          ...prev,
          status: "recusou_optout",
          notas: "Recepção pediu para remover o número dos contatos comerciais.",
          custom_fields: {},
        }));
        toast({ title: "Cenário: Recusa / Opt-out", description: "Contato bloqueado; NBA suspende abordagens ativas respeitando LGPD." });
        break;
      default:
        break;
    }
    setDialogOpen(true);
  };

  const displayLead: LeadProspeccao = {
    ...leadState,
    ai_analise_gerada_em: isRefined ? (leadState.ai_analise_gerada_em || new Date().toISOString()) : null,
    plano_prospecao_7dias: getSimulatedPlanForMaturity(commercialMaturity, isRefined),
  };

  return (
    <div className="dark min-h-screen bg-[#0b0f0e] text-[#f4f4f5] pb-16 font-sans antialiased">
      {/* Barra de Segurança e Demonstração */}
      <div className="border-b border-[#1f2d29] bg-[#111816]/95 backdrop-blur sticky top-0 z-50 px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Modo Homologação Segura (Localhost)
                </span>
                <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400 bg-emerald-500/5">
                  100% Simulado
                </Badge>
              </div>
              <p className="text-[11px] text-zinc-400">
                Zero chamadas ao Gemini · Zero gravações no Supabase · Zero consumo de créditos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={openSellerProfileDialog}
              className="h-8 text-xs border-[#1f2d29] bg-[#111816] text-zinc-300 hover:text-white hover:bg-[#1f2d29]"
              title="Visualizar ou editar o perfil comercial simulado em memória"
            >
              <UserCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
              Perfil Comercial (Demo)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDirectToggleRefine}
              className="h-8 text-xs border-[#1f2d29] bg-[#111816] text-zinc-300 hover:text-white hover:bg-[#1f2d29]"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {isRefined ? "Ver Sugestão Inicial" : "Ver Refinado com IA"}
            </Button>

            {!dialogOpen && (
              <Button
                size="sm"
                onClick={() => setDialogOpen(true)}
                className="h-8 text-xs bg-[#10d98a] hover:bg-[#0eb875] text-[#0b0f0e] font-semibold"
              >
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                Abrir Modal "Ver Plano"
              </Button>
            )}

            <Link to="/">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Voltar à Zuno
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Conteúdo Central */}
      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Banner Explicativo */}
        <Card className="border-[#1f2d29] bg-[#111816] text-[#f4f4f5] shadow-lg">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-white">
                <Sparkles className="h-4 w-4 text-[#10d98a]" />
                Experiência Oficial da Zuno: Modal "Ver Plano"
              </h2>
              <p className="text-xs text-zinc-300 leading-relaxed max-w-2xl">
                Na Zuno oficial, o usuário navega em <strong>Buscar Leads</strong> ou <strong>Leads Salvos</strong> e clica em <strong>"Ver Plano"</strong>.
                O modal <code className="bg-[#0b0f0e] px-1.5 py-0.5 rounded text-emerald-400">LeadPlanDialog</code> abre com contatos, CRM, anotações e a Análise Comercial completa.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">Estado do modal:</span>
              <Badge
                variant="outline"
                className={
                  isRefined
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400 font-semibold"
                    : "border-zinc-700 bg-zinc-800/80 text-zinc-300 font-medium"
                }
              >
                {isRefined ? "Personalizado com IA" : "Sugestão Inicial"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Painel de Controle de Simulação de Tempo (Dev Exclusivo) */}
        <Card className="border-emerald-500/40 bg-[#0e1714] text-[#f4f4f5] shadow-lg" data-testid="time-simulation-panel">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1f2d29] pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Controle de Simulação de Tempo (Dev Exclusivo)
                  </span>
                  <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                    Relógio Injetado
                  </Badge>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Recalcula a Próxima Melhor Ação para o mesmo lead considerando horas corridas, dias úteis, tentativas e respostas.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-[#0b0f0e] px-3 py-1.5 rounded-lg border border-[#1f2d29] text-xs font-mono">
                <span className="text-zinc-400 text-[11px]">Data simulada:</span>
                <span className="text-emerald-400 font-semibold">
                  {simulatedNow.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                <Badge className={
                  simulatedNow.getDay() === 0 || simulatedNow.getDay() === 6
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]"
                    : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]"
                }>
                  {simulatedNow.getDay() === 0 || simulatedNow.getDay() === 6 ? "Fim de Semana" : "Dia Útil"}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleTimeAdvance(0)}
                className="h-8 text-xs border-[#1f2d29] bg-[#111816] text-zinc-200 hover:text-white hover:bg-[#1f2d29]"
              >
                Agora
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleTimeAdvance(24)}
                className="h-8 text-xs border-emerald-500/30 bg-[#111816] text-emerald-400 hover:bg-emerald-500/10"
              >
                Avançar 24 horas
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleTimeAdvance(48)}
                className="h-8 text-xs border-emerald-500/30 bg-[#111816] text-emerald-400 hover:bg-emerald-500/10"
              >
                Avançar 48 horas
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleTimeAdvance(72)}
                className="h-8 text-xs border-emerald-500/30 bg-[#111816] text-emerald-400 hover:bg-emerald-500/10"
              >
                Avançar 72 horas
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleTimeAdvance(168)}
                className="h-8 text-xs border-emerald-500/30 bg-[#111816] text-emerald-400 hover:bg-emerald-500/10"
              >
                Avançar 7 dias
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleResetSimulation}
                className="h-8 text-xs border-destructive/40 text-destructive bg-[#111816] hover:bg-destructive/10 ml-auto"
              >
                Reiniciar simulação
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Painel de Maturidade Comercial (Comparativo do Mesmo Lead) */}
        <Card className="border-[#1f2d29] bg-[#111816] text-[#f4f4f5]" data-testid="panel-commercial-maturity">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500/10 text-purple-400">
                  <Briefcase className="h-3.5 w-3.5" />
                </span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">
                    Maturidade Comercial do Assinante (Comparativo do Mesmo Lead):
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    Altera a linguagem, o tom de abordagem e a Próxima Melhor Ação para o MESMO lead
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={COMMERCIAL_MATURITY_METAS[commercialMaturity].badgeClass}>
                Nível Ativo: {COMMERCIAL_MATURITY_METAS[commercialMaturity].label}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
              {(["equilibrado", "iniciante", "intermediario", "avancado"] as const).map((mat) => {
                const meta = COMMERCIAL_MATURITY_METAS[mat];
                const isActive = commercialMaturity === mat;
                return (
                  <button
                    key={mat}
                    type="button"
                    onClick={() => {
                      setCommercialMaturity(mat);
                      enableDemoSellerProfile({
                        ...(offerScenario === "incompleto" ? INCOMPLETE_OFFER_PROFILE : DETAILED_OFFER_PROFILE),
                        commercial_maturity: mat,
                      });
                      toast({
                        title: `Maturidade: ${meta.label}`,
                        description: meta.description,
                      });
                    }}
                    className={cn(
                      "flex flex-col text-left p-2.5 rounded-lg border transition-all text-xs space-y-1",
                      isActive
                        ? "border-emerald-500 bg-emerald-500/15 shadow-[0_0_15px_rgba(16,217,138,0.15)] ring-1 ring-emerald-500"
                        : "border-[#1f2d29] bg-[#0c1210] hover:border-zinc-700 hover:bg-[#111816]"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={cn("font-semibold", isActive ? "text-emerald-400" : "text-white")}>
                        {meta.label}
                      </span>
                      {isActive && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                      {meta.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="rounded-lg border border-[#1f2d29] bg-[#0c1210] p-2.5 text-[11px] text-zinc-300 space-y-1">
              <p>
                <strong className="text-white">Estilo de Condução: </strong>
                {COMMERCIAL_MATURITY_METAS[commercialMaturity].guidanceStyle}
              </p>
              <p>
                <strong className="text-white">Tom da Abordagem: </strong>
                {COMMERCIAL_MATURITY_METAS[commercialMaturity].approachTone}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Painel de Refinamento de Oferta Comercial (Entendimento do Negócio) */}
        <Card className="border-[#1f2d29] bg-[#111816] text-[#f4f4f5]" data-testid="panel-offer-clarification">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Refinamento da Oferta Comercial (Entendimento do Negócio):
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    A Zuno compreende o negócio de quem vende antes de gerar uma estratégia personalizada com IA.
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  offerScenario === "incompleto"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px]"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[10px]"
                }
              >
                {offerScenario === "incompleto" ? "Cenário Ativo: Perfil Incompleto" : "Cenário Ativo: Perfil Detalhado"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Cenário 1: Incompleto */}
              <button
                type="button"
                onClick={() => handleSelectOfferScenario("incompleto")}
                className={cn(
                  "flex flex-col text-left p-3 rounded-lg border transition-all text-xs space-y-2",
                  offerScenario === "incompleto"
                    ? "border-amber-500/60 bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.1)] ring-1 ring-amber-500/50"
                    : "border-[#1f2d29] bg-[#0c1210] hover:border-zinc-700 hover:bg-[#111816]"
                )}
                data-testid="btn-scenario-incomplete-offer"
              >
                <div className="flex items-center justify-between w-full">
                  <span className={cn("font-semibold", offerScenario === "incompleto" ? "text-amber-400" : "text-white")}>
                    1. Perfil Incompleto (Oferta Ampla)
                  </span>
                  <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px] px-1.5 py-0">
                    Dispara 1 Pergunta Única
                  </Badge>
                </div>
                <div className="text-[11px] text-zinc-400 space-y-0.5">
                  <p><strong className="text-zinc-300">Serviço:</strong> Automação de WhatsApp</p>
                  <p><strong className="text-zinc-300">Descrição:</strong> <span className="text-zinc-500 italic">Vazia (falta o problema resolvido)</span></p>
                </div>
                <div className="rounded border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-amber-300/90 leading-relaxed">
                  Ao clicar em <em>"Gerar plano com IA"</em>, a Zuno identifica que falta informação essencial e apresenta <strong>1 pergunta contextual</strong>:
                  <div className="font-semibold text-zinc-100 my-1 bg-amber-950/40 p-1.5 rounded border border-amber-500/30">
                    "Qual problema sua automação resolve para o tipo de empresa que você quer atender?"
                  </div>
                  Permite resposta curta ou continuar sem responder (estratégia exploratória prudente).
                </div>
              </button>

              {/* Cenário 2: Detalhado */}
              <button
                type="button"
                onClick={() => handleSelectOfferScenario("detalhado")}
                className={cn(
                  "flex flex-col text-left p-3 rounded-lg border transition-all text-xs space-y-2",
                  offerScenario === "detalhado"
                    ? "border-emerald-500/60 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,217,138,0.15)] ring-1 ring-emerald-500/50"
                    : "border-[#1f2d29] bg-[#0c1210] hover:border-zinc-700 hover:bg-[#111816]"
                )}
                data-testid="btn-scenario-detailed-offer"
              >
                <div className="flex items-center justify-between w-full">
                  <span className={cn("font-semibold", offerScenario === "detalhado" ? "text-emerald-400" : "text-white")}>
                    2. Perfil Suficientemente Detalhado
                  </span>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] px-1.5 py-0">
                    Gera Direto sem Perguntas
                  </Badge>
                </div>
                <div className="text-[11px] text-zinc-400 space-y-0.5">
                  <p><strong className="text-zinc-300">Serviço:</strong> Automação de WhatsApp</p>
                  <p><strong className="text-zinc-300">Descrição:</strong> "Implantamos triagem e confirmação no WhatsApp para reduzir faltas..."</p>
                </div>
                <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-2 text-[11px] text-emerald-300/90 leading-relaxed">
                  Como a oferta já está clara e objetiva, ao clicar em <em>"Gerar plano com IA"</em> a Zuno segue <strong>normalmente sem perguntas adicionais</strong>, sem interrupção nem atrito.
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Seletor de Cenários Comerciais (Próxima Melhor Ação) */}
        <Card className="border-[#1f2d29] bg-[#111816] text-[#f4f4f5]">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Simular Cenários da Próxima Melhor Ação (NBA):
              </span>
              <span className="text-[11px] text-zinc-400">Clique para testar a inteligência de decisão</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => applyScenario("novo")} className="h-7 text-xs border-[#1f2d29] bg-[#0c1210] text-zinc-200 hover:border-emerald-500/50 hover:text-emerald-400">
                1. Lead Novo (1ª Abordagem)
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyScenario("espera_recente")} className="h-7 text-xs border-[#1f2d29] bg-[#0c1210] text-zinc-200 hover:border-amber-500/50 hover:text-amber-400">
                2. Contato Recente (Pausa 48h)
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyScenario("followup_48h")} className="h-7 text-xs border-[#1f2d29] bg-[#0c1210] text-zinc-200 hover:border-emerald-500/50 hover:text-emerald-400">
                3. Silêncio &gt; 48h (Follow-up)
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyScenario("tres_tentativas")} className="h-7 text-xs border-[#1f2d29] bg-[#0c1210] text-zinc-200 hover:border-zinc-500/50 hover:text-zinc-300">
                4. 3 Tentativas Concluídas (CRM)
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyScenario("duvida_preco")} className="h-7 text-xs border-[#1f2d29] bg-[#0c1210] text-zinc-200 hover:border-blue-500/50 hover:text-blue-400">
                5. Solicitou Preço / Dúvida
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyScenario("qualificacao")} className="h-7 text-xs border-[#1f2d29] bg-[#0c1210] text-zinc-200 hover:border-amber-500/50 hover:text-amber-400">
                6. Qualificação + Follow-up
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyScenario("negociacao")} className="h-7 text-xs border-[#1f2d29] bg-[#0c1210] text-zinc-200 hover:border-orange-500/50 hover:text-orange-400">
                7. Negociação Ativa
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyScenario("convertido")} className="h-7 text-xs border-[#1f2d29] bg-[#0c1210] text-zinc-200 hover:border-emerald-500/50 hover:text-emerald-400">
                8. Convertido (Cliente Ganho)
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyScenario("recusa")} className="h-7 text-xs border-destructive/30 bg-[#0c1210] text-destructive hover:bg-destructive/10">
                9. Recusa / Opt-out
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card do Lead que Simula o Card em 'Buscar Leads' / 'Leads Salvos' */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Lead Simulado em "Leads Salvos"
            </h3>
            <span className="text-xs text-zinc-500">Clique em "Ver Plano" para abrir o diálogo oficial</span>
          </div>

          <Card className="border-[#1f2d29] bg-[#111816] text-[#f4f4f5] hover:border-[#10d98a]/40 transition-all shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-xl text-white font-bold">{displayLead.nome}</CardTitle>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                    <span>Curitiba, PR • Google Rating 4.8 (142 avaliações)</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge variant="outline" className="border-[#1f2d29] bg-[#0e1412] text-zinc-300 text-xs">
                    {displayLead.nicho}
                  </Badge>
                  <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-medium">
                    Foco: {displayLead.foco}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 text-xs text-zinc-300">
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-zinc-400" />
                  <span>(41) 9988-7766</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>WhatsApp no site verificado</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Globe className="h-3.5 w-3.5" />
                  <span>sorrisoprime.com.br</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#1f2d29]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-zinc-400">Status CRM:</span>
                  <Badge className="bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs uppercase font-medium">
                    {displayLead.status || "novo"}
                  </Badge>
                  <span className="text-xs text-zinc-500">•</span>
                  <span className="text-xs text-zinc-400">Salvo:</span>
                  <Badge className={leadState.salvo ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs" : "bg-zinc-800 text-zinc-400 border-zinc-700 text-xs"}>
                    {leadState.salvo ? "Sim" : "Não"}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggleSaveLead}
                    className={
                      leadState.salvo
                        ? "h-8 text-xs border-emerald-500/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 gap-1.5"
                        : "h-8 text-xs border-[#1f2d29] text-zinc-300 hover:text-white hover:bg-zinc-800 gap-1.5"
                    }
                    title="Alternar estado salvo do lead em memória"
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    {leadState.salvo ? "Lead Salvo" : "Salvar Lead"}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickContactOpen(true)}
                    className="h-8 text-xs border-zinc-700 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 gap-1.5"
                    title="Registrar contato comercial realizado"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Registrar Contato
                  </Button>

                  <Button
                    onClick={() => setDialogOpen(true)}
                    className="h-8 bg-[#10d98a] hover:bg-[#0eb875] text-[#0b0f0e] font-bold text-xs gap-1.5 shadow-lg shadow-[#10d98a]/10"
                  >
                    <Eye className="h-4 w-4" />
                    Ver Plano
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Modal Oficial LeadPlanDialog no Modo Demonstração */}
      <LeadPlanDialog
        lead={displayLead}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isDemoMode={true}
        simulatedNow={simulatedNow}
        onAdvanceTime={handleTimeAdvance}
        onResetTime={handleResetSimulation}
        onDemoReanalyze={handleDemoReanalyze}
        commercialMaturity={commercialMaturity}
        onCommercialMaturityChange={setCommercialMaturity}
        onLeadRefined={(refined) => {
          setIsRefined(true);
          setLeadState(refined);
        }}
        onStatusChange={(leadId, newStatus) => {
          setLeadState((prev) => ({ ...prev, status: newStatus }));
        }}
      />

      {quickContactOpen && (
        <ConfirmContactModal
          open={quickContactOpen}
          onOpenChange={setQuickContactOpen}
          leadId={displayLead.id}
          leadNome={displayLead.nome}
          defaultType={displayLead.status === "novo" ? "primeira_abordagem" : "follow_up"}
          onConfirm={async () => {
            setLeadState((prev) => ({
              ...prev,
              status: prev.status === "novo" ? "em_contato" : prev.status,
              plano_prospecao_7dias: prev.plano_prospecao_7dias?.map((d) =>
                d.dia === 1 && prev.status === "novo" ? { ...d, status_dia: "concluido" as const } : d
              ),
              custom_fields: {
                ...((prev as any).custom_fields || {}),
                crm_flow: {
                  ...((prev as any).custom_fields?.crm_flow || {}),
                  ultima_interacao_em: simulatedNow.toISOString(),
                  ultimo_canal_interacao: "whatsapp",
                },
              },
            }));
            toast({
              title: "Contato registrado no horário simulado!",
              description: `Última abordagem gravada em ${simulatedNow.toLocaleString("pt-BR")}.`,
            });
            return true;
          }}
        />
      )}
    </div>
  );
}
