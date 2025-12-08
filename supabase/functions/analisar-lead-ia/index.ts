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

    // Prioriza Gemini Direto → OpenAI Fallback → Mock
    if (GOOGLE_GEMINI_API_KEY) {
      console.log("🚀 Usando Google Gemini 2.5 Pro (API direta)...");
      try {
        analise = await analyzeWithGeminiDirect(leadData, GOOGLE_GEMINI_API_KEY);
      } catch (geminiError: any) {
        console.log(`⚠️ Gemini falhou: ${geminiError.message}`);
        if (OPENAI_API_KEY) {
          console.log("🔄 Fallback para OpenAI...");
          analise = await analyzeWithOpenAI(leadData, OPENAI_API_KEY);
        } else {
          throw geminiError;
        }
      }
    } else if (OPENAI_API_KEY) {
      console.log("🤖 Usando OpenAI...");
      analise = await analyzeWithOpenAI(leadData, OPENAI_API_KEY);
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-06-05:generateContent?key=${apiKey}`,
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
                        mensagem: { type: "string" },
                        objecao_provavel: { type: "string" },
                        resposta_sugerida: { type: "string" },
                        cta: { type: "string" }
                      },
                      required: ["dia", "canal", "mensagem", "objecao_provavel", "resposta_sugerida", "cta"]
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

    console.log("✅ Análise gerada com sucesso via Gemini 2.5 Pro (direto)");
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
                      mensagem: { type: "string" },
                      objecao_provavel: { type: "string" },
                      resposta_sugerida: { type: "string" },
                      cta: { type: "string" }
                    },
                    required: ["dia", "canal", "mensagem", "objecao_provavel", "resposta_sugerida", "cta"]
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

🏆 SUA ESPECIALIDADE:
• Prospecção B2B de alto ticket para agências de marketing digital
• Vendas consultivas para Tráfego, SEO, Social, Full Service, Automação, CRM, Sites/Landing, Design
• Domínio absoluto de prospecção multicanal (WhatsApp, Email, Instagram)

📜 REGRAS DE OURO (INEGOCIÁVEIS):

1. COPY AFIADA E PERSUASIVA
   • Frases CURTAS e DIRETAS - máximo 20 palavras por frase
   • Entre DIRETO no valor - nada de "Olá tudo bem?" ou "Boa tarde"
   • Cada palavra deve ter propósito - corte todo o resto
   • Máximo 2 emojis estratégicos (não decorativos)

2. PROIBIÇÕES ABSOLUTAS
   ❌ NUNCA invente nomes (João, Maria, etc) - use apenas nome_responsavel se fornecido
   ❌ NUNCA use clichês: "explodir resultados", "escalar vendas", "bombar", "alavancar"
   ❌ NUNCA prometa milagres ou números absurdos
   ❌ NUNCA use saudações vazias: "Olá!", "Boa tarde!", "Pessoal"
   ❌ NUNCA seja bajulador ou use elogios genéricos

3. TOM CONSULTIVO PROFISSIONAL
   • Postura de especialista que identificou uma oportunidade
   • Confiança sem arrogância
   • Dados e insights específicos, não opiniões vagas
   • Respeito pelo tempo do prospect

4. ESTRUTURA POR CANAL:

   📱 WHATSAPP (máx 4 linhas):
   • Linha 1: Insight direto sobre o negócio deles
   • Linha 2: Oportunidade/gap identificado
   • Linha 3: Prova rápida (dado ou comparativo)
   • Linha 4: CTA de baixo compromisso

   ✉️ EMAIL (máx 150 palavras):
   • Assunto: 6-8 palavras, direto ao benefício
   • Abertura: Vá direto ao diagnóstico (não sobre você)
   • Corpo: Problema + insight + evidência
   • Fechamento: CTA claro e específico
   • PS opcional: escassez real ou credencial

   📸 INSTAGRAM DM (máx 4 linhas):
   • Mencione algo específico do perfil/conteúdo deles
   • Conecte com oportunidade identificada
   • 1 emoji máximo
   • Recomende pré-engajamento (curtir posts, comentar)

5. OBJEÇÕES E RESPOSTAS
   • Objeções devem ser FRASES EXATAS que clientes dizem
   • Respostas usam técnica: Reconhecer → Reposicionar → Evidência → Próximo passo
   • Nunca seja defensivo ou agressivo

6. CTAs PROGRESSIVOS (escalada de compromisso):
   • Dia 1-2: Validação ("Faz sentido uma conversa?")
   • Dia 3-4: Entrega de valor ("Posso enviar diagnóstico?")
   • Dia 5-6: Agendamento ("Terça ou quarta funciona?")
   • Dia 7: Encerramento respeitoso ("Última mensagem, sem insistência")

7. DIAGNÓSTICO CONSULTIVO (6-8 bullets)
   • Avaliação de maturidade digital real
   • Gaps críticos com impacto no negócio
   • Oportunidades específicas para o foco
   • Comparativo com mercado/concorrentes
   • Potencial de ROI estimado

LEMBRE-SE: Cada mensagem deve ser tão boa que o prospect QUEIRA responder.`;
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
   • Analise maturidade digital real
   • Identifique gaps críticos
   • Aponte oportunidades para ${lead.foco}
   • Estime potencial de ROI

2. PROBABILIDADE DE CONVERSÃO (0-100)
   ${canaisDisponiveis.length === 0 ? "• Máximo 30% se nenhum canal detectado" : ""}

3. PLANO DE PROSPECÇÃO 7 DIAS
   • Cada dia: mensagem pronta para copiar e colar
   • Objeções: frases EXATAS que clientes dizem
   • Respostas: técnica consultiva profissional
   • CTAs: progressivos e específicos
   
   Progressão obrigatória:
   - Dia 1: Apresentação + contexto
   - Dia 2: Dor específica do nicho
   - Dia 3: Oportunidade clara
   - Dia 4: Framework/método
   - Dia 5: Prova social/cenário
   - Dia 6: Visão estratégica + próximo passo
   - Dia 7: Último toque respeitoso

═══════════════════════════════════════
🎯 LEMBRE-SE: VOCÊ É COPYWRITER DE ELITE
═══════════════════════════════════════
Cada mensagem deve ser memorável e fazer o prospect QUERER responder.
Use os dados REAIS: ${lead.nome}, ${lead.cidade}, ${lead.nicho}, ${lead.foco}.`;
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
        mensagem: `${lead.nome_responsavel || lead.nome}, analisei o setor de ${lead.nicho} em ${lead.cidade}. Identifiquei uma oportunidade em ${lead.foco} que poucas empresas estão explorando. Vale uma conversa de 5 min?`,
        objecao_provavel: "Quem é você e como conseguiu meu contato?",
        resposta_sugerida: "Justo. Sou especialista em ${lead.foco} e faço análises de mercado regularmente. Encontrei dados públicos da empresa e identifiquei uma oportunidade real. Posso mostrar em 5 minutos.",
        cta: "Faz sentido uma conversa rápida ou prefere que eu envie por escrito?"
      },
      {
        dia: 2,
        canal: getCanal(2),
        mensagem: `Assunto: Oportunidade identificada - ${lead.nome}\n\nAnalisei empresas de ${lead.nicho} em ${lead.cidade} e notei que muitas estão perdendo clientes por não otimizar ${lead.foco}. Preparei um diagnóstico rápido para vocês - posso enviar?`,
        objecao_provavel: "Já trabalhamos com alguém",
        resposta_sugerida: "Faz sentido. Não vim substituir ninguém. Vim mostrar uma oportunidade complementar que identificamos especificamente para ${lead.nicho}. Vale conhecer mesmo que seja só para comparar?",
        cta: "Posso enviar o diagnóstico por aqui ou prefere por email?"
      },
      {
        dia: 3,
        canal: getCanal(3),
        mensagem: `Empresas de ${lead.nicho} em cidades similares estão usando uma estratégia específica de ${lead.foco} que está gerando resultados. ${lead.nome} pode aplicar o mesmo. Posso mostrar como funciona?`,
        objecao_provavel: "Não tenho orçamento agora",
        resposta_sugerida: "Compreendo. E se eu mostrar quanto vocês podem estar deixando de faturar por não explorar essa oportunidade? Muitas vezes o 'orçamento' aparece quando o ROI fica claro.",
        cta: "Posso enviar uma análise rápida de potencial?"
      },
      {
        dia: 4,
        canal: getCanal(4),
        mensagem: `Preparei um framework simples de 3 passos que empresas de ${lead.nicho} usam para melhorar ${lead.foco}. Funciona bem para negócios do porte de vocês em ${lead.cidade}. Quer que eu compartilhe?`,
        objecao_provavel: "Preciso falar com meu sócio",
        resposta_sugerida: "Claro. Posso preparar um resumo executivo de 1 página para facilitar a conversa. Assim vocês avaliam com as informações certas em mãos.",
        cta: "Envio o resumo por aqui ou prefere por email?"
      },
      {
        dia: 5,
        canal: getCanal(5),
        mensagem: `Última semana analisando o setor de ${lead.nicho}. ${lead.nome} tem um perfil que combina bem com nossa metodologia de ${lead.foco}. 15 minutos para mostrar a proposta?`,
        objecao_provavel: "Me manda proposta por email",
        resposta_sugerida: "Posso enviar. Mas antes de algo genérico, preciso de 5 min para entender 2-3 pontos do negócio. Assim a proposta já vem personalizada com projeção de retorno.",
        cta: "Amanhã às 10h ou às 15h funciona melhor?"
      },
      {
        dia: 6,
        canal: getCanal(6),
        mensagem: `${lead.nome}, estou fechando a agenda do mês para novos projetos de ${lead.foco}. Guardei um espaço para vocês caso faça sentido. Conseguimos alinhar essa semana?`,
        objecao_provavel: "Vou analisar e retorno",
        resposta_sugerida: "Combinado. Deixo um lembrete: cada semana sem otimizar ${lead.foco} é oportunidade que passa. Se preferir, posso mostrar um teste piloto de baixo investimento para validar.",
        cta: "Qual dia funciona para uma conversa final?"
      },
      {
        dia: 7,
        canal: getCanal(7),
        mensagem: `Última mensagem sobre isso. Se ${lead.foco} não é prioridade agora, entendo perfeitamente. Fico à disposição quando fizer sentido. Sucesso com a ${lead.nome}!`,
        objecao_provavel: "Não tenho interesse",
        resposta_sugerida: "Entendido, agradeço a clareza. Se em algum momento fizer sentido revisitar, estou à disposição. Sucesso com os projetos atuais.",
        cta: "Salva meu contato caso mude de ideia no futuro"
      }
    ]
  };
}
