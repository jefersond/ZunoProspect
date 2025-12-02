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
  has_meta_pixel: boolean;
  has_gtag: boolean;
  has_gtm: boolean;
  instagram_url: string | null;
  instagram_context: string | null;
  canaisProspeccao?: ("email" | "whatsapp" | "instagram")[];
}

interface SiteSignals {
  whatsapp_on_site: boolean;
  whatsapp_number: string | null;
  has_meta_pixel: boolean;
  has_gtag: boolean;
  has_gtm: boolean;
  instagram_url: string | null;
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

// Função melhorada para escanear o site em busca de sinais digitais
async function scrapeSiteForSignals(websiteUrl: string): Promise<SiteSignals> {
  const signals: SiteSignals = {
    whatsapp_on_site: false,
    whatsapp_number: null,
    has_meta_pixel: false,
    has_gtag: false,
    has_gtm: false,
    instagram_url: null,
  };

  try {
    console.log(`🔍 Escaneando site: ${websiteUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const siteResponse = await fetch(websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!siteResponse.ok) {
      console.log(`⚠️ Erro ao acessar site: ${siteResponse.status}`);
      return signals;
    }

    const html = await siteResponse.text();
    console.log(`📄 HTML recebido: ${html.length} caracteres`);
    
    // ========================================
    // DETECÇÃO DE WHATSAPP - MÚLTIPLOS PADRÕES
    // ========================================
    
    // Padrões de link direto do WhatsApp
    const whatsappLinkPatterns = [
      /wa\.me\/(\+?[0-9]+)/gi,
      /api\.whatsapp\.com\/send\?phone=(\+?[0-9]+)/gi,
      /web\.whatsapp\.com\/send\?phone=(\+?[0-9]+)/gi,
      /whatsapp:\/\/send\?phone=(\+?[0-9]+)/gi,
    ];
    
    for (const pattern of whatsappLinkPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          signals.whatsapp_on_site = true;
          signals.whatsapp_number = match[1].replace(/\D/g, '');
          console.log(`✅ WhatsApp encontrado via link: ${signals.whatsapp_number}`);
          break;
        }
      }
      if (signals.whatsapp_on_site) break;
    }

    // Procura por href com whatsapp
    if (!signals.whatsapp_on_site) {
      const hrefWhatsappPattern = /href\s*=\s*["'][^"']*whatsapp[^"']*["']/gi;
      const hrefMatches = html.match(hrefWhatsappPattern);
      if (hrefMatches && hrefMatches.length > 0) {
        // Tenta extrair número do href
        const numberMatch = hrefMatches[0].match(/(\d{10,15})/);
        if (numberMatch) {
          signals.whatsapp_on_site = true;
          signals.whatsapp_number = numberMatch[1];
          console.log(`✅ WhatsApp encontrado via href: ${signals.whatsapp_number}`);
        } else {
          signals.whatsapp_on_site = true;
          console.log(`✅ Link WhatsApp detectado (sem número específico)`);
        }
      }
    }

    // Procura por classe/id com whatsapp
    if (!signals.whatsapp_on_site) {
      const whatsappClassPatterns = [
        /class\s*=\s*["'][^"']*whatsapp[^"']*["']/gi,
        /id\s*=\s*["'][^"']*whatsapp[^"']*["']/gi,
        /class\s*=\s*["'][^"']*wpp[^"']*["']/gi,
        /class\s*=\s*["'][^"']*zap[^"']*["']/gi,
      ];
      
      for (const pattern of whatsappClassPatterns) {
        if (pattern.test(html)) {
          signals.whatsapp_on_site = true;
          console.log(`✅ WhatsApp detectado via classe/id CSS`);
          break;
        }
      }
    }

    // Procura por imagens/ícones de WhatsApp
    if (!signals.whatsapp_on_site) {
      const whatsappImagePatterns = [
        /src\s*=\s*["'][^"']*whatsapp[^"']*\.(png|jpg|jpeg|svg|gif|webp)["']/gi,
        /src\s*=\s*["'][^"']*wpp[^"']*\.(png|jpg|jpeg|svg|gif|webp)["']/gi,
        /src\s*=\s*["'][^"']*zap[^"']*\.(png|jpg|jpeg|svg|gif|webp)["']/gi,
      ];
      
      for (const pattern of whatsappImagePatterns) {
        if (pattern.test(html)) {
          signals.whatsapp_on_site = true;
          console.log(`✅ WhatsApp detectado via imagem/ícone`);
          break;
        }
      }
    }

    // Procura por texto "WhatsApp" próximo a números de telefone
    if (!signals.whatsapp_on_site) {
      const whatsappContextPattern = /whatsapp[^0-9]{0,80}(\+?55\s*)?(\(?[0-9]{2}\)?[\s\-]?[0-9]{4,5}[\s\-]?[0-9]{4})/gi;
      const contextMatch = html.match(whatsappContextPattern);
      if (contextMatch) {
        signals.whatsapp_on_site = true;
        const numberMatch = contextMatch[0].match(/(\d{10,13})/);
        if (numberMatch) {
          signals.whatsapp_number = numberMatch[1];
        }
        console.log(`✅ WhatsApp encontrado via contexto de texto`);
      }
    }

    // ========================================
    // DETECÇÃO DE INSTAGRAM - MÚLTIPLOS PADRÕES
    // ========================================
    
    // Padrões de link do Instagram
    const instagramPatterns = [
      /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/gi,
      /href\s*=\s*["'][^"']*instagram\.com\/([a-zA-Z0-9._]+)[^"']*["']/gi,
    ];
    
    for (const pattern of instagramPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && !['p', 'reel', 'stories', 'explore', 'accounts', 'about', 'legal', 'help'].includes(match[1].toLowerCase())) {
          signals.instagram_url = `https://instagram.com/${match[1]}`;
          console.log(`✅ Instagram encontrado: ${signals.instagram_url}`);
          break;
        }
      }
      if (signals.instagram_url) break;
    }

