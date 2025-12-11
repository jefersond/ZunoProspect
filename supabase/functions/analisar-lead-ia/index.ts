import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  whatsapp_number?: string | null;
  email?: string | null;
  has_meta_pixel: boolean;
  has_gtag: boolean;
  has_gtm: boolean;
  instagram_url: string | null;
  instagram_context: string | null;
  canaisProspeccao?: ("email" | "whatsapp" | "instagram")[];
  cnpj?: string | null;
  razao_social?: string | null;
  nome_responsavel?: string | null;
  situacao_cadastral?: string | null;
  porte_empresa?: string | null;
  cnae_principal?: string | null;
}

function getAvailableChannels(lead: LeadData, selectedChannels: ("email" | "whatsapp" | "instagram")[]): ("email" | "whatsapp" | "instagram")[] {
  const available: ("email" | "whatsapp" | "instagram")[] = [];
  
  if (selectedChannels.includes("whatsapp") && (lead.whatsapp_number || lead.whatsapp_on_site)) {
    available.push("whatsapp");
  }
  if (selectedChannels.includes("email") && lead.email) {
    available.push("email");
  }
  if (selectedChannels.includes("instagram") && lead.instagram_url) {
    available.push("instagram");
  }
  
  console.log(`📢 Canais selecionados: ${selectedChannels.join(", ")} | Detectados: ${available.length > 0 ? available.join(", ") : "NENHUM"}`);
  return available;
}

interface SiteSignals {
  whatsapp_on_site: boolean;
  whatsapp_number: string | null;
  has_meta_pixel: boolean;
  has_gtag: boolean;
  has_gtm: boolean;
  instagram_url: string | null;
  email: string | null;
  cnpj: string | null;
}

interface CNPJData {
  razao_social: string | null;
  nome_responsavel: string | null;
  telefone: string | null;
  email: string | null;
  situacao_cadastral: string | null;
  porte_empresa: string | null;
  cnae_principal: string | null;
}

async function fetchCNPJData(cnpj: string): Promise<CNPJData | null> {
  try {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return null;
    
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    let nomeResponsavel: string | null = null;
    if (data.qsa && data.qsa.length > 0) {
      const administrador = data.qsa.find((socio: any) => 
        socio.qualificacao_socio?.toLowerCase().includes('administrador') ||
        socio.qualificacao_socio?.toLowerCase().includes('diretor')
      );
      nomeResponsavel = (administrador || data.qsa[0]).nome_socio;
      if (nomeResponsavel) {
        nomeResponsavel = nomeResponsavel.toLowerCase().split(' ')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      }
    }
    
    return {
      razao_social: data.razao_social || null,
      nome_responsavel: nomeResponsavel,
      telefone: data.ddd_telefone_1 ? data.ddd_telefone_1.replace(/\D/g, '') : null,
      email: data.email ? data.email.toLowerCase() : null,
      situacao_cadastral: data.descricao_situacao_cadastral || null,
      porte_empresa: data.porte || null,
      cnae_principal: data.cnae_fiscal_descricao || null,
    };
  } catch {
    return null;
  }
}

interface AnaliseResult {
  diagnostico_bullets: string[];
  probabilidade_conversao: number;
  plano_prospeccao_7dias: Array<{
    dia: number;
    canal: "whatsapp" | "email" | "instagram";
    acao_sugerida: string;
    mensagem: string;
    objecao_provavel: string;
    resposta_sugerida: string;
    cta: string;
  }>;
}

async function scrapeSiteForSignals(websiteUrl: string): Promise<SiteSignals> {
  const signals: SiteSignals = {
    whatsapp_on_site: false,
    whatsapp_number: null,
    has_meta_pixel: false,
    has_gtag: false,
    has_gtm: false,
    instagram_url: null,
    email: null,
    cnpj: null,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const siteResponse = await fetch(websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!siteResponse.ok) return signals;

    const html = await siteResponse.text();
    
    // WhatsApp detection
    const whatsappPatterns = [
      /wa\.me\/(\+?[0-9]+)/gi,
      /api\.whatsapp\.com\/send\?phone=(\+?[0-9]+)/gi,
    ];
    
    for (const pattern of whatsappPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          signals.whatsapp_on_site = true;
          signals.whatsapp_number = match[1].replace(/\D/g, '');
          break;
        }
      }
      if (signals.whatsapp_on_site) break;
    }

    if (!signals.whatsapp_on_site && /whatsapp/i.test(html)) {
      signals.whatsapp_on_site = true;
    }

    // Instagram detection
    const instagramMatch = html.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
    if (instagramMatch && !['p', 'reel', 'stories', 'explore'].includes(instagramMatch[1].toLowerCase())) {
      signals.instagram_url = `https://instagram.com/${instagramMatch[1]}`;
    }

    // Marketing tools
    if (/fbq\s*\(|facebook\.com\/tr\?id=/i.test(html)) signals.has_meta_pixel = true;
    if (/gtag\s*\(|googletagmanager\.com\/gtag/i.test(html)) signals.has_gtag = true;
    if (/GTM-[A-Z0-9]+/i.test(html)) signals.has_gtm = true;

    // Email detection
    const emailMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (emailMatch) signals.email = emailMatch[1].toLowerCase();

    // CNPJ detection
    const cnpjMatch = html.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    if (cnpjMatch) signals.cnpj = cnpjMatch[0].replace(/\D/g, '');

  } catch (error: any) {
    console.log(`⚠️ Erro ao escanear site: ${error.message}`);
  }

  return signals;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    const leadId = requestData.leadId || requestData.lead_id;
    
    console.log("🔍 Iniciando análise:", { leadId, hasNome: !!requestData.nome });

    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    let leadData: LeadData;
    
    if (leadId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      console.log("📥 Buscando lead via RPC...");
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const { data: decryptedLeads, error: rpcError } = await supabase
        .rpc("get_lead_decrypted_by_id", { p_lead_id: leadId });
        
      if (rpcError || !decryptedLeads?.length) {
        throw new Error("Lead não encontrado");
      }
      
      const lead = decryptedLeads[0];
      leadData = {
        nome: lead.nome,
        nicho: lead.nicho,
        cidade: lead.cidade,
        website: lead.website,
        foco: lead.foco,
        whatsapp_on_site: lead.whatsapp_on_site || false,
        whatsapp_number: lead.whatsapp_number,
        email: lead.email,
        has_meta_pixel: lead.has_meta_pixel || false,
        has_gtag: lead.has_gtag || false,
        has_gtm: lead.has_gtm || false,
        instagram_url: lead.instagram_url,
        instagram_context: lead.instagram_context,
        canaisProspeccao: requestData.canaisProspeccao,
        cnpj: lead.cnpj,
        razao_social: lead.razao_social,
        nome_responsavel: lead.nome_responsavel,
        situacao_cadastral: lead.situacao_cadastral,
        porte_empresa: lead.porte_empresa,
        cnae_principal: lead.cnae_principal,
      };
      
      // Re-scrape website for fresh signals
      if (lead.website) {
        const newSignals = await scrapeSiteForSignals(lead.website);
        leadData.whatsapp_on_site = newSignals.whatsapp_on_site || leadData.whatsapp_on_site;
        leadData.whatsapp_number = newSignals.whatsapp_number || leadData.whatsapp_number;
        leadData.email = newSignals.email || leadData.email;
        leadData.instagram_url = newSignals.instagram_url || leadData.instagram_url;
        leadData.has_meta_pixel = newSignals.has_meta_pixel || leadData.has_meta_pixel;
        leadData.has_gtag = newSignals.has_gtag || leadData.has_gtag;
        leadData.has_gtm = newSignals.has_gtm || leadData.has_gtm;
        
        if (newSignals.cnpj && !leadData.nome_responsavel) {
          const cnpjData = await fetchCNPJData(newSignals.cnpj);
          if (cnpjData) {
            Object.assign(leadData, {
              cnpj: newSignals.cnpj,
              razao_social: cnpjData.razao_social,
              nome_responsavel: cnpjData.nome_responsavel,
              situacao_cadastral: cnpjData.situacao_cadastral,
              porte_empresa: cnpjData.porte_empresa,
              cnae_principal: cnpjData.cnae_principal,
            });
            if (!leadData.email && cnpjData.email) leadData.email = cnpjData.email;
          }
        }
        
        // Update signals in DB
        await supabase.from("leads").update({
          whatsapp_on_site: leadData.whatsapp_on_site,
          has_meta_pixel: leadData.has_meta_pixel,
          has_gtag: leadData.has_gtag,
          has_gtm: leadData.has_gtm,
          ...(leadData.cnpj && { 
            cnpj: leadData.cnpj,
            razao_social: leadData.razao_social,
            nome_responsavel: leadData.nome_responsavel,
            situacao_cadastral: leadData.situacao_cadastral,
            porte_empresa: leadData.porte_empresa,
            cnae_principal: leadData.cnae_principal,
          }),
        }).eq("id", leadId);
      }
    } else {
      leadData = {
        nome: requestData.nome,
        nicho: requestData.nicho,
        cidade: requestData.cidade,
        website: requestData.website,
        foco: requestData.foco,
        whatsapp_on_site: requestData.whatsapp_on_site || false,
        whatsapp_number: requestData.whatsapp_number,
        email: requestData.email,
        has_meta_pixel: requestData.has_meta_pixel || false,
        has_gtag: requestData.has_gtag || false,
        has_gtm: requestData.has_gtm || false,
        instagram_url: requestData.instagram_url,
        instagram_context: requestData.instagram_context,
        canaisProspeccao: requestData.canaisProspeccao,
      };
    }

    console.log("🤖 Analisando:", leadData.nome, "| Canais detectados:", 
      [leadData.whatsapp_number && "WhatsApp", leadData.email && "Email", leadData.instagram_url && "Instagram"].filter(Boolean).join(", ") || "Nenhum");

    let analise: AnaliseResult;

    // Prioriza OpenAI → Gemini Fallback → Mock
    if (OPENAI_API_KEY) {
      console.log("🤖 Usando OpenAI GPT-4o (principal)...");
      try {
        analise = await analyzeWithOpenAI(leadData, OPENAI_API_KEY);
      } catch (openaiError: any) {
        console.log(`⚠️ OpenAI falhou: ${openaiError.message}`);
        if (GOOGLE_GEMINI_API_KEY) {
          console.log("🔄 Fallback para Gemini...");
          analise = await analyzeWithGeminiDirect(leadData, GOOGLE_GEMINI_API_KEY);
        } else {
          throw openaiError;
        }
      }
    } else if (GOOGLE_GEMINI_API_KEY) {
      console.log("🚀 Usando Gemini (secundário)...");
      analise = await analyzeWithGeminiDirect(leadData, GOOGLE_GEMINI_API_KEY);
    } else {
      console.log("⚠️ Nenhuma API key - usando mock");
      analise = generateMockAnalise(leadData);
    }

    // Save analysis to DB
    if (leadId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabase.from("leads").update({
        diagnostico_bullets: analise.diagnostico_bullets,
        probabilidade_conversao: analise.probabilidade_conversao,
        plano_prospeccao: analise.plano_prospeccao_7dias,
        ai_analise_gerada_em: new Date().toISOString(),
      }).eq("id", leadId);
      console.log("✅ Análise salva no banco");
    }

    return new Response(JSON.stringify(analise), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("❌ Erro:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// =============================================================================
// GOOGLE GEMINI DIRETO (API KEY DO USUÁRIO) - MODELO PRINCIPAL
// =============================================================================
async function analyzeWithGeminiDirect(lead: LeadData, apiKey: string): Promise<AnaliseResult> {
  const canaisSelecionados = lead.canaisProspeccao?.length ? lead.canaisProspeccao : ["email", "whatsapp"] as const;
  const canaisDisponiveis = getAvailableChannels(lead, [...canaisSelecionados]);
  
  const systemPrompt = buildEliteCopywriterSystemPrompt();
  const userPrompt = buildEliteUserPrompt(lead, canaisDisponiveis);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8000,
          },
          tools: [{
            functionDeclarations: [{
              name: "gerar_analise_lead",
              description: "Gera análise completa do lead com diagnóstico, probabilidade e plano de prospecção de 7 dias",
              parameters: {
                type: "object",
                properties: {
                  diagnostico_bullets: {
                    type: "array",
                    items: { type: "string" },
                    description: "6-8 bullets de diagnóstico consultivo profundo"
                  },
                  probabilidade_conversao: {
                    type: "number",
                    description: "Probabilidade de conversão de 0-100"
                  },
                  plano_prospeccao_7dias: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        dia: { type: "number" },
                        canal: { type: "string", enum: ["whatsapp", "email", "instagram"] },
                        acao_sugerida: { type: "string", description: "Ação tática específica: enviar áudio, texto, curtir posts, reagir story, etc." },
                        mensagem: { type: "string" },
                        objecao_provavel: { type: "string" },
                        resposta_sugerida: { type: "string" },
                        cta: { type: "string" }
                      },
                      required: ["dia", "canal", "acao_sugerida", "mensagem", "objecao_provavel", "resposta_sugerida", "cta"]
                    }
                  }
                },
                required: ["diagnostico_bullets", "probabilidade_conversao", "plano_prospeccao_7dias"]
              }
            }]
          }],
          toolConfig: {
            functionCallingConfig: {
              mode: "ANY",
              allowedFunctionNames: ["gerar_analise_lead"]
            }
          }
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Gemini API error:", response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse Gemini response format
    const candidate = data.candidates?.[0];
    if (!candidate?.content?.parts) {
      throw new Error("Resposta inválida do Gemini");
    }

    // Find the function call in parts
    const functionCallPart = candidate.content.parts.find((p: any) => p.functionCall);
    if (!functionCallPart?.functionCall?.args) {
      throw new Error("IA não retornou análise estruturada");
    }

    const analise: AnaliseResult = functionCallPart.functionCall.args;
    
    // Validate and ensure 7 days
    if (!analise.plano_prospeccao_7dias || analise.plano_prospeccao_7dias.length !== 7) {
      throw new Error("Plano deve ter exatamente 7 dias");
    }

    console.log("✅ Análise gerada com sucesso via Gemini 2.0 Flash");
    return analise;

  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("Timeout: IA demorou mais de 90 segundos");
    }
    throw error;
  }
}

