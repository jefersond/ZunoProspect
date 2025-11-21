import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LeadData {
  nome: string;
  nicho: string;
  cidade: string;
  website: string | null;
  foco: string;
  whatsapp_on_site: boolean;
  has_meta_pixel: boolean;
  has_gtag: boolean;
  has_gtm: boolean;
  instagram_url: string | null;
  instagram_context: string | null;
}

interface AnaliseResult {
  diagnostico_bullets: string[];
  probabilidade_conversao: number;
  plano_prospeccao_7dias: Array<{
    dia: number;
    canal: "whatsapp" | "email";
    mensagem: string;
    objecao_provavel: string;
    resposta_sugerida: string;
    cta: string;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const leadData: LeadData = await req.json();
    console.log("Analisando lead:", leadData.nome);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    let analise: AnaliseResult;

    if (!OPENAI_API_KEY) {
      // Mock de análise quando não houver API key
      console.log("API key não configurada - retornando análise mockada");
      analise = generateMockAnalise(leadData);
    } else {
      // Análise real com ChatGPT (OpenAI)
      analise = await analyzeWithAI(leadData, OPENAI_API_KEY);
    }

    return new Response(JSON.stringify(analise), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Erro na análise:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao analisar lead" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateMockAnalise(lead: LeadData): AnaliseResult {
  const temMarketing = lead.has_meta_pixel || lead.has_gtag || lead.has_gtm;
  const temWhatsApp = lead.whatsapp_on_site;
  const temSocial = !!lead.instagram_url;

  return {
    diagnostico_bullets: [
      `Empresa "${lead.nome}" no nicho de ${lead.nicho} em ${lead.cidade}`,
      temMarketing
        ? "Presença digital intermediária com ferramentas de tracking instaladas"
        : "Presença digital básica sem ferramentas de análise instaladas",
      temWhatsApp
        ? "WhatsApp ativo no site indica abertura para contato direto"
        : "Sem WhatsApp visível - oportunidade para implementar canal direto",
      temSocial
        ? "Presença em redes sociais detectada"
        : "Sem redes sociais identificadas - oportunidade de construção de marca",
      `Foco em ${lead.foco} tem alta compatibilidade com perfil atual`,
      "Potencial para crescimento com estratégia multicanal estruturada",
    ],
    probabilidade_conversao: temMarketing ? 72 : 45,
    plano_prospeccao_7dias: [
      {
        dia: 1,
        canal: "whatsapp",
        mensagem: `Olá! Notei que ${lead.nome} está em ${lead.cidade}. Estamos ajudando empresas de ${lead.nicho} a ${getFocoMessage(lead.foco)}. Podemos conversar 5min?`,
        objecao_provavel: "Já temos fornecedor",
        resposta_sugerida: "Entendo! Não vim substituir ninguém. Vim mostrar como empresas do seu nicho estão conseguindo resultados complementares. Vale a pena conhecer?",
        cta: "Responda 'sim' se topar uma conversa rápida",
      },
      {
        dia: 2,
        canal: "email",
        mensagem: `Assunto: ${lead.nome} - Oportunidade de ${lead.foco}\n\nOi! Rápido aqui: vi que vocês estão em ${lead.cidade} e trabalham com ${lead.nicho}. Temos cases específicos desse nicho que estão dobrando resultados com nossa abordagem de ${lead.foco}. Quer ver?`,
        objecao_provavel: "Não tenho orçamento agora",
        resposta_sugerida: "Sem problema! Minha ideia é mostrar o potencial primeiro. Depois você decide se faz sentido. Investimento só quando você estiver 100% confortável.",
        cta: "Clique aqui para agendar 15min",
      },
      {
        dia: 3,
        canal: "whatsapp",
        mensagem: `Case rápido: empresa de ${lead.nicho} em cidade similar aumentou ${getFocoMetric(lead.foco)} em 3 meses. Seu caso é parecido. Posso enviar o resumo?`,
        objecao_provavel: "Estou muito ocupado",
        resposta_sugerida: "Imagino! Por isso preparei algo bem objetivo: 1 página, 3 números, 0 enrolação. Lê em 2 minutos. Posso mandar?",
        cta: "Responda 'manda' para receber",
      },
      {
        dia: 4,
        canal: "email",
        mensagem: `Assunto: Diagnóstico ${lead.nome}\n\nPreparei uma análise rápida da presença digital de vocês. ${temMarketing ? "Vi que já usam algumas ferramentas, mas" : "Identifiquei"} 3 oportunidades imediatas de ${lead.foco}. Quer receber?`,
        objecao_provavel: "Como sei que funciona?",
        resposta_sugerida: "Justo! Por isso ofereço: mostro o plano completo antes, você aprova cada etapa, e medimos tudo. Se não bater meta, ajusto sem custo. Risco zero.",
        cta: "Responda para receber o diagnóstico",
      },
      {
        dia: 5,
        canal: "whatsapp",
        mensagem: `Última tentativa: ${lead.nome} tem potencial enorme em ${lead.nicho}. Montei uma proposta personalizada focada em ${lead.foco}. 15min de call pra mostrar?`,
        objecao_provavel: "Preciso pensar",
        resposta_sugerida: "Claro! Mas antes de pensar, que tal ter todas as informações? Na call vou mostrar números, prazos e investimento. Aí sim dá pra pensar certinho.",
        cta: "Escolha dia/hora: [link calendário]",
      },
      {
        dia: 6,
        canal: "email",
        mensagem: `Assunto: Proposta Final - ${lead.nome}\n\nOi! Sei que está avaliando. Deixo aqui uma proposta completa: escopo, cronograma, investimento e garantias. Sem pressão, só informação pra você decidir bem. Abre e dá uma olhada?`,
        objecao_provavel: "Vou deixar pra depois",
        resposta_sugerida: "Entendo. Mas deixa eu te falar: cada mês que passa sem otimizar ${lead.foco} é oportunidade perdida. Que tal começarmos pequeno? Teste de 30 dias, baixo investimento?",
        cta: "Clique para ver proposta completa",
      },
      {
        dia: 7,
        canal: "whatsapp",
        mensagem: `Última mensagem: vi que ainda não conseguimos conversar. Tudo bem! Fico à disposição. Se mudar de ideia sobre ${lead.foco}, é só chamar. Sucesso aí com ${lead.nome}! 🚀`,
        objecao_provavel: "Vou entrar em contato depois",
        resposta_sugerida: "Combinado! Salva meu contato. E olha: se precisar de algo pontual enquanto isso, mesmo que pequeno, pode chamar. A gente se ajuda!",
        cta: "Salve meu contato para futuro",
      },
    ],
  };
}

async function analyzeWithAI(lead: LeadData, apiKey: string): Promise<AnaliseResult> {
  const prompt = buildAnalysisPrompt(lead);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-mini-2025-08-07",
      messages: [
        {
          role: "system",
          content:
            "Você é um especialista em prospecção B2B e análise de marketing digital. Sua função é gerar diagnósticos precisos e planos de prospecção persuasivos.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "gerar_analise_lead",
            description: "Gera análise completa do lead com diagnóstico, probabilidade e plano de prospecção",
            parameters: {
              type: "object",
              properties: {
                diagnostico_bullets: {
                  type: "array",
                  description: "Máximo 6 bullets sobre presença digital, gaps e oportunidades",
                  items: { type: "string" },
                  maxItems: 6,
                },
                probabilidade_conversao: {
                  type: "number",
                  description: "Probabilidade de conversão de 0 a 100",
                  minimum: 0,
                  maximum: 100,
                },
                plano_prospeccao_7dias: {
                  type: "array",
                  description: "Plano de 7 dias de prospecção multicanal",
                  items: {
                    type: "object",
                    properties: {
                      dia: { type: "number" },
                      canal: { type: "string", enum: ["whatsapp", "email"] },
                      mensagem: { type: "string" },
                      objecao_provavel: { type: "string" },
                      resposta_sugerida: { type: "string" },
                      cta: { type: "string" },
                    },
                    required: ["dia", "canal", "mensagem", "objecao_provavel", "resposta_sugerida", "cta"],
                  },
                  minItems: 7,
                  maxItems: 7,
                },
              },
              required: ["diagnostico_bullets", "probabilidade_conversao", "plano_prospeccao_7dias"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "gerar_analise_lead" } },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Erro na API de IA:", response.status, errorText);
    throw new Error(`Erro na API de IA: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices[0].message.tool_calls?.[0];

  if (!toolCall) {
    throw new Error("IA não retornou análise estruturada");
  }

  const analise = JSON.parse(toolCall.function.arguments);
  return analise;
}

function buildAnalysisPrompt(lead: LeadData): string {
  const sinaisMarketing = [];
  if (lead.has_meta_pixel) sinaisMarketing.push("Meta Pixel instalado");
  if (lead.has_gtag) sinaisMarketing.push("Google Analytics configurado");
  if (lead.has_gtm) sinaisMarketing.push("Google Tag Manager ativo");
  if (lead.whatsapp_on_site) sinaisMarketing.push("WhatsApp visível no site");
  if (lead.instagram_url) sinaisMarketing.push("Presença no Instagram");

  return `Analise este lead B2B e gere um plano de prospecção persuasivo:

DADOS DO LEAD:
- Nome: ${lead.nome}
- Nicho: ${lead.nicho}
- Cidade: ${lead.cidade}
- Website: ${lead.website || "Não informado"}
- Foco de Serviço Desejado: ${lead.foco}

SINAIS DE MARKETING DIGITAL:
${sinaisMarketing.length > 0 ? sinaisMarketing.join("\n") : "Nenhum sinal detectado"}

${lead.instagram_context ? `CONTEXTO INSTAGRAM:\n${lead.instagram_context}` : ""}

INSTRUÇÕES:

1. DIAGNÓSTICO (máximo 6 bullets):
   - Avalie presença digital atual
   - Identifique gaps de marketing
   - Destaque oportunidades relacionadas ao foco "${lead.foco}"
   - Avalie maturidade digital
   ${lead.instagram_context ? "- Considere análise do Instagram" : ""}

2. PROBABILIDADE DE CONVERSÃO (0-100):
   - Considere maturidade atual
   - Sinais de investimento em marketing
   - Complexidade da oferta necessária
   - Abertura para contato (WhatsApp, redes sociais)

3. PLANO DE PROSPECÇÃO 7 DIAS:
   Crie cadência multicanal (WhatsApp + Email) com:
   - 1 mensagem por dia
   - Copy ULTRA PERSUASIVA adaptada ao foco "${lead.foco}"
   - Objeções prováveis realistas
   - Respostas que contornam objeções com técnicas de vendas
   - CTAs claros e acionáveis

FOCO "${lead.foco}" - Adapte mensagens:
${getFocoGuidance(lead.foco)}

Retorne em português brasileiro, com linguagem profissional mas acessível.`;
}

function getFocoGuidance(foco: string): string {
  const guidance: Record<string, string> = {
    "Full Service":
      "Enfatize gestão completa, economia de tempo, resultados integrados, parceria estratégica",
    Tráfego: "Enfatize ROI, leads qualificados, escala, otimização de campanhas, mídia paga",
    Automação: "Enfatize redução de tarefas manuais, funis automatizados, nutrição de leads, eficiência",
    Design: "Enfatize identidade visual, conversão, experiência do usuário, modernização de marca",
    Social: "Enfatize engajamento, crescimento orgânico, conteúdo relevante, comunidade",
    SEO: "Enfatize tráfego orgânico, ranking Google, autoridade, conteúdo evergreen, leads gratuitos",
    "Sites/Landing": "Enfatize conversão, velocidade, responsividade, design moderno, performance",
    CRM: "Enfatize organização de leads, funil de vendas, métricas, produtividade do time comercial",
  };
  return guidance[foco] || "Enfatize resultados, ROI e transformação do negócio";
}

function getFocoMessage(foco: string): string {
  const messages: Record<string, string> = {
    "Full Service": "ter uma gestão completa de marketing sem se preocupar com nada",
    Tráfego: "dobrar os leads qualificados com tráfego pago otimizado",
    Automação: "automatizar processos e nutrir leads no piloto automático",
    Design: "modernizar a identidade visual e aumentar conversões",
    Social: "crescer nas redes sociais e engajar clientes",
    SEO: "rankear no Google e gerar tráfego orgânico qualificado",
    "Sites/Landing": "criar sites de alta conversão com design moderno",
    CRM: "organizar o funil de vendas e aumentar produtividade comercial",
  };
  return messages[foco] || "otimizar resultados de marketing";
}

function getFocoMetric(foco: string): string {
  const metrics: Record<string, string> = {
    "Full Service": "resultados gerais",
    Tráfego: "leads de tráfego pago",
    Automação: "conversões automatizadas",
    Design: "taxa de conversão do site",
    Social: "engajamento nas redes",
    SEO: "tráfego orgânico",
    "Sites/Landing": "conversões da landing page",
    CRM: "produtividade comercial",
  };
  return metrics[foco] || "resultados";
}
