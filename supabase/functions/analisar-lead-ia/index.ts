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
    const leadData: LeadData & { lead_id?: string; canaisProspeccao?: string } = await req.json();
    console.log("🔍 Analisando lead:", leadData.nome, leadData.lead_id ? `(ID: ${leadData.lead_id})` : "");

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    let analise: AnaliseResult;

    if (!OPENAI_API_KEY) {
      console.log("⚠️ API key não configurada - retornando análise mockada");
      analise = generateMockAnalise(leadData, leadData.canaisProspeccao);
    } else {
      console.log("🤖 Iniciando análise com OpenAI...");
      analise = await analyzeWithAI(leadData, OPENAI_API_KEY, leadData.canaisProspeccao);
    }

    // Se temos lead_id e credenciais do Supabase, atualiza o lead no banco
    if (leadData.lead_id && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      console.log("💾 Atualizando lead no banco...");
      
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const { error: updateError } = await supabase
          .from("leads")
          .update({
            diagnostico_bullets: analise.diagnostico_bullets,
            probabilidade_conversao: analise.probabilidade_conversao,
            plano_prospeccao: analise.plano_prospeccao_7dias,
            ai_analise_gerada_em: new Date().toISOString(),
          })
          .eq("id", leadData.lead_id);

        if (updateError) {
          console.error("❌ Erro ao atualizar lead:", updateError);
        } else {
          console.log("✅ Lead atualizado com sucesso");
        }
      } catch (dbError: any) {
        console.error("❌ Erro ao conectar com banco:", dbError);
      }
    }

    return new Response(JSON.stringify(analise), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("❌ Erro fatal na análise:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Erro ao analisar lead",
        details: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateMockAnalise(lead: LeadData, canaisProspeccao: string = "ambos"): AnaliseResult {
  const temMarketing = lead.has_meta_pixel || lead.has_gtag || lead.has_gtm;
  const temWhatsApp = lead.whatsapp_on_site;
  const temSocial = !!lead.instagram_url;

  // Define os canais disponíveis baseado na preferência
  const getCanal = (diaNumero: number): "whatsapp" | "email" => {
    if (canaisProspeccao === "whatsapp") return "whatsapp";
    if (canaisProspeccao === "email") return "email";
    // Se for ambos, alterna: ímpares WhatsApp, pares Email
    return diaNumero % 2 === 1 ? "whatsapp" : "email";
  };

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
        canal: getCanal(1),
        mensagem: `Olá! Notei que ${lead.nome} está em ${lead.cidade}. Estamos ajudando empresas de ${lead.nicho} a ${getFocoMessage(lead.foco)}. Podemos conversar 5min?`,
        objecao_provavel: "Já temos fornecedor",
        resposta_sugerida: "Entendo! Não vim substituir ninguém. Vim mostrar como empresas do seu nicho estão conseguindo resultados complementares. Vale a pena conhecer?",
        cta: "Responda 'sim' se topar uma conversa rápida",
      },
      {
        dia: 2,
        canal: getCanal(2),
        mensagem: `Assunto: ${lead.nome} - Oportunidade de ${lead.foco}\n\nOi! Rápido aqui: vi que vocês estão em ${lead.cidade} e trabalham com ${lead.nicho}. Temos cases específicos desse nicho que estão dobrando resultados com nossa abordagem de ${lead.foco}. Quer ver?`,
        objecao_provavel: "Não tenho orçamento agora",
        resposta_sugerida: "Sem problema! Minha ideia é mostrar o potencial primeiro. Depois você decide se faz sentido. Investimento só quando você estiver 100% confortável.",
        cta: "Clique aqui para agendar 15min",
      },
      {
        dia: 3,
        canal: getCanal(3),
        mensagem: `Case rápido: empresa de ${lead.nicho} em cidade similar aumentou ${getFocoMetric(lead.foco)} em 3 meses. Seu caso é parecido. Posso enviar o resumo?`,
        objecao_provavel: "Estou muito ocupado",
        resposta_sugerida: "Imagino! Por isso preparei algo bem objetivo: 1 página, 3 números, 0 enrolação. Lê em 2 minutos. Posso mandar?",
        cta: "Responda 'manda' para receber",
      },
      {
        dia: 4,
        canal: getCanal(4),
        mensagem: `Assunto: Diagnóstico ${lead.nome}\n\nPreparei uma análise rápida da presença digital de vocês. ${temMarketing ? "Vi que já usam algumas ferramentas, mas" : "Identifiquei"} 3 oportunidades imediatas de ${lead.foco}. Quer receber?`,
        objecao_provavel: "Como sei que funciona?",
        resposta_sugerida: "Justo! Por isso ofereço: mostro o plano completo antes, você aprova cada etapa, e medimos tudo. Se não bater meta, ajusto sem custo. Risco zero.",
        cta: "Responda para receber o diagnóstico",
      },
      {
        dia: 5,
        canal: getCanal(5),
        mensagem: `Última tentativa: ${lead.nome} tem potencial enorme em ${lead.nicho}. Montei uma proposta personalizada focada em ${lead.foco}. 15min de call pra mostrar?`,
        objecao_provavel: "Preciso pensar",
        resposta_sugerida: "Claro! Mas antes de pensar, que tal ter todas as informações? Na call vou mostrar números, prazos e investimento. Aí sim dá pra pensar certinho.",
        cta: "Escolha dia/hora: [link calendário]",
      },
      {
        dia: 6,
        canal: getCanal(6),
        mensagem: `Assunto: Proposta Final - ${lead.nome}\n\nOi! Sei que está avaliando. Deixo aqui uma proposta completa: escopo, cronograma, investimento e garantias. Sem pressão, só informação pra você decidir bem. Abre e dá uma olhada?`,
        objecao_provavel: "Vou deixar pra depois",
        resposta_sugerida: "Entendo. Mas deixa eu te falar: cada mês que passa sem otimizar ${lead.foco} é oportunidade perdida. Que tal começarmos pequeno? Teste de 30 dias, baixo investimento?",
        cta: "Clique para ver proposta completa",
      },
      {
        dia: 7,
        canal: getCanal(7),
        mensagem: `Última mensagem: vi que ainda não conseguimos conversar. Tudo bem! Fico à disposição. Se mudar de ideia sobre ${lead.foco}, é só chamar. Sucesso aí com ${lead.nome}! 🚀`,
        objecao_provavel: "Vou entrar em contato depois",
        resposta_sugerida: "Combinado! Salva meu contato. E olha: se precisar de algo pontual enquanto isso, mesmo que pequeno, pode chamar. A gente se ajuda!",
        cta: "Salve meu contato para futuro",
      },
    ],
  };
}