// =============================================================================
// OPENAI (FALLBACK)
// =============================================================================
async function analyzeWithOpenAI(lead: LeadData, apiKey: string): Promise<AnaliseResult> {
  const canaisSelecionados = lead.canaisProspeccao?.length ? lead.canaisProspeccao : ["email", "whatsapp"] as const;
  const canaisDisponiveis = getAvailableChannels(lead, [...canaisSelecionados]);
  
  const systemPrompt = buildEliteCopywriterSystemPrompt();
  const userPrompt = buildEliteUserPrompt(lead, canaisDisponiveis);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "gerar_analise_lead",
            description: "Gera análise completa do lead",
            parameters: {
              type: "object",
              properties: {
                diagnostico_bullets: { type: "array", items: { type: "string" } },
                probabilidade_conversao: { type: "number" },
                plano_prospeccao_7dias: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      dia: { type: "number" },
                      canal: { type: "string", enum: ["whatsapp", "email", "instagram"] },
                      acao_sugerida: { type: "string", description: "Ação tática específica: enviar áudio, texto, curtir posts, reagir story, etc." },
                      mensagem: { type: "string" },
                      objecao_provavel: { type: "string" },
                      resposta_sugerida: { type: "string" },
                      cta: { type: "string" }
                    },
                    required: ["dia", "canal", "acao_sugerida", "mensagem", "objecao_provavel", "resposta_sugerida", "cta"]
                  }
                }
              },
              required: ["diagnostico_bullets", "probabilidade_conversao", "plano_prospeccao_7dias"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "gerar_analise_lead" } },
        temperature: 0.7,
        max_tokens: 4000
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status}`, errorText);
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) throw new Error("IA não retornou análise");

    return JSON.parse(toolCall.function.arguments);

  } catch (error: any) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// =============================================================================
// SYSTEM PROMPT - COPYWRITER DE ELITE
// =============================================================================
function buildEliteCopywriterSystemPrompt(): string {
  return `Você é um COPYWRITER E ESTRATEGISTA DE VENDAS B2B de ELITE com 15+ anos de experiência.
Sua missão: criar mensagens que fazem o prospect PARAR, LER e RESPONDER.

🏆 SUA ESPECIALIDADE:
• Prospecção B2B de alto ticket para agências de marketing digital
• Vendas consultivas para Tráfego, SEO, Social, Full Service, Automação, CRM, Sites/Landing, Design
• Domínio absoluto de prospecção multicanal (WhatsApp, Email, Instagram)
• Copywriting HUMANIZADO que gera conexão genuína

═══════════════════════════════════════════════════════════════
📜 REGRAS DE OURO (INEGOCIÁVEIS)
═══════════════════════════════════════════════════════════════

1. 🎯 SAUDAÇÕES ELEGANTES E PERSONALIZADAS
   
   ✅ OBRIGATÓRIO: Comece SEMPRE com saudação CURTA e CONTEXTUALIZADA:
   
   SE nome_responsavel disponível:
   • "Bom dia, [nome]! 👋" ou "[nome], tudo bem?"
   • "[Nome], vi algo interessante sobre [nicho]..."
   • "Oi [nome]! Analisei [empresa] e..."
   
   SE nome_responsavel NÃO disponível:
   • "Bom dia! Vi a [empresa] e..."
   • "Oi, pessoal da [empresa]! 👋"
   • "Equipe [empresa], tudo bem?"
   
   ❌ PROIBIDO saudações VAZIAS sem contexto:
   • "Olá!" (sozinho)
   • "Boa tarde, tudo bem?" (genérico demais)
   • "Prezados senhores" (corporativo demais)

2. 💬 TOM HUMANIZADO E EMPÁTICO
   
   • Escreva como uma PESSOA real, não como um robô de vendas
   • Use "você" e "sua empresa" - crie conexão pessoal
   • Demonstre que ESTUDOU o negócio deles
   • Seja CURIOSO: faça perguntas que provocam reflexão
   • Reconheça a realidade do negócio antes de oferecer solução
   
   EXEMPLO DE TOM CERTO:
   "Bom dia, Carlos! 👋 Analisei o mercado de [nicho] em [cidade] e 
   percebi que a maioria enfrenta o mesmo desafio: [dor]. 
   Vi que a [empresa] ainda não explora [oportunidade]. 
   Posso te mostrar como resolver isso em 5 min?"

3. 📝 COPY AFIADA (mas humana)
   • Frases CURTAS e DIRETAS - máximo 20 palavras por frase
   • Primeiro CONECTE, depois VENDA
   • Cada palavra deve ter propósito - corte o resto
   • Máximo 2 emojis estratégicos (👋 para saudação, ✅ para resultados)

4. 🚫 PROIBIÇÕES ABSOLUTAS
   ❌ NUNCA invente nomes - use apenas nome_responsavel se fornecido
   ❌ NUNCA use clichês: "explodir resultados", "escalar vendas", "bombar", "alavancar"
   ❌ NUNCA prometa milagres ou números absurdos
   ❌ NUNCA seja bajulador ou use elogios genéricos
   ❌ NUNCA comece com "Somos uma agência..." ou fale de si primeiro

