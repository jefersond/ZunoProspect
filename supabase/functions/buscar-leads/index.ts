import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

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
    
    let leads = [];

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
        }
      }));

      leads = mockLeads;
    } else {
      // Busca real com Google Places API com múltiplas variações de termo
      // Google retorna no máximo 20 resultados por página e 60 no total (3 páginas) POR BUSCA
      // Para ultrapassar 60, fazemos múltiplas buscas com variações de termos
      
      const MAX_PAGES_PER_SEARCH = 3;
      const targetCount = body.quantidade;
      
      // Map para armazenar resultados únicos por place_id
      const uniqueResults: Map<string, any> = new Map();
      
      // Função para gerar variações de termo de busca
      function generateSearchVariations(nicho: string, cidade: string, estado: string): string[] {
        // Gera plural do nicho
        const nichoPlural = nicho.endsWith('a') ? nicho + 's' : 
                           nicho.endsWith('o') ? nicho + 's' : 
                           nicho.endsWith('e') ? nicho + 's' :
                           nicho + 'es';
        
        // Variações para Text Search
        return [
          `${nicho} ${cidade} ${estado}`,           // original
          `${nicho} em ${cidade} ${estado}`,        // com preposição
          `${nichoPlural} ${cidade} ${estado}`,     // plural
          `${nicho} centro ${cidade}`,              // centro
          `${nicho} ${cidade} zona sul`,            // zona sul
          `${nicho} ${cidade} zona norte`,          // zona norte
          `${nicho} ${cidade} zona leste`,          // zona leste
          `${nicho} ${cidade} zona oeste`,          // zona oeste
          `melhor ${nicho} ${cidade}`,              // melhor
          `${nicho} perto ${cidade}`,               // perto
        ];
      }
      
      // Função para gerar offsets de busca por proximidade (grid de pontos)
      function generateProximityOffsets(): { lat: number; lng: number; label: string }[] {
        return [
          { lat: 0, lng: 0, label: 'centro' },
          { lat: 0.015, lng: 0.015, label: 'nordeste' },
          { lat: 0.015, lng: -0.015, label: 'noroeste' },
          { lat: -0.015, lng: 0.015, label: 'sudeste' },
          { lat: -0.015, lng: -0.015, label: 'sudoeste' },
          { lat: 0.025, lng: 0, label: 'norte' },
          { lat: -0.025, lng: 0, label: 'sul' },
          { lat: 0, lng: 0.025, label: 'leste' },
          { lat: 0, lng: -0.025, label: 'oeste' },
        ];
      }
      
      // Função para fazer busca paginada (até 60 resultados)
      async function searchWithPagination(searchUrl: string, searchLabel: string): Promise<any[]> {
        const results: any[] = [];
        let pageToken: string | null = null;
        let pageCount = 0;
        
        while (pageCount < MAX_PAGES_PER_SEARCH) {
          let url = searchUrl;
          
          if (pageToken) {
            // Usa pageToken para próxima página - Google exige delay de ~2s
            url = searchUrl.split('?')[0] + `?pagetoken=${pageToken}&key=${GOOGLE_API_KEY}`;
            console.log(`⏳ Aguardando 2s antes de buscar página ${pageCount + 1} de "${searchLabel}"...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          console.log(`📄 Buscando página ${pageCount + 1} de "${searchLabel}"...`);
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.status === "OK" && data.results?.length > 0) {
            results.push(...data.results);
            pageToken = data.next_page_token || null;
            pageCount++;
            
            console.log(`✅ Página ${pageCount}: ${data.results.length} resultados (acumulado: ${results.length})`);
            
            if (!pageToken) break;
          } else if (data.status === "ZERO_RESULTS") {
            console.log(`📋 Nenhum resultado para "${searchLabel}"`);
            break;
          } else {
            console.log(`⚠️ Status ${data.status} para "${searchLabel}": ${data.error_message || ''}`);
            break;
          }
        }
        
        return results;
      }
      
      console.log(`🔍 Iniciando busca multi-variação. Objetivo: ${targetCount} leads únicos`);
      
      if (body.proximidadeAtiva && body.raioKm) {
        // Busca por proximidade com múltiplos pontos (grid)
        console.log("🗺️ Modo: Busca por proximidade com grid de pontos");

        // Geocodifica a cidade + estado para obter lat/lng do centro
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          `${body.cidade}, ${body.estado}, Brasil`
        )}&key=${GOOGLE_API_KEY}`;

        const geocodeResponse = await fetch(geocodeUrl);
        const geocodeData = await geocodeResponse.json();

        if (geocodeData.status !== "OK" || !geocodeData.results[0]) {
          console.error("Geocode API status:", geocodeData.status);
          throw new Error(`Cidade "${body.cidade}" não encontrada. Verifique se digitou corretamente o nome da cidade.`);
        }

        const centerLocation = geocodeData.results[0].geometry.location;
        console.log("📍 Centro da cidade:", centerLocation);
        
        // Gera pontos de busca baseado na quantidade solicitada
        const offsets = generateProximityOffsets();
        // Limita número de buscas baseado na quantidade solicitada
        const maxSearches = Math.min(Math.ceil(targetCount / 40), offsets.length);
        const selectedOffsets = offsets.slice(0, maxSearches);
        
        // Se for busca incremental, aumenta o raio
        const isIncremental = body.excludePlaceIds && body.excludePlaceIds.length > 0;
        const searchRadius = isIncremental ? body.raioKm * 1.5 : body.raioKm;
        
        console.log(`🎯 Fazendo ${selectedOffsets.length} buscas em pontos diferentes (raio: ${searchRadius}km)`);
        
        for (const offset of selectedOffsets) {
          if (uniqueResults.size >= targetCount) {
            console.log(`✅ Objetivo atingido: ${uniqueResults.size} leads únicos`);
            break;
          }
          
          const searchLat = centerLocation.lat + offset.lat;
          const searchLng = centerLocation.lng + offset.lng;
          
          const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${searchLat},${searchLng}&radius=${
            searchRadius * 1000
          }&keyword=${encodeURIComponent(body.nicho)}&key=${GOOGLE_API_KEY}`;
          
          const results = await searchWithPagination(nearbyUrl, `proximidade-${offset.label}`);
          
          // Adiciona apenas resultados únicos
          for (const result of results) {
            if (!uniqueResults.has(result.place_id)) {
              uniqueResults.set(result.place_id, result);
            }
          }
          
          console.log(`📊 Total único até agora: ${uniqueResults.size} leads`);
        }
        
      } else {
        // Busca por texto com múltiplas variações de termo
        console.log("📝 Modo: Busca por texto com variações de termos");
        
        const searchVariations = generateSearchVariations(body.nicho, body.cidade, body.estado);
        // Limita número de variações baseado na quantidade solicitada
        const maxVariations = Math.min(Math.ceil(targetCount / 40), searchVariations.length);
        const selectedVariations = searchVariations.slice(0, maxVariations);
        
        console.log(`🎯 Usando ${selectedVariations.length} variações de termo de busca`);
        
        for (const query of selectedVariations) {
          if (uniqueResults.size >= targetCount) {
            console.log(`✅ Objetivo atingido: ${uniqueResults.size} leads únicos`);
            break;
          }
          
          console.log(`\n🔎 Buscando: "${query}"`);
          
          const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
          
          const results = await searchWithPagination(textSearchUrl, query);
          
          // Adiciona apenas resultados únicos
          let newCount = 0;
          for (const result of results) {
            if (!uniqueResults.has(result.place_id)) {
              uniqueResults.set(result.place_id, result);
              newCount++;
            }
          }
          
          console.log(`📊 Novos leads desta busca: ${newCount} | Total único: ${uniqueResults.size}`);
        }
      }
      
      // Converte Map para array
      leads = Array.from(uniqueResults.values());
      console.log(`\n🎯 Total de leads únicos encontrados: ${leads.length}`);
    }

    console.log(`Encontrados ${leads.length} leads antes do filtro`);
    
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
            leadsCount: 0 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }
    
    // Limita ao número solicitado após filtrar duplicados
    leads = leads.slice(0, body.quantidade);

    // Função para analisar o HTML do site e extrair sinais digitais
    async function analyzeSiteHTML(websiteUrl: string) {
      const signals = {
        whatsapp_on_site: false,
        whatsapp_number: null as string | null,
        has_meta_pixel: false,
        has_gtag: false,
        has_gtm: false,
        instagram_url: null as string | null,
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
        
        // Detectar WhatsApp
        const whatsappPatterns = [
          /wa\.me\/([0-9]+)/i,
          /api\.whatsapp\.com\/send\?phone=([0-9]+)/i,
          /web\.whatsapp\.com\/send\?phone=([0-9]+)/i,
        ];
        
        for (const pattern of whatsappPatterns) {
          const match = html.match(pattern);
          if (match) {
            signals.whatsapp_on_site = true;
            signals.whatsapp_number = match[1];
            break;
          }
        }

        // Se não encontrou nos links, procura por "WhatsApp" próximo a números
        if (!signals.whatsapp_on_site) {
          const whatsappContext = /whatsapp[^0-9]{0,50}(\+?[0-9\s\-\(\)]{10,20})/i;
          const contextMatch = html.match(whatsappContext);
          if (contextMatch) {
            signals.whatsapp_on_site = true;
            signals.whatsapp_number = contextMatch[1].replace(/\D/g, '');
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

        // ========================================
        // DETECÇÃO DE INSTAGRAM - MÚLTIPLOS PADRÕES
        // ========================================
        
        // Lista de usernames a ignorar (páginas genéricas do Instagram)
        const ignoredUsernames = ['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'about', 'legal', 'help', 'direct', 'tv', 'accounts'];
        
        // Padrões de link do Instagram
        const instagramPatterns = [
          /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/gi,
          /(?:https?:\/\/)?(?:www\.)?instagr\.am\/([a-zA-Z0-9._]+)/gi,
          /href\s*=\s*["'][^"']*instagram\.com\/([a-zA-Z0-9._]+)[^"']*["']/gi,
        ];
        
        for (const pattern of instagramPatterns) {
          const matches = html.matchAll(pattern);
          for (const match of matches) {
            if (match[1] && !ignoredUsernames.includes(match[1].toLowerCase())) {
              signals.instagram_url = `https://instagram.com/${match[1]}`;
              console.log(`✅ Instagram encontrado via link: ${signals.instagram_url}`);
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
            /data-instagram\s*=\s*["']@?([a-zA-Z0-9._]+)["']/gi,
          ];
          
          for (const pattern of instagramClassPatterns) {
            if (pattern.test(html)) {
              // Há um elemento Instagram, tenta encontrar o link próximo
              const linkNearby = html.match(/instagram\.com\/([a-zA-Z0-9._]+)/gi);
              if (linkNearby && linkNearby[0]) {
                const username = linkNearby[0].replace(/instagram\.com\//i, '');
                if (!ignoredUsernames.includes(username.toLowerCase())) {
                  signals.instagram_url = `https://instagram.com/${username}`;
                  console.log(`✅ Instagram detectado via classe CSS: ${signals.instagram_url}`);
                }
              }
              break;
            }
          }
        }

        // Procura por SVG icons com links de Instagram
        if (!signals.instagram_url) {
          const svgInstagramPattern = /<a[^>]*href\s*=\s*["'][^"']*instagram\.com\/([a-zA-Z0-9._]+)[^"']*["'][^>]*>[\s\S]*?<svg/gi;
          const svgMatch = html.match(svgInstagramPattern);
          if (svgMatch) {
            const usernameMatch = svgMatch[0].match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
            if (usernameMatch && usernameMatch[1] && !ignoredUsernames.includes(usernameMatch[1].toLowerCase())) {
              signals.instagram_url = `https://instagram.com/${usernameMatch[1]}`;
              console.log(`✅ Instagram detectado via ícone SVG: ${signals.instagram_url}`);
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
              const linkMatch = html.match(/instagram\.com\/([a-zA-Z0-9._]+)/gi);
              if (linkMatch) {
                const username = linkMatch[0].replace(/instagram\.com\//i, '');
                if (!ignoredUsernames.includes(username.toLowerCase())) {
                  signals.instagram_url = `https://instagram.com/${username}`;
                  console.log(`✅ Instagram detectado via ícone: ${signals.instagram_url}`);
                }
              }
              break;
            }
          }
        }

        // Procura por @username próximo a "Instagram"
        if (!signals.instagram_url) {
          const atUsernamePatterns = [
            /instagram[^\n]{0,80}@([a-zA-Z0-9._]{3,30})/gi,
            /@([a-zA-Z0-9._]{3,30})[^\n]{0,80}instagram/gi,
          ];
          
          for (const pattern of atUsernamePatterns) {
            const match = html.match(pattern);
            if (match) {
              const usernameMatch = match[0].match(/@([a-zA-Z0-9._]{3,30})/);
              if (usernameMatch && usernameMatch[1] && !ignoredUsernames.includes(usernameMatch[1].toLowerCase())) {
                signals.instagram_url = `https://instagram.com/${usernameMatch[1]}`;
                console.log(`✅ Instagram detectado via @username: ${signals.instagram_url}`);
                break;
              }
            }
          }
        }

        // Procura em áreas comuns (footer, social links)
        if (!signals.instagram_url) {
          const socialSectionPatterns = [
            /(?:footer|social|redes|siga)[^]*?instagram\.com\/([a-zA-Z0-9._]+)/gi,
          ];
          
          for (const pattern of socialSectionPatterns) {
            const match = html.match(pattern);
            if (match) {
              const usernameMatch = match[0].match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
              if (usernameMatch && usernameMatch[1] && !ignoredUsernames.includes(usernameMatch[1].toLowerCase())) {
                signals.instagram_url = `https://instagram.com/${usernameMatch[1]}`;
                console.log(`✅ Instagram detectado em seção social: ${signals.instagram_url}`);
                break;
              }
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
    async function processLead(place: any) {
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
            whatsapp_number: null,
            has_meta_pixel: false,
            has_gtag: false,
            has_gtm: false,
            instagram_url: null,
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
          
          // Insere no banco usando colunas criptografadas
          // IMPORTANTE: Dados sensíveis são criptografados no banco
          const { error: insertError } = await supabaseClient.rpc('insert_lead_with_encryption', {
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
            p_nicho: body.nicho,
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
          });

          if (insertError) {
            console.error("Erro ao inserir lead:", insertError);
            return null;
          }

          // Busca o lead recém-criado para obter o ID
          const { data: leadData, error: selectError } = await supabaseClient
            .from("leads")
            .select("id")
            .eq("google_place_id", place.place_id)
            .eq("user_id", user.id)
            .single();

          if (selectError || !leadData) {
            console.error("Erro ao buscar ID do lead:", selectError);
          }

          // Agenda análise de IA em background com retry
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
                      canaisProspeccao: body.canaisProspeccao || ["email", "whatsapp", "instagram"],
                    }),
                  }
                );

                if (response.ok) {
                  console.log(`✅ Análise IA agendada com sucesso para: ${details.name}`);
                  return;
                }

                const errorText = await response.text();
                console.error(`❌ Erro na análise IA (tentativa ${attempt}):`, response.status, errorText);
                
                // Se não for o último retry, aguarda antes de tentar novamente
                if (attempt < retries) {
                  await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                }
              } catch (err: any) {
                console.error(`❌ Erro ao chamar análise IA (tentativa ${attempt}):`, err.message);
                if (attempt < retries) {
                  await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                }
              }
            }
            console.error(`❌ Falha após ${retries} tentativas de análise IA para: ${details.name}`);
          };

          // Executa em background
          scheduleAnalysisWithRetry().catch(err => 
            console.error("Erro crítico no agendamento de IA:", err)
          );

          return {
            nome: details.name,
            endereco: details.formatted_address,
            sinais: siteSignals,
          };
        }
      } catch (error) {
        console.error("Erro ao processar lead:", error);
      }
      return null;
    }

    // Processa leads em paralelo (máximo 5 por vez para não sobrecarregar)
    const leadsDetails = [];
    const batchSize = 5;
    
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      const results = await Promise.all(batch.map((place: any) => processLead(place)));
      leadsDetails.push(...results.filter(r => r !== null));
    }

    return new Response(
      JSON.stringify({
        success: true,
        leadsCount: leadsDetails.length,
        leads: leadsDetails,
        hasMore: leads.length >= body.quantidade, // Indica se provavelmente há mais resultados
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    // Log detailed error server-side
    console.error("Erro na busca de leads:", {
      message: error.message,
      stack: error.stack,
    });
    
    // Return generic error message to client
    // Only show specific message for known/expected errors
    let clientMessage = "Erro ao buscar leads. Tente novamente.";
    
    if (error.message?.includes("Cidade") && error.message?.includes("não encontrada")) {
      clientMessage = error.message; // Safe to show city not found error
    } else if (error.message?.includes("Token de paginação")) {
      clientMessage = error.message; // Safe to show pagination token error
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'SEARCH_ERROR',
        message: clientMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