async function analyzeWithAI(lead: LeadData, apiKey: string, canaisProspeccao: string = "ambos"): Promise<AnaliseResult> {
  const prompt = buildAnalysisPrompt(lead, canaisProspeccao);

  console.log("Iniciando análise com OpenAI para:", lead.nome);

  try {
    const requestBody = {
      model: "gpt-4o-mini",
      max_completion_tokens: 4000,
      messages: [
        {
          role: "system",
          content:
            "Você é um especialista sênior em prospecção B2B, copywriting persuasivo e análise de marketing digital. Você domina a técnica AIDA (Atenção, Interesse, Desejo, Ação) e cria mensagens de alta conversão. Suas objeções são realistas e suas respostas usam técnicas avançadas de vendas consultivas. Você gera CTAs irresistíveis e acionáveis.",
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
    };

    console.log("Enviando requisição para OpenAI...");

    // Adiciona timeout de 30 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Erro HTTP da OpenAI:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      
      let errorMessage = `Erro ${response.status} na API OpenAI`;
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch {
        errorMessage += `: ${errorText.substring(0, 200)}`;
      }
      
      throw new Error(errorMessage);
    }

      const data = await response.json();
    console.log("✅ Resposta recebida da OpenAI");

    if (!data.choices || data.choices.length === 0) {
      console.error("❌ Resposta sem choices:", data);
      throw new Error("API retornou resposta vazia");
    }

    const toolCall = data.choices[0].message.tool_calls?.[0];

    if (!toolCall) {
      console.error("❌ Sem tool_calls na resposta:", data.choices[0].message);
      throw new Error("IA não retornou análise estruturada. Tente novamente.");
    }

    console.log("✅ Tool call recebido, parseando argumentos...");
    
    let analise: AnaliseResult;
    try {
      analise = JSON.parse(toolCall.function.arguments);
    } catch (parseError: any) {
      console.error("❌ Erro ao parsear JSON:", {
        error: parseError.message,
        arguments: toolCall.function.arguments,
      });
      throw new Error("Erro ao processar resposta da IA");
    }

    // Validação básica
    if (!analise.diagnostico_bullets || !Array.isArray(analise.diagnostico_bullets)) {
      throw new Error("Análise incompleta: diagnóstico inválido");
    }
    if (!analise.plano_prospeccao_7dias || analise.plano_prospeccao_7dias.length !== 7) {
      throw new Error("Análise incompleta: plano deve ter 7 dias");
    }

    console.log("✅ Análise validada com sucesso");
    return analise;

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error("Timeout: OpenAI demorou mais de 30 segundos para responder");
      }
      throw fetchError;
    }
  } catch (error: any) {
    console.error("❌ Erro na função analyzeWithAI:", {
      message: error.message,
      stack: error.stack,
      lead: lead.nome,
    });
    
    // Re-throw com mensagem mais clara
    if (error.message.includes("API") || error.message.includes("Timeout")) {
      throw error; // Já tem mensagem clara
    }
    throw new Error(`Falha ao analisar lead: ${error.message}`);
  }
}

