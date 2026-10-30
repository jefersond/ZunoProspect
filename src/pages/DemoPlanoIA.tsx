import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Sparkles, RefreshCw, CheckCircle2 } from "lucide-react";
import { LeadAnalysis } from "@/components/prospeccao/LeadAnalysis";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { LeadProspeccao, PlanoProspeccaoDia } from "@/types/lead";

const SIMULATED_LEAD: LeadProspeccao = {
  id: "demo-lead-sorriso-prime",
  user_id: "demo-user",
  nome: "Clínica Sorriso Prime",
  nicho: "clínica odontológica",
  cidade: "Curitiba",
  foco: "Automação",
  telefone: "4199887766",
  website: "https://sorrisoprime.com.br",
  instagram: "@sorrisoprime",
  rating: 4.8,
  reviews: 142,
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
    "Hipótese comercial: A implantação de triagem e confirmação automática no WhatsApp pode agilizar o atendimento de novos pacientes e reduzir ausências.",
    "Pergunta para validar: Como vocês organizam hoje a confirmação de consultas para evitar horários ociosos na agenda?",
  ],
  probabilidade_conversao: null,
  ai_analise_gerada_em: null,
  ai_used_fallback: false,
  salvo: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const SIMULATED_INITIAL_DAYS: PlanoProspeccaoDia[] = [
  {
    dia: 1,
    tipo_dia: "mensagem",
    canal: "whatsapp",
    titulo: "Dia 1 — Abertura Curta e Identificação de Demanda",
    titulo_dia: "Dia 1 — Abertura Curta e Identificação de Demanda",
    objetivo: "Iniciar primeiro contato neutro para identificar o canal comercial da recepção",
    acao_sugerida: "Enviar WhatsApp para a recepção da Clínica Sorriso Prime",
    mensagem: "Oi, pessoal da Clínica Sorriso Prime! Tudo bem?\n\nAtuo com Automação em Curitiba. Vocês atendem novos clientes de clínica odontológica por este número ou o contato comercial fica em outro canal?",
    objecao_provavel: "Quem é você e como conseguiu nosso número?",
    resposta_sugerida: "Atuo com Automação para negócios de clínica odontológica e localizei o contato público da Clínica Sorriso Prime na pesquisa local de Curitiba.",
    justificativa: "Abertura neutra que não presume intimidade nem afirma problemas internos.",
    status_dia: "disponivel",
  },
  {
    dia: 2,
    tipo_dia: "acompanhamento",
    canal: "instagram",
    titulo: "Dia 2 — Observação de Presença Digital sem Intimidade Falsa",
    titulo_dia: "Dia 2 — Observação de Presença Digital sem Intimidade Falsa",
    objetivo: "Compartilhar observação real sobre o segmento local sem fingir intimidade",
    acao_sugerida: "Enviar Direct comentando a demanda local",
    mensagem: "Oi, pessoal da Clínica Sorriso Prime! Tudo bem?\n\nEstava acompanhando negócios de clínica odontológica em Curitiba. Uma dificuldade comum que vejo é responder a tempo quem chega pelo Instagram e pelo WhatsApp sem acumular mensagens pendentes.\n\nVocês têm interesse em avaliar como organizar essa triagem?",
    objecao_provavel: "Não temos interesse no momento.",
    resposta_sugerida: "Compreendo perfeitamente! Fico à disposição se em algum momento isso for prioridade para vocês.",
    justificativa: "Nova perspectiva sobre o mesmo serviço de automação.",
    status_dia: "pendente",
  },
  {
    dia: 3,
    tipo_dia: "mensagem",
    canal: "email",
    titulo: "Dia 3 — Envio de Ângulo Consultivo Estruturado",
    titulo_dia: "Dia 3 — Envio de Ângulo Consultivo Estruturado",
    objetivo: "Apresentar hipótese comercial clara conectada ao serviço sem promessas absurdas",
    acao_sugerida: "Enviar e-mail explicando a lógica para o segmento",
    assunto_email: "Pergunta rápida sobre fluxo de atendimento - Clínica Sorriso Prime",
    mensagem: "Olá, equipe da Clínica Sorriso Prime!\n\nEntrei em contato recentemente porque trabalho com Automação voltado para clínica odontológica em Curitiba.\n\nA ideia é bem direta: em vez de depender apenas de confirmações manuais, estruturar uma rotina clara para que os agendamentos sejam confirmados no WhatsApp sem sobrecarregar a recepção.\n\nFaz sentido conversarmos 5 minutos sobre isso esta semana?",
    objecao_provavel: "Qual é o valor do investimento?",
    resposta_sugerida: "O investimento varia conforme a quantidade de profissionais e o volume de agendamentos. A ideia inicial é só entender o cenário de vocês para ver se faz sentido.",
    justificativa: "Separação de assunto e corpo com pergunta final simples.",
    status_dia: "pendente",
  },
  {
    dia: 4,
    tipo_dia: "acompanhamento",
    canal: "whatsapp",
    titulo: "Dia 4 — Acompanhamento Leve sem Cobrança Passiva",
    titulo_dia: "Dia 4 — Acompanhamento Leve sem Cobrança Passiva",
    objetivo: "Retomar contato com pergunta nova sem cobranças do tipo 'viu minha mensagem'",
    acao_sugerida: "Enviar WhatsApp trazendo nova reflexão prática",
    mensagem: "Oi, pessoal da Clínica Sorriso Prime! Tudo bem?\n\nPassando só para compartilhar uma dúvida de rotina: a recepção de vocês costuma gastar muito tempo confirmando consultas manualmente uma a uma no WhatsApp?",
    objecao_provavel: "Já temos secretárias cuidando disso.",
    resposta_sugerida: "Perfeito! O objetivo não é substituir o atendimento humano, mas liberar as secretárias de tarefas repetitivas para focarem no paciente presencial.",
    justificativa: "Pergunta consultiva rápida que reabre o diálogo sem pressão.",
    status_dia: "pendente",
  },
  {
    dia: 5,
    tipo_dia: "tarefa",
    canal: "nenhum",
    titulo: "Dia 5 — Pausa Estratégica e Pesquisa",
    titulo_dia: "Dia 5 — Pausa Estratégica e Pesquisa",
    objetivo: "Pausa estratégica para não sobrecarregar o prospect",
    acao_sugerida: "Conferir o perfil da clínica no Google para checar horários de pico e serviços em destaque.",
    mensagem: "",
    justificativa: "Respeitar o tempo da empresa e evitar insistência desagradável.",
    status_dia: "pendente",
  },
  {
    dia: 6,
    tipo_dia: "acompanhamento",
    canal: "whatsapp",
    titulo: "Dia 6 — Apresentação de Exemplo de Mercado",
    titulo_dia: "Dia 6 — Apresentação de Exemplo de Mercado",
    objetivo: "Citar benefício prático observado no nicho de clínicas odontológicas",
    acao_sugerida: "Enviar mensagem curta com observação de mercado",
    mensagem: "Oi, pessoal da Sorriso Prime! Passando para compartilhar uma observação rápida: clínicas odontológicas com movimento alto costumam reduzir faltas em até metade apenas automatizando o lembrete de 24h antes. Vale falarmos 5 minutos sobre como isso funcionaria aí?",
    objecao_provavel: "Não temos orçamento no momento.",
    resposta_sugerida: "Sem problemas! O momento da empresa sempre vem primeiro. Deixo meu contato para quando planejarem essa melhoria.",
    justificativa: "Dado de mercado relevante para a rotina odontológica sem inventar promessas.",
    status_dia: "pendente",
  },
  {
    dia: 7,
    tipo_dia: "acompanhamento",
    canal: "whatsapp",
    titulo: "Dia 7 — Encerramento Elegante da Sequência",
    titulo_dia: "Dia 7 — Encerramento Elegante da Sequência",
    objetivo: "Encerrar a cadência com postura profissional, mantendo as portas abertas",
    acao_sugerida: "Enviar mensagem final de encerramento e atualizar CRM",
    mensagem: "Oi, pessoal da Clínica Sorriso Prime! Imagino que a rotina de atendimentos esteja bem corrida por aí. Vou deixar nosso contato registrado e encerro minhas mensagens por aqui para não incomodar. Se em algum momento fizer sentido organizar esse fluxo, fico à disposição!",
    objecao_provavel: "",
    resposta_sugerida: "",
    justificativa: "Descompressão total sem mensagens passivo-agressivas de despedida.",
    status_dia: "pendente",
  },
];