═══════════════════════════════════════════════════════════════
5. 🎯 AÇÃO SUGERIDA (CAMPO OBRIGATÓRIO)
═══════════════════════════════════════════════════════════════

   Para CADA DIA, você DEVE incluir uma "acao_sugerida" que orienta
   o usuário sobre COMO executar o contato (formato, preparação, etc.)

   📱 WHATSAPP - Ações possíveis:
   ─────────────────────────────
   • Dia 1: "Enviar ÁUDIO de 30-45 segundos se apresentando"
   • Dias 2-4: Alternar entre "Enviar mensagem de TEXTO" e "Enviar ÁUDIO curto (20-30s)"
   • Dia 5-6: "Enviar mensagem de TEXTO com case/resultado"
   • Dia 7: "Enviar ÁUDIO de despedida respeitoso (30s)"
   
   📸 INSTAGRAM - Ações possíveis (PRÉ-ENGAJAMENTO OBRIGATÓRIO):
   ─────────────────────────────
   • "1) Curtir 2-3 posts recentes 2) Reagir a 1 story com emoji relevante 3) Enviar DM com a mensagem"
   • "1) Comentar no último post com insight relevante 2) Esperar 1h 3) Enviar DM"
   • "Reagir aos últimos 2 stories + enviar DM com áudio curto (20s)"
   
   ✉️ EMAIL - Ações possíveis:
   ─────────────────────────────
   • "Enviar email com ASSUNTO: [sugestão de assunto impactante]"
   • "Enviar email com PDF de case anexo"
   • "Enviar email com link de vídeo curto (Loom 2min)"

═══════════════════════════════════════════════════════════════
6. 📱 ESTRUTURA POR CANAL
═══════════════════════════════════════════════════════════════

   📱 WHATSAPP (máx 5 linhas):
   ─────────────────────────────
   • Linha 1: Saudação personalizada + emoji 👋
   • Linha 2: Insight específico sobre o negócio deles
   • Linha 3: Oportunidade/gap identificado
   • Linha 4: Proposta de valor rápida
   • Linha 5: CTA de baixo compromisso
   
   EXEMPLO WHATSAPP:
   "Bom dia, [nome]! 👋
   Analisei o setor de [nicho] em [cidade] e encontrei algo interessante.
   Empresas similares estão usando [estratégia] e gerando [resultado].
   Vi que a [empresa] ainda não explora isso.
   Vale 5 min para eu te mostrar?"

   ✉️ EMAIL (máx 150 palavras):
   ─────────────────────────────
   • Assunto: [Nome], + 6-8 palavras direto ao benefício
   • Saudação: "[Nome], tudo bem?" ou "Bom dia, [nome]!"
   • Abertura: Empatia + contexto do mercado
   • Corpo: Problema + insight + oportunidade
   • Fechamento: CTA claro e específico
   • Assinatura: Simples, profissional
   
   EXEMPLO EMAIL:
   Assunto: [Nome], achei algo sobre [nicho] em [cidade]
   
   [Nome], tudo bem?
   
   Estava analisando empresas de [nicho] na região e percebi que 
   a maioria enfrenta o mesmo desafio: [dor específica].
   
   O que chamou minha atenção na [empresa] é que [insight].
   Empresas similares que resolveram isso viram [resultado].
   
   Posso te enviar um diagnóstico rápido mostrando como?
   
   Abraço,
   [nome]

   📸 INSTAGRAM DM (máx 4 linhas):
   ─────────────────────────────
   • Linha 1: Saudação + referência ao conteúdo deles
   • Linha 2-3: Conexão com oportunidade
   • Linha 4: CTA leve
   • IMPORTANTE: Recomende pré-engajamento (curtir 2-3 posts antes)
   
   EXEMPLO INSTAGRAM:
   "Oi [nome]! 😊 Vi seu post sobre [tema] - curti a abordagem!
   Trabalho com [foco] e identifiquei algo que pode ajudar [nicho] como vocês.
   Posso mandar uma ideia rápida?"

═══════════════════════════════════════════════════════════════
6. 🎭 OBJEÇÕES E RESPOSTAS
═══════════════════════════════════════════════════════════════
   • Objeções: FRASES EXATAS que clientes dizem no dia a dia
   • Respostas com técnica: Validar → Reposicionar → Evidência → Próximo passo
   • Tom: empático, nunca defensivo
   
   EXEMPLO:
   Objeção: "Já trabalho com outra agência"
   Resposta: "Entendo, [nome]! Muitos clientes nossos também tinham. 
   O que mudou foi quando viram [benefício específico]. 
   Posso te mostrar em 10 min como funciona, sem compromisso?"

═══════════════════════════════════════════════════════════════
7. 📅 PROGRESSÃO DOS 7 DIAS (Tom Humanizado)
═══════════════════════════════════════════════════════════════
   
   • Dia 1: CONEXÃO + INSIGHT
     Saudação calorosa + dado específico que gera curiosidade
     "Bom dia, [nome]! Analisei [empresa] e achei algo interessante..."
   
   • Dia 2: EMPATIA + DOR
     "Sei que [nicho] enfrenta [desafio]..." - reconhece realidade
   
   • Dia 3: OPORTUNIDADE CLARA
     "Vi que empresas similares estão..." - benchmarking
   
   • Dia 4: VALOR TANGÍVEL
     Oferece framework/diagnóstico gratuito
   
   • Dia 5: PROVA SOCIAL
     Cita resultados ou tendências do setor
   
   • Dia 6: PARCERIA
     Tom de "vamos juntos", não de vendedor
   
   • Dia 7: DESPEDIDA ELEGANTE
     "[Nome], essa é minha última mensagem sobre isso.
     Fico à disposição quando fizer sentido para vocês. Abraço! 👋"

═══════════════════════════════════════════════════════════════
8. 📊 DIAGNÓSTICO CONSULTIVO (6-8 bullets)
═══════════════════════════════════════════════════════════════
   • Avaliação de maturidade digital real
   • Gaps críticos com impacto no negócio
   • Oportunidades específicas para o foco
   • Comparativo com mercado/concorrentes
   • Potencial de ROI estimado

═══════════════════════════════════════════════════════════════
🎯 LEMBRE-SE: VOCÊ É HUMANO, NÃO UM ROBÔ
═══════════════════════════════════════════════════════════════
Cada mensagem deve parecer escrita por uma PESSOA real que:
• Estudou o negócio do prospect
• Se importa genuinamente em ajudar
• Respeita o tempo e a inteligência do outro
• Oferece valor antes de pedir algo

Mensagens frias e robóticas = ignoradas.
Mensagens humanas e personalizadas = respondidas.`;
}

// =============================================================================
// BIBLIOTECA DE NICHOS COM EXEMPLOS ESPECÍFICOS
// =============================================================================
interface NichoContext {
  dor_principal: string;
  dor_secundaria: string;
  ganho_principal: string;
  metrica_chave: string;
  exemplo_whatsapp: string;
  exemplo_email: string;
  exemplo_instagram: string;
  objecoes: { objecao: string; resposta: string }[];
  jargoes: string[];
}

const NICHO_DATABASE: Record<string, NichoContext> = {
  // ═══════════════════════════════════════
  // SAÚDE & ESTÉTICA
  // ═══════════════════════════════════════
  "clinica_estetica": {
    dor_principal: "agenda com buracos e dependência de indicação boca-a-boca",
    dor_secundaria: "concorrência com clínicas que fazem promoção de procedimentos",
    ganho_principal: "agenda lotada de procedimentos de alto ticket (harmonização, lipo, skincare)",
    metrica_chave: "taxa de ocupação da agenda e ticket médio",
    exemplo_whatsapp: `Bom dia, [nome]! 👋 
Vi que a [empresa] trabalha com estética em [cidade].
Muitas clínicas aqui estão usando tráfego pago para lotar a agenda de harmonização e lipo.
Reparei que vocês ainda não exploram isso.
Posso te mostrar como funciona em 5 min?`,
    exemplo_email: `Assunto: [Nome], agenda de estética em [cidade]

[Nome], tudo bem?

Analisei clínicas de estética em [cidade] e percebi um padrão: as que investem em anúncios online lotam agenda de lipo, harmonização e skincare.
As que não investem dependem de indicação e têm buracos na agenda.

