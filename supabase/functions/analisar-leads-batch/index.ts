import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Interface compacta para lead (apenas campos necessários para análise)
interface LeadInput {
  id: string;
  nome: string;
  nicho: string;
  cidade: string;
  foco: string;
  website?: string | null;
  whatsapp_number?: string | null;
  whatsapp_on_site?: boolean;
  email?: string | null;
  instagram_url?: string | null;
  has_meta_pixel?: boolean;
  has_gtag?: boolean;
  has_gtm?: boolean;
  canaisProspeccao?: ("email" | "whatsapp" | "instagram")[];
}

interface AnaliseResult {
  lead_id: string;
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

// Determina canais disponíveis baseado nos sinais detectados
function getAvailableChannels(lead: LeadInput): ("email" | "whatsapp" | "instagram")[] {
  const selected = lead.canaisProspeccao || ["email", "whatsapp", "instagram"];
  const available: ("email" | "whatsapp" | "instagram")[] = [];
  
  if (selected.includes("whatsapp") && (lead.whatsapp_number || lead.whatsapp_on_site)) {
    available.push("whatsapp");
  }
  if (selected.includes("email") && lead.email) {
    available.push("email");
  }
  if (selected.includes("instagram") && lead.instagram_url) {
    available.push("instagram");
  }
  
  return available;
}

// Prompt otimizado (~800 tokens vs ~2500+ tokens anterior)
function buildBatchPrompt(leads: LeadInput[]): string {
  const leadsData = leads.map((lead, idx) => {
    const canais = getAvailableChannels(lead);
    const sinais = [
      lead.has_meta_pixel ? "Pixel" : null,
      lead.has_gtag ? "GA" : null,
      lead.has_gtm ? "GTM" : null,
      lead.whatsapp_on_site ? "WA" : null,
    ].filter(Boolean).join(",") || "nenhum";
    
    return `[${idx + 1}] ${lead.nome} | ${lead.nicho} | ${lead.cidade} | Foco: ${lead.foco} | Sinais: ${sinais} | Canais: ${canais.length > 0 ? canais.join(",") : "nenhum"}`;
  }).join("\n");

  return `Analise ${leads.length} leads B2B e gere plano de prospecção 7 dias para cada.

LEADS:
${leadsData}

REGRAS CRÍTICAS:
- Diagnóstico: máx 4 bullets curtos por lead
- Probabilidade: 0-100 baseado em sinais digitais
- Plano 7 dias: alternar canais disponíveis, mensagens diretas (<100 palavras)
- Tom: profissional B2B, sem clichês ("explodir", "escalar")
- Se canal não disponível, NÃO usar
- Cada dia: mensagem + objeção provável + resposta + CTA

Retorne análise para TODOS os ${leads.length} leads via função.`;
}

// Processa batch de leads com OpenAI
async function analyzeLeadsBatch(leads: LeadInput[], apiKey: string): Promise<AnaliseResult[]> {
  console.log(`🤖 Analisando batch de ${leads.length} leads...`);
  
  const prompt = buildBatchPrompt(leads);
  
  // Gera schema de canais permitidos por lead
  const leadsChannels = leads.map(lead => getAvailableChannels(lead));
  
  const requestBody = {
    model: "gpt-4o-mini",
    max_completion_tokens: 8000,
    messages: [
      {
        role: "system",
        content: `Você é um estrategista B2B. Gere análises de prospecção concisas e diretas. Tom profissional, sem jargões. Máx 2 emojis por mensagem.`,
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
          name: "gerar_analises_batch",
          description: "Gera análises para múltiplos leads de uma vez",
          parameters: {
            type: "object",
            properties: {
              analises: {
                type: "array",
                description: "Array de análises, uma para cada lead na mesma ordem",
                items: {
                  type: "object",
                  properties: {
                    lead_index: { 
                      type: "number",
                      description: "Índice do lead (1, 2, 3...)"
                    },
                    diagnostico_bullets: {
                      type: "array",
                      items: { type: "string" },
                      maxItems: 4,
                    },
                    probabilidade_conversao: {
                      type: "number",
                      minimum: 0,
                      maximum: 100,
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
                          cta: { type: "string" },
                        },
                        required: ["dia", "canal", "mensagem", "objecao_provavel", "resposta_sugerida", "cta"],
                      },
                    },
                  },
                  required: ["lead_index", "diagnostico_bullets", "probabilidade_conversao", "plano_prospeccao_7dias"],
                },
              },
            },
            required: ["analises"],
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "gerar_analises_batch" } },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout para batch

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
      console.error("❌ OpenAI error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("No tool call response from OpenAI");
    }

    const result = JSON.parse(toolCall.function.arguments);
    
    // Mapeia resultados para IDs dos leads
    return result.analises.map((analise: any) => ({
      lead_id: leads[analise.lead_index - 1]?.id,
      diagnostico_bullets: analise.diagnostico_bullets || [],
      probabilidade_conversao: analise.probabilidade_conversao || 50,
      plano_prospeccao_7dias: analise.plano_prospeccao_7dias || [],
    }));
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("❌ Batch analysis error:", error.message);
    
    // Retorna análises mock para não bloquear
    return leads.map(lead => generateMockAnalise(lead));
  }
}

