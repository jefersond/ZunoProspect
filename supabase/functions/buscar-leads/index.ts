import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProspeccaoRequest {
  cidade: string;
  nicho: string;
  quantidade: number;
  foco: string;
  proximidadeAtiva: boolean;
  raioKm?: number;
  canaisProspeccao?: ("email" | "whatsapp" | "instagram")[];
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
      // Busca real com Google Places API
      if (body.proximidadeAtiva && body.raioKm) {
        // Busca por proximidade (Nearby Search)
        console.log("Buscando por proximidade (Nearby Search)...");

        // Geocodifica a cidade para obter lat/lng do centro
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          body.cidade
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
        const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${
          body.raioKm * 1000
        }&keyword=${encodeURIComponent(body.nicho)}&key=${GOOGLE_API_KEY}`;

        const nearbyResponse = await fetch(nearbyUrl);
        const nearbyData = await nearbyResponse.json();

      if (nearbyData.status === "OK") {
          leads = nearbyData.results.slice(0, body.quantidade);
        } else {
          console.error("Nearby Search falhou:", nearbyData.status, nearbyData.error_message);
          throw new Error(`Erro na busca: ${nearbyData.error_message || nearbyData.status}`);
        }
      } else {
        // Busca por texto (Text Search)
        console.log("Buscando por texto (Text Search)...");

        const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
          `${body.nicho} ${body.cidade}`
        )}&key=${GOOGLE_API_KEY}`;

        const textResponse = await fetch(textSearchUrl);
        const textData = await textResponse.json();

        if (textData.status === "OK") {
          leads = textData.results.slice(0, body.quantidade);
        } else {
          console.error("Text Search falhou:", textData.status, textData.error_message);
          throw new Error(`Erro na busca: ${textData.error_message || textData.status}`);
        }
      }
    }

    console.log(`Encontrados ${leads.length} leads`);

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
          
          // Insere no banco (ou atualiza se já existe)
          // IMPORTANTE: Limpa os campos de análise IA para forçar regeneração quando o foco muda
          const { error: insertError } = await supabaseClient.from("leads").upsert(
            {
              nome: details.name,
              endereco: details.formatted_address,
              telefone: details.formatted_phone_number || null,
              website: details.website || null,
              google_place_id: place.place_id,
              rating: details.rating || null,
              total_reviews: details.user_ratings_total || 0,
              cidade: body.cidade,
              latitude: details.geometry?.location?.lat || null,
              longitude: details.geometry?.location?.lng || null,
              nicho: body.nicho,
              foco: body.foco,
              status: "novo",
              user_id: user.id,
              proximidade_ativa: body.proximidadeAtiva,
              raio_km: body.raioKm,
              whatsapp_on_site: siteSignals.whatsapp_on_site,
              whatsapp_number: siteSignals.whatsapp_number,
              has_meta_pixel: siteSignals.has_meta_pixel,
              has_gtag: siteSignals.has_gtag,
              has_gtm: siteSignals.has_gtm,
              instagram_url: siteSignals.instagram_url,
              digital_signals: siteSignals,
              // Limpa análise IA anterior para forçar regeneração com novo foco
              diagnostico_bullets: null,
              probabilidade_conversao: null,
              plano_prospeccao: null,
              ai_analise_gerada_em: null,
            },
            { onConflict: "google_place_id" }
          );

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