const SIMULATED_REFINED_DAYS: PlanoProspeccaoDia[] = [
  {
    dia: 1,
    tipo_dia: "mensagem",
    canal: "whatsapp",
    titulo: "Dia 1 — Abertura Consultiva Especializada",
    titulo_dia: "Dia 1 — Abertura Consultiva Especializada",
    objetivo: "Confirmar se o WhatsApp é o canal da recepção odontológica para novos agendamentos",
    acao_sugerida: "Enviar WhatsApp para a recepção da Clínica Sorriso Prime",
    mensagem: "Oi, pessoal da Clínica Sorriso Prime! Tudo bem?\n\nSou Rodrigo Silva, da AutoAtende. Atuo com automação de atendimento no WhatsApp para clínicas odontológicas em Curitiba. Vocês atendem novos pacientes por este número ou o contato da recepção fica em outro canal?",
    objecao_provavel: "Como você conseguiu nosso número?",
    resposta_sugerida: "Localizei o contato público da Clínica Sorriso Prime na pesquisa local do Google em Curitiba.",
    justificativa: "Abertura neutra e direta, apresentando o profissional e o serviço com as próprias palavras.",
    status_dia: "disponivel",
  },
  {
    dia: 2,
    tipo_dia: "acompanhamento",
    canal: "instagram",
    titulo: "Dia 2 — Triagem de Mensagens Noturnas e Fins de Semana",
    titulo_dia: "Dia 2 — Triagem de Mensagens Noturnas e Fins de Semana",
    objetivo: "Apresentar o gargalo de pacientes que buscam atendimento fora do horário comercial",
    acao_sugerida: "Enviar Direct respeitoso abordando atendimento 24h",
    mensagem: "Oi, equipe da Clínica Sorriso Prime! Tudo bem?\n\nAcompanhando clínicas odontológicas em Curitiba, vejo que muitas acumulam mensagens à noite ou no domingo e perdem pacientes por demora na resposta inicial. Vocês têm interesse em avaliar como organizar uma triagem automática para esses horários?",
    objecao_provavel: "Não temos interesse no momento.",
    resposta_sugerida: "Compreendo perfeitamente! Se em algum momento fizer sentido organizar o fluxo de mensagens, fico à disposição.",
    justificativa: "Nova perspectiva prática sobre o mesmo serviço de automação de WhatsApp.",
    condicao: "Enviar somente se o Dia 1 não tiver recebido resposta após 24h úteis.",
    status_dia: "pendente",
  },
  {
    dia: 3,
    tipo_dia: "mensagem",
    canal: "email",
    titulo: "Dia 3 — Redução de Ausências (No-Show) na Agenda Odontológica",
    titulo_dia: "Dia 3 — Redução de Ausências (No-Show) na Agenda Odontológica",
    objetivo: "Demonstrar como lembretes automáticos evitam buracos na agenda dos dentistas",
    acao_sugerida: "Enviar e-mail estruturado abordando confirmação automática",
    assunto_email: "Confirmação automática de consultas - Clínica Sorriso Prime",
    mensagem: "Olá, equipe da Clínica Sorriso Prime!\n\nEntrei em contato recentemente porque atuo com automação de atendimento no WhatsApp para clínicas odontológicas em Curitiba.\n\nUm ponto comum que dentistas e recepcionistas relatam é o tempo gasto ligando ou mandando WhatsApp manual para confirmar consultas do dia seguinte.\n\nCom uma rotina automática de confirmação em 2 cliques, a clínica reduz faltas de pacientes sem sobrecarregar a recepção. Faz sentido conversarmos 5 minutos esta semana sobre isso?",
    objecao_provavel: "Qual é o custo dessa implantação?",
    resposta_sugerida: "O formato depende do número de dentistas e agendas da clínica. Se fizer sentido, podemos alinhar em 5 minutos.",
    justificativa: "Explora o impacto das ausências na agenda odontológica sem mudar de serviço.",
    status_dia: "pendente",
  },
  {
    dia: 4,
    tipo_dia: "acompanhamento",
    canal: "whatsapp",
    titulo: "Dia 4 — Pergunta Consultiva sobre Tempo de Recepção",
    titulo_dia: "Dia 4 — Pergunta Consultiva sobre Tempo de Recepção",
    objetivo: "Fazer pergunta consultiva de baixo atrito sobre a rotina das secretárias",
    acao_sugerida: "Enviar WhatsApp curto",
    mensagem: "Oi, pessoal da Clínica Sorriso Prime! Uma dúvida rápida de rotina: a recepção de vocês costuma gastar mais de 1 hora por dia confirmando pacientes para o dia seguinte?",
    objecao_provavel: "Já temos secretárias cuidando disso.",
    resposta_sugerida: "Perfeito! O objetivo não é substituir o atendimento humano, mas liberar as secretárias de tarefas repetitivas para focarem no paciente presencial.",
    justificativa: "Pergunta simples que se responde com sim ou não, mantendo o diálogo aberto.",
    condicao: "Enviar somente após 48h do último contato sem retorno.",
    status_dia: "pendente",
  },
  {
    dia: 5,
    tipo_dia: "tarefa",
    canal: "nenhum",
    titulo: "Dia 5 — Pausa Estratégica e Pesquisa",
    titulo_dia: "Dia 5 — Pausa Estratégica e Pesquisa",
    objetivo: "Pausa estratégica para não sobrecarregar o prospect",
    acao_sugerida: "Conferir o perfil do Google para identificar quais especialidades têm mais demanda na clínica.",
    mensagem: "",
    justificativa: "Evita excesso de contatos e prepara argumento contextualizado para a reta final.",
    status_dia: "pendente",
  },
  {
    dia: 6,
    tipo_dia: "acompanhamento",
    canal: "whatsapp",
    titulo: "Dia 6 — Exemplo Prático de Agilidade no Primeiro Atendimento",
    titulo_dia: "Dia 6 — Exemplo Prático de Agilidade no Primeiro Atendimento",
    objetivo: "Mostrar como o tempo de resposta influencia a decisão do paciente odontológico",
    acao_sugerida: "Enviar mensagem curta com observação prática",
    mensagem: "Oi, pessoal da Sorriso Prime! Passando para compartilhar uma observação rápida: mais de 60% dos pacientes que pedem orçamento odontológico por WhatsApp fecham com a clínica que responde de imediato. Vale falarmos 5 minutos sobre como garantir essa resposta instantânea?",
    objecao_provavel: "Não temos orçamento no momento.",
    resposta_sugerida: "Sem problemas! O momento da clínica sempre vem primeiro. Deixo meu contato para quando planejarem essa melhoria.",
    justificativa: "Última tentativa consultiva antes do encerramento da cadência.",
    condicao: "Enviar somente em horário comercial em dia útil.",
    status_dia: "pendente",
  },
  {
    dia: 7,
    tipo_dia: "acompanhamento",
    canal: "whatsapp",
    titulo: "Dia 7 — Encerramento Elegante (Breakup)",
    titulo_dia: "Dia 7 — Encerramento Elegante (Breakup)",
    objetivo: "Encerrar a sequência com elegância sem cobranças passivo-agressivas",
    acao_sugerida: "Enviar mensagem final de encerramento e atualizar CRM",
    mensagem: "Oi, pessoal da Clínica Sorriso Prime! Imagino que a rotina de atendimentos esteja bem corrida por aí. Vou deixar nosso contato registrado e encerro minhas mensagens por aqui para não incomodar. Se em algum momento fizer sentido organizar esse fluxo, fico à disposição!",
    objecao_provavel: "",
    resposta_sugerida: "",
    justificativa: "Descompressão total que preserva o relacionamento futuro no CRM.",
    condicao: "Enviar após 3 dias do Dia 6 e alterar status para 'perdido' ou 'sem_resposta'.",
    status_dia: "pendente",
  },
];

