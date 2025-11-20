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
          throw new Error("Cidade não encontrada");
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
          console.log("Nearby Search status:", nearbyData.status);
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
          console.log("Text Search status:", textData.status);
        }
      }
    }

    console.log(`Encontrados ${leads.length} leads`);

    // Busca detalhes de cada lead e salva no banco
    const leadsDetails = [];
    
    for (const place of leads) {
      try {
        // Busca detalhes do lugar
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,geometry&key=${GOOGLE_API_KEY}`;
        
        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();
        
        if (detailsData.status === "OK") {
          const details = detailsData.result;
          
          // Insere no banco (ou atualiza se já existe)
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
            },
            { onConflict: "google_place_id" }
          );

          if (insertError) {
            console.error("Erro ao inserir lead:", insertError);
          } else {
            leadsDetails.push({
              nome: details.name,
              endereco: details.formatted_address,
            });
          }
        }
      } catch (error) {
        console.error("Erro ao buscar detalhes do lead:", error);
      }
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
