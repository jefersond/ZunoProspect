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
    let totalAvailable = 0; // Total de leads disponíveis ANTES de limitar

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
      totalAvailable = mockLeads.length;
    } else {
      // Busca real com Google Places API
      if (body.proximidadeAtiva && body.raioKm) {
        // Busca por proximidade (Nearby Search)
        console.log("Buscando por proximidade (Nearby Search)...");

        // Se for busca incremental, aumenta o raio em 50% para encontrar novos leads
        const isIncremental = body.excludePlaceIds && body.excludePlaceIds.length > 0;
        const searchRadius = isIncremental ? body.raioKm * 1.5 : body.raioKm;
        
        if (isIncremental) {
          console.log(`Busca incremental: raio expandido de ${body.raioKm}km para ${searchRadius}km`);
        }

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

        const location = geocodeData.results[0].geometry.location;
        console.log("Coordenadas do centro da cidade:", location);

        // Nearby Search com keyword (nicho) e raio
        let nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${
          searchRadius * 1000
        }&keyword=${encodeURIComponent(body.nicho)}&key=${GOOGLE_API_KEY}`;

        // Se houver pageToken, usa para paginação (busca incremental)
        if (body.pageToken) {
          nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${body.pageToken}&key=${GOOGLE_API_KEY}`;
          console.log("Usando pageToken para busca incremental");
        }

        const nearbyResponse = await fetch(nearbyUrl);
        const nearbyData = await nearbyResponse.json();

      if (nearbyData.status === "OK") {
          // Guarda o total de resultados disponíveis ANTES de limitar
          totalAvailable = nearbyData.results.length;
          
          // Se for busca incremental, pega TODOS os resultados (até 20) para filtrar depois
          // Se não, pega apenas a quantidade solicitada
          leads = body.excludePlaceIds && body.excludePlaceIds.length > 0
            ? nearbyData.results // Busca incremental: pega tudo para filtrar
            : nearbyData.results.slice(0, body.quantidade);
          
          console.log(`Google retornou ${nearbyData.results.length} resultados`);
        } else if (nearbyData.status === "INVALID_REQUEST" && body.pageToken) {
          // PageToken pode ter expirado (válido por ~2 minutos)
          throw new Error("Token de paginação expirou. Tente fazer uma nova busca.");
        } else {
          console.error("Nearby Search falhou:", nearbyData.status, nearbyData.error_message);
          throw new Error(`Erro na busca: ${nearbyData.error_message || nearbyData.status}`);
        }
      } else {
        // Busca por texto (Text Search)
        console.log("Buscando por texto (Text Search)...");

        let textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
          `${body.nicho} ${body.cidade} ${body.estado}`
        )}&key=${GOOGLE_API_KEY}`;

        // Se houver pageToken, usa para paginação (busca incremental)
        if (body.pageToken) {
          textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${body.pageToken}&key=${GOOGLE_API_KEY}`;
          console.log("Usando pageToken para busca incremental");
        }

        const textResponse = await fetch(textSearchUrl);
        const textData = await textResponse.json();

        if (textData.status === "OK") {
          // Guarda o total de resultados disponíveis ANTES de limitar
          totalAvailable = textData.results.length;
          
          // Se for busca incremental, pega TODOS os resultados (até 20) para filtrar depois
          // Se não, pega apenas a quantidade solicitada
          leads = body.excludePlaceIds && body.excludePlaceIds.length > 0
            ? textData.results // Busca incremental: pega tudo para filtrar
            : textData.results.slice(0, body.quantidade);
          
          console.log(`Google retornou ${textData.results.length} resultados`);
        } else if (textData.status === "INVALID_REQUEST" && body.pageToken) {
          // PageToken pode ter expirado (válido por ~2 minutos)
          throw new Error("Token de paginação expirou. Tente fazer uma nova busca.");
        } else {
          console.error("Text Search falhou:", textData.status, textData.error_message);
          throw new Error(`Erro na busca: ${textData.error_message || textData.status}`);
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
    const maxLeadsToProcess = isUnlimited ? body.quantidade : Math.min(body.quantidade, userQuota);
    const limitedByQuota = !isUnlimited && leadsAfterFilter > userQuota && userQuota < body.quantidade;
    
    console.log(`Quota do usuário: ${isUnlimited ? 'ilimitado' : userQuota} | Leads após filtro: ${leadsAfterFilter} | Será processado: ${Math.min(leadsAfterFilter, maxLeadsToProcess)}`);
    
    // Limita ao número que pode processar (considerando quota)
    leads = leads.slice(0, maxLeadsToProcess);
    
    // Calcula leads adicionais disponíveis (incentivo para upgrade)
    const additionalLeadsAvailable = limitedByQuota ? Math.max(0, totalAvailable - leads.length) : 0;
    
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

        // Detectar Instagram URL
        const instagramMatch = html.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
        if (instagramMatch) {
          signals.instagram_url = `https://instagram.com/${instagramMatch[1]}`;
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
            scheduleAnalysis: scheduleAnalysisWithRetry
          };
        }
      } catch (error) {
        console.error("Erro ao processar lead:", error);
      }
      return null;
    }

    // Processa leads em paralelo (máximo 5 por vez para não sobrecarregar)
    const leadsWithAnalysis: { leadResult: any; scheduleAnalysis: () => Promise<void> }[] = [];
    const batchSize = 5;
    
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      const results = await Promise.all(batch.map((place: any) => processLead(place)));
      leadsWithAnalysis.push(...results.filter(r => r !== null) as any[]);
    }

    // Extrai apenas os resultados dos leads para retorno
    const leadsDetails = leadsWithAnalysis.map(item => item.leadResult);

    // ============================================
    // PROCESSAMENTO PARALELO DE ANÁLISES IA (3x mais rápido)
    // ============================================
    const AI_BATCH_SIZE = 3; // 3 análises simultâneas
    const DELAY_BETWEEN_BATCHES_MS = 1000; // 1 segundo entre lotes
    
    console.log(`📊 Processando ${leadsWithAnalysis.length} análises de IA em lotes de ${AI_BATCH_SIZE} (paralelo)...`);
    
    // Processa análises em lotes paralelos
    for (let i = 0; i < leadsWithAnalysis.length; i += AI_BATCH_SIZE) {
      const batch = leadsWithAnalysis.slice(i, i + AI_BATCH_SIZE);
      const batchNumber = Math.floor(i / AI_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(leadsWithAnalysis.length / AI_BATCH_SIZE);
      
      console.log(`🔄 Processando lote ${batchNumber}/${totalBatches} (${batch.length} análises em paralelo)...`);
      
      // Executa lote em PARALELO
      const batchPromises = batch.map(async (item, idx) => {
        if (item.scheduleAnalysis) {
          try {
            await item.scheduleAnalysis();
            console.log(`✅ Análise ${i + idx + 1}/${leadsWithAnalysis.length} concluída.`);
          } catch (err) {
            console.error(`❌ Erro na análise ${i + idx + 1}/${leadsWithAnalysis.length}:`, err);
          }
        }
      });
      
      await Promise.all(batchPromises);
      
      // Delay apenas ENTRE lotes (não entre análises do mesmo lote)
      if (i + AI_BATCH_SIZE < leadsWithAnalysis.length) {
        console.log(`⏳ Aguardando ${DELAY_BETWEEN_BATCHES_MS/1000}s antes do próximo lote...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      }
    }
    
    console.log(`✅ Todas as ${leadsWithAnalysis.length} análises de IA foram processadas em paralelo!`);

    return new Response(
      JSON.stringify({
        success: true,
        leadsCount: leadsDetails.length,
        leads: leadsDetails,
        hasMore: leads.length >= body.quantidade,
        // Campos para incentivo de upgrade
        totalAvailable,
        limitedByQuota,
        additionalLeadsAvailable,
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