Vi que a [empresa] ainda não explora isso. Posso te enviar um diagnóstico gratuito?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi seu antes/depois de harmonização - resultado incrível!
Trabalho ajudando clínicas a lotar agenda com pacientes de alto ticket.
Posso te mandar uma ideia rápida?`,
    objecoes: [
      { objecao: "Minha agenda já é cheia por indicação", resposta: "Ótimo sinal de qualidade! Mas indicação é imprevisível - você não controla quantos pacientes entram por semana. Com tráfego, você decide: 'quero 10 agendamentos de harmonização essa semana'. Posso mostrar como funciona?" },
      { objecao: "Meu público é mais velho, não usa internet", resposta: "Interessante - e onde esse público pesquisa quando quer fazer um procedimento estético? Google. 78% das pessoas de 40+ buscam 'clínica de estética perto de mim' antes de agendar. Posso mostrar como aparecer primeiro?" }
    ],
    jargoes: ["ticket médio", "recorrência", "protocolos", "agenda lotada", "procedimento de alto valor"]
  },

  "dentista": {
    dor_principal: "agenda vazia às segundas e horários ociosos à tarde",
    dor_secundaria: "pacientes que somem depois do orçamento por causa do preço",
    ganho_principal: "pacientes novos toda semana para implantes e harmonização facial",
    metrica_chave: "taxa de conversão de orçamento e novos pacientes/mês",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei consultórios odontológicos em [cidade] e percebi algo.
Muitos dentistas têm agenda vazia às segundas e horários ociosos.
A [empresa] está captando pacientes novos toda semana ou depende de indicação?
Posso mostrar como resolver isso em 5 min?`,
    exemplo_email: `Assunto: [Nome], agenda de implantes em [cidade]

[Nome], tudo bem?

Consultórios que dependem só de indicação têm um problema: não controlam quantos pacientes novos entram por mês.

Vi que a [empresa] pode estar perdendo pacientes de implante e harmonização para concorrentes que aparecem primeiro no Google.

Posso te mostrar como mudar isso?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi que vocês fazem harmonização - área que está explodindo!
Ajudo dentistas a lotar agenda de implantes e harmô sem depender de indicação.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Paciente de implante vem por indicação", resposta: "Verdade, indicação é o melhor canal. Mas você controla quantas indicações recebe por mês? Com tráfego pago, você decide: 'quero 5 orçamentos de implante essa semana'. Posso mostrar como funciona sem compromisso?" },
      { objecao: "Já fiz Google Ads e não deu certo", resposta: "Entendo - infelizmente muitas campanhas são mal configuradas. O segredo está na página de destino e no follow-up. Posso analisar o que pode ter dado errado e mostrar a estratégia correta?" }
    ],
    jargoes: ["conversão de orçamento", "ticket médio de implante", "recorrência", "harmô", "pacientes qualificados"]
  },

  "psicologo": {
    dor_principal: "dificuldade em lotar agenda de sessões particulares",
    dor_secundaria: "pacientes que abandonam terapia após poucas sessões",
    ganho_principal: "agenda cheia de pacientes particulares com recorrência mensal",
    metrica_chave: "taxa de retenção e novos pacientes/mês",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Vi que você atende em [cidade] como psicóloga.
Muitos psicólogos dependem de plano de saúde e têm agenda vazia no particular.
Consegue lotar agenda só com pacientes particulares ou ainda depende de convênio?
Posso mostrar uma estratégia em 5 min?`,
    exemplo_email: `Assunto: [Nome], pacientes particulares em [cidade]

[Nome], tudo bem?

A maioria dos psicólogos depende de convênio e tem horários vagos no particular.
Mas existe uma estratégia para atrair pacientes que buscam atendimento de qualidade e pagam bem.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi seu conteúdo sobre ansiedade - muito relevante!
Ajudo psicólogos a lotar agenda de particulares sem depender de convênio.
Posso mandar uma ideia rápida?`,
    objecoes: [
      { objecao: "Meus pacientes vêm por indicação", resposta: "Indicação é ótimo sinal de competência! Mas você consegue prever quantos novos pacientes terá mês que vem? Com uma estratégia de conteúdo + anúncios, você atrai pessoas que já estão buscando ajuda. Posso mostrar?" },
      { objecao: "Não gosto de me expor nas redes", resposta: "Entendo perfeitamente. A boa notícia: dá pra atrair pacientes sem dançar no TikTok. Usamos conteúdo educativo + Google Ads para quem já está buscando. Posso mostrar essa abordagem mais discreta?" }
    ],
    jargoes: ["recorrência mensal", "pacientes particulares", "taxa de retenção", "agenda lotada"]
  },

  "veterinario": {
    dor_principal: "dependência de emergências e baixa recorrência de consultas preventivas",
    dor_secundaria: "tutores que só aparecem quando o pet está doente",
    ganho_principal: "agenda cheia de consultas preventivas e pacotes de acompanhamento",
    metrica_chave: "recorrência de clientes e ticket médio por pet",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei clínicas veterinárias em [cidade] e vi um padrão.
A maioria depende de emergências e perde faturamento por não ter recorrência.
A [empresa] já trabalha com pacotes de acompanhamento ou planos de saúde pet?
Posso mostrar como implementar?`,
    exemplo_email: `Assunto: [Nome], recorrência na clínica veterinária

[Nome], tudo bem?

Clínicas que dependem só de emergências têm faturamento imprevisível.
Mas dá pra criar recorrência com pacotes de acompanhamento e planos de saúde pet.

Posso te mostrar como outras clínicas em [cidade] estão fazendo isso?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi as fotos dos pets que vocês atendem - fofura demais!
Ajudo clínicas a criar recorrência com planos de saúde pet.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Tutor não paga plano de saúde pra pet", resposta: "Entendo a preocupação. Mas 62% dos tutores consideram o pet um membro da família. Com a comunicação certa, eles veem o plano como proteção, não gasto. Posso mostrar como apresentar?" },
      { objecao: "Já tenho clientes fiéis", resposta: "Ótimo! E você sabe quantos deles têm outros pets que não trazem pra você? Com uma estratégia de retenção, você atende toda a família e aumenta ticket. Posso mostrar como?" }
    ],
    jargoes: ["recorrência", "ticket médio", "plano de saúde pet", "consulta preventiva"]
  },

  // ═══════════════════════════════════════
  // SERVIÇOS PROFISSIONAIS
  // ═══════════════════════════════════════
  "advocacia": {
    dor_principal: "dependência de indicação e dificuldade em captar clientes corporativos",
    dor_secundaria: "precificação por hora que limita faturamento",
    ganho_principal: "fluxo previsível de consultas qualificadas em sua área de especialidade",
    metrica_chave: "leads qualificados por mês e taxa de conversão",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Vi que o escritório atua em [cidade] na área de [especialidade].
Muitos advogados dependem de indicação e têm meses imprevisíveis.
Vocês conseguem prever quantos clientes novos entram por mês?
Posso mostrar uma estratégia em 5 min?`,
    exemplo_email: `Assunto: [Nome], captação de clientes para o escritório

[Nome], tudo bem?

A maioria dos escritórios depende de indicação - o que significa faturamento imprevisível.
Mas existe uma estratégia para atrair clientes que já estão buscando advogado na sua área.

Posso te mostrar como funciona para escritórios de [cidade]?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi seu conteúdo sobre [área jurídica] - muito didático!
Ajudo advogados a captar clientes qualificados sem depender só de indicação.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Cliente de advocacia vem por indicação", resposta: "Indicação é o melhor canal, concordo. Mas você controla quantas indicações recebe por mês? Com uma estratégia de Google Ads, você atrai quem já está buscando advogado na sua área. Posso mostrar?" },
      { objecao: "OAB tem restrições de publicidade", resposta: "Verdade, e respeitamos 100%. A estratégia que usamos é educativa - conteúdo que posiciona você como autoridade, não anúncio de 'advogado barato'. Posso mostrar exemplos que funcionam dentro das regras?" }
    ],
    jargoes: ["leads qualificados", "taxa de conversão", "autoridade na área", "posicionamento"]
  },

  "contabilidade": {
    dor_principal: "clientes que pedem desconto e veem contabilidade como custo",
    dor_secundaria: "dificuldade em vender serviços consultivos além do básico",
    ganho_principal: "carteira de clientes que valorizam consultoria e pagam ticket maior",
    metrica_chave: "ticket médio e retenção de clientes",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei escritórios de contabilidade em [cidade].
A maioria reclama que cliente só quer preço baixo e não valoriza o serviço.
Vocês conseguem vender consultoria além do básico ou ficam presos no honorário mínimo?
Posso mostrar como mudar isso?`,
    exemplo_email: `Assunto: [Nome], ticket maior na contabilidade

[Nome], tudo bem?

O maior desafio dos contadores: cliente que compara preço e não vê valor.
Mas existe uma estratégia para atrair empresas que buscam consultoria, não só obrigações.

Posso te mostrar como outros escritórios em [cidade] estão aumentando ticket?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi seu conteúdo sobre impostos - super didático!
Ajudo contadores a atrair clientes que pagam bem por consultoria.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Empresário só quer pagar barato", resposta: "Entendo a frustração. Mas existe um perfil de empresário que quer conselho, não só guias. O segredo está na comunicação - mostrar que você resolve problemas, não só cumpre obrigações. Posso mostrar como atrair esse perfil?" },
      { objecao: "Mercado está saturado", resposta: "Concordo que tem muito contador. Mas poucos se posicionam como consultores. Quando você muda a comunicação de 'abro empresas' para 'ajudo empresas a pagar menos impostos legalmente', atrai outro público. Posso mostrar?" }
    ],
    jargoes: ["ticket médio", "serviços consultivos", "retenção", "carteira qualificada"]
  },

  "imobiliaria": {
    dor_principal: "leads frios que somem depois da visita ao imóvel",
    dor_secundaria: "corretores que dependem de plantão e não têm carteira própria",
    ganho_principal: "fluxo constante de leads qualificados prontos para comprar/alugar",
    metrica_chave: "taxa de conversão de visita e ciclo de venda",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Vi que a [empresa] atua no mercado imobiliário de [cidade].
Muitas imobiliárias reclamam: lead entra, faz visita, some.
Vocês conseguem converter quantos % dos leads que entram?
Posso mostrar como melhorar isso em 5 min?`,
    exemplo_email: `Assunto: [Nome], conversão de leads imobiliários

[Nome], tudo bem?

O maior desafio do mercado imobiliário: leads que fazem visita e desaparecem.
Mas existe uma estratégia de follow-up que aumenta conversão em até 40%.

Posso te mostrar como funciona para imobiliárias de [cidade]?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os imóveis que vocês trabalham em [cidade] - carteira bonita!
Ajudo imobiliárias a converter mais leads em vendas.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Lead imobiliário é muito frio", resposta: "Verdade, a maioria está só pesquisando. Mas você sabe quem está pronto pra comprar? Com um sistema de qualificação, você identifica os 20% que estão prontos e foca energia neles. Posso mostrar como?" },
      { objecao: "Corretor não segue processo", resposta: "Entendo - é o maior desafio da gestão. Por isso usamos automação: o sistema faz follow-up mesmo que o corretor esqueça. Posso mostrar como funciona?" }
    ],
    jargoes: ["taxa de conversão", "lead qualificado", "ciclo de venda", "follow-up", "fechamento"]
  },

  // ═══════════════════════════════════════
  // FITNESS & ACADEMIAS
  // ═══════════════════════════════════════
  "academia": {
    dor_principal: "alta taxa de cancelamento e sazonalidade (verão lotado, inverno vazio)",
    dor_secundaria: "dificuldade em vender planos anuais em vez de mensais",
    ganho_principal: "retenção alta e fluxo constante de novos alunos o ano todo",
    metrica_chave: "taxa de retenção e novos alunos/mês",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei academias em [cidade] e vi um padrão.
A maioria lota em janeiro e esvazia em abril.
A [empresa] consegue manter retenção alta o ano todo?
Posso mostrar como resolver isso?`,
    exemplo_email: `Assunto: [Nome], retenção na academia

[Nome], tudo bem?

O maior desafio das academias: aluno entra em janeiro, cancela em março.
Mas existe uma estratégia de engajamento que mantém retenção acima de 80%.

Posso te mostrar como funciona para academias de [cidade]?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os treinos que vocês postam - estrutura top!
Ajudo academias a manter retenção alta o ano todo.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Aluno cancela porque é preguiçoso", resposta: "Entendo a frustração. Mas academias com alta retenção não dependem da motivação do aluno - elas criam sistemas de engajamento. App de treino, desafios, comunidade. Posso mostrar como implementar?" },
      { objecao: "Concorrência de preço é muito forte", resposta: "Verdade, low cost cresceu muito. Mas você não compete com eles em preço - compete em experiência. O segredo está em atrair quem busca resultado, não quem busca barato. Posso mostrar como?" }
    ],
    jargoes: ["taxa de retenção", "churn", "plano anual", "engajamento", "LTV"]
  },

  "personal": {
    dor_principal: "agenda que depende de poucos clientes que podem cancelar a qualquer momento",
    dor_secundaria: "dificuldade em cobrar mais caro sem perder alunos",
    ganho_principal: "carteira diversificada de clientes que valorizam seu trabalho",
    metrica_chave: "ticket médio e recorrência",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Vi que você atua como personal trainer em [cidade].
A maioria dos personais depende de 5-10 clientes - se 2 cancelam, o mês quebra.
Você consegue atrair clientes novos toda semana ou depende de indicação?
Posso mostrar uma estratégia em 5 min?`,
    exemplo_email: `Assunto: [Nome], carteira de clientes de personal

[Nome], tudo bem?

O maior risco do personal: depender de poucos clientes.
Mas existe uma estratégia para atrair clientes de alto ticket que valorizam seu trabalho.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os resultados dos seus alunos - transformações incríveis!
Ajudo personais a atrair clientes que pagam bem.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Meus clientes vêm por indicação", resposta: "Indicação é o melhor canal! Mas você controla quantas indicações recebe por mês? Com uma estratégia de conteúdo, você atrai quem já está buscando personal e não conhece ninguém. Posso mostrar?" },
      { objecao: "Personal é muito caro pra maioria", resposta: "Verdade pra maioria. Mas existe um público que quer resultado e paga bem por isso. O segredo está em atrair esse público certo. Posso mostrar como?" }
    ],
    jargoes: ["ticket médio", "recorrência", "carteira diversificada", "resultado"]
  },

  // ═══════════════════════════════════════
  // ALIMENTAÇÃO
  // ═══════════════════════════════════════
  "restaurante": {
    dor_principal: "movimento concentrado no fim de semana e mesas vazias durante a semana",
    dor_secundaria: "dependência de apps de delivery que cobram 30% de comissão",
    ganho_principal: "casa cheia todos os dias e delivery próprio com margem saudável",
    metrica_chave: "ticket médio e fluxo por dia da semana",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei restaurantes em [cidade] e vi um padrão.
A maioria lota sexta e sábado, mas fica vazio terça e quarta.
A [empresa] consegue manter movimento durante a semana?
Posso mostrar como resolver isso?`,
    exemplo_email: `Assunto: [Nome], movimento durante a semana

[Nome], tudo bem?

O maior desafio dos restaurantes: fim de semana lotado, semana vazia.
Mas existe uma estratégia para atrair clientes nos dias mais fracos.

Posso te mostrar como funciona para restaurantes de [cidade]?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os pratos que vocês postam - deu água na boca!
Ajudo restaurantes a lotar durante a semana, não só fim de semana.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Meu movimento já é bom", resposta: "Ótimo sinal! E durante a semana, como está? A maioria dos restaurantes perde dinheiro terça e quarta. Se você já está bem nesses dias, parabéns - é exceção. Se não, posso mostrar como melhorar?" },
      { objecao: "iFood já traz pedidos", resposta: "Traz, mas quanto você paga de comissão? 30%? Com delivery próprio e uma base de clientes, você paga 0% e ainda fideliza. Posso mostrar como montar?" }
    ],
    jargoes: ["ticket médio", "giro de mesas", "delivery próprio", "fidelização"]
  },

  "pizzaria": {
    dor_principal: "guerra de preço com concorrentes e dependência de promoção",
    dor_secundaria: "comissões altas de apps de delivery",
    ganho_principal: "clientes fiéis que pedem direto sem precisar de desconto",
    metrica_chave: "pedidos diretos vs apps e ticket médio",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei pizzarias em [cidade] e percebi algo.
A maioria compete por preço e perde margem no iFood.
A [empresa] consegue ter pedidos diretos ou depende muito dos apps?
Posso mostrar como mudar isso?`,
    exemplo_email: `Assunto: [Nome], pedidos diretos na pizzaria

[Nome], tudo bem?

Pizzarias que dependem de iFood pagam 30% de comissão.
Mas existe uma estratégia para ter base própria de clientes que pedem direto.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi as pizzas que vocês postam - massa linda!
Ajudo pizzarias a ter mais pedidos diretos e depender menos de apps.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Preciso do iFood pra ter movimento", resposta: "Entendo - o app traz visibilidade. Mas cada pedido do iFood, você paga 30%. Se você converter esses clientes pra pedir direto, a margem muda completamente. Posso mostrar como fazer essa conversão?" },
      { objecao: "Cliente só quer promoção", resposta: "Alguns sim. Mas existe um público que quer qualidade e conveniência, não só preço. O segredo está em atrair esse público certo com a comunicação certa. Posso mostrar?" }
    ],
    jargoes: ["pedido direto", "margem", "fidelização", "ticket médio", "recorrência"]
  },

  "confeitaria": {
    dor_principal: "demanda concentrada em datas comemorativas e meses parados",
    dor_secundaria: "dificuldade em mostrar valor para cobrar mais caro",
    ganho_principal: "encomendas constantes o ano todo e clientes que pagam pelo diferencial",
    metrica_chave: "encomendas/mês e ticket médio",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Vi que a [empresa] trabalha com confeitaria em [cidade].
A maioria das confeiteiras lota em Páscoa e Natal, mas fica parada no resto do ano.
Você consegue ter encomendas constantes?
Posso mostrar uma estratégia?`,
    exemplo_email: `Assunto: [Nome], encomendas o ano todo

[Nome], tudo bem?

O maior desafio das confeitarias: datas comemorativas lotam, resto do ano esvazia.
Mas existe uma estratégia para ter fluxo constante de encomendas.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os bolos que você posta - arte pura!
Ajudo confeitarias a ter encomendas o ano todo, não só em datas.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Meu produto é mais caro que mercado", resposta: "E deve ser mesmo! Você faz arte, não bolo de supermercado. O desafio é atrair quem valoriza isso. Com a comunicação certa, você atrai clientes que pagam pelo diferencial. Posso mostrar como?" },
      { objecao: "Cliente pede muito desconto", resposta: "Alguns sim. Mas você quer trabalhar pra quem não valoriza seu trabalho? Com posicionamento certo, você atrai quem paga bem. Posso mostrar como?" }
    ],
    jargoes: ["encomendas", "ticket médio", "posicionamento premium", "diferencial"]
  },

  // ═══════════════════════════════════════
  // COMÉRCIO
  // ═══════════════════════════════════════
  "loja_roupas": {
    dor_principal: "estoque parado e dificuldade em competir com e-commerce",
    dor_secundaria: "clientes que olham na loja e compram online mais barato",
    ganho_principal: "clientes fiéis que voltam todo mês e indicam amigos",
    metrica_chave: "giro de estoque e recorrência de clientes",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei lojas de roupa em [cidade] e vi um padrão.
A maioria reclama de estoque parado e concorrência online.
A [empresa] consegue girar estoque rápido ou tem peças há meses?
Posso mostrar uma estratégia?`,
    exemplo_email: `Assunto: [Nome], giro de estoque da loja

[Nome], tudo bem?

Lojas físicas que competem só em preço perdem pra online.
Mas lojas que criam experiência e relacionamento vendem mais caro e giram estoque.

Posso te mostrar como funciona para lojas de [cidade]?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os looks que vocês postam - estilo incrível!
Ajudo lojas a girar estoque e fidelizar clientes.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Cliente compara preço com online", resposta: "Alguns sim. Mas você oferece algo que a internet não tem: experimentar, tocar, ter consultoria. O segredo está em destacar esses diferenciais. Posso mostrar como comunicar isso?" },
      { objecao: "Loja física está morrendo", resposta: "Loja genérica sim. Mas loja com experiência e comunidade está crescendo. As pessoas querem conexão, não só produto. Posso mostrar como criar isso?" }
    ],
    jargoes: ["giro de estoque", "recorrência", "ticket médio", "experiência de compra"]
  },

  "petshop": {
    dor_principal: "concorrência de preço com grandes redes e e-commerce",
    dor_secundaria: "dificuldade em fidelizar além do banho e tosa",
    ganho_principal: "clientes que compram de tudo e voltam toda semana",
    metrica_chave: "ticket médio e frequência de visita",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei petshops em [cidade] e percebi algo.
A maioria vende banho e ração, mas perde pro preço da internet.
A [empresa] consegue vender acessórios, brinquedos, produtos premium?
Posso mostrar como aumentar ticket?`,
    exemplo_email: `Assunto: [Nome], ticket médio do petshop

[Nome], tudo bem?

Petshops que vendem só banho e ração competem em preço.
Mas petshops que vendem experiência e consultoria cobram mais e fidelizam.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os pets que passam por vocês - fofura demais!
Ajudo petshops a aumentar ticket e fidelizar tutores.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Cliente compara preço com Cobasi", resposta: "Alguns sim. Mas você oferece algo que rede grande não tem: atendimento personalizado, conhecer o pet pelo nome, recomendação certeira. O segredo está em destacar isso. Posso mostrar como?" },
      { objecao: "Banho e tosa já dá trabalho demais", resposta: "Entendo - serviço é puxado. Mas e se você vendesse mais produtos sem aumentar mão de obra? Com uma estratégia de venda consultiva, você aumenta ticket sem mais trabalho. Posso mostrar?" }
    ],
    jargoes: ["ticket médio", "recorrência", "venda consultiva", "fidelização"]
  },

  // ═══════════════════════════════════════
  // BELEZA
  // ═══════════════════════════════════════
  "salao_beleza": {
    dor_principal: "agenda com buracos e dependência de promoção para atrair clientes",
    dor_secundaria: "profissionais que levam clientes quando saem",
    ganho_principal: "agenda lotada com clientes que voltam todo mês",
    metrica_chave: "taxa de retorno e ticket médio",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei salões de beleza em [cidade] e vi um padrão.
A maioria depende de promoção pra lotar - o que corrói margem.
A [empresa] consegue lotar agenda sem desconto?
Posso mostrar como?`,
    exemplo_email: `Assunto: [Nome], agenda lotada sem promoção

[Nome], tudo bem?

Salões que dependem de promoção atraem clientes de preço, não de valor.
Mas existe uma estratégia para lotar agenda com clientes que pagam bem.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os trabalhos que vocês postam - técnica impecável!
Ajudo salões a lotar agenda sem depender de promoção.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Concorrência de preço é muito forte", resposta: "Verdade, tem muito salão barato. Mas você não quer competir com eles - quer atrair quem paga por qualidade. O segredo está no posicionamento. Posso mostrar como atrair esse público?" },
      { objecao: "Profissional boa sai e leva clientes", resposta: "Infelizmente acontece. Por isso é importante a marca do salão ser mais forte que a marca do profissional. Posso mostrar como construir isso?" }
    ],
    jargoes: ["taxa de retorno", "ticket médio", "agenda lotada", "posicionamento"]
  },

  "barbearia": {
    dor_principal: "cliente que vai em qualquer barbearia e não tem fidelidade",
    dor_secundaria: "dificuldade em vender serviços além do corte básico",
    ganho_principal: "clientes fiéis que cortam todo mês e indicam amigos",
    metrica_chave: "frequência de retorno e serviços adicionais/cliente",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei barbearias em [cidade] e percebi algo.
A maioria tem clientes que vão em qualquer lugar - sem fidelidade.
A [empresa] consegue ter clientes que voltam todo mês certinho?
Posso mostrar como criar isso?`,
    exemplo_email: `Assunto: [Nome], clientes fiéis na barbearia

[Nome], tudo bem?

Barbearias que vendem só corte competem em preço.
Mas barbearias que criam experiência e comunidade têm clientes fiéis.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os cortes que vocês postam - nível premium!
Ajudo barbearias a criar clientes fiéis que voltam todo mês.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Homem vai onde é mais perto", resposta: "Alguns sim. Mas existe um público que quer experiência, não só corte. Cerveja, papo, ambiente. O segredo está em atrair esse público. Posso mostrar como?" },
      { objecao: "Já tenho bastante movimento", resposta: "Ótimo! E você consegue vender barba, produtos, assinatura? Muitas barbearias aumentam 40% o faturamento sem aumentar cadeiras. Posso mostrar como?" }
    ],
    jargoes: ["recorrência", "ticket médio", "experiência", "comunidade", "assinatura"]
  },

  // ═══════════════════════════════════════
  // EDUCAÇÃO
  // ═══════════════════════════════════════
  "escola_idiomas": {
    dor_principal: "alta taxa de desistência após 3-6 meses",
    dor_secundaria: "concorrência de apps gratuitos e cursos online baratos",
    ganho_principal: "alunos que completam o curso e indicam amigos",
    metrica_chave: "taxa de retenção e NPS",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei escolas de idiomas em [cidade] e vi um padrão.
A maioria perde alunos depois de 3-6 meses - antes de fluência.
A [empresa] consegue manter alunos até o final?
Posso mostrar como melhorar retenção?`,
    exemplo_email: `Assunto: [Nome], retenção de alunos de idiomas

[Nome], tudo bem?

O maior desafio das escolas: aluno entra motivado, desiste em 6 meses.
Mas existe uma estratégia de engajamento que mantém alunos até a fluência.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi que vocês trabalham com [idioma] em [cidade]!
Ajudo escolas a manter alunos até a fluência, não só matricular.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Aluno desiste porque não tem tempo", resposta: "Verdade, tempo é desafio. Mas escolas com alta retenção criam sistemas que cabem na rotina do aluno. App, microaulas, acompanhamento. Posso mostrar como implementar?" },
      { objecao: "Duolingo é de graça", resposta: "É sim, e 95% desiste em 3 meses. Seu diferencial é o acompanhamento humano, a correção personalizada, a comunidade. O segredo está em destacar isso. Posso mostrar como?" }
    ],
    jargoes: ["taxa de retenção", "LTV", "NPS", "engajamento", "fluência"]
  },

  "curso_profissionalizante": {
    dor_principal: "alunos que não completam o curso ou não conseguem emprego depois",
    dor_secundaria: "concorrência de cursos online gratuitos",
    ganho_principal: "alunos empregados que indicam a escola como diferencial na carreira",
    metrica_chave: "taxa de conclusão e empregabilidade",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei cursos profissionalizantes em [cidade] e percebi algo.
Muitos alunos se matriculam, mas não completam ou não conseguem emprego.
A [empresa] acompanha empregabilidade dos formandos?
Posso mostrar uma estratégia?`,
    exemplo_email: `Assunto: [Nome], empregabilidade dos alunos

[Nome], tudo bem?

O maior diferencial de um curso: aluno empregado que indica.
Mas a maioria das escolas não acompanha isso.

Posso te mostrar como criar um sistema de empregabilidade que vira marketing?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi que vocês formam profissionais em [área]!
Ajudo cursos a ter alunos empregados que viram cases de sucesso.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Mercado de trabalho está difícil", resposta: "Verdade, mas isso é ainda mais motivo pra você se diferenciar. Cursos que entregam empregabilidade se destacam. Posso mostrar como criar parcerias com empresas?" },
      { objecao: "YouTube ensina de graça", resposta: "Ensina, mas não dá certificado, não acompanha, não coloca no mercado. Seu diferencial é o caminho completo. Posso mostrar como comunicar isso?" }
    ],
    jargoes: ["empregabilidade", "taxa de conclusão", "cases de sucesso", "parceria empresas"]
  },

  // ═══════════════════════════════════════
  // AUTOMOTIVO
  // ═══════════════════════════════════════
  "oficina_mecanica": {
    dor_principal: "cliente que só aparece quando quebra e não faz manutenção preventiva",
    dor_secundaria: "desconfiança do cliente sobre serviços 'desnecessários'",
    ganho_principal: "clientes recorrentes que fazem manutenção regular e indicam",
    metrica_chave: "recorrência e ticket médio",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei oficinas mecânicas em [cidade] e vi um padrão.
A maioria depende de emergência - cliente só aparece quando quebra.
A [empresa] consegue ter clientes de manutenção preventiva?
Posso mostrar como criar recorrência?`,
    exemplo_email: `Assunto: [Nome], recorrência na oficina

[Nome], tudo bem?

Oficinas que dependem de emergência têm faturamento imprevisível.
Mas existe uma estratégia para criar recorrência com manutenção preventiva.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os serviços que vocês fazem - trabalho caprichado!
Ajudo oficinas a ter clientes recorrentes, não só emergências.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Cliente não quer gastar com prevenção", resposta: "Alguns não. Mas quando você mostra quanto custa o conserto vs quanto custa a prevenção, muitos mudam de ideia. O segredo está na comunicação. Posso mostrar como?" },
      { objecao: "Mercado muito informal", resposta: "Verdade, tem muita oficina de fundo de quintal. Mas você pode se posicionar como premium - cliente que quer qualidade paga mais. Posso mostrar como atrair esse público?" }
    ],
    jargoes: ["recorrência", "manutenção preventiva", "ticket médio", "confiança"]
  },

  "lava_jato": {
    dor_principal: "demanda concentrada no fim de semana e capacidade ociosa na semana",
    dor_secundaria: "concorrência de preço e guerra de promoção",
    ganho_principal: "clientes com plano mensal que vêm regularmente",
    metrica_chave: "assinaturas ativas e frequência",
    exemplo_whatsapp: `Bom dia, [nome]! 👋
Analisei lava-jatos em [cidade] e percebi algo.
A maioria lota sábado e fica vazio segunda a quinta.
A [empresa] consegue ter movimento durante a semana?
Posso mostrar uma estratégia?`,
    exemplo_email: `Assunto: [Nome], movimento durante a semana

[Nome], tudo bem?

Lava-jatos que dependem de fim de semana têm capacidade ociosa.
Mas existe uma estratégia de assinatura mensal que garante fluxo constante.

Posso te mostrar como funciona?

Abraço`,
    exemplo_instagram: `Oi [nome]! 😊 Vi os carros que vocês cuidam - acabamento impecável!
Ajudo lava-jatos a ter movimento o dia todo com assinaturas.
Posso mandar uma ideia?`,
    objecoes: [
      { objecao: "Cliente só quer promoção", resposta: "Alguns sim. Mas existe um público que quer praticidade - lavar toda semana sem pensar. Com assinatura, você atrai esse público e garante receita previsível. Posso mostrar como?" },
      { objecao: "Lava-jato é commodity", resposta: "Básico sim. Mas você pode se diferenciar: higienização interna, proteção de pintura, serviços premium. Posso mostrar como posicionar?" }
    ],
    jargoes: ["assinatura mensal", "recorrência", "ticket médio", "capacidade ociosa"]
  }
};