function buildAnalysisPrompt(lead: LeadData, canaisProspeccao: string = "ambos"): string {
  // Define os canais disponíveis baseado na preferência do usuário
  const canaisDisponiveis = canaisProspeccao === "ambos" 
    ? ["whatsapp", "email"]
    : [canaisProspeccao];
  
  const canalTexto = canaisProspeccao === "ambos"
    ? "WhatsApp e Email (alternando estrategicamente)"
    : canaisProspeccao === "email"
    ? "Email apenas"
    : "WhatsApp apenas";
    
  const sinaisMarketing = [];
  if (lead.has_meta_pixel) sinaisMarketing.push("Meta Pixel instalado");
  if (lead.has_gtag) sinaisMarketing.push("Google Analytics configurado");
  if (lead.has_gtm) sinaisMarketing.push("Google Tag Manager ativo");
  if (lead.whatsapp_on_site) sinaisMarketing.push("WhatsApp visível no site");
  if (lead.instagram_url) sinaisMarketing.push("Presença no Instagram");

  return `Analise este lead B2B e gere um plano de prospecção de alta conversão:

═══════════════════════════════════════
📊 DADOS DO LEAD
═══════════════════════════════════════
- Nome: ${lead.nome}
- Nicho: ${lead.nicho}
- Cidade: ${lead.cidade}
- Website: ${lead.website || "Não informado"}
- Foco de Serviço Desejado: ${lead.foco}

🎯 SINAIS DE MARKETING DIGITAL:
${sinaisMarketing.length > 0 ? sinaisMarketing.join("\n") : "Nenhum sinal detectado"}

${lead.instagram_context ? `📱 CONTEXTO INSTAGRAM:\n${lead.instagram_context}` : ""}

═══════════════════════════════════════
📋 INSTRUÇÕES DETALHADAS
═══════════════════════════════════════

1️⃣ DIAGNÓSTICO (máximo 6 bullets):
   - Avalie presença digital atual com métricas específicas
   - Identifique gaps críticos de marketing digital
   - Destaque oportunidades de ROI relacionadas ao foco "${lead.foco}"
   - Analise maturidade digital e prontidão para investimento
   ${lead.instagram_context ? "- Considere dados do Instagram na análise" : ""}
   - Use linguagem consultiva e profissional

2️⃣ PROBABILIDADE DE CONVERSÃO (0-100):
   Avalie com base em:
   - Maturidade digital e investimento atual em marketing
   - Sinais de crescimento e abertura para mudança
   - Complexidade da solução vs. capacidade de absorção
   - Canais de contato disponíveis (WhatsApp, redes sociais)
   - Urgência implícita do nicho "${lead.nicho}"

3️⃣ PLANO DE PROSPECÇÃO 7 DIAS - TÉCNICA AIDA OBRIGATÓRIA:
   
   🎯 MENSAGENS - Estrutura AIDA (Atenção, Interesse, Desejo, Ação):
   
   ✅ ATENÇÃO: Ganchar com problema específico ou resultado tangível
   - Use números, dados do nicho ou dor conhecida
   - Personalize com nome da empresa e cidade
   - Crie curiosidade ou urgência nos primeiros 10 segundos
   
   ✅ INTERESSE: Mostre relevância imediata
   - Cases específicos do nicho "${lead.nicho}"
   - Resultados mensuráveis de empresas similares
   - Conexão emocional com desafios do dia a dia
   
   ✅ DESEJO: Construa aspiração pela solução
   - Benefícios tangíveis focados em "${lead.foco}"
   - Diferenciais competitivos claros
   - Redução de risco percebido
   - Prova social ou autoridade
   
   ✅ AÇÃO: CTA irresistível e de baixo atrito
   - Uma ação clara e específica
   - Elimine barreiras para o próximo passo
   - Senso de urgência ou escassez sutil
   
   📝 OBJEÇÕES PROVÁVEIS - Requisitos:
   - Sejam REALISTAS e específicas do nicho "${lead.nicho}"
   - Reflitam preocupações reais de empresas similares
   - Incluam objeções de orçamento, timing, risco e confiança
   - Aumentem em complexidade ao longo dos 7 dias
   
   💬 RESPOSTAS SUGERIDAS - Técnicas Avançadas:
   - Use SPIN Selling (Situação, Problema, Implicação, Necessidade)
   - Aplique técnica do "Feel, Felt, Found" quando apropriado
   - Reframe objeções em oportunidades
   - Demonstre empatia genuína antes de contornar
   - Use prova social, dados ou cases para validar
   - Ofereça garantias ou redução de risco
   - Mantenha tom consultivo, nunca agressivo
   - Mínimo 2 sentenças, máximo 4 sentenças
   
   🎯 CTAs (Call-to-Action) - Requisitos:
   - Sejam ESPECÍFICOS e de baixo compromisso inicial
   - Usem verbos de ação fortes ("Agende", "Receba", "Descubra")
   - Incluam benefício imediato no próprio CTA
   - Removam fricção (tempo curto, sem compromisso, gratuito)
   - Variem o formato: WhatsApp rápido, link de agendamento, PDF exclusivo
   - Criem senso de urgência sutil quando apropriado
   
    📅 CADÊNCIA ESTRATÉGICA:
    - Canais disponíveis: ${canalTexto}
    ${canaisProspeccao === "ambos" 
      ? "- Alterne canais: WhatsApp (mais direto/rápido) em dias ímpares + Email (mais formal/detalhado) em dias pares" 
      : `- Use ${canaisProspeccao} em todos os 7 dias, variando abordagem e tom`}
    - Dia 1-2: Apresentação + gancho de valor
    - Dia 3-4: Prova social + case study
    - Dia 5-6: Proposta concreta + urgência
    - Dia 7: Follow-up de despedida mantendo porta aberta

═══════════════════════════════════════
🎯 ADAPTAÇÃO PARA FOCO: "${lead.foco}"
═══════════════════════════════════════
${getFocoGuidance(lead.foco)}

⚠️ QUALIDADE MÍNIMA EXIGIDA:
- Mensagens: 3-6 linhas, copy persuasiva com AIDA completo
- Objeções: Realistas e específicas do contexto do lead
- Respostas: Técnicas consultivas avançadas, 2-4 sentenças
- CTAs: Claros, acionáveis, baixo atrito, com benefício explícito

🌐 IDIOMA: Português brasileiro profissional mas acessível`;
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
