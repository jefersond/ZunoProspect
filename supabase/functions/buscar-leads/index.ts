import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ============= CORS HELPER =============
// Configure a env var ALLOWED_ORIGINS com os domínios permitidos separados por vírgula
// Exemplo: "https://meuapp.lovable.app,https://meudominio.com.br,http://localhost:5173"
function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const allowedOriginsEnv = Deno.env.get("ALLOWED_ORIGINS") || "";
  const allowedOrigins = allowedOriginsEnv.split(",").map((o) => o.trim()).filter(Boolean);
  
  const origin = (allowedOrigins.length === 0 || (requestOrigin && allowedOrigins.includes(requestOrigin)))
    ? (requestOrigin || "*")
    : "";
    
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

function handleCorsRequest(req: Request): Response | null {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (origin && corsHeaders["Access-Control-Allow-Origin"] === "") {
    return new Response(JSON.stringify({ error: "Origem não autorizada" }), { 
      status: 403, 
      headers: { "Content-Type": "application/json" } 
    });
  }
  
  return null;
}

interface ProspeccaoRequest {
  cidade: string;
  estado: string;
  nicho: string;
  quantidade: number;
  foco: string;
  proximidadeAtiva: boolean;
  raioKm?: number;
  canaisProspeccao?: ("email" | "whatsapp" | "instagram")[];
  excludePlaceIds?: string[];
  pageToken?: string;
  pais?: "BR" | "US";
}