function getNichoExamples(nicho: string): NichoContext | null {
  const nichoLower = nicho.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Direct match first
  const patterns: Record<string, string[]> = {
    "clinica_estetica": ["clinica de estetica", "estetica", "clinica estetica", "estetica facial", "harmonizacao", "estetica corporal"],
    "dentista": ["dentista", "odontologia", "odonto", "clinica odontologica", "consultorio odontologico", "clinica dentaria"],
    "psicologo": ["psicologo", "psicologia", "psicologa", "terapeuta", "terapia", "consultorio psicologico"],
    "veterinario": ["veterinario", "clinica veterinaria", "pet care", "hospital veterinario", "vet"],
    "advocacia": ["advocacia", "advogado", "escritorio de advocacia", "advogados", "juridico"],
    "contabilidade": ["contabilidade", "contador", "escritorio contabil", "contadores"],
    "imobiliaria": ["imobiliaria", "corretor", "imobiliarias", "corretor de imoveis"],
    "academia": ["academia", "fitness", "musculacao", "treino"],
    "personal": ["personal", "personal trainer", "treinador pessoal"],
    "restaurante": ["restaurante", "gastronomia", "self service", "buffet"],
    "pizzaria": ["pizzaria", "pizza", "pizzas"],
    "confeitaria": ["confeitaria", "confeiteira", "bolos", "doces", "cake designer"],
    "loja_roupas": ["loja de roupas", "moda", "boutique", "vestuario", "roupa feminina", "roupa masculina"],
    "petshop": ["petshop", "pet shop", "loja de pet", "agropet"],
    "salao_beleza": ["salao de beleza", "salao", "cabeleireiro", "hair", "cabelos"],
    "barbearia": ["barbearia", "barbeiro", "barber", "barba"],
    "escola_idiomas": ["escola de idiomas", "ingles", "idiomas", "espanhol", "curso de ingles"],
    "curso_profissionalizante": ["curso profissionalizante", "curso tecnico", "escola tecnica", "formacao profissional"],
    "oficina_mecanica": ["oficina mecanica", "mecanica", "oficina", "mecanico", "auto center"],
    "lava_jato": ["lava jato", "lavajato", "lavagem", "lava car", "lava rapido"]
  };
  
  // Find best match
  for (const [key, keywords] of Object.entries(patterns)) {
    for (const keyword of keywords) {
      if (nichoLower.includes(keyword)) {
        return NICHO_DATABASE[key] || null;
      }
    }
  }
  
  // Partial match fallback
  for (const [key, context] of Object.entries(NICHO_DATABASE)) {
    const keyNormalized = key.replace(/_/g, " ");
    if (nichoLower.includes(keyNormalized) || keyNormalized.includes(nichoLower)) {
      return context;
    }
  }
  
  return null;
}