    // Procura por classe/id com instagram
    if (!signals.instagram_url) {
      const instagramClassPatterns = [
        /class\s*=\s*["'][^"']*instagram[^"']*["']/gi,
        /id\s*=\s*["'][^"']*instagram[^"']*["']/gi,
        /class\s*=\s*["'][^"']*insta[^"']*["']/gi,
      ];
      
      for (const pattern of instagramClassPatterns) {
        if (pattern.test(html)) {
          // Há um elemento Instagram, tenta encontrar o link
          const linkNearby = html.match(/instagram\.com\/([a-zA-Z0-9._]+)/gi);
          if (linkNearby && linkNearby[0]) {
            const username = linkNearby[0].replace(/instagram\.com\//i, '');
            if (!['p', 'reel', 'stories', 'explore'].includes(username.toLowerCase())) {
              signals.instagram_url = `https://instagram.com/${username}`;
              console.log(`✅ Instagram detectado via classe CSS: ${signals.instagram_url}`);
            }
          }
          break;
        }
      }
    }

    // Procura por imagens/ícones de Instagram
    if (!signals.instagram_url) {
      const instagramImagePatterns = [
        /src\s*=\s*["'][^"']*instagram[^"']*\.(png|jpg|jpeg|svg|gif|webp)["']/gi,
        /src\s*=\s*["'][^"']*insta[^"']*\.(png|jpg|jpeg|svg|gif|webp)["']/gi,
      ];
      
      for (const pattern of instagramImagePatterns) {
        if (pattern.test(html)) {
          // Tem ícone de Instagram, tenta achar o link
          const linkMatch = html.match(/instagram\.com\/([a-zA-Z0-9._]+)/gi);
          if (linkMatch) {
            const username = linkMatch[0].replace(/instagram\.com\//i, '');
            if (!['p', 'reel', 'stories', 'explore'].includes(username.toLowerCase())) {
              signals.instagram_url = `https://instagram.com/${username}`;
              console.log(`✅ Instagram detectado via ícone: ${signals.instagram_url}`);
            }
          }
          break;
        }
      }
    }

    // ========================================
    // DETECÇÃO DE FERRAMENTAS DE MARKETING
    // ========================================
    
    // Meta Pixel
    if (/fbq\s*\(\s*['"]init['"]/i.test(html) || 
        /facebook\.com\/tr\?id=/i.test(html) ||
        /connect\.facebook\.net\/.*\/fbevents\.js/i.test(html)) {
      signals.has_meta_pixel = true;
      console.log(`✅ Meta Pixel detectado`);
    }

    // Google Analytics / gtag
    if (/gtag\s*\(\s*['"]config['"]/i.test(html) || 
        /googletagmanager\.com\/gtag\/js/i.test(html) ||
        /google-analytics\.com\/analytics\.js/i.test(html) ||
        /UA-[0-9]+-[0-9]+/i.test(html) ||
        /G-[A-Z0-9]+/i.test(html)) {
      signals.has_gtag = true;
      console.log(`✅ Google Analytics detectado`);
    }

    // Google Tag Manager
    if (/GTM-[A-Z0-9]+/i.test(html) || 
        /googletagmanager\.com\/gtm\.js/i.test(html) ||
        /googletagmanager\.com\/ns\.html/i.test(html)) {
      signals.has_gtm = true;
      console.log(`✅ Google Tag Manager detectado`);
    }

    console.log(`📊 Sinais finais:`, signals);
    
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`⏱️ Timeout ao acessar site: ${websiteUrl}`);
    } else {
      console.error(`❌ Erro ao escanear site ${websiteUrl}:`, error.message);
    }
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
    
    console.log("🔍 Recebido request:", { leadId, hasNome: !!requestData.nome });

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    let leadData: LeadData;
    let websiteUrl: string | null = null;
    
    // Se temos leadId, busca os dados do banco e re-escaneia o site
    if (leadId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      console.log("📥 Buscando dados do lead no banco...");
      
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      // Busca o lead direto da tabela
      const { data: directLead, error: directError } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();
        
      if (directError || !directLead) {
        console.error("❌ Lead não encontrado:", directError);
        throw new Error("Lead não encontrado no banco de dados");
      }
      
      websiteUrl = directLead.website as string | null;
      leadData = {
        nome: directLead.nome as string,
        nicho: directLead.nicho as string,
        cidade: directLead.cidade as string,
        website: directLead.website as string | null,
        foco: directLead.foco as string,
        whatsapp_on_site: (directLead.whatsapp_on_site as boolean) || false,
        has_meta_pixel: (directLead.has_meta_pixel as boolean) || false,
        has_gtag: (directLead.has_gtag as boolean) || false,
        has_gtm: (directLead.has_gtm as boolean) || false,
        instagram_url: directLead.instagram_url as string | null,
        instagram_context: directLead.instagram_context as string | null,
        canaisProspeccao: requestData.canaisProspeccao,
      };
      
      console.log("✅ Lead carregado:", leadData.nome);
      
      // RE-ESCANEIA O SITE para detectar novos sinais
      if (websiteUrl) {
        console.log("🔄 Re-escaneando site para detectar sinais atualizados...");
        const newSignals = await scrapeSiteForSignals(websiteUrl);
        
        // Atualiza os sinais se encontrar algo novo
        if (newSignals.whatsapp_on_site || newSignals.instagram_url || newSignals.has_meta_pixel || newSignals.has_gtag || newSignals.has_gtm) {
          leadData.whatsapp_on_site = newSignals.whatsapp_on_site || leadData.whatsapp_on_site;
          leadData.has_meta_pixel = newSignals.has_meta_pixel || leadData.has_meta_pixel;
          leadData.has_gtag = newSignals.has_gtag || leadData.has_gtag;
          leadData.has_gtm = newSignals.has_gtm || leadData.has_gtm;
          leadData.instagram_url = newSignals.instagram_url || leadData.instagram_url;
          
          // Atualiza os sinais no banco (campos não criptografados)
          console.log("💾 Atualizando sinais no banco...");
          const updateData: Record<string, any> = {
            whatsapp_on_site: leadData.whatsapp_on_site,
            has_meta_pixel: leadData.has_meta_pixel,
            has_gtag: leadData.has_gtag,
            has_gtm: leadData.has_gtm,
          };
          
          // Se encontrou novo WhatsApp ou Instagram, atualiza via campos não criptografados temporariamente
          if (newSignals.whatsapp_number) {
            updateData.whatsapp_number = newSignals.whatsapp_number;
          }
          if (newSignals.instagram_url) {
            updateData.instagram_url = newSignals.instagram_url;
          }
          
          const { error: updateSignalsError } = await supabase
            .from("leads")
            .update(updateData)
            .eq("id", leadId);
            
          if (updateSignalsError) {
            console.error("⚠️ Erro ao atualizar sinais:", updateSignalsError);
          } else {
            console.log("✅ Sinais atualizados no banco");
          }
        }
      }
    } else {
      // Usa os dados passados diretamente
      leadData = {
        nome: requestData.nome,
        nicho: requestData.nicho,
        cidade: requestData.cidade,
        website: requestData.website,
        foco: requestData.foco,
        whatsapp_on_site: requestData.whatsapp_on_site || false,
        has_meta_pixel: requestData.has_meta_pixel || false,
        has_gtag: requestData.has_gtag || false,
        has_gtm: requestData.has_gtm || false,
        instagram_url: requestData.instagram_url,
        instagram_context: requestData.instagram_context,
        canaisProspeccao: requestData.canaisProspeccao,
      };
    }

    console.log("🔍 Analisando lead:", leadData.nome);

    let analise: AnaliseResult;

    if (!OPENAI_API_KEY) {
      console.log("⚠️ API key não configurada - retornando análise mockada");
      analise = generateMockAnalise(leadData);
    } else {
      console.log("🤖 Iniciando análise com OpenAI...");
      analise = await analyzeWithAI(leadData, OPENAI_API_KEY);
    }

    // Atualiza o lead no banco se temos ID
    if (leadId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      console.log("💾 Salvando análise no banco...");
      
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { error: updateError } = await supabase
        .from("leads")
        .update({
          diagnostico_bullets: analise.diagnostico_bullets,
          probabilidade_conversao: analise.probabilidade_conversao,
          plano_prospeccao: analise.plano_prospeccao_7dias,
          ai_analise_gerada_em: new Date().toISOString(),
        })
        .eq("id", leadId);

      if (updateError) {
        console.error("❌ Erro ao atualizar lead:", updateError);
      } else {
        console.log("✅ Lead atualizado com sucesso");
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

function generateMockAnalise(lead: LeadData): AnaliseResult {
  const temMarketing = lead.has_meta_pixel || lead.has_gtag || lead.has_gtm;
  const temWhatsApp = lead.whatsapp_on_site;
  const temSocial = !!lead.instagram_url;

  const canais = lead.canaisProspeccao && lead.canaisProspeccao.length > 0 
    ? lead.canaisProspeccao 
    : ["email", "whatsapp"];
  
  const getCanal = (diaNumero: number): "whatsapp" | "email" | "instagram" => {
    if (canais.length === 1) return canais[0] as "whatsapp" | "email" | "instagram";
    const index = (diaNumero - 1) % canais.length;
    return canais[index] as "whatsapp" | "email" | "instagram";
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

async function analyzeWithAI(lead: LeadData, apiKey: string): Promise<AnaliseResult> {
  const prompt = buildAnalysisPrompt(lead);

  console.log("Iniciando análise com OpenAI para:", lead.nome);

  const canaisPermitidos = lead.canaisProspeccao && lead.canaisProspeccao.length > 0 
    ? lead.canaisProspeccao 
    : ["email", "whatsapp"];

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
                      canal: { type: "string", enum: canaisPermitidos, description: "USAR APENAS OS CANAIS PERMITIDOS PELO USUÁRIO" },
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

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
        throw new Error("Timeout: OpenAI demorou mais de 60 segundos para responder. Tente novamente.");
      }
      throw fetchError;
    }
  } catch (error: any) {
    console.error("❌ Erro na função analyzeWithAI:", {
      message: error.message,
      stack: error.stack,
      lead: lead.nome,
    });
    
    if (error.message.includes("API") || error.message.includes("Timeout")) {
      throw error;
    }
    throw new Error(`Falha ao analisar lead: ${error.message}`);
  }
}

function buildAnalysisPrompt(lead: LeadData): string {
  const canais = lead.canaisProspeccao && lead.canaisProspeccao.length > 0 
    ? lead.canaisProspeccao 
    : ["email", "whatsapp"];
  
  const canalTexto = canais.map(c => {
    if (c === "email") return "Email";
    if (c === "whatsapp") return "WhatsApp";
    if (c === "instagram") return "Instagram";
    return c;
  }).join(", ");
  
  const estrategiaCadencia = canais.length === 1 
    ? `Use SOMENTE ${canalTexto} para todos os 7 dias`
    : `Distribua os 7 dias entre os canais disponíveis (${canalTexto}), alternando estrategicamente para maximizar engajamento`;
    
  const sinaisMarketing = [];
  if (lead.has_meta_pixel) sinaisMarketing.push("Meta Pixel instalado");
  if (lead.has_gtag) sinaisMarketing.push("Google Analytics configurado");
  if (lead.has_gtm) sinaisMarketing.push("Google Tag Manager ativo");
  if (lead.whatsapp_on_site) sinaisMarketing.push("WhatsApp visível no site");
  if (lead.instagram_url) sinaisMarketing.push(`Instagram: ${lead.instagram_url}`);

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

3️⃣ PLANO DE PROSPECÇÃO 7 DIAS:
   
   📢 CANAIS DISPONÍVEIS: ${canalTexto}
   ⚠️ IMPORTANTE: ${estrategiaCadencia}
   
   Para CADA dia, gere:
   
   📝 MENSAGEM (usando técnica AIDA):
   - WhatsApp: curta (até 150 palavras), informal, emojis moderados
   - Email: assunto atrativo + corpo estruturado
   - Instagram: tom casual, visual, engajamento

   🚫 OBJEÇÃO PROVÁVEL:
   - Antecipe a objeção mais realista para aquele estágio
   - Ex: "Já temos fornecedor", "Sem orçamento", "Não tenho tempo"
   
   💬 RESPOSTA SUGERIDA:
   - Use técnicas de vendas (espelhamento, pergunta reversa, prova social)
   - Seja empático mas assertivo
   - Mantenha o tom profissional e consultivo

   🎯 CTA (Call-to-Action):
   - DEVE ser específico e acionável
   - Ex: "Responda SIM", "Clique aqui para agendar", "Escolha um horário"
   - Evite CTAs genéricos como "Fale conosco"

LEMBRE-SE:
- Personalize TODAS as mensagens com nome da empresa e cidade
- Adapte linguagem ao canal específico
- Escalone urgência ao longo dos 7 dias
- USE APENAS OS CANAIS ESPECIFICADOS: ${canalTexto}`;
}

function getFocoMessage(foco: string): string {
  const messages: Record<string, string> = {
    "Full Service": "escalar resultados com estratégia de marketing integrada",
    "Tráfego": "multiplicar vendas com tráfego pago de alta conversão",
    "Automação": "economizar tempo e escalar com automação inteligente",
    "Design": "transformar a marca em referência visual no mercado",
    "Social": "construir autoridade e engajamento nas redes sociais",
    "SEO": "dominar o Google e atrair clientes organicamente",
    "Sites/Landing": "converter mais visitantes com páginas otimizadas",
    "CRM": "organizar vendas e aumentar retenção de clientes",
  };
  return messages[foco] || "crescer com marketing digital estratégico";
}

function getFocoMetric(foco: string): string {
  const metrics: Record<string, string> = {
    "Full Service": "ROI em 180%",
    "Tráfego": "conversões em 250%",
    "Automação": "produtividade em 300%",
    "Design": "engajamento em 200%",
    "Social": "seguidores qualificados em 400%",
    "SEO": "tráfego orgânico em 350%",
    "Sites/Landing": "taxa de conversão em 180%",
    "CRM": "vendas recorrentes em 220%",
  };
  return metrics[foco] || "resultados em 200%";
}
