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
  // CNPJ enrichment fields
  cnpj?: string | null;
  razao_social?: string | null;
  nome_responsavel?: string | null;
  situacao_cadastral?: string | null;
  porte_empresa?: string | null;
  cnae_principal?: string | null;
}

// Função para filtrar canais baseado no que foi detectado no lead
// SEM FALLBACK - só retorna canais que realmente foram detectados
function getAvailableChannels(lead: LeadData, selectedChannels: ("email" | "whatsapp" | "instagram")[]): ("email" | "whatsapp" | "instagram")[] {
  const available: ("email" | "whatsapp" | "instagram")[] = [];
  
  // WhatsApp: disponível SOMENTE se tem número ou está no site
  if (selectedChannels.includes("whatsapp") && (lead.whatsapp_number || lead.whatsapp_on_site)) {
    available.push("whatsapp");
  }
  
  // Email: disponível SOMENTE se foi detectado
  if (selectedChannels.includes("email") && lead.email) {
    available.push("email");
  }
  
  // Instagram: disponível SOMENTE se foi detectado no site
  // Se selecionado mas não detectado, sugestões irão para o diagnóstico (não para o plano)
  if (selectedChannels.includes("instagram") && lead.instagram_url) {
    available.push("instagram");
  } else if (selectedChannels.includes("instagram") && !lead.instagram_url) {
    console.log(`📸 Instagram selecionado mas NÃO detectado - NÃO será usado no plano (sugestões irão para diagnóstico)`);
  }
  
  // SEM FALLBACK! Se não detectou nenhum canal, retorna array vazio
  // A IA será instruída a criar plano alternativo de como ENCONTRAR contato
  
  console.log(`📢 Canais selecionados pelo usuário: ${selectedChannels.join(", ")}`);
  console.log(`✅ Canais REALMENTE detectados: ${available.length > 0 ? available.join(", ") : "NENHUM"}`);
  
  if (available.length === 0) {
    console.log(`⚠️ ATENÇÃO: Nenhum canal de contato foi detectado para este lead!`);
  }
  
  return available;
}

// Gera variações prováveis do handle do Instagram baseado no nome da empresa
function generateInstagramVariations(nome: string, cidade: string): string[] {
  // Remove acentos
  const removeAccents = (str: string) => 
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Versão sem espaços e caracteres especiais
  const normalized = removeAccents(nome.toLowerCase())
    .replace(/[^a-z0-9]/g, '');
  
  // Versão com underscores
  const withUnderscores = removeAccents(nome.toLowerCase())
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
    
  // Versão com pontos
  const withDots = removeAccents(nome.toLowerCase())
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '');
    
  // Cidade normalizada
  const cidadeNorm = removeAccents(cidade.toLowerCase())
    .replace(/[^a-z]/g, '');
  
  // Gera variações
  const variations = new Set<string>();
  
  // Variações básicas
  variations.add(`@${normalized}`);
  variations.add(`@${withUnderscores}`);
  variations.add(`@${withDots}`);
  
  // Com "oficial"
  variations.add(`@${normalized}oficial`);
  variations.add(`@${normalized}_oficial`);
  
  // Com cidade
  if (cidadeNorm.length > 0) {
    variations.add(`@${normalized}${cidadeNorm}`);
    variations.add(`@${normalized}_${cidadeNorm}`);
    variations.add(`@${withUnderscores}_${cidadeNorm}`);
  }
  
  // Abreviações comuns (primeiras letras de cada palavra)
  const words = removeAccents(nome.toLowerCase()).split(/\s+/).filter(w => w.length > 2);
  if (words.length > 1) {
    const initials = words.map(w => w[0]).join('');
    variations.add(`@${initials}`);
    variations.add(`@${initials}${cidadeNorm}`);
  }
  
  return Array.from(variations).slice(0, 6); // Máximo 6 sugestões
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