// =============================================================================
// USER PROMPT - DADOS DO LEAD
// =============================================================================
function buildEliteUserPrompt(lead: LeadData, canaisDisponiveis: ("email" | "whatsapp" | "instagram")[]): string {
  const canalTexto = canaisDisponiveis.length > 0 
    ? canaisDisponiveis.map(c => c === "email" ? "Email" : c === "whatsapp" ? "WhatsApp" : "Instagram DM").join(", ")
    : "NENHUM DETECTADO";

  const sinaisMarketing = [];
  if (lead.has_meta_pixel) sinaisMarketing.push("Meta Pixel ativo");
  if (lead.has_gtag) sinaisMarketing.push("Google Analytics ativo");
  if (lead.has_gtm) sinaisMarketing.push("GTM configurado");
  if (lead.whatsapp_on_site || lead.whatsapp_number) sinaisMarketing.push("WhatsApp no site");
  if (lead.instagram_url) sinaisMarketing.push(`Instagram: ${lead.instagram_url}`);
  if (lead.email) sinaisMarketing.push(`Email: ${lead.email}`);

  // Build channel cadence strategy
  let cadencia = "";
  if (canaisDisponiveis.length === 0) {
    cadencia = "⚠️ Nenhum canal detectado - foque em estratégias para ENCONTRAR contato";
  } else if (canaisDisponiveis.length === 1) {
    cadencia = `Use ${canalTexto} para todos os 7 dias com variações de abordagem`;
  } else if (canaisDisponiveis.length === 2) {
    cadencia = `Alterne: Dias 1,3,5,7 = ${canaisDisponiveis[0]}, Dias 2,4,6 = ${canaisDisponiveis[1]}`;
  } else {
    cadencia = `Cadência 3 canais: D1 WhatsApp, D2 Email, D3 Instagram, D4 WhatsApp, D5 Email, D6 Instagram, D7 WhatsApp`;
  }

  const focoArgs = getFocoArguments(lead.foco);
  
  // Get niche-specific context
  const nichoContext = getNichoExamples(lead.nicho);

  let nichoSection = "";
  if (nichoContext) {
    nichoSection = `
═══════════════════════════════════════
🎯 REFERÊNCIA ESPECÍFICA PARA: ${lead.nicho.toUpperCase()}
═══════════════════════════════════════

📌 DORES DO NICHO (use nas mensagens):
• Principal: ${nichoContext.dor_principal}
• Secundária: ${nichoContext.dor_secundaria}

🎁 GANHO PRINCIPAL:
• ${nichoContext.ganho_principal}

📊 MÉTRICA-CHAVE:
• ${nichoContext.metrica_chave}

💬 EXEMPLO DE WHATSAPP (use como referência):
${nichoContext.exemplo_whatsapp}

✉️ EXEMPLO DE EMAIL (use como referência):
${nichoContext.exemplo_email}

📸 EXEMPLO DE INSTAGRAM DM (use como referência):
${nichoContext.exemplo_instagram}

🚫 OBJEÇÕES COMUNS DESTE NICHO:
${nichoContext.objecoes.map(o => `• "${o.objecao}" → ${o.resposta}`).join("\n")}

📝 JARGÕES DO NICHO (use para parecer especialista):
${nichoContext.jargoes.join(", ")}
`;
  } else {
    nichoSection = `
═══════════════════════════════════════
⚠️ NICHO SEM REFERÊNCIA ESPECÍFICA: ${lead.nicho}
═══════════════════════════════════════
Use sua expertise para criar mensagens personalizadas.
Pesquise mentalmente: quais são as dores típicas deste tipo de negócio?
`;
  }

  return `═══════════════════════════════════════
📊 DADOS DO LEAD PARA ANÁLISE
═══════════════════════════════════════

🏢 EMPRESA
• Nome: ${lead.nome}
• Nicho: ${lead.nicho}
• Cidade: ${lead.cidade}
• Website: ${lead.website || "Não informado"}
${lead.cnae_principal ? `• CNAE: ${lead.cnae_principal}` : ""}
${lead.porte_empresa ? `• Porte: ${lead.porte_empresa}` : ""}
${lead.situacao_cadastral ? `• Situação: ${lead.situacao_cadastral}` : ""}

👤 CONTATO
${lead.nome_responsavel 
  ? `✅ NOME DO RESPONSÁVEL: "${lead.nome_responsavel}" - USE NAS MENSAGENS!`
  : `❌ Nome do responsável não detectado - NÃO INVENTE NOMES`}

🎯 FOCO DO SERVIÇO: ${lead.foco}
${focoArgs}
${nichoSection}
📊 SINAIS DE MARKETING DETECTADOS:
${sinaisMarketing.length > 0 ? sinaisMarketing.map(s => `• ${s}`).join("\n") : "• Nenhum sinal detectado - empresa com baixa maturidade digital"}

═══════════════════════════════════════
⚠️ CANAIS PERMITIDOS: ${canalTexto}
═══════════════════════════════════════
🚫 USE APENAS estes canais no plano!
📅 Estratégia: ${cadencia}

═══════════════════════════════════════
📋 GERE AGORA:
═══════════════════════════════════════

1. DIAGNÓSTICO (6-8 bullets consultivos)
   • Use as dores específicas do nicho acima
   • Analise maturidade digital real
   • Identifique gaps críticos
   • Aponte oportunidades para ${lead.foco}
   • Estime potencial de ROI

2. PROBABILIDADE DE CONVERSÃO (0-100)
   ${canaisDisponiveis.length === 0 ? "• Máximo 30% se nenhum canal detectado" : ""}

3. PLANO DE PROSPECÇÃO 7 DIAS
   • BASEIE-SE NOS EXEMPLOS DO NICHO ACIMA!
   • Cada dia: mensagem pronta para copiar e colar
   • Objeções: use as objeções específicas do nicho
   • Respostas: técnica consultiva profissional
   • CTAs: progressivos e específicos
   
   Progressão obrigatória:
   - Dia 1: Apresentação + contexto (use dor principal)
   - Dia 2: Dor específica do nicho
   - Dia 3: Oportunidade clara (use ganho principal)
   - Dia 4: Framework/método
   - Dia 5: Prova social/cenário
   - Dia 6: Visão estratégica + próximo passo
   - Dia 7: Último toque respeitoso

═══════════════════════════════════════
🎯 LEMBRE-SE: USE OS DADOS DO NICHO!
═══════════════════════════════════════
Os exemplos acima são REFERÊNCIA - adapte para os dados REAIS:
• Empresa: ${lead.nome}
• Cidade: ${lead.cidade}
• Nicho: ${lead.nicho}
• Foco: ${lead.foco}
${lead.nome_responsavel ? `• Responsável: ${lead.nome_responsavel}` : ""}`;
}