serve(async (req) => {
  const corsCheck = handleCorsRequest(req);
  if (corsCheck) return corsCheck;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    // SECURITY: Get encryption key from external secret (NOT from database)
    const encryptionKey = Deno.env.get('LEADS_ENCRYPTION_KEY');
    if (!encryptionKey) {
      console.error("❌ LEADS_ENCRYPTION_KEY not configured");
      return new Response(JSON.stringify({ error: "Configuração de segurança inválida" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    });
    
    // Admin client for secure insert operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verifica autenticação
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ProspeccaoRequest = await req.json();
    console.log("Buscando leads:", body);

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    
    let leads: any[] = [];
    let totalAvailable = 0; // Total de leads disponíveis ANTES de limitar

    // ============================================
    // FUNÇÃO DE PAGINAÇÃO AUTOMÁTICA
    // Busca até 3 páginas (60 resultados) automaticamente
    // ============================================
    async function fetchAllPagesFromGoogle(
      initialUrl: string,
      targetQuantity: number,
      maxPages: number = 3
    ): Promise<{ results: any[]; totalFound: number }> {
      const allResults: any[] = [];
      const seenPlaceIds = new Set<string>();
      let pageToken: string | null = null;
      let currentPage = 0;

      while (allResults.length < targetQuantity && currentPage < maxPages) {
        let url = initialUrl;
        
        // Se temos pageToken, usa ele (substitui a URL inteira)
        if (pageToken) {
          // Extrai a base URL para adicionar apenas o pageToken
          const baseUrl = initialUrl.includes('nearbysearch') 
            ? 'https://maps.googleapis.com/maps/api/place/nearbysearch/json'
            : 'https://maps.googleapis.com/maps/api/place/textsearch/json';
          url = `${baseUrl}?pagetoken=${pageToken}&key=${GOOGLE_API_KEY}`;
        }

        console.log(`📄 Buscando página ${currentPage + 1}/${maxPages}...`);
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === "OK" && data.results?.length > 0) {
          // Deduplica por place_id
          for (const result of data.results) {
            if (!seenPlaceIds.has(result.place_id)) {
              seenPlaceIds.add(result.place_id);
              allResults.push(result);
            }
          }
          
          console.log(`✅ Página ${currentPage + 1}: ${data.results.length} resultados (total acumulado: ${allResults.length})`);
          
          pageToken = data.next_page_token || null;
          
          // Se ainda não atingimos a quantidade e tem mais páginas
          if (pageToken && allResults.length < targetQuantity) {
            // Google EXIGE delay de 2 segundos antes de usar pageToken
            console.log(`⏳ Aguardando 2s para próxima página (requisito Google)...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } else if (data.status === "ZERO_RESULTS") {
          console.log(`📭 Página ${currentPage + 1}: Nenhum resultado`);
          break;
        } else {
          console.error(`❌ Erro na página ${currentPage + 1}:`, data.status, data.error_message);
          break;
        }

        currentPage++;
        if (!pageToken) break; // Sem mais páginas
      }

      console.log(`📊 Paginação completa: ${allResults.length} leads únicos em ${currentPage} página(s)`);
      return { results: allResults, totalFound: allResults.length };
    }

    // ============================================
    // FUNÇÃO PARA BUSCAR UM NICHO ESPECÍFICO
    // ============================================
    async function searchSingleNiche(
      nicho: string,
      targetQuantity: number,
      location?: { lat: number; lng: number },
      searchRadius?: number
    ): Promise<{ results: any[]; totalFound: number }> {
      if (body.proximidadeAtiva && location && searchRadius) {
        // Nearby Search com keyword (nicho) e raio
        const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${
          searchRadius * 1000
        }&keyword=${encodeURIComponent(nicho)}&key=${GOOGLE_API_KEY}`;

        return await fetchAllPagesFromGoogle(nearbyUrl, targetQuantity, 3);
      } else {
        // Text Search
        const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
          `${nicho} ${body.cidade} ${body.estado}`
        )}&key=${GOOGLE_API_KEY}`;

        return await fetchAllPagesFromGoogle(textSearchUrl, targetQuantity, 3);
      }
    }

    // Se não houver API key, retorna dados mockados para teste de UI
    if (!GOOGLE_API_KEY) {
      console.log("API key não configurada - retornando dados mockados");
      
      const mockLeads = Array.from({ length: Math.min(body.quantidade, 5) }, (_, i) => ({
        place_id: `mock_place_${i}_${Date.now()}`,
        name: `${body.nicho.charAt(0).toUpperCase() + body.nicho.slice(1)} ${i + 1} - ${body.cidade}`,
        formatted_address: `Rua Exemplo ${i + 100}, ${body.cidade}, Brasil`,
        formatted_phone_number: `(11) 9${1000 + i}-${1000 + i}`,
        website: i % 2 === 0 ? `https://exemplo${i + 1}.com.br` : null,
        rating: 3.5 + (i * 0.3),
        user_ratings_total: 10 + (i * 5),
        geometry: {
          location: {
            lat: -23.5505 + (i * 0.01),
            lng: -46.6333 + (i * 0.01)
          }
        },
        _nicho: body.nicho // Marca o nicho
      }));

      leads = mockLeads;
      totalAvailable = mockLeads.length;
    } else {
      // ============================================
      // DETECTA MÚLTIPLOS NICHOS (separados por vírgula)
      // ============================================
      const nichos = body.nicho.split(',').map((n: string) => n.trim()).filter((n: string) => n.length > 0);
      const isMultipleNiches = nichos.length > 1;

      if (isMultipleNiches) {
        console.log(`🔍 Detectados ${nichos.length} nichos: ${nichos.join(', ')}`);
      }

      // Prepara coordenadas se busca por proximidade
      let location: { lat: number; lng: number } | undefined;
      let searchRadius = body.raioKm || 5;

      if (body.proximidadeAtiva) {
        // Geocodifica a cidade + estado para obter lat/lng do centro
        const countryName = body.pais === "US" ? "USA" : "Brasil";
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          `${body.cidade}, ${body.estado}, ${countryName}`
        )}&key=${GOOGLE_API_KEY}`;

        const geocodeResponse = await fetch(geocodeUrl);
        const geocodeData = await geocodeResponse.json();

        if (geocodeData.status !== "OK" || !geocodeData.results[0]) {
          console.error("Geocode API status:", geocodeData.status);
          throw new Error(`Cidade "${body.cidade}" não encontrada. Verifique se digitou corretamente o nome da cidade.`);
        }

        location = geocodeData.results[0].geometry.location;
        console.log("📍 Coordenadas do centro da cidade:", location);

        // Se for busca incremental, aumenta o raio em 50% para encontrar novos leads
        const isIncremental = body.excludePlaceIds && body.excludePlaceIds.length > 0;
        if (isIncremental && body.raioKm) {
          searchRadius = body.raioKm * 1.5;
          console.log(`Busca incremental: raio expandido de ${body.raioKm}km para ${searchRadius}km`);
        }
      }

      // ============================================
      // BUSCA POR NICHO(S)
      // ============================================
      if (isMultipleNiches) {
        // MÚLTIPLOS NICHOS: Busca paralela para cada nicho
        console.log(`🚀 Iniciando busca paralela para ${nichos.length} nichos...`);
        
        const seenPlaceIds = new Set<string>();
        const allResults: any[] = [];
        
        // Calcula quantidade por nicho (divide igualmente + 20% extra para compensar duplicatas)
        const quantidadePorNicho = Math.ceil((body.quantidade * 1.2) / nichos.length);

        // Busca paralela para todos os nichos
        const searchPromises = nichos.map((nicho: string) => 
          searchSingleNiche(nicho, quantidadePorNicho, location, searchRadius)
            .then(result => ({ nicho, ...result }))
            .catch(error => {
              console.error(`❌ Erro ao buscar nicho "${nicho}":`, error.message);
              return { nicho, results: [], totalFound: 0 };
            })
        );

        const nichosResults = await Promise.all(searchPromises);

        // Combina resultados, removendo duplicatas e marcando o nicho de origem
        for (const { nicho, results } of nichosResults) {
          console.log(`📊 Nicho "${nicho}": ${results.length} resultados`);
          
          for (const result of results) {
            if (!seenPlaceIds.has(result.place_id)) {
              seenPlaceIds.add(result.place_id);
              allResults.push({
                ...result,
                _nicho: nicho // Marca qual nicho encontrou este lead
              });
            }
          }
        }

        console.log(`✅ Total combinado: ${allResults.length} leads únicos de ${nichos.length} nichos`);
        
        totalAvailable = allResults.length;
        leads = body.excludePlaceIds && body.excludePlaceIds.length > 0
          ? allResults // Busca incremental: pega tudo para filtrar
          : allResults.slice(0, body.quantidade);
          
        console.log(`🎯 Total disponível: ${totalAvailable}, entregando: ${leads.length}`);

        if (allResults.length === 0) {
          throw new Error(`Nenhum resultado encontrado para "${nichos.join(', ')}" em ${body.cidade}`);
        }
      } else {
        // NICHO ÚNICO: Busca normal (código original)
        const singleNicho = nichos[0] || body.nicho;
        
        if (body.proximidadeAtiva && location) {
          console.log("🔍 Buscando por proximidade (Nearby Search) com paginação automática...");

          const { results: nearbyResults, totalFound } = await searchSingleNiche(
            singleNicho,
            body.quantidade,
            location,
            searchRadius
          );

          if (nearbyResults.length > 0) {
            totalAvailable = totalFound;
            // Marca o nicho em cada resultado
            leads = (body.excludePlaceIds && body.excludePlaceIds.length > 0
              ? nearbyResults
              : nearbyResults.slice(0, body.quantidade))
              .map((r: any) => ({ ...r, _nicho: singleNicho }));
            
            console.log(`🎯 Total disponível: ${totalAvailable}, entregando: ${leads.length}`);
          } else {
            throw new Error(`Nenhum resultado encontrado para "${singleNicho}" em ${body.cidade}`);
          }
        } else {
          console.log("🔍 Buscando por texto (Text Search) com paginação automática...");

          const { results: textResults, totalFound } = await searchSingleNiche(
            singleNicho,
            body.quantidade
          );

          if (textResults.length > 0) {
            totalAvailable = totalFound;
            // Marca o nicho em cada resultado
            leads = (body.excludePlaceIds && body.excludePlaceIds.length > 0
              ? textResults
              : textResults.slice(0, body.quantidade))
              .map((r: any) => ({ ...r, _nicho: singleNicho }));
            
            console.log(`🎯 Total disponível: ${totalAvailable}, entregando: ${leads.length}`);
          } else {
            throw new Error(`Nenhum resultado encontrado para "${singleNicho}" em ${body.cidade}`);
          }
        }
      }
    }

    console.log(`Encontrados ${leads.length} leads antes do filtro (total disponível: ${totalAvailable})`);
    
    // Filtra leads que já existem (busca incremental)
    const excludePlaceIds = body.excludePlaceIds || [];
    const originalLeadsCount = leads.length;
    if (excludePlaceIds.length > 0) {
      console.log(`Filtrando ${excludePlaceIds.length} place_ids já existentes...`);
      leads = leads.filter((lead: any) => !excludePlaceIds.includes(lead.place_id));
      console.log(`Leads após filtro: ${leads.length} (removidos: ${originalLeadsCount - leads.length})`);
      
      // Se não houver novos leads após filtrar, informa ao usuário
      if (leads.length === 0) {
        return new Response(
          JSON.stringify({ 
            error: "Nenhum lead novo encontrado. O Google retornou os mesmos resultados da busca anterior. Tente aumentar o raio de busca ou modificar os termos.",
            leadsCount: 0,
            totalAvailable: 0,
            limitedByQuota: false,
            additionalLeadsAvailable: 0,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }
    
    // Verificar quota do usuário ANTES de processar
    const { data: subscriptionData } = await supabaseClient.rpc('get_subscription_info', {
      p_user_id: user.id
    });
    
    const userQuota = subscriptionData?.[0]?.leads_remaining ?? body.quantidade;
    const isUnlimited = subscriptionData?.[0]?.leads_limit === -1;
    
    // Calcula quantos leads podem ser processados
    const leadsAfterFilter = leads.length;
    const maxLeadsToProcess = isUnlimited ? body.quantidade : Math.min(body.quantidade, Math.max(0, userQuota));
    const limitedByQuota = !isUnlimited && (leadsAfterFilter > userQuota || userQuota <= 0);
    
    console.log(`Quota do usuário: ${isUnlimited ? 'ilimitado' : userQuota} | Leads após filtro: ${leadsAfterFilter} | Será processado: ${Math.min(leadsAfterFilter, maxLeadsToProcess)}`);
    
    // Separa leads desbloqueados e bloqueados (para mostrar preview com blur)
    const unlockedLeads = leads.slice(0, maxLeadsToProcess);
    const lockedLeadsPreview = leads.slice(maxLeadsToProcess, maxLeadsToProcess + 5); // Até 5 leads como preview
    
    // Atualiza leads para processar apenas os desbloqueados
    leads = unlockedLeads;
    
    // Calcula leads adicionais disponíveis (incentivo para upgrade)
    const additionalLeadsAvailable = limitedByQuota ? Math.max(0, leadsAfterFilter - unlockedLeads.length) : 0;
    const lockedLeadsCount = lockedLeadsPreview.length;
    
    if (additionalLeadsAvailable > 0) {
      console.log(`🎯 ${additionalLeadsAvailable} leads adicionais disponíveis além da cota do usuário!`);
    }

    // Função para analisar o HTML do site e extrair sinais digitais
    async function analyzeSiteHTML(websiteUrl: string) {
      const signals = {
        whatsapp_on_site: false,
        whatsapp_number: null as string | null,
        has_meta_pixel: false,
        has_gtag: false,
        has_gtm: false,
        instagram_url: null as string | null,
        email: null as string | null,
      };

      try {
        console.log(`Analisando site: ${websiteUrl}`);
        const siteResponse = await fetch(websiteUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LeadBot/1.0)',
          },
          redirect: 'follow',
        });

        if (!siteResponse.ok) {
          console.log(`Erro ao acessar site: ${siteResponse.status}`);
          return signals;
        }

        const html = await siteResponse.text();
        
        // =============================================
        // DETECÇÃO APRIMORADA DE WHATSAPP/TELEFONE
        // =============================================
        
        // 1. Padrões de links WhatsApp (mais completos)
        const whatsappLinkPatterns = [
          /wa\.me\/(\+?[0-9]+)/gi,
          /api\.whatsapp\.com\/send\?phone=(\+?[0-9]+)/gi,
          /web\.whatsapp\.com\/send\?phone=(\+?[0-9]+)/gi,
          /whatsapp:\/\/send\?phone=(\+?[0-9]+)/gi,
        ];
        
        for (const pattern of whatsappLinkPatterns) {
          const matches = [...html.matchAll(pattern)];
          for (const match of matches) {
            if (match[1]) {
              const cleanNumber = match[1].replace(/\D/g, '');
              if (cleanNumber.length >= 10) {
                signals.whatsapp_on_site = true;
                signals.whatsapp_number = cleanNumber;
                console.log(`📱 WhatsApp encontrado via link: ${cleanNumber}`);
                break;
              }
            }
          }
          if (signals.whatsapp_on_site) break;
        }

        // 2. Links tel: (telefone que pode ser WhatsApp)
        if (!signals.whatsapp_number) {
          const telPattern = /href\s*=\s*["']tel:(\+?55)?(\d{10,11})["']/gi;
          const telMatches = [...html.matchAll(telPattern)];
          for (const match of telMatches) {
            const number = (match[1] || '') + match[2];
            const cleanNumber = number.replace(/\D/g, '');
            // Prioriza números com 9 (celular = provável WhatsApp)
            if (cleanNumber.length >= 10 && /9\d{8}$/.test(cleanNumber)) {
              signals.whatsapp_number = cleanNumber;
              signals.whatsapp_on_site = true;
              console.log(`📱 Celular encontrado via tel: ${cleanNumber}`);
              break;
            }
          }
        }

        // 3. Números brasileiros em texto (próximos a "whatsapp", "zap", "wpp", "fale conosco")
        if (!signals.whatsapp_number) {
          const contextPatterns = [
            // Palavra-chave seguida de número
            /(?:whatsapp|wpp|whats|zap|fale\s*conosco|atendimento)[^0-9]{0,80}(?:\+?55\s*)?(?:\(?0?([1-9][0-9])\)?\s*)?([9]?\d{4}[-.\s]?\d{4})/gi,
            // Número seguido de palavra-chave
            /(?:\+?55\s*)?(?:\(?0?([1-9][0-9])\)?\s*)?([9]\d{4}[-.\s]?\d{4})[^0-9]{0,30}(?:whatsapp|wpp|whats|zap)/gi,
          ];
          
          for (const pattern of contextPatterns) {
            const matches = [...html.matchAll(pattern)];
            for (const match of matches) {
              const ddd = match[1] || '';
              const number = match[2] || '';
              const fullNumber = (ddd + number).replace(/\D/g, '');
              if (fullNumber.length >= 8 && /9\d{7,8}$/.test(fullNumber)) {
                // Adiciona DDD 11 se não tiver
                signals.whatsapp_number = fullNumber.length <= 9 ? '11' + fullNumber : fullNumber;
                signals.whatsapp_on_site = true;
                console.log(`📱 WhatsApp encontrado via contexto: ${signals.whatsapp_number}`);
                break;
              }
            }
            if (signals.whatsapp_number) break;
          }
        }

        // 4. Números brasileiros gerais no HTML (fallback para celulares)
        if (!signals.whatsapp_number) {
          // Formato: (11) 99999-9999 ou 11999999999 ou +55 11 99999-9999
          const phonePatterns = [
            /\+?55\s*\(?([1-9][0-9])\)?\s*(9\d{4})[-.\s]?(\d{4})/g,
            /\(?([1-9][0-9])\)?\s*(9\d{4})[-.\s]?(\d{4})/g,
          ];
          
          for (const pattern of phonePatterns) {
            const matches = [...html.matchAll(pattern)];
            for (const match of matches) {
              const ddd = match[1];
              const part1 = match[2];
              const part2 = match[3];
              const fullNumber = `${ddd}${part1}${part2}`.replace(/\D/g, '');
              if (fullNumber.length >= 10 && fullNumber.length <= 11) {
                signals.whatsapp_number = fullNumber;
                signals.whatsapp_on_site = true;
                console.log(`📱 Celular encontrado via regex geral: ${fullNumber}`);
                break;
              }
            }
            if (signals.whatsapp_number) break;
          }
        }

        // 5. Detecta se tem WhatsApp no site mesmo sem número extraível
        if (!signals.whatsapp_on_site) {
          if (/whatsapp|wa\.me|api\.whatsapp/i.test(html)) {
            signals.whatsapp_on_site = true;
            console.log(`📱 WhatsApp detectado no site (sem número extraível)`);
          }
        }

        // Detectar Meta Pixel
        if (/fbq\s*\(\s*['"]init['"]/i.test(html) || /facebook\.com\/tr\?id=/i.test(html)) {
          signals.has_meta_pixel = true;
        }

        // Detectar Google Analytics / gtag
        if (/gtag\s*\(\s*['"]config['"]/i.test(html) || /googletagmanager\.com\/gtag\/js/i.test(html)) {
          signals.has_gtag = true;
        }

        // Detectar Google Tag Manager
        if (/GTM-[A-Z0-9]+/i.test(html) || /googletagmanager\.com\/gtm\.js/i.test(html)) {
          signals.has_gtm = true;
        }

        // Detectar Instagram URL
        const instagramMatch = html.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
        if (instagramMatch && !['p', 'reel', 'stories', 'explore'].includes(instagramMatch[1].toLowerCase())) {
          signals.instagram_url = `https://instagram.com/${instagramMatch[1]}`;
        }

        // =============================================
        // DETECÇÃO APRIMORADA DE EMAIL
        // =============================================
        
        // Lista de emails genéricos para ignorar
        const excludeEmailPatterns = /\b(wix|google|facebook|instagram|example|test|noreply|suporte@wix|no-reply|support@|admin@|info@wix|webmaster@|hostmaster@)\b/i;
        
        // 1. Links mailto (mais confiável)
        const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        if (mailtoMatch && !excludeEmailPatterns.test(mailtoMatch[1])) {
          signals.email = mailtoMatch[1].toLowerCase();
          console.log(`📧 Email encontrado via mailto: ${signals.email}`);
        }

        // 2. Emails em texto (regex geral)
        if (!signals.email) {
          const emailPattern = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com\.br|com|net|org|br|io|me|info|co|gov\.br))\b/gi;
          const emailMatches = html.match(emailPattern);
          
          if (emailMatches) {
            // Pega o primeiro email que não seja genérico
            const validEmail = emailMatches.find(e => !excludeEmailPatterns.test(e));
            if (validEmail) {
              signals.email = validEmail.toLowerCase();
              console.log(`📧 Email encontrado via regex: ${signals.email}`);
            }
          }
        }

        // 3. Emails próximos a palavras-chave de contato
        if (!signals.email) {
          const contextPattern = /(?:email|e-mail|contato|contact|fale\s*conosco)[^a-z@]{0,50}([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
          const contextMatches = [...html.matchAll(contextPattern)];
          for (const match of contextMatches) {
            if (match[1] && !excludeEmailPatterns.test(match[1])) {
              signals.email = match[1].toLowerCase();
              console.log(`📧 Email encontrado via contexto: ${signals.email}`);
              break;
            }
          }
        }

        console.log(`Sinais detectados:`, signals);
      } catch (error) {
        console.error(`Erro ao analisar HTML do site ${websiteUrl}:`, error);
      }

      return signals;
    }

    // Função para processar um lead
    // Retorna { leadResult, scheduleAnalysis, isNew } onde isNew indica se foi INSERT ou UPDATE
    async function processLead(place: any): Promise<{ leadResult: any; scheduleAnalysis: () => Promise<void>; isNew: boolean } | null> {
      try {
        let detailsData: any;

        // Se não estiver usando mock, busca detalhes na API real
        if (GOOGLE_API_KEY) {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,geometry&key=${GOOGLE_API_KEY}`;
          const detailsResponse = await fetch(detailsUrl);
          detailsData = await detailsResponse.json();
        } else {
          detailsData = {
            status: "OK",
            result: place
          };
        }
        
        if (detailsData.status === "OK") {
          const details = detailsData.result;
          
          // Analisa o site se houver website (com timeout)
          let siteSignals = {
            whatsapp_on_site: false,
            whatsapp_number: null as string | null,
            has_meta_pixel: false,
            has_gtag: false,
            has_gtm: false,
            instagram_url: null as string | null,
            email: null as string | null,
          };

          if (details.website) {
            try {
              const signalsPromise = analyzeSiteHTML(details.website);
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 5000)
              );
              siteSignals = await Promise.race([signalsPromise, timeoutPromise]) as typeof siteSignals;
            } catch (error) {
              console.log(`Timeout ou erro ao analisar site ${details.website}`);
            }
          }
          
          // Verifica se user existe
          if (!user) {
            console.error("Usuário não autenticado");
            return null;
          }
          
          // Insere no banco usando a wrapper segura que define a chave de criptografia
          // SECURITY: Encryption key passed as parameter, restricted to service_role
          const { data: rpcResult, error: insertError } = await supabaseAdmin.rpc('set_encryption_key_and_insert_lead', {
            p_encryption_key: encryptionKey,
            p_nome: details.name,
            p_endereco: details.formatted_address,
            p_telefone: details.formatted_phone_number || null,
            p_website: details.website || null,
            p_google_place_id: place.place_id,
            p_rating: details.rating || null,
            p_total_reviews: details.user_ratings_total || 0,
            p_cidade: body.cidade,
            p_latitude: details.geometry?.location?.lat || null,
            p_longitude: details.geometry?.location?.lng || null,
            p_nicho: place._nicho || body.nicho, // Usa o nicho específico se disponível
            p_foco: body.foco,
            p_user_id: user.id,
            p_proximidade_ativa: body.proximidadeAtiva,
            p_raio_km: body.raioKm,
            p_whatsapp_on_site: siteSignals.whatsapp_on_site,
            p_whatsapp_number: siteSignals.whatsapp_number,
            p_has_meta_pixel: siteSignals.has_meta_pixel,
            p_has_gtag: siteSignals.has_gtag,
            p_has_gtm: siteSignals.has_gtm,
            p_instagram_url: siteSignals.instagram_url,
            p_digital_signals: siteSignals,
            p_email: siteSignals.email,
            p_pais: body.pais || "BR",
          });

          if (insertError) {
            console.error("Erro ao inserir lead:", insertError);
            return null;
          }

          // rpcResult agora contém { id: uuid, is_new: boolean }
          const leadId = rpcResult?.id;
          const isNewLead = rpcResult?.is_new ?? false;
          const leadData = { id: leadId };
          console.log(`✅ Lead ${isNewLead ? 'INSERIDO (novo)' : 'ATUALIZADO (existente)'} com ID: ${leadId}`);

          // Agenda análise de IA em background com retry e rate limiting
          const scheduleAnalysisWithRetry = async (retries = 3) => {
            for (let attempt = 1; attempt <= retries; attempt++) {
              try {
                console.log(`🤖 Agendando análise IA (tentativa ${attempt}/${retries}) para: ${details.name}`);
                
                const response = await fetch(
                  `${Deno.env.get("SUPABASE_URL")}/functions/v1/analisar-lead-ia`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: req.headers.get("Authorization")!,
                    },
                    body: JSON.stringify({
                      lead_id: leadData?.id,
                      user_id: user.id, // Passa user_id para RPC funcionar com service role
                      nome: details.name,
                      nicho: body.nicho,
                      cidade: body.cidade,
                      website: details.website || null,
                      foco: body.foco,
                      whatsapp_on_site: siteSignals.whatsapp_on_site,
                      has_meta_pixel: siteSignals.has_meta_pixel,
                      has_gtag: siteSignals.has_gtag,
                      has_gtm: siteSignals.has_gtm,
                      instagram_url: siteSignals.instagram_url,
                      instagram_context: null,
                      canaisProspeccao: body.canaisProspeccao || "ambos",
                      pais: body.pais || "BR",
                    }),
                  }
                );

                if (response.ok) {
                  console.log(`✅ Análise IA agendada com sucesso para: ${details.name}`);
                  return;
                }

                const errorText = await response.text();
                console.error(`❌ Erro na análise IA (tentativa ${attempt}):`, response.status, errorText);
                
                // Rate limit detectado - aguardar tempo maior
                if (response.status === 429) {
                  const retryAfter = parseInt(response.headers.get('Retry-After') || '30');
                  const waitTime = Math.max(retryAfter, 10) * 1000; // Mínimo 10s para rate limit
                  console.log(`⏳ Rate limit atingido, aguardando ${waitTime/1000}s antes de retry...`);
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                  continue;
                }
                
                // Outros erros - backoff exponencial padrão
                if (attempt < retries) {
                  const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 30000); // Max 30s
                  console.log(`⏳ Aguardando ${backoffMs/1000}s antes de retry...`);
                  await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
              } catch (err: any) {
                console.error(`❌ Erro ao chamar análise IA (tentativa ${attempt}):`, err.message);
                if (attempt < retries) {
                  const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
                  await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
              }
            }
            console.error(`❌ Falha após ${retries} tentativas de análise IA para: ${details.name}`);
          };

          // Retorna a função para ser executada com delay
          return { 
            leadResult: {
              nome: details.name,
              endereco: details.formatted_address,
              sinais: siteSignals,
            },
            scheduleAnalysis: scheduleAnalysisWithRetry,
            isNew: isNewLead
          };
        }
      } catch (error) {
        console.error("Erro ao processar lead:", error);
      }
      return null;
    }

    // Processa leads em paralelo (máximo 5 por vez para não sobrecarregar)
    const leadsWithAnalysis: { leadResult: any; scheduleAnalysis: () => Promise<void>; isNew: boolean }[] = [];
    const batchSize = 5;
    
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      const results = await Promise.all(batch.map((place: any) => processLead(place)));
      leadsWithAnalysis.push(...results.filter(r => r !== null) as any[]);
    }
    
    // Contagem de leads NOVOS vs ATUALIZADOS
    const newLeadsCount = leadsWithAnalysis.filter(item => item.isNew).length;
    const updatedLeadsCount = leadsWithAnalysis.filter(item => !item.isNew).length;
    console.log(`📊 Leads processados: ${newLeadsCount} NOVOS + ${updatedLeadsCount} ATUALIZADOS = ${leadsWithAnalysis.length} total`);

    // Extrai apenas os resultados dos leads para retorno
    const leadsDetails = leadsWithAnalysis.map(item => item.leadResult);

    // ============================================
    // ANÁLISE IA EM BACKGROUND (NÃO BLOQUEIA RESPOSTA)
    // ============================================
    // Usa EdgeRuntime.waitUntil para rodar análises após retornar resposta
    // Isso evita timeout e garante que o usuário veja os leads imediatamente
    
    const runAIAnalysisInBackground = async () => {
      const AI_BATCH_SIZE = 5;
      const DELAY_BETWEEN_BATCHES_MS = 500;
      
      console.log(`🤖 [BACKGROUND] Iniciando análise IA de ${leadsWithAnalysis.length} leads...`);
      
      for (let i = 0; i < leadsWithAnalysis.length; i += AI_BATCH_SIZE) {
        const batch = leadsWithAnalysis.slice(i, i + AI_BATCH_SIZE);
        const batchNumber = Math.floor(i / AI_BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(leadsWithAnalysis.length / AI_BATCH_SIZE);
        
        console.log(`🔄 [BACKGROUND] Lote ${batchNumber}/${totalBatches} (${batch.length} análises)...`);
        
        const batchPromises = batch.map(async (item, idx) => {
          if (item.scheduleAnalysis) {
            try {
              await item.scheduleAnalysis();
              console.log(`✅ [BACKGROUND] Análise ${i + idx + 1}/${leadsWithAnalysis.length} ok.`);
            } catch (err) {
              console.error(`❌ [BACKGROUND] Análise ${i + idx + 1} falhou:`, err);
            }
          }
        });
        
        await Promise.all(batchPromises);
        
        if (i + AI_BATCH_SIZE < leadsWithAnalysis.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
        }
      }
      
      console.log(`✅ [BACKGROUND] Todas as ${leadsWithAnalysis.length} análises IA concluídas!`);
    };

    // Agenda análise em background - NÃO AGUARDA (resposta retorna imediatamente)
    // @ts-ignore - EdgeRuntime disponível no Deno Edge Functions
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(runAIAnalysisInBackground());
      console.log(`🚀 Análise IA agendada em background para ${leadsWithAnalysis.length} leads`);
    } else {
      // Fallback: se EdgeRuntime não disponível, dispara sem await (fire and forget)
      runAIAnalysisInBackground().catch(err => 
        console.error("❌ Erro na análise IA em background:", err)
      );
      console.log(`🚀 Análise IA disparada (fire-and-forget) para ${leadsWithAnalysis.length} leads`);
    }

    // Prepara preview dos leads bloqueados (dados básicos apenas, sem processar)
    const lockedLeadsData = lockedLeadsPreview.map((place: any) => ({
      id: `locked_${place.place_id}`,
      nome: place.name,
      endereco: place.formatted_address || place.vicinity || '',
      cidade: body.cidade,
      nicho: body.nicho,
      foco: body.foco,
      rating: place.rating || null,
      total_reviews: place.user_ratings_total || 0,
      isLocked: true,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        leadsCount: leadsDetails.length,
        newLeadsCount: newLeadsCount,
        updatedLeadsCount: updatedLeadsCount,
        leads: leadsDetails,
        lockedLeads: lockedLeadsData,
        hasMore: leads.length >= body.quantidade,
        totalAvailable: leadsAfterFilter,
        limitedByQuota,
        additionalLeadsAvailable,
        lockedLeadsCount: additionalLeadsAvailable,
        // NOVO: Indica que análise IA está rodando em background
        analysisQueued: leadsWithAnalysis.length > 0,
        analysisCount: leadsWithAnalysis.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Erro na busca de leads:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao buscar leads" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