// Função para buscar dados do CNPJ na BrasilAPI
async function fetchCNPJData(cnpj: string): Promise<CNPJData | null> {
  try {
    // Remove caracteres não numéricos
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    
    if (cnpjLimpo.length !== 14) {
      console.log(`⚠️ CNPJ inválido (não tem 14 dígitos): ${cnpjLimpo}`);
      return null;
    }
    
    console.log(`🔍 Buscando dados do CNPJ: ${cnpjLimpo}`);
    
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.log(`⚠️ Erro ao buscar CNPJ: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    // Extrai nome do primeiro sócio (QSA = Quadro de Sócios e Administradores)
    let nomeResponsavel: string | null = null;
    if (data.qsa && data.qsa.length > 0) {
      // Procura pelo sócio administrador primeiro
      const administrador = data.qsa.find((socio: any) => 
        socio.qualificacao_socio?.toLowerCase().includes('administrador') ||
        socio.qualificacao_socio?.toLowerCase().includes('diretor')
      );
      
      if (administrador) {
        nomeResponsavel = administrador.nome_socio;
      } else {
        // Se não encontrar administrador, pega o primeiro sócio
        nomeResponsavel = data.qsa[0].nome_socio;
      }
      
      // Formata o nome (capitaliza corretamente)
      if (nomeResponsavel) {
        nomeResponsavel = nomeResponsavel
          .toLowerCase()
          .split(' ')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    }
    
    // Se não tem sócio, tenta usar nome fantasia ou razão social
    if (!nomeResponsavel && data.nome_fantasia) {
      // Extrai primeiro nome do nome fantasia se parecer ser de pessoa
      const nomeFantasia = data.nome_fantasia;
      if (nomeFantasia && !nomeFantasia.includes('LTDA') && !nomeFantasia.includes('S/A')) {
        const palavras = nomeFantasia.split(' ');
        if (palavras.length <= 3 && palavras[0].length > 2) {
          nomeResponsavel = palavras[0].charAt(0).toUpperCase() + palavras[0].slice(1).toLowerCase();
        }
      }
    }
    
    const cnpjData: CNPJData = {
      razao_social: data.razao_social || null,
      nome_responsavel: nomeResponsavel,
      telefone: data.ddd_telefone_1 ? data.ddd_telefone_1.replace(/\D/g, '') : null,
      email: data.email ? data.email.toLowerCase() : null,
      situacao_cadastral: data.descricao_situacao_cadastral || null,
      porte_empresa: data.porte || null,
      cnae_principal: data.cnae_fiscal_descricao || null,
    };
    
    console.log(`✅ Dados CNPJ obtidos:`, {
      razao_social: cnpjData.razao_social,
      nome_responsavel: cnpjData.nome_responsavel,
      situacao: cnpjData.situacao_cadastral,
      porte: cnpjData.porte_empresa,
    });
    
    return cnpjData;
  } catch (error: any) {
    console.error(`❌ Erro ao buscar CNPJ:`, error.message);
    return null;
  }
}

interface PlanoDia {
  dia: number;
  canal: "whatsapp" | "email" | "instagram";
  mensagem: string;
  objecao_provavel: string;
  resposta_sugerida: string;
  cta: string;
}

interface PlanosPorCanal {
  whatsapp?: PlanoDia[];
  email?: PlanoDia[];
  instagram?: PlanoDia[];
}

interface AnaliseResult {
  diagnostico_bullets: string[];
  probabilidade_conversao: number;
  plano_prospeccao_7dias: PlanosPorCanal;
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
    email: null,
    cnpj: null,
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

    // ========================================
    // DETECÇÃO DE EMAIL - MÚLTIPLOS PADRÕES
    // ========================================
    
    // Padrão 1: Links mailto:
    const mailtoPattern = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
    const mailtoMatches = html.matchAll(mailtoPattern);
    for (const match of mailtoMatches) {
      if (match[1]) {
        signals.email = match[1].toLowerCase();
        console.log(`✅ Email encontrado via mailto: ${signals.email}`);
        break;
      }
    }

    // Padrão 2: Emails em texto geral (se não encontrou via mailto)
    if (!signals.email) {
      // Regex para emails - exclui domínios comuns de imagens/assets
      const emailTextPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
      const emailMatches = html.match(emailTextPattern);
      
      if (emailMatches && emailMatches.length > 0) {
        // Filtra emails inválidos ou de domínios de sistema
        const excludedDomains = ['example.com', 'sentry.io', 'wixpress.com', 'google.com', 'facebook.com', 'twitter.com', 'instagram.com'];
        const excludedPatterns = ['noreply', 'no-reply', 'donotreply', 'mailer-daemon'];
        
        for (const email of emailMatches) {
          const emailLower = email.toLowerCase();
          const domain = emailLower.split('@')[1];
          
          // Pula emails de sistema ou domínios excluídos
          if (excludedDomains.some(d => domain?.includes(d))) continue;
          if (excludedPatterns.some(p => emailLower.includes(p))) continue;
          
          // Email válido encontrado
          signals.email = emailLower;
          console.log(`✅ Email encontrado via texto: ${signals.email}`);
          break;
        }
      }
    }

    // Padrão 3: Busca por contexto (email perto de palavras-chave)
    if (!signals.email) {
      const emailContextPatterns = [
        /(?:contato|email|e-mail|fale\s*conosco|atendimento)[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
        /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?:[:\s]*(?:contato|email|e-mail))/gi,
      ];
      
      for (const pattern of emailContextPatterns) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            signals.email = match[1].toLowerCase();
            console.log(`✅ Email encontrado via contexto: ${signals.email}`);
            break;
          }
        }
        if (signals.email) break;
      }
    }

    // ========================================
    // DETECÇÃO DE CNPJ - MÚLTIPLOS PADRÕES
    // ========================================
    
    // Padrão 1: CNPJ formatado (XX.XXX.XXX/XXXX-XX)
    const cnpjFormattedPattern = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;
    const cnpjFormattedMatches = html.match(cnpjFormattedPattern);
    if (cnpjFormattedMatches && cnpjFormattedMatches.length > 0) {
      signals.cnpj = cnpjFormattedMatches[0].replace(/\D/g, '');
      console.log(`✅ CNPJ encontrado (formatado): ${signals.cnpj}`);
    }
    
    // Padrão 2: CNPJ não formatado (14 dígitos) perto de palavras-chave
    if (!signals.cnpj) {
      const cnpjContextPattern = /(?:cnpj|inscri[çc][aã]o)[:\s]*(\d{14}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/gi;
      const cnpjContextMatches = html.matchAll(cnpjContextPattern);
      for (const match of cnpjContextMatches) {
        if (match[1]) {
          signals.cnpj = match[1].replace(/\D/g, '');
          console.log(`✅ CNPJ encontrado (contexto): ${signals.cnpj}`);
          break;
        }
      }
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
        whatsapp_number: directLead.whatsapp_number as string | null,
        email: directLead.email as string | null,
        has_meta_pixel: (directLead.has_meta_pixel as boolean) || false,
        has_gtag: (directLead.has_gtag as boolean) || false,
        has_gtm: (directLead.has_gtm as boolean) || false,
        instagram_url: directLead.instagram_url as string | null,
        instagram_context: directLead.instagram_context as string | null,
        canaisProspeccao: requestData.canaisProspeccao,
        // CNPJ fields
        cnpj: directLead.cnpj as string | null,
        razao_social: directLead.razao_social as string | null,
        nome_responsavel: directLead.nome_responsavel as string | null,
        situacao_cadastral: directLead.situacao_cadastral as string | null,
        porte_empresa: directLead.porte_empresa as string | null,
        cnae_principal: directLead.cnae_principal as string | null,
      };
      
      console.log("✅ Lead carregado:", leadData.nome);
      console.log("📧 Email existente:", leadData.email);
      console.log("📱 WhatsApp existente:", leadData.whatsapp_number);
      console.log("📸 Instagram existente:", leadData.instagram_url);
      console.log("👤 Nome responsável existente:", leadData.nome_responsavel);
      
      // RE-ESCANEIA O SITE para detectar novos sinais
      if (websiteUrl) {
        console.log("🔄 Re-escaneando site para detectar sinais atualizados...");
        const newSignals = await scrapeSiteForSignals(websiteUrl);
        
        // Atualiza os sinais - combina existentes com novos
        leadData.whatsapp_on_site = newSignals.whatsapp_on_site || leadData.whatsapp_on_site;
        leadData.whatsapp_number = newSignals.whatsapp_number || leadData.whatsapp_number;
        leadData.email = newSignals.email || leadData.email;
        leadData.has_meta_pixel = newSignals.has_meta_pixel || leadData.has_meta_pixel;
        leadData.has_gtag = newSignals.has_gtag || leadData.has_gtag;
        leadData.has_gtm = newSignals.has_gtm || leadData.has_gtm;
        leadData.instagram_url = newSignals.instagram_url || leadData.instagram_url;
        
        console.log("📧 Email após scraping:", leadData.email);
        console.log("📱 WhatsApp após scraping:", leadData.whatsapp_number);
        console.log("📸 Instagram após scraping:", leadData.instagram_url);
        
        // Se encontrou CNPJ no site e ainda não temos nome_responsavel, busca na BrasilAPI
        if (newSignals.cnpj && !leadData.nome_responsavel) {
          console.log("🏢 CNPJ detectado no site, buscando dados na BrasilAPI...");
          const cnpjData = await fetchCNPJData(newSignals.cnpj);
          
          if (cnpjData) {
            leadData.cnpj = newSignals.cnpj;
            leadData.razao_social = cnpjData.razao_social;
            leadData.nome_responsavel = cnpjData.nome_responsavel;
            leadData.situacao_cadastral = cnpjData.situacao_cadastral;
            leadData.porte_empresa = cnpjData.porte_empresa;
            leadData.cnae_principal = cnpjData.cnae_principal;
            
            // Usa telefone e email do CNPJ se não temos
            if (!leadData.email && cnpjData.email) {
              leadData.email = cnpjData.email;
            }
            
            console.log("👤 Nome responsável encontrado:", leadData.nome_responsavel);
          }
        }
        
        // Atualiza os sinais no banco (campos não criptografados)
        console.log("💾 Atualizando sinais no banco...");
        const updateData: Record<string, any> = {
          whatsapp_on_site: leadData.whatsapp_on_site,
          has_meta_pixel: leadData.has_meta_pixel,
          has_gtag: leadData.has_gtag,
          has_gtm: leadData.has_gtm,
        };
        
        // Se encontrou novo WhatsApp, Instagram ou Email, atualiza
        if (newSignals.whatsapp_number) {
          updateData.whatsapp_number = newSignals.whatsapp_number;
        }
        if (newSignals.instagram_url) {
          updateData.instagram_url = newSignals.instagram_url;
        }
        if (newSignals.email) {
          updateData.email = newSignals.email;
        }
        
        // Atualiza dados de CNPJ se encontrados
        if (leadData.cnpj) {
          updateData.cnpj = leadData.cnpj;
          updateData.razao_social = leadData.razao_social;
          updateData.nome_responsavel = leadData.nome_responsavel;
          updateData.situacao_cadastral = leadData.situacao_cadastral;
          updateData.porte_empresa = leadData.porte_empresa;
          updateData.cnae_principal = leadData.cnae_principal;
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
    } else {
      // Usa os dados passados diretamente
      leadData = {
        nome: requestData.nome,
        nicho: requestData.nicho,
        cidade: requestData.cidade,
        website: requestData.website,
        foco: requestData.foco,
        whatsapp_on_site: requestData.whatsapp_on_site || false,
        whatsapp_number: requestData.whatsapp_number || null,
        email: requestData.email || null,
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
    // Log detailed error server-side only
    console.error("❌ Erro fatal na análise:", {
      message: error.message,
      stack: error.stack,
    });
    
    // Return generic error to client - don't expose internal details
    let clientMessage = "Erro ao analisar lead. Tente novamente.";
    
    // Only show specific messages for known/expected errors
    if (error.message?.includes("Timeout")) {
      clientMessage = "A análise demorou muito. Tente novamente em alguns segundos.";
    } else if (error.message?.includes("API Key")) {
      clientMessage = "Erro de configuração. Entre em contato com o suporte.";
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'ANALYSIS_ERROR',
        message: clientMessage,
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
  const temWhatsApp = lead.whatsapp_on_site || lead.whatsapp_number;
  const temSocial = !!lead.instagram_url;
  const temEmail = !!lead.email;

  // Filtra canais baseado no que foi detectado
  const canaisSelecionados = lead.canaisProspeccao && lead.canaisProspeccao.length > 0 
    ? lead.canaisProspeccao 
    : ["email", "whatsapp"] as ("email" | "whatsapp" | "instagram")[];
  
  const canais = getAvailableChannels(lead, canaisSelecionados);

  // Gera plano de 7 dias para cada canal disponível
  const generatePlanForChannel = (canal: "whatsapp" | "email" | "instagram"): PlanoDia[] => {
    const mensagens = {
      whatsapp: [
        { mensagem: `Olá! Notei que ${lead.nome} está em ${lead.cidade}. Estamos ajudando empresas de ${lead.nicho} a ${getFocoMessage(lead.foco)}. Podemos conversar 5min?`, objecao: "Já temos fornecedor", resposta: "Entendo! Não vim substituir ninguém. Vim mostrar como empresas do seu nicho estão conseguindo resultados complementares.", cta: "Responda 'sim' se topar uma conversa" },
        { mensagem: `Oi! Vi que vocês trabalham com ${lead.nicho}. Temos cases específicos desse nicho que estão gerando ótimos resultados com ${lead.foco}. Posso compartilhar?`, objecao: "Não tenho orçamento", resposta: "Sem problema! Minha ideia é mostrar o potencial primeiro. Investimento só quando fizer sentido.", cta: "Responda 'pode ser' para continuar" },
        { mensagem: `Case rápido: empresa de ${lead.nicho} aumentou ${getFocoMetric(lead.foco)} em 3 meses. Seu caso é parecido. Posso enviar o resumo?`, objecao: "Estou ocupado", resposta: "Por isso preparei algo objetivo: 1 página, 3 números. Lê em 2 minutos.", cta: "Responda 'manda'" },
        { mensagem: `Preparei uma análise rápida da presença digital de vocês. Identifiquei 3 oportunidades de ${lead.foco}. Quer receber?`, objecao: "Como sei que funciona?", resposta: "Mostro o plano antes, você aprova cada etapa. Se não bater meta, ajusto sem custo.", cta: "Responda para receber" },
        { mensagem: `${lead.nome} tem potencial enorme em ${lead.nicho}. Montei uma proposta focada em ${lead.foco}. 15min de call pra mostrar?`, objecao: "Preciso pensar", resposta: "Claro! Na call mostro números, prazos e investimento. Aí dá pra decidir.", cta: "Escolha dia/hora" },
        { mensagem: `Deixo aqui uma proposta completa: escopo, cronograma e garantias. Sem pressão, só informação pra você decidir.`, objecao: "Vou deixar pra depois", resposta: "Cada mês sem otimizar é oportunidade perdida. Que tal um teste de 30 dias?", cta: "Quer ver a proposta?" },
        { mensagem: `Última mensagem: fico à disposição. Se mudar de ideia sobre ${lead.foco}, é só chamar. Sucesso! 🚀`, objecao: "Vou entrar em contato depois", resposta: "Combinado! Salva meu contato. Qualquer coisa, pode chamar!", cta: "Salve meu contato" },
      ],
      email: [
        { mensagem: `Assunto: Oportunidade ${lead.foco} para ${lead.nome}\n\nOlá,\n\nIdentifiquei que ${lead.nome} atua em ${lead.nicho} em ${lead.cidade}. Temos ajudado empresas similares a ${getFocoMessage(lead.foco)}.\n\nPodemos agendar uma conversa de 15 minutos?`, objecao: "Já temos fornecedor", resposta: "Entendo perfeitamente. Nossa proposta é complementar - muitos clientes mantêm parcerias existentes.", cta: "Clique aqui para agendar" },
        { mensagem: `Assunto: Case ${lead.nicho} - ${getFocoMetric(lead.foco)}\n\nOlá,\n\nCompartilho um case de empresa de ${lead.nicho} que obteve resultados expressivos com nossa metodologia de ${lead.foco}.\n\nGostaria de conhecer os detalhes?`, objecao: "Não tenho orçamento", resposta: "Trabalhamos com diferentes modelos de investimento. Vamos primeiro entender as necessidades.", cta: "Responda este email" },
        { mensagem: `Assunto: Diagnóstico gratuito ${lead.nome}\n\nOlá,\n\nPreparei uma análise preliminar da presença digital de vocês. Identifiquei oportunidades imediatas em ${lead.foco}.\n\nPosso enviar o relatório completo?`, objecao: "Estou ocupado", resposta: "O relatório é objetivo: 1 página com dados e recomendações práticas.", cta: "Responda 'sim'" },
        { mensagem: `Assunto: Proposta personalizada ${lead.foco}\n\nOlá,\n\nCom base na análise do seu negócio, elaborei uma proposta focada em ${lead.foco} com metas claras e mensuráveis.\n\nGostaria de receber?`, objecao: "Como sei que funciona?", resposta: "Trabalhamos com métricas transparentes e relatórios mensais. Você acompanha cada resultado.", cta: "Agendar apresentação" },
        { mensagem: `Assunto: Follow-up ${lead.nome}\n\nOlá,\n\nEntro em contato para verificar seu interesse em discutir as oportunidades de ${lead.foco} que identifiquei.\n\nQue tal agendarmos uma call esta semana?`, objecao: "Preciso pensar", resposta: "Claro! Na call apresento todos os detalhes para sua decisão informada.", cta: "Escolha o melhor horário" },
        { mensagem: `Assunto: Última tentativa - ${lead.nome}\n\nOlá,\n\nSei que está avaliando. Deixo disponível nossa proposta completa com escopo e garantias.\n\nEstou à disposição para esclarecer qualquer dúvida.`, objecao: "Vou deixar pra depois", resposta: "Sem problema. Meu contato fica disponível quando for o momento certo.", cta: "Acesse a proposta" },
        { mensagem: `Assunto: Até logo, ${lead.nome}\n\nOlá,\n\nRespeito seu tempo e prioridades atuais. Fico à disposição quando ${lead.foco} for prioridade.\n\nSucesso nos seus projetos!`, objecao: "Vou entrar em contato depois", resposta: "Combinado! Mantenho seu contato e fico disponível.", cta: "Salve meu contato" },
      ],
      instagram: [
        { mensagem: `Oi! Vi que vocês fazem um trabalho incrível com ${lead.nicho} aqui em ${lead.cidade}. Curti muito o conteúdo! 👏`, objecao: "Quem é você?", resposta: "Sou especialista em ${lead.foco} e ajudo empresas como a de vocês a crescerem.", cta: "Posso te mostrar como?" },
        { mensagem: `Adorei o post sobre [tema]. Empresas de ${lead.nicho} têm muito potencial com ${lead.foco}. Posso compartilhar uma ideia?`, objecao: "Não preciso", resposta: "Entendo! Só queria mostrar uma oportunidade que vi no mercado.", cta: "Aceita uma dica?" },
        { mensagem: `Vi que vocês têm bastante engajamento! Isso é ótimo sinal. Com ${lead.foco} dá pra converter mais dessa audiência.`, objecao: "Já fazemos isso", resposta: "Boa! Mas sempre dá pra otimizar. Posso mostrar o que tem funcionado.", cta: "Quer ver um case?" },
        { mensagem: `Case rápido: empresa de ${lead.nicho} aumentou vendas com estratégia de ${lead.foco}. Lembrei de vocês!`, objecao: "Estou ocupado", resposta: "É bem rápido! Só uma ideia que pode fazer diferença.", cta: "1 minuto?" },
        { mensagem: `Oi! Continuo acompanhando o trabalho de vocês. Preparei algo sobre ${lead.foco} que pode ajudar.`, objecao: "Não conheço seu trabalho", resposta: "Posso te mostrar! Temos cases no seu nicho.", cta: "Te mando?" },
        { mensagem: `Última vez que passo por aqui: tenho uma proposta pronta pra ${lead.nome}. Sem pressão!`, objecao: "Não é prioridade", resposta: "Sem problema! Fica a dica pra quando for o momento.", cta: "Posso enviar?" },
        { mensagem: `Sucesso aí com ${lead.nome}! Qualquer coisa sobre ${lead.foco}, me chama! 🚀`, objecao: "Vou ver depois", resposta: "Combinado! Tô por aqui se precisar.", cta: "Me segue pra gente trocar mais ideias" },
      ],
    };

    return mensagens[canal].map((item, index) => ({
      dia: index + 1,
      canal,
      mensagem: item.mensagem,
      objecao_provavel: item.objecao,
      resposta_sugerida: item.resposta,
      cta: item.cta,
    }));
  };

  // Monta o objeto de planos por canal (apenas canais detectados)
  const planosPorCanal: PlanosPorCanal = {};

  // Gera plano específico para cada canal detectado
  if (canais.includes("whatsapp")) {
    planosPorCanal.whatsapp = generatePlanForChannel("whatsapp");
  }
  if (canais.includes("email")) {
    planosPorCanal.email = generatePlanForChannel("email");
  }
  if (canais.includes("instagram")) {
    planosPorCanal.instagram = generatePlanForChannel("instagram");
  }

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
    plano_prospeccao_7dias: planosPorCanal,
  };
}

async function analyzeWithAI(lead: LeadData, apiKey: string): Promise<AnaliseResult> {
  // Canais selecionados pelo usuário (originais)
  const canaisSelecionados = lead.canaisProspeccao && lead.canaisProspeccao.length > 0 
    ? lead.canaisProspeccao 
    : ["email", "whatsapp"] as ("email" | "whatsapp" | "instagram")[];
  
  // Filtra para apenas canais realmente detectados
  const canaisDisponiveis = getAvailableChannels(lead, canaisSelecionados);
  
  // Verifica se Instagram foi selecionado mas não detectado
  const instagramSelecionadoMasNaoDetectado = canaisSelecionados.includes("instagram") && !lead.instagram_url;
  
  // Cria uma versão do lead com os canais DETECTADOS (não os selecionados)
  const leadComCanaisDisponiveis = {
    ...lead,
    canaisProspeccao: canaisDisponiveis,
    // Passa info adicional para o prompt saber que Instagram foi selecionado mas não detectado
    _instagramSelecionadoMasNaoDetectado: instagramSelecionadoMasNaoDetectado,
    _canaisSelecionadosOriginais: canaisSelecionados,
  };
  
  const prompt = buildAnalysisPrompt(leadComCanaisDisponiveis as LeadData & { _instagramSelecionadoMasNaoDetectado?: boolean; _canaisSelecionadosOriginais?: ("email" | "whatsapp" | "instagram")[] });

  console.log("Iniciando análise com OpenAI para:", lead.nome);
  console.log("Canais SELECIONADOS pelo usuário:", canaisSelecionados.join(", "));
  console.log("Canais DETECTADOS e disponíveis para prospecção:", canaisDisponiveis.length > 0 ? canaisDisponiveis.join(", ") : "NENHUM");
  if (instagramSelecionadoMasNaoDetectado) {
    console.log("⚠️ Instagram foi selecionado mas NÃO foi detectado - sugestões irão para diagnóstico");
  }

  const canaisPermitidos = canaisDisponiveis;

  try {
    const systemPrompt = `Você atua **APENAS** na criação do **plano de prospecção de 7 dias**, como um **COPYWRITER E ESTRATEGISTA DE VENDAS com mais de 15 anos de experiência**.

🏆 ESPECIALIDADES:
• Vendas B2B e prospecção de alto ticket
• Serviços de marketing digital (Tráfego, SEO, Social, Full Service, Automação, CRM, Sites/Landing, Design)
• Prospecção multicanal (WhatsApp, Email, Instagram)

📜 REGRAS DE OURO DO COPYWRITER (INEGOCIÁVEIS):
1. Linguagem CLARA, INTELIGENTE e PERSUASIVA
2. Frases CURTAS e DIRETAS, sem enrolação
3. Tom: PROFISSIONAL falando com PROFISSIONAL (dono/gestor)
4. Emojis: MÁXIMO 2 por mensagem, APENAS quando fizer sentido
5. NUNCA use clichês: "explodir resultados", "escalar", "destravar", "bombar", "rios de dinheiro"
6. NUNCA promessas milagrosas: "+327% em 7 dias", "garantido", "ficar milionário"
7. NUNCA invente números específicos sem dados do contexto
8. Cada mensagem deve passar no teste "E daí?" (So what?)
9. Abra loops de curiosidade que só fecham na resposta
10. Termine SEMPRE com pergunta que demanda resposta

🎭 POSTURA B2B PROFISSIONAL:
• Consultivo e direto - postura de especialista que entrega valor
• Autoridade sem arrogância
• Foco em resultados e ROI
• NUNCA use: "pessoal", "galera", "vocês aí", "olá tudo bem?"
• TOM: Consultor de negócios, NÃO vendedor pedindo atenção`;

    const requestBody = {
      model: "gpt-4o-mini",
      max_completion_tokens: 6000,
      messages: [
        {
          role: "system",
          content: systemPrompt,
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
                  type: "object",
                  description: "Planos de 7 dias SEPARADOS para CADA canal disponível. CADA canal deve ter sua própria progressão única de 7 dias.",
                  properties: {
                    whatsapp: canaisPermitidos.includes("whatsapp") ? {
                      type: "array",
                      description: "7 dias de cadência EXCLUSIVA para WhatsApp com progressão única",
                      items: {
                        type: "object",
                        properties: {
                          dia: { type: "number", minimum: 1, maximum: 7 },
                          canal: { type: "string", enum: ["whatsapp"] },
                          mensagem: { type: "string" },
                          objecao_provavel: { type: "string" },
                          resposta_sugerida: { type: "string" },
                          cta: { type: "string" },
                        },
                        required: ["dia", "canal", "mensagem", "objecao_provavel", "resposta_sugerida", "cta"],
                      },
                      minItems: 7,
                      maxItems: 7,
                    } : undefined,
                    email: canaisPermitidos.includes("email") ? {
                      type: "array",
                      description: "7 dias de cadência EXCLUSIVA para Email com progressão única",
                      items: {
                        type: "object",
                        properties: {
                          dia: { type: "number", minimum: 1, maximum: 7 },
                          canal: { type: "string", enum: ["email"] },
                          mensagem: { type: "string" },
                          objecao_provavel: { type: "string" },
                          resposta_sugerida: { type: "string" },
                          cta: { type: "string" },
                        },
                        required: ["dia", "canal", "mensagem", "objecao_provavel", "resposta_sugerida", "cta"],
                      },
                      minItems: 7,
                      maxItems: 7,
                    } : undefined,
                    instagram: canaisPermitidos.includes("instagram") ? {
                      type: "array",
                      description: "7 dias de cadência EXCLUSIVA para Instagram DM com progressão única",
                      items: {
                        type: "object",
                        properties: {
                          dia: { type: "number", minimum: 1, maximum: 7 },
                          canal: { type: "string", enum: ["instagram"] },
                          mensagem: { type: "string" },
                          objecao_provavel: { type: "string" },
                          resposta_sugerida: { type: "string" },
                          cta: { type: "string" },
                        },
                        required: ["dia", "canal", "mensagem", "objecao_provavel", "resposta_sugerida", "cta"],
                      },
                      minItems: 7,
                      maxItems: 7,
                    } : undefined,
                  },
                  required: canaisPermitidos,
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
      
      // A IA agora retorna diretamente no formato por canal
      const planosPorCanal = analise.plano_prospeccao_7dias as PlanosPorCanal;
      
      // Valida que cada canal tenha 7 dias
      const canaisRetornados = Object.keys(planosPorCanal) as ("whatsapp" | "email" | "instagram")[];
      for (const canal of canaisRetornados) {
        const planoCanalData = planosPorCanal[canal];
        if (!planoCanalData || !Array.isArray(planoCanalData) || planoCanalData.length !== 7) {
          console.warn(`⚠️ Canal ${canal} não tem 7 dias, ignorando...`);
          delete planosPorCanal[canal];
        }
      }
      
      // Verifica se pelo menos um canal foi retornado com sucesso
      const canaisValidos = Object.keys(planosPorCanal).filter(c => planosPorCanal[c as keyof PlanosPorCanal]?.length === 7);
      if (canaisValidos.length === 0) {
        throw new Error("Análise incompleta: nenhum canal com plano de 7 dias válido");
      }
      
      console.log(`✅ Planos gerados para canais: ${canaisValidos.join(", ")}`);
      
      // Atualiza o resultado com os planos validados
      analise.plano_prospeccao_7dias = planosPorCanal;

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

function buildAnalysisPrompt(lead: LeadData & { _instagramSelecionadoMasNaoDetectado?: boolean; _canaisSelecionadosOriginais?: ("email" | "whatsapp" | "instagram")[] }): string {
  // Estes canais já vêm filtrados baseado no que foi DETECTADO (não os selecionados)
  const canais = lead.canaisProspeccao && lead.canaisProspeccao.length > 0 
    ? lead.canaisProspeccao 
    : [];
  
  const nenhumCanalDetectado = canais.length === 0;
  
  // Verifica se Instagram foi selecionado mas não detectado (para adicionar sugestões ao diagnóstico)
  const instagramSelecionadoMasNaoDetectado = lead._instagramSelecionadoMasNaoDetectado || false;
  const instagramVariations = instagramSelecionadoMasNaoDetectado 
    ? generateInstagramVariations(lead.nome, lead.cidade)
    : [];
  
  const canalTexto = canais.length > 0 
    ? canais.map(c => {
        if (c === "email") return "Email";
        if (c === "whatsapp") return "WhatsApp";
        if (c === "instagram") return "Instagram DM";
        return c;
      }).join(", ")
    : "NENHUM CANAL DETECTADO";
  
  // Cadência multicanal inteligente
  let estrategiaCadencia = "";
  if (nenhumCanalDetectado) {
    estrategiaCadencia = "⚠️ NENHUM CANAL DETECTADO - Crie plano focado em ENCONTRAR o contato (ligação, visita presencial, LinkedIn, busca de redes)";
  } else if (canais.length === 1) {
    estrategiaCadencia = `Use SOMENTE ${canalTexto} para todos os 7 dias com variações criativas de abordagem`;
  } else if (canais.length === 2) {
    estrategiaCadencia = `CADÊNCIA 2 CANAIS (${canalTexto}):
• Dias 1, 3, 5, 7: ${canais[0] === "whatsapp" ? "WhatsApp" : canais[0] === "email" ? "Email" : "Instagram"}
• Dias 2, 4, 6: ${canais[1] === "whatsapp" ? "WhatsApp" : canais[1] === "email" ? "Email" : "Instagram"}
REGRA: Nunca usar o mesmo canal 2 dias consecutivos`;
  } else if (canais.length === 3) {
    estrategiaCadencia = `CADÊNCIA 3 CANAIS (WhatsApp + Email + Instagram):
• Dia 1: WhatsApp - Primeiro contato, direto e curto
• Dia 2: Email - Formalização, proposta de valor estruturada
• Dia 3: Instagram DM - Engajamento social, referência a conteúdo
• Dia 4: WhatsApp - Follow-up rápido, resposta a silêncio
• Dia 5: Email - Conteúdo mais denso, case ou proposta
• Dia 6: Instagram DM - Segunda tentativa social
• Dia 7: WhatsApp - Encerramento profissional
REGRA: Nunca usar o mesmo canal 2 dias consecutivos`;
  }
  
  // Status detalhado dos canais
  const canaisInfo = [];
  if (lead.whatsapp_on_site || lead.whatsapp_number) {
    canaisInfo.push(`✅ WhatsApp: DISPONÍVEL${lead.whatsapp_number ? ` (${lead.whatsapp_number})` : " (detectado no site)"}`);
  } else {
    canaisInfo.push("❌ WhatsApp: NÃO DETECTADO - NÃO USAR!");
  }
  if (lead.email) {
    canaisInfo.push(`✅ Email: DISPONÍVEL (${lead.email})`);
  } else {
    canaisInfo.push("❌ Email: NÃO DETECTADO - NÃO USAR!");
  }
  // Instagram: usa instagramVariations já calculada no início da função
  if (lead.instagram_url) {
    canaisInfo.push(`✅ Instagram: DISPONÍVEL (${lead.instagram_url})`);
  } else if (instagramSelecionadoMasNaoDetectado) {
    canaisInfo.push(`⚠️ Instagram: SELECIONADO pelo usuário mas NÃO DETECTADO no site
    SUGESTÕES DE PERFIL para o DIAGNÓSTICO (NÃO para o plano):
    ${instagramVariations.join(", ")}
    IMPORTANTE: NÃO use Instagram no plano de 7 dias! Apenas mencione as sugestões no diagnóstico.`);
  } else {
    canaisInfo.push("❌ Instagram: NÃO SELECIONADO");
  }
    
  const sinaisMarketing = [];
  if (lead.has_meta_pixel) sinaisMarketing.push("✓ Meta Pixel instalado");
  if (lead.has_gtag) sinaisMarketing.push("✓ Google Analytics ativo");
  if (lead.has_gtm) sinaisMarketing.push("✓ Google Tag Manager configurado");
  if (lead.whatsapp_on_site || lead.whatsapp_number) sinaisMarketing.push("✓ WhatsApp no site");
  if (lead.instagram_url) sinaisMarketing.push(`✓ Instagram ativo: ${lead.instagram_url}`);
  if (lead.email) sinaisMarketing.push(`✓ Email de contato: ${lead.email}`);

  // Instruções específicas por canal
  const instrucoesPorCanal = `
═══════════════════════════════════════
📱 REGRAS POR CANAL (OBEDEÇA RIGOROSAMENTE)
═══════════════════════════════════════

${canais.includes("whatsapp") ? `
💬 WHATSAPP - ABORDAGEM B2B CONSULTIVA:
• Máximo 4 linhas por mensagem (quebra em parágrafos curtos)
• Entre direto no VALOR - sem "olá tudo bem" ou "pessoal"
• 1-2 emojis estratégicos no máximo (não decorativos)
• Postura de consultor que identificou oportunidade
• Tom profissional e direto, não coloquial
• NUNCA comece com saudações vazias - lidere com insight

❌ EVITAR (WhatsApp):
"Olá! Tudo bem? Meu nome é X da empresa Y e gostaria de..."
"Pessoal da empresa, vi que vocês..." (muito informal)
"João, vi que a empresa..." (NÃO INVENTE NOMES!)

✅ USAR (WhatsApp):
"${lead.nome}, analisei o setor de ${lead.nicho} em ${lead.cidade}. Identifiquei um gap que está custando clientes: [gap específico]. Empresas similares corrigiram isso e viram aumento de 3x em leads. Faz sentido uma conversa de 5 min?"
` : ""}

${canais.includes("email") ? `
✉️ EMAIL - ESTRUTURA B2B CONSULTIVA:
• Assunto: direto ao ponto + urgência implícita (máx 50 caracteres)
  Ex: "Oportunidade identificada - ${lead.nome}"
  Ex: "Diagnóstico rápido: ${lead.nicho} em ${lead.cidade}"
  Ex: "3 gaps custando clientes - ${lead.nome}"
• Abertura: vá direto à análise/descoberta (não sobre você)
• Corpo: diagnóstico + evidência + próximo passo (máx 150 palavras)
• Fechamento: convite claro e de baixo compromisso
• PS: reforço de credibilidade ou escassez (opcional)

❌ EVITAR (Email):
"Prezado(a), venho por meio desta apresentar nossa empresa..."
"Olá, equipe da..." ou "Pessoal da..." (informal demais)
"Oi João," (NÃO INVENTE NOMES!)

✅ USAR (Email):
"Assunto: Diagnóstico rápido - ${lead.nome}

Analisei a presença digital da ${lead.nome} e identifiquei 3 gaps que estão custando clientes:

1. [Gap específico sobre presença digital]
2. [Oportunidade não explorada em ${lead.foco}]
3. [Vantagem competitiva não aproveitada]

Empresas do mesmo porte em ${lead.cidade} já corrigiram isso e viram aumento médio de [X%] em [métrica].

Vale 10 minutos para mostrar como aplicar isso no caso de vocês?

[Assinatura]

PS: Sem compromisso. Se não fizer sentido, agradeço pela atenção e sigo em frente."
` : ""}

${canais.includes("instagram") ? `
📸 INSTAGRAM DM - ABORDAGEM CONSULTIVA AVANÇADA:

${!lead.instagram_url ? `
⚠️ ATENÇÃO: Instagram SELECIONADO mas NÃO DETECTADO no site!

📋 HANDLES SUGERIDOS (gerados automaticamente baseado no nome):
${generateInstagramVariations(lead.nome, lead.cidade).map(v => `• ${v}`).join("\n")}

Para dias de Instagram no plano, a mensagem DEVE incluir:
1. PRIMEIRO: Instrução para o usuário VERIFICAR se um desses handles existe
2. Alternativamente: "Pesquise '${lead.nome} ${lead.cidade}' diretamente no Instagram"
3. "Verifique o Google Maps ou site oficial para link direto do Instagram"
4. DEPOIS: Template de mensagem para usar quando encontrar o perfil

Após encontrar, use o template de DM abaixo.
` : ""}

🔑 PRÉ-ABORDAGEM (RECOMENDADO):
Antes de enviar DM, engaje genuinamente:
• Curta 2-3 posts recentes
• Comente com insight relevante (NÃO só "muito bom! 🔥")
• Visualize stories se disponível
• Isso aquece o perfil e aumenta chance de resposta

📐 ESTRUTURA DA MENSAGEM (MÁX 4 LINHAS):
• Linha 1: Referência específica ao conteúdo/perfil deles
• Linha 2: Conexão com oportunidade identificada
• Linha 3-4: CTA de baixo compromisso
• 1 emoji estratégico MÁXIMO (ou nenhum)

✅ EXEMPLOS DE DM PROFISSIONAL:

Dia 3 (primeira DM após engajamento):
"Vi que ${lead.nome} está crescendo em ${lead.cidade}. Analisei o perfil e identifiquei uma oportunidade em ${lead.foco} que poucas empresas de ${lead.nicho} estão explorando. Posso enviar um diagnóstico rápido por aqui?"

Dia 6 (segunda DM se não respondeu):
"Última mensagem por aqui. O insight sobre ${lead.foco} para ${lead.nicho} ainda vale - é uma oportunidade real. Se fizer sentido, me responde 'ok' que envio em 30 segundos."

💡 VANTAGENS DO INSTAGRAM para prospecção B2B:
• Resposta mais rápida que email
• Tom mais profissional que WhatsApp pessoal
• Permite ver conteúdo e entender melhor o prospect
• Menos saturado que outros canais

❌ EVITAR (Instagram):
• Mensagens longas demais (serão ignoradas)
• "Olá, somos uma agência de marketing e gostaríamos de apresentar nossos serviços..." (spam puro)
• Comentários genéricos antes da DM ("Adorei!", "Top!", "🔥🔥")
• Enviar DM sem nenhum engajamento prévio (parece stalker)
• Elogios vazios sem conexão com negócio

✅ EXEMPLO DE COMENTÁRIO PRÉ-DM:
"Interessante a abordagem sobre [tema específico do post]. No setor de ${lead.nicho}, isso é crucial porque [insight rápido]."
` : ""}`;

  // Instruções de objeções avançadas
  const instrucoesObjecoes = `
═══════════════════════════════════════
🚫 OBJEÇÕES - FORMATO AVANÇADO (OBRIGATÓRIO)
═══════════════════════════════════════

Cada objeção deve ser:
• A FRASE EXATA como o cliente diria (entre aspas)
• Realista para aquele estágio do funil B2B
• Progressiva (objeções mais duras nos dias finais)

OBJEÇÕES B2B REAIS POR ESTÁGIO:

📅 Dia 1-2 (DESCONFIANÇA INICIAL):
• "Quem é você e como conseguiu meu contato?"
• "Não solicitei nenhum contato"
• "Estou ocupado, não é um bom momento"
• "Vocês são de onde?"

📅 Dia 3-4 (RESISTÊNCIA ESTRUTURAL):
• "Já trabalhamos com uma agência/profissional"
• "Não temos orçamento para isso no momento"
• "Isso não é prioridade para a empresa agora"
• "Nossa diretoria não aprovou investimentos em marketing"
• "O último fornecedor não entregou resultados"

📅 Dia 5-6 (HESITAÇÃO DE DECISÃO):
• "Preciso conversar com meu sócio/diretor"
• "Me manda uma proposta por email que eu avalio"
• "Vou analisar internamente e retorno"
• "Quanto custa? Me passa os valores"
• "Não tenho tempo para reuniões agora"

📅 Dia 7 (REJEIÇÃO FINAL OU SILÊNCIO):
• "Não tenho interesse, obrigado"
• "Não me procure mais, por favor"
• [Silêncio total / Visualizou e não respondeu]
• "Vou te chamar quando precisar"

═══════════════════════════════════════
💬 RESPOSTAS B2B CONSULTIVAS (OBRIGATÓRIO)
═══════════════════════════════════════

ESTRUTURA DE RESPOSTA PROFISSIONAL:
1. RECONHECER (sem bajular): "Compreendo perfeitamente..."
2. REPOSICIONAR com dado/insight: "O que observamos no mercado é que..."
3. EVIDÊNCIA rápida: número, case anônimo, comparação de mercado
4. PRÓXIMO PASSO de baixo atrito

EXEMPLOS DE RESPOSTAS B2B POR OBJEÇÃO:

❓ "Já trabalhamos com uma agência"
✅ "Faz sentido. Inclusive, não estou sugerindo substituição. A maioria dos clientes que atendemos já tinham parceiros. O que identificamos foi uma oportunidade específica em [área] que complementa o trabalho atual. Se não fizer sentido, pelo menos sai com um diagnóstico gratuito. 10 minutos?"

❓ "Não temos orçamento"
✅ "Compreendo. E se eu te mostrasse uma análise de quanto vocês estão deixando de faturar por não explorar [oportunidade específica]? Muitas vezes o 'orçamento' aparece quando o ROI fica claro. Posso enviar esse diagnóstico sem compromisso?"

❓ "Preciso falar com meu sócio"
✅ "Claro. Inclusive, posso preparar um resumo executivo de 1 página com os pontos principais para facilitar essa conversa? Assim vocês avaliam com as informações certas em mãos."

❓ "Me manda proposta por email"
✅ "Posso enviar. Mas antes de mandar algo genérico, preciso de 5 minutos para entender 2-3 pontos específicos do negócio de vocês. Assim a proposta já vem personalizada e com projeção de retorno. Amanhã às 10h ou prefere às 14h?"

❓ "Não tenho interesse"
✅ "Entendido. Agradeço a clareza. Se em algum momento fizer sentido revisitar [oportunidade específica], deixo meu contato à disposição. Sucesso com os projetos atuais."

❓ [Silêncio / Não respondeu]
✅ "Última mensagem, sem insistência. Se o timing não for agora, tudo bem. Deixo registrado a oportunidade que identifiquei em [área]. Quando fizer sentido, estou aqui."

TÉCNICAS CONSULTIVAS OBRIGATÓRIAS:
• Isolamento: "Tirando a questão de orçamento, faria sentido estrategicamente?"
• Reframe de valor: Transformar custo em investimento com ROI projetado
• Prova anônima: "Uma empresa do mesmo porte em ${lead.cidade}..."
• Pergunta diagnóstica: "Me ajuda a entender: vocês medem [métrica] atualmente?"
• Escassez real: Limitar disponibilidade de agenda, não inventar urgência falsa`;

  // Progressão de CTAs
  const instrucoesCTAs = `
═══════════════════════════════════════
🎯 PROGRESSÃO DE CTAs B2B (7 DIAS) - OBRIGATÓRIO
═══════════════════════════════════════

CTAs devem escalar em compromisso de forma profissional:

• Dia 1: VALIDAÇÃO DE INTERESSE
  "Vale uma conversa de 5 minutos ou não faz sentido agora?"
  "Isso é relevante para vocês ou posso seguir em frente?"

• Dia 2: ENTREGA DE VALOR
  "Posso enviar o diagnóstico que preparei?"
  "Quer que eu compartilhe a análise?"

• Dia 3: PROVA DE RESULTADO
  "Posso mostrar um case similar do setor de ${lead.nicho}?"
  "Tenho um comparativo de mercado - envio?"

• Dia 4: CONVERSA ESTRUTURADA
  "15 minutos para apresentar os pontos principais - funciona?"
  "Uma call rápida para alinhar expectativas?"

• Dia 5: AGENDAMENTO DIRETO
  "Tenho disponibilidade amanhã às 10h ou às 15h. Qual funciona melhor?"
  "Conseguimos encaixar essa semana?"

• Dia 6: URGÊNCIA CONTEXTUAL
  "Estou fechando a agenda do mês. Conseguimos alinhar até sexta?"
  "Última semana com essa condição de entrada"

• Dia 7: ENCERRAMENTO PROFISSIONAL
  "Última mensagem sobre isso. Se o timing mudar, estou à disposição."
  "Agradeço a atenção. Fico disponível quando fizer sentido."

⚠️ CTAs PROIBIDOS (muito genéricos ou informais):
❌ "Fale conosco"
❌ "Entre em contato"
❌ "Aguardo retorno"
❌ "Fico no aguardo"
❌ "Me chama aí"
❌ "Bora conversar?"
❌ "Responde SIM ou NÃO"`;

  return `
════════════════════════════════════════════════════════════════════════════════
🎯 MISSÃO: Gerar plano de prospecção de ELITE para conversão máxima
════════════════════════════════════════════════════════════════════════════════

═══════════════════════════════════════
📊 DADOS DO LEAD
═══════════════════════════════════════
• Empresa: ${lead.nome}
• Nicho: ${lead.nicho}
• Cidade: ${lead.cidade}
• Website: ${lead.website || "Não informado"}
• Foco de Serviço: ${lead.foco}
${lead.cnae_principal ? `• CNAE: ${lead.cnae_principal}` : ""}
${lead.porte_empresa ? `• Porte: ${lead.porte_empresa}` : ""}
${lead.situacao_cadastral ? `• Situação: ${lead.situacao_cadastral}` : ""}

🎯 SINAIS DE MARKETING DETECTADOS:
${sinaisMarketing.length > 0 ? sinaisMarketing.join("\n") : "❌ Nenhum sinal de marketing digital detectado - empresa com baixa maturidade digital"}

🔌 STATUS DOS CANAIS DE CONTATO:
${canaisInfo.join("\n")}

${lead.instagram_context ? `📱 CONTEXTO DO INSTAGRAM:\n${lead.instagram_context}` : ""}

════════════════════════════════════════════════════════════════════════════════
⚠️⚠️⚠️ REGRA CRÍTICA #0 - PERSONALIZAÇÃO DE NOME ⚠️⚠️⚠️
════════════════════════════════════════════════════════════════════════════════

${lead.nome_responsavel 
  ? `✅ NOME DO RESPONSÁVEL DETECTADO: "${lead.nome_responsavel}"

USE ESTE NOME nas mensagens para humanizar a abordagem!
Exemplo: "Oi ${lead.nome_responsavel}, vi que a ${lead.nome} está em ${lead.cidade}..."

IMPORTANTE: Use EXATAMENTE este nome, não invente variações!`
  : `❌ NOME DO RESPONSÁVEL: NÃO DETECTADO

🚫🚫🚫 NUNCA INVENTE NOMES como "João", "Maria", "Carlos", etc! 🚫🚫🚫

Abordagens B2B CORRETAS sem nome pessoal (entre direto no valor):
• "${lead.nome}, identifiquei uma oportunidade..."
• "Analisei a presença digital da ${lead.nome}..."
• "A ${lead.nome} está perdendo clientes em ${lead.cidade} por [motivo]..."
• "${lead.nome}, 3 gaps que identifiquei no setor de ${lead.nicho}..."

❌ ERRADO: "João, vi que a ${lead.nome}..." (NOME INVENTADO!)
❌ ERRADO: "Pessoal da ${lead.nome}, vi que vocês..." (muito informal)
❌ ERRADO: "Olá, equipe da ${lead.nome}," (saudação vazia)
✅ CORRETO: "${lead.nome}, analisei o setor de ${lead.nicho} em ${lead.cidade}..."
✅ CORRETO: "Identifiquei 3 oportunidades para a ${lead.nome}..."`}

════════════════════════════════════════════════════════════════════════════════
⚠️⚠️⚠️ REGRA CRÍTICA #1 - CANAIS DE CONTATO ⚠️⚠️⚠️
════════════════════════════════════════════════════════════════════════════════

${nenhumCanalDetectado 
  ? `🚨 NENHUM CANAL DE CONTATO FOI DETECTADO!

Como não temos email, WhatsApp ou Instagram, crie um plano de whatsapp com 7 dias focado em:
- Use "whatsapp" como canal nos campos (para o sistema aceitar)
- Mas a MENSAGEM deve ser sobre COMO ENCONTRAR o contato:
  • Dia 1-2: Buscar telefone em Google, Reclame Aqui, LinkedIn
  • Dia 3-4: Tentar contato via formulário do site
  • Dia 5-6: Buscar redes sociais alternativas
  • Dia 7: Considerar visita presencial ou carta`
  : `═══════════════════════════════════════
📋 ESTRUTURA DO PLANO - GERAR PLANOS SEPARADOS POR CANAL
═══════════════════════════════════════

🚨 REGRA CRÍTICA: Você DEVE gerar 7 DIAS ÚNICOS para CADA canal detectado!

Canais detectados: ${canalTexto}

${canais.includes("whatsapp") ? `
📱 plano_prospeccao_7dias.whatsapp (OBRIGATÓRIO - 7 dias):
• 7 mensagens ÚNICAS e DIFERENTES de WhatsApp
• Progressão: Dia 1 (apresentação) → Dia 7 (encerramento)
• Tom conversacional B2B, máximo 4 linhas
• Cada dia aborda uma fase diferente do funil` : ""}

${canais.includes("email") ? `
✉️ plano_prospeccao_7dias.email (OBRIGATÓRIO - 7 dias):
• 7 emails ÚNICOS e DIFERENTES
• Progressão: Dia 1 (apresentação) → Dia 7 (encerramento)
• Incluir assunto em cada mensagem
• Estrutura formal, máximo 150 palavras` : ""}

${canais.includes("instagram") ? `
📸 plano_prospeccao_7dias.instagram (OBRIGATÓRIO - 7 dias):
• 7 DMs ÚNICOS e DIFERENTES
• Progressão: Dia 1 (engajamento) → Dia 7 (encerramento)
• Máximo 4 linhas, tom casual-profissional
• Sugestão de pré-engajamento (curtir posts)` : ""}

⚠️ CADA CANAL TEM SUA PRÓPRIA CADÊNCIA DE 7 DIAS!
• Dia 1 do WhatsApp é DIFERENTE do Dia 1 do Email
• Dia 1 do Email é DIFERENTE do Dia 1 do Instagram
• NUNCA repita mensagens entre canais!`}

${!nenhumCanalDetectado ? instrucoesPorCanal : ""}

${instrucoesObjecoes}

${instrucoesCTAs}

═══════════════════════════════════════
📆 DIRETRIZES POR DIA (OBRIGATÓRIO SEGUIR)
═══════════════════════════════════════

DIA 1 - APRESENTAÇÃO + CONTEXTO
• Objetivo: Se apresentar, contextualizar por que está entrando em contato
• Mostrar que conhece o nicho e a cidade do lead
• NADA de vendeção agressiva - foque em curiosidade + empatia
• Tom: "Identifiquei algo interessante sobre sua empresa"

DIA 2 - DOR ESPECÍFICA DO NICHO
• Explorar uma dor específica do nicho, ligada ao FOCO
• Conectar com o que foi visto no site/Instagram (quando houver contexto)
• Tom: "Empresas do seu setor enfrentam esse desafio específico"

DIA 3 - OPORTUNIDADE CLARA
• Mostrar uma oportunidade que a empresa pode estar perdendo
• Sutilmente introduzir sua solução/abordagem
• Tom: "Você pode estar deixando dinheiro na mesa por isso"

DIA 4 - MINI FRAMEWORK / MÉTODO
• Trazer um framework simples de resolver parte do problema
• Mostrar que você tem MÉTODO, não só opinião
• Tom: "Assim que empresas similares estão resolvendo"

DIA 5 - PROVA SOCIAL / CENÁRIO TÍPICO
• Trabalhar prova social ou cenário típico (SEM MENTIR)
• Mostrar como empresas parecidas se beneficiam
• Tom: "Resultado real de quem implementou"

DIA 6 - VISÃO ESTRATÉGICA + PRÓXIMO PASSO
• Reforçar o FOCO (${lead.foco}) com visão estratégica
• Trazer a conversa para um próximo passo concreto (call rápida)
• Tom: "Proposta objetiva de próximo passo"

DIA 7 - ÚLTIMO TOQUE RESPEITOSO
• Tom respeitoso, SEM pressão tóxica
• Deixar claro que não quer incomodar, mas está disponível
• CTA simples e fácil de responder
• Tom: "Última mensagem, respeito sua decisão"

═══════════════════════════════════════
🎯 ADAPTAÇÃO POR FOCO: ${lead.foco}
═══════════════════════════════════════
${lead.foco === "Tráfego" ? `
📣 TRÁFEGO - ARGUMENTAÇÃO ESPECÍFICA:
• Falar de fluxo PREVISÍVEL de leads qualificados
• Campanhas bem estruturadas vs "impulsionar no escuro"
• Dinheiro parado por falta de mídia paga otimizada
• Métricas: CPL (Custo por Lead), ROAS, CAC
• Dor: "Você depende de indicação e boca-a-boca"
• Ganho: "Leads novos entrando todo dia de forma previsível"
` : ""}${lead.foco === "SEO" ? `
🔍 SEO - ARGUMENTAÇÃO ESPECÍFICA:
• Buscas no Google que seus clientes fazem TODO DIA
• Tráfego ORGÂNICO = leads gratuitos no longo prazo
• Efeito composto: resultados acumulam com o tempo
• Autoridade e posicionamento vs concorrentes
• Dor: "Seus concorrentes aparecem primeiro no Google"
• Ganho: "Clientes te encontrando sem pagar por clique"
` : ""}${lead.foco === "Social" ? `
📱 SOCIAL - ARGUMENTAÇÃO ESPECÍFICA:
• Consistência no Instagram como diferencial
• Posicionamento e conexão com seguidores
• Construção de MARCA, não só posts
• Engajamento qualificado vs métricas de vaidade
• Dor: "Posts sem engajamento, seguidores que não compram"
• Ganho: "Comunidade engajada que vira cliente"
` : ""}${lead.foco === "Full Service" ? `
🎯 FULL SERVICE - ARGUMENTAÇÃO ESPECÍFICA:
• Visão 360° - estratégia integrada
• Tráfego + conteúdo + site + social conectados
• Economia de tempo com parceiro único
• ROI geral da operação, não métricas isoladas
• Dor: "Vários fornecedores, nenhum resultado integrado"
• Ganho: "Um parceiro que cuida de tudo com estratégia"
` : ""}${lead.foco === "Automação" ? `
⚙️ AUTOMAÇÃO - ARGUMENTAÇÃO ESPECÍFICA:
• Funis de vendas que rodam sozinhos
• Follow-ups automáticos = leads que não esfriam
• Menos tarefas manuais = mais tempo para o que importa
• Leads esquecidos = dinheiro perdido
• Dor: "Leads entram e ninguém acompanha direito"
• Ganho: "Sistema que nutre leads enquanto você dorme"
` : ""}${lead.foco === "Sites/Landing" ? `
🖥️ SITES/LANDING - ARGUMENTAÇÃO ESPECÍFICA:
• Páginas que CONVERTEM, não só "bonitas"
• Experiência do usuário que guia para ação
• Clareza de oferta em 5 segundos
• Taxa de conversão atual vs potencial
• Dor: "Site que não gera leads, só custa hospedagem"
• Ganho: "Página que transforma visitante em contato"
` : ""}${lead.foco === "CRM" ? `
📊 CRM - ARGUMENTAÇÃO ESPECÍFICA:
• Organização de pipeline de vendas
• Follow-up sistemático, não na memória
• Leads esquecidos = dinheiro perdido
• Previsibilidade de faturamento
• Dor: "Vendas desorganizadas, leads perdidos no WhatsApp"
• Ganho: "Saber exatamente quantas vendas vai fechar"
` : ""}${lead.foco === "Design" ? `
🎨 DESIGN - ARGUMENTAÇÃO ESPECÍFICA:
• Identidade visual como diferencial competitivo
• Marca que transmite profissionalismo e confiança
• Design que VENDE, não só bonito
• Consistência visual em todos os canais
• Dor: "Visual amador que afasta clientes premium"
• Ganho: "Marca que atrai os clientes certos"
` : ""}

═══════════════════════════════════════
📋 DIAGNÓSTICO (máximo 6 bullets)
═══════════════════════════════════════
Gere análise consultiva incluindo:
• Avaliação da maturidade digital atual
• Gaps críticos identificados
• Oportunidades específicas para ${lead.foco}
• Recomendações prioritárias
• Potencial de ROI estimado
${lead.instagram_context ? "• Insights do Instagram" : ""}
${instagramSelecionadoMasNaoDetectado ? `
⚠️ IMPORTANTE - INCLUIR NO DIAGNÓSTICO:
• Instagram foi selecionado para prospecção mas NÃO foi detectado no site
• Adicionar um bullet sugerindo verificar estes possíveis handles: ${instagramVariations.slice(0, 4).join(", ")}
• Orientar o usuário a buscar o perfil manualmente antes de abordar
• NÃO incluir Instagram no plano de 7 dias!` : ""}

═══════════════════════════════════════
📊 PROBABILIDADE DE CONVERSÃO (0-100)
═══════════════════════════════════════
Calcule baseado em:
• Maturidade digital (ferramentas instaladas)
• Canais de contato disponíveis
• Sinais de investimento em marketing
• Complexidade da solução de ${lead.foco}
• Tamanho provável da empresa

REGRA: Se nenhum canal detectado, máximo 30% de probabilidade

═══════════════════════════════════════
🚀 LEMBRE-SE: VOCÊ É UM COPYWRITER DE ELITE
═══════════════════════════════════════
• Cada mensagem deve ser memorável
• Use dados REAIS do lead (nome, cidade, nicho)
• Crie urgência progressiva ao longo dos 7 dias
• Objeções devem ser FRASES REAIS que clientes dizem
• Respostas devem usar técnicas avançadas de vendas
• CTAs devem escalar em compromisso
• ${canalTexto} - USE APENAS ESTES CANAIS!`;
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