function getFocoArguments(foco: string): string {
  const args: Record<string, string> = {
    "Tráfego": `📣 ARGUMENTAÇÃO TRÁFEGO:
• Foque em fluxo PREVISÍVEL de leads qualificados
• Métricas: CPL, ROAS, CAC
• Dor: dependência de indicação/boca-a-boca
• Ganho: leads novos entrando todo dia`,
    
    "SEO": `🔍 ARGUMENTAÇÃO SEO:
• Foque em tráfego orgânico = leads gratuitos
• Efeito composto: resultados acumulam
• Dor: concorrentes aparecem primeiro no Google
• Ganho: clientes te encontrando sem pagar por clique`,
    
    "Social": `📱 ARGUMENTAÇÃO SOCIAL:
• Foque em consistência e posicionamento
• Construção de MARCA, não só posts
• Dor: posts sem engajamento, seguidores que não compram
• Ganho: comunidade engajada que vira cliente`,
    
    "Full Service": `🎯 ARGUMENTAÇÃO FULL SERVICE:
• Visão 360° - estratégia integrada
• Economia de tempo com parceiro único
• Dor: vários fornecedores, resultados desconectados
• Ganho: um parceiro que cuida de tudo`,
    
    "Automação": `⚙️ ARGUMENTAÇÃO AUTOMAÇÃO:
• Funis que rodam sozinhos
• Follow-ups automáticos = leads que não esfriam
• Dor: leads entram e ninguém acompanha
• Ganho: sistema que nutre leads 24/7`,
    
    "CRM": `📊 ARGUMENTAÇÃO CRM:
• Organização de pipeline de vendas
• Follow-up sistemático, não na memória
• Dor: vendas desorganizadas, leads perdidos no WhatsApp
• Ganho: previsibilidade de faturamento`,
    
    "Sites/Landing": `🖥️ ARGUMENTAÇÃO SITES/LANDING:
• Páginas que CONVERTEM, não só bonitas
• Clareza de oferta em 5 segundos
• Dor: site que não gera leads, só custa hospedagem
• Ganho: página que transforma visitante em contato`,
    
    "Design": `🎨 ARGUMENTAÇÃO DESIGN:
• Identidade visual como diferencial competitivo
• Design que VENDE, não só bonito
• Dor: visual amador que afasta clientes premium
• Ganho: marca que atrai os clientes certos`,
  };
  
  return args[foco] || `• Foque nos benefícios específicos de ${foco}`;
}