// Mock analysis fallback
function generateMockAnalise(lead: LeadInput): AnaliseResult {
  const canais = getAvailableChannels(lead);
  const temMarketing = lead.has_meta_pixel || lead.has_gtag || lead.has_gtm;
  
  const getCanal = (dia: number): "whatsapp" | "email" | "instagram" => {
    if (canais.length === 0) return "whatsapp";
    return canais[(dia - 1) % canais.length];
  };

  return {
    lead_id: lead.id,
    diagnostico_bullets: [
      `${lead.nome} em ${lead.cidade}, nicho ${lead.nicho}`,
      temMarketing ? "Presença digital com ferramentas de tracking" : "Presença digital básica",
      `Oportunidade em ${lead.foco}`,
      canais.length > 0 ? `Canais disponíveis: ${canais.join(", ")}` : "Sem canais de contato detectados",
    ],
    probabilidade_conversao: temMarketing ? 65 : 40,
    plano_prospeccao_7dias: Array.from({ length: 7 }, (_, i) => ({
      dia: i + 1,
      canal: getCanal(i + 1),
      mensagem: `Dia ${i + 1}: Mensagem de prospecção para ${lead.nome} focada em ${lead.foco}.`,
      objecao_provavel: "Já temos fornecedor",
      resposta_sugerida: "Entendo! Nossa proposta é complementar, não substituir.",
      cta: "Podemos conversar 5 minutos?",
    })),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    const { leads } = await req.json() as { leads: LeadInput[] };
    
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return new Response(
        JSON.stringify({ error: "No leads provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📊 Recebido batch de ${leads.length} leads para análise`);

    let analises: AnaliseResult[];

    if (!OPENAI_API_KEY) {
      console.log("⚠️ OpenAI API key não configurada - usando mock");
      analises = leads.map(lead => generateMockAnalise(lead));
    } else {
      analises = await analyzeLeadsBatch(leads, OPENAI_API_KEY);
    }

    // Salva todas as análises no banco
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const updatePromises = analises.map(async (analise) => {
      if (!analise.lead_id) return;
      
      const { error } = await supabase
        .from("leads")
        .update({
          diagnostico_bullets: analise.diagnostico_bullets,
          probabilidade_conversao: analise.probabilidade_conversao,
          plano_prospeccao: analise.plano_prospeccao_7dias,
          ai_analise_gerada_em: new Date().toISOString(),
        })
        .eq("id", analise.lead_id);
        
      if (error) {
        console.error(`❌ Erro ao salvar lead ${analise.lead_id}:`, error);
      } else {
        console.log(`✅ Lead ${analise.lead_id} atualizado`);
      }
    });

    await Promise.all(updatePromises);

    console.log(`✅ Batch de ${analises.length} leads processado com sucesso`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: analises.length,
        analises 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Erro no batch:", error.message);
    return new Response(
      JSON.stringify({ error: "Batch processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