export default function DemoPlanoIA() {
  const [isRefined, setIsRefined] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const { toast } = useToast();

  const handleSimulateRefine = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsRefined(true);
      setIsSimulating(false);
      toast({
        title: "Plano Comercial Completo Gerado!",
        description: "Simulação do Gemini concluída com sucesso (Zero chamadas de API reais / Zero créditos consumidos).",
      });
    }, 600);
  };

  const handleReset = () => {
    setIsRefined(false);
    toast({
      title: "Sugestão Inicial Restaurada",
      description: "Você voltou para a visão inicial determinística com o botão verde pronto.",
    });
  };

  const displayLead: LeadProspeccao = {
    ...SIMULATED_LEAD,
    ai_analise_gerada_em: isRefined ? new Date().toISOString() : null,
    ai_used_fallback: false,
    plano_prospecao_7dias: isRefined ? SIMULATED_REFINED_DAYS : SIMULATED_INITIAL_DAYS,
  };

  return (
    <div className="min-h-screen bg-[#0b0f0e] text-[#f4f4f5] pb-16">
      {/* Barra de Segurança e Demonstração */}
      <div className="border-b border-[#1f2d29] bg-[#111816]/90 backdrop-blur sticky top-0 z-50 px-4 py-3">
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

          <div className="flex items-center gap-2">
            {isRefined ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="h-8 text-xs border-[#1f2d29] text-zinc-300 hover:text-white hover:bg-[#1f2d29]"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Ver Sugestão Inicial
              </Button>
            ) : (
              <Badge className="bg-[#10d98a]/10 text-[#10d98a] border border-[#10d98a]/30 text-xs px-2.5 py-1">
                Visualizando Sugestão Inicial
              </Badge>
            )}

            <Link to="/">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-zinc-400 hover:text-white"
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
        <Card className="border-[#1f2d29] bg-[#111816] text-[#f4f4f5]">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-[#f4f4f5]">
                <Sparkles className="h-4 w-4 text-[#10d98a]" />
                Demonstração Rápida do Pacote Comercial com IA
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
                {isRefined
                  ? "Você está visualizando o resultado pós-refinamento: o diagnóstico, a primeira abordagem em destaque, a cadência de 7 dias com o mesmo fio condutor e as 7 objeções táticas."
                  : "Abaixo está o lead fictício em seu estado inicial. Observe o badge 'Sugestão inicial' e o card de alto impacto com o botão verde 'Gerar plano comercial completo com IA'."}
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">Estado atual:</span>
              <Badge
                variant="outline"
                className={
                  isRefined
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-semibold"
                    : "border-zinc-700 bg-zinc-800/60 text-zinc-300"
                }
              >
                {isRefined ? "Personalizado com IA" : "Sugestão Inicial"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Componente Real do LeadAnalysis com o Lead Simulado */}
        <div className="rounded-xl border border-[#1f2d29] bg-[#111816]/70 p-4 sm:p-6 shadow-xl">
          <LeadAnalysis
            lead={displayLead}
            diagnostico={displayLead.diagnostico_bullets}
            plano={displayLead.plano_prospecao_7dias}
            geradoEm={displayLead.ai_analise_gerada_em}
            probabilidade={null}
            onReanalyze={isRefined ? handleReset : handleSimulateRefine}
            isReanalyzing={isSimulating}
            canAnalyzeAI={true}
            showCompanyName={true}
          />
        </div>
      </main>
    </div>
  );
}