function generateMockAnalise(lead: LeadData): AnaliseResult {
  const canaisSelecionados = lead.canaisProspeccao?.length ? lead.canaisProspeccao : ["email", "whatsapp"] as const;
  const canais = getAvailableChannels(lead, [...canaisSelecionados]);
  
  const getCanal = (dia: number): "whatsapp" | "email" | "instagram" => {
    if (canais.length === 0) return "whatsapp";
    if (canais.length === 1) return canais[0];
    return canais[(dia - 1) % canais.length];
  };

  const temMarketing = lead.has_meta_pixel || lead.has_gtag || lead.has_gtm;
  const temContato = canais.length > 0;

  return {
    diagnostico_bullets: [
      `${lead.nome} atua no segmento de ${lead.nicho} em ${lead.cidade}`,
      temMarketing 
        ? "Presença digital intermediária com ferramentas de tracking instaladas" 
        : "Baixa maturidade digital - sem ferramentas de análise detectadas",
      temContato
        ? `Canais de contato ativos: ${canais.join(", ")}`
        : "Nenhum canal de contato direto identificado - oportunidade de estruturação",
      `Foco em ${lead.foco} alinhado com tendências do mercado`,
      "Potencial de crescimento com estratégia bem estruturada",
      "Recomendação: abordagem consultiva focada em resultados mensuráveis",
    ],
    probabilidade_conversao: temMarketing && temContato ? 65 : temContato ? 45 : 25,
    plano_prospeccao_7dias: [
      {
        dia: 1,
        canal: getCanal(1),
        acao_sugerida: getCanal(1) === "whatsapp" ? "Enviar ÁUDIO de 30-45 segundos se apresentando" : getCanal(1) === "instagram" ? "1) Curtir 2-3 posts recentes 2) Reagir a 1 story 3) Enviar DM" : "Enviar email com assunto personalizado",
        mensagem: `${lead.nome_responsavel || lead.nome}, analisei o setor de ${lead.nicho} em ${lead.cidade}. Identifiquei uma oportunidade em ${lead.foco} que poucas empresas estão explorando. Vale uma conversa de 5 min?`,
        objecao_provavel: "Quem é você e como conseguiu meu contato?",
        resposta_sugerida: "Justo. Sou especialista em ${lead.foco} e faço análises de mercado regularmente. Encontrei dados públicos da empresa e identifiquei uma oportunidade real. Posso mostrar em 5 minutos.",
        cta: "Faz sentido uma conversa rápida ou prefere que eu envie por escrito?"
      },
      {
        dia: 2,
        canal: getCanal(2),
        acao_sugerida: getCanal(2) === "whatsapp" ? "Enviar mensagem de TEXTO" : getCanal(2) === "instagram" ? "Comentar no último post com insight + esperar 1h + enviar DM" : "Enviar email com case de sucesso anexo",
        mensagem: `Assunto: Oportunidade identificada - ${lead.nome}\n\nAnalisei empresas de ${lead.nicho} em ${lead.cidade} e notei que muitas estão perdendo clientes por não otimizar ${lead.foco}. Preparei um diagnóstico rápido para vocês - posso enviar?`,
        objecao_provavel: "Já trabalhamos com alguém",
        resposta_sugerida: "Faz sentido. Não vim substituir ninguém. Vim mostrar uma oportunidade complementar que identificamos especificamente para ${lead.nicho}. Vale conhecer mesmo que seja só para comparar?",
        cta: "Posso enviar o diagnóstico por aqui ou prefere por email?"
      },
      {
        dia: 3,
        canal: getCanal(3),
        acao_sugerida: getCanal(3) === "whatsapp" ? "Enviar ÁUDIO curto (20-30 segundos)" : getCanal(3) === "instagram" ? "Reagir aos últimos 2 stories + enviar DM" : "Enviar email com dados do mercado",
        mensagem: `Empresas de ${lead.nicho} em cidades similares estão usando uma estratégia específica de ${lead.foco} que está gerando resultados. ${lead.nome} pode aplicar o mesmo. Posso mostrar como funciona?`,
        objecao_provavel: "Não tenho orçamento agora",
        resposta_sugerida: "Compreendo. E se eu mostrar quanto vocês podem estar deixando de faturar por não explorar essa oportunidade? Muitas vezes o 'orçamento' aparece quando o ROI fica claro.",
        cta: "Posso enviar uma análise rápida de potencial?"
      },
      {
        dia: 4,
        canal: getCanal(4),
        acao_sugerida: getCanal(4) === "whatsapp" ? "Enviar mensagem de TEXTO com framework" : getCanal(4) === "instagram" ? "Curtir 2 posts + enviar DM com proposta de valor" : "Enviar email com framework em PDF",
        mensagem: `Preparei um framework simples de 3 passos que empresas de ${lead.nicho} usam para melhorar ${lead.foco}. Funciona bem para negócios do porte de vocês em ${lead.cidade}. Quer que eu compartilhe?`,
        objecao_provavel: "Preciso falar com meu sócio",
        resposta_sugerida: "Claro. Posso preparar um resumo executivo de 1 página para facilitar a conversa. Assim vocês avaliam com as informações certas em mãos.",
        cta: "Envio o resumo por aqui ou prefere por email?"
      },
      {
        dia: 5,
        canal: getCanal(5),
        acao_sugerida: getCanal(5) === "whatsapp" ? "Enviar ÁUDIO de 30 segundos com case de sucesso" : getCanal(5) === "instagram" ? "Comentar em post recente + enviar DM com resultado" : "Enviar email com vídeo curto (Loom 2min)",
        mensagem: `Última semana analisando o setor de ${lead.nicho}. ${lead.nome} tem um perfil que combina bem com nossa metodologia de ${lead.foco}. 15 minutos para mostrar a proposta?`,
        objecao_provavel: "Me manda proposta por email",
        resposta_sugerida: "Posso enviar. Mas antes de algo genérico, preciso de 5 min para entender 2-3 pontos do negócio. Assim a proposta já vem personalizada com projeção de retorno.",
        cta: "Amanhã às 10h ou às 15h funciona melhor?"
      },
      {
        dia: 6,
        canal: getCanal(6),
        acao_sugerida: getCanal(6) === "whatsapp" ? "Enviar mensagem de TEXTO com urgência sutil" : getCanal(6) === "instagram" ? "Reagir a story + enviar DM com escassez" : "Enviar email com proposta personalizada",
        mensagem: `${lead.nome}, estou fechando a agenda do mês para novos projetos de ${lead.foco}. Guardei um espaço para vocês caso faça sentido. Conseguimos alinhar essa semana?`,
        objecao_provavel: "Vou analisar e retorno",
        resposta_sugerida: "Combinado. Deixo um lembrete: cada semana sem otimizar ${lead.foco} é oportunidade que passa. Se preferir, posso mostrar um teste piloto de baixo investimento para validar.",
        cta: "Qual dia funciona para uma conversa final?"
      },
      {
        dia: 7,
        canal: getCanal(7),
        acao_sugerida: getCanal(7) === "whatsapp" ? "Enviar ÁUDIO de despedida respeitoso (30 segundos)" : getCanal(7) === "instagram" ? "Enviar DM final com porta aberta" : "Enviar email final de despedida",
        mensagem: `Última mensagem sobre isso. Se ${lead.foco} não é prioridade agora, entendo perfeitamente. Fico à disposição quando fizer sentido. Sucesso com a ${lead.nome}!`,
        objecao_provavel: "Não tenho interesse",
        resposta_sugerida: "Entendido, agradeço a clareza. Se em algum momento fizer sentido revisitar, estou à disposição. Sucesso com os projetos atuais.",
        cta: "Salva meu contato caso mude de ideia no futuro"
      }
    ]
  };
}
