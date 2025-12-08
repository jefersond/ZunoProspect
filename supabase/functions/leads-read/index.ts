import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

// Sanitize error messages for security
function sanitizeError(error: unknown): string {
  console.error('Internal error:', error);
  return 'Erro interno do servidor';
}

/**
 * Leads Read - Application Layer Security
 * 
 * This edge function provides secure read access to leads data:
 * 1. Validates user authentication via JWT
 * 2. Enforces ownership checks (user can only see their own leads)
 * 3. Controls which fields are returned (no raw encrypted data exposed)
 * 4. Decryption happens server-side via RPC function
 * 
 * The frontend should NEVER access the leads table directly.
 * All reads must go through this function.
 */

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get the authorization header to verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        error: 'UNAUTHORIZED',
        message: 'Não autorizado'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with user's token to verify authentication
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ 
        error: 'UNAUTHORIZED',
        message: 'Sessão inválida'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    
    // Use user's client for RPC calls (respects RLS + user context)
    // The RPC function get_leads_decrypted_filtered uses auth.uid() internally

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ 
        error: 'INVALID_JSON',
        message: 'Corpo da requisição inválido'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, leadId, salvo } = body;

    // Validate action
    const validActions = ['list', 'get_by_id', 'get_filtered', 'get_place_ids', 'get_stats', 'get_reports_data'];
    if (!action || !validActions.includes(action)) {
      return new Response(JSON.stringify({ 
        error: 'INVALID_ACTION',
        message: 'Ação inválida'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET PLACE IDS - For duplicate detection (returns minimal data)
    if (action === 'get_place_ids') {
      const { salvo } = body;
      console.log(`Fetching place IDs for user ${userId} with salvo=${salvo}`);

      // Use service role to access non-sensitive data efficiently
      const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
      
      let query = supabaseService
        .from('leads')
        .select('google_place_id')
        .eq('user_id', userId)
        .not('google_place_id', 'is', null);
      
      if (salvo === true || salvo === false) {
        query = query.eq('salvo', salvo);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Query error:', error);
        return new Response(JSON.stringify({ 
          error: 'FETCH_FAILED',
          message: 'Erro ao buscar place IDs'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const placeIds = (data || []).map(l => l.google_place_id).filter(Boolean);
      
      console.log(`Returned ${placeIds.length} place IDs for user ${userId}`);

      return new Response(JSON.stringify({ 
        success: true,
        data: placeIds 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET STATS - For dashboard metrics (non-sensitive aggregates only)
    if (action === 'get_stats') {
      console.log(`Fetching stats for user ${userId}`);

      const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data, error } = await supabaseService
        .from('leads')
        .select('id, nome, cidade, nicho, foco, status, probabilidade_conversao, salvo, created_at, updated_at, rating, total_reviews, whatsapp_on_site, has_meta_pixel, has_gtag, has_gtm')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Query error:', error);
        return new Response(JSON.stringify({ 
          error: 'FETCH_FAILED',
          message: 'Erro ao buscar estatísticas'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Returned stats for ${(data || []).length} leads`);

      return new Response(JSON.stringify({ 
        success: true,
        data: data || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET REPORTS DATA - For advanced reports with filtering (non-sensitive data + encrypted presence check)
    if (action === 'get_reports_data') {
      const { dateStart, dateEnd, nicho, foco, cidade } = body;
      console.log(`Fetching reports data for user ${userId}`);

      const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
      
      let query = supabaseService
        .from('leads')
        .select('id, nome, cidade, nicho, foco, status, probabilidade_conversao, salvo, created_at, updated_at, rating, total_reviews, whatsapp_on_site, has_meta_pixel, has_gtag, has_gtm, whatsapp_number_encrypted, email_encrypted, telefone_encrypted, instagram_url_encrypted')
        .eq('user_id', userId);
      
      // Apply date filters if provided
      if (dateStart) {
        query = query.gte('created_at', dateStart);
      }
      if (dateEnd) {
        query = query.lte('created_at', dateEnd);
      }
      
      // Apply field filters
      if (nicho) query = query.eq('nicho', nicho);
      if (foco) query = query.eq('foco', foco);
      if (cidade) query = query.eq('cidade', cidade);
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Query error:', error);
        return new Response(JSON.stringify({ 
          error: 'FETCH_FAILED',
          message: 'Erro ao buscar dados de relatórios'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Transform data to indicate presence of contact info without exposing encrypted data
      const safeData = (data || []).map((lead: any) => ({
        id: lead.id,
        nome: lead.nome,
        cidade: lead.cidade,
        nicho: lead.nicho,
        foco: lead.foco,
        status: lead.status,
        probabilidade_conversao: lead.probabilidade_conversao,
        salvo: lead.salvo,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
        rating: lead.rating,
        total_reviews: lead.total_reviews,
        whatsapp_on_site: lead.whatsapp_on_site,
        has_meta_pixel: lead.has_meta_pixel,
        has_gtag: lead.has_gtag,
        has_gtm: lead.has_gtm,
        // Only expose boolean presence of contact info, not the actual encrypted data
        has_whatsapp: !!lead.whatsapp_number_encrypted,
        has_email: !!lead.email_encrypted,
        has_telefone: !!lead.telefone_encrypted,
        has_instagram: !!lead.instagram_url_encrypted,
      }));

      // Also fetch filter options (distinct values)
      const { data: filterOptions } = await supabaseService
        .from('leads')
        .select('nicho, foco, cidade')
        .eq('user_id', userId);

      console.log(`Returned reports data for ${safeData.length} leads`);

      return new Response(JSON.stringify({ 
        success: true,
        data: safeData,
        filterOptions: {
          nichos: [...new Set((filterOptions || []).map((l: any) => l.nicho).filter(Boolean))],
          focos: [...new Set((filterOptions || []).map((l: any) => l.foco).filter(Boolean))],
          cidades: [...new Set((filterOptions || []).map((l: any) => l.cidade).filter(Boolean))],
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET FILTERED - List leads with optional salvo filter
    if (action === 'get_filtered') {
      // salvo can be true, false, or null (all leads)
      const salvoParam = salvo === true || salvo === false ? salvo : null;
      
      console.log(`Fetching leads for user ${userId} with salvo=${salvoParam}`);

      // Use authenticated client to call RPC (respects user context)
      const { data, error } = await supabaseUser
        .rpc('get_leads_decrypted_filtered', { p_salvo: salvoParam });

      if (error) {
        console.error('RPC error:', error);
        return new Response(JSON.stringify({ 
          error: 'FETCH_FAILED',
          message: 'Erro ao buscar leads'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Filter to only expose necessary fields (application-layer field control)
      const safeLeads = (data || []).map((lead: any) => ({
        id: lead.id,
        google_place_id: lead.google_place_id,
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email,
        endereco: lead.endereco,
        whatsapp_number: lead.whatsapp_number,
        website: lead.website,
        instagram_url: lead.instagram_url,
        cidade: lead.cidade,
        nicho: lead.nicho,
        foco: lead.foco,
        status: lead.status,
        notas: lead.notas,
        rating: lead.rating,
        total_reviews: lead.total_reviews,
        whatsapp_on_site: lead.whatsapp_on_site,
        has_meta_pixel: lead.has_meta_pixel,
        has_gtag: lead.has_gtag,
        has_gtm: lead.has_gtm,
        diagnostico_bullets: lead.diagnostico_bullets,
        probabilidade_conversao: lead.probabilidade_conversao,
        plano_prospeccao: lead.plano_prospeccao,
        ai_analise_gerada_em: lead.ai_analise_gerada_em,
        proximidade_ativa: lead.proximidade_ativa,
        raio_km: lead.raio_km,
        salvo: lead.salvo,
        instagram_context: lead.instagram_context,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
        // CNPJ data
        cnpj: lead.cnpj,
        razao_social: lead.razao_social,
        nome_responsavel: lead.nome_responsavel,
        cnpj_telefone: lead.cnpj_telefone,
        cnpj_email: lead.cnpj_email,
        situacao_cadastral: lead.situacao_cadastral,
        porte_empresa: lead.porte_empresa,
        cnae_principal: lead.cnae_principal,
        // Explicitly NOT including:
        // - user_id (not needed by frontend)
        // - latitude/longitude (not needed unless mapping)
        // - raw encrypted fields (never exposed)
      }));

      console.log(`Returned ${safeLeads.length} leads for user ${userId}`);

      return new Response(JSON.stringify({ 
        success: true,
        data: safeLeads 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // LIST - Get all leads for user (alias for get_filtered with null)
    if (action === 'list') {
      console.log(`Listing all leads for user ${userId}`);

      const { data, error } = await supabaseUser
        .rpc('get_leads_decrypted');

      if (error) {
        console.error('RPC error:', error);
        return new Response(JSON.stringify({ 
          error: 'FETCH_FAILED',
          message: 'Erro ao buscar leads'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Same field filtering as above
      const safeLeads = (data || []).map((lead: any) => ({
        id: lead.id,
        google_place_id: lead.google_place_id,
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email,
        endereco: lead.endereco,
        whatsapp_number: lead.whatsapp_number,
        website: lead.website,
        instagram_url: lead.instagram_url,
        cidade: lead.cidade,
        nicho: lead.nicho,
        foco: lead.foco,
        status: lead.status,
        notas: lead.notas,
        rating: lead.rating,
        total_reviews: lead.total_reviews,
        whatsapp_on_site: lead.whatsapp_on_site,
        has_meta_pixel: lead.has_meta_pixel,
        has_gtag: lead.has_gtag,
        has_gtm: lead.has_gtm,
        diagnostico_bullets: lead.diagnostico_bullets,
        probabilidade_conversao: lead.probabilidade_conversao,
        plano_prospeccao: lead.plano_prospeccao,
        ai_analise_gerada_em: lead.ai_analise_gerada_em,
        proximidade_ativa: lead.proximidade_ativa,
        raio_km: lead.raio_km,
        salvo: lead.salvo,
        instagram_context: lead.instagram_context,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
        cnpj: lead.cnpj,
        razao_social: lead.razao_social,
        nome_responsavel: lead.nome_responsavel,
        cnpj_telefone: lead.cnpj_telefone,
        cnpj_email: lead.cnpj_email,
        situacao_cadastral: lead.situacao_cadastral,
        porte_empresa: lead.porte_empresa,
        cnae_principal: lead.cnae_principal,
      }));

      console.log(`Returned ${safeLeads.length} leads for user ${userId}`);

      return new Response(JSON.stringify({ 
        success: true,
        data: safeLeads 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET BY ID - Get single lead
    if (action === 'get_by_id') {
      if (!leadId || !isValidUUID(leadId)) {
        return new Response(JSON.stringify({ 
          error: 'INVALID_LEAD_ID',
          message: 'ID do lead inválido'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Fetching lead ${leadId} for user ${userId}`);

      // Use RPC to get decrypted data
      const { data, error } = await supabaseUser
        .rpc('get_leads_decrypted');

      if (error) {
        console.error('RPC error:', error);
        return new Response(JSON.stringify({ 
          error: 'FETCH_FAILED',
          message: 'Erro ao buscar lead'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Find the specific lead (RPC already filters by user_id via auth.uid())
      const lead = (data || []).find((l: any) => l.id === leadId);

      if (!lead) {
        return new Response(JSON.stringify({ 
          error: 'LEAD_NOT_FOUND',
          message: 'Lead não encontrado'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Return single lead with field filtering
      const safeLead = {
        id: lead.id,
        google_place_id: lead.google_place_id,
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email,
        endereco: lead.endereco,
        whatsapp_number: lead.whatsapp_number,
        website: lead.website,
        instagram_url: lead.instagram_url,
        cidade: lead.cidade,
        nicho: lead.nicho,
        foco: lead.foco,
        status: lead.status,
        notas: lead.notas,
        rating: lead.rating,
        total_reviews: lead.total_reviews,
        whatsapp_on_site: lead.whatsapp_on_site,
        has_meta_pixel: lead.has_meta_pixel,
        has_gtag: lead.has_gtag,
        has_gtm: lead.has_gtm,
        diagnostico_bullets: lead.diagnostico_bullets,
        probabilidade_conversao: lead.probabilidade_conversao,
        plano_prospeccao: lead.plano_prospeccao,
        ai_analise_gerada_em: lead.ai_analise_gerada_em,
        proximidade_ativa: lead.proximidade_ativa,
        raio_km: lead.raio_km,
        salvo: lead.salvo,
        instagram_context: lead.instagram_context,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
        cnpj: lead.cnpj,
        razao_social: lead.razao_social,
        nome_responsavel: lead.nome_responsavel,
        cnpj_telefone: lead.cnpj_telefone,
        cnpj_email: lead.cnpj_email,
        situacao_cadastral: lead.situacao_cadastral,
        porte_empresa: lead.porte_empresa,
        cnae_principal: lead.cnae_principal,
      };

      console.log(`Returned lead ${leadId} for user ${userId}`);

      return new Response(JSON.stringify({ 
        success: true,
        data: safeLead 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      error: 'INVALID_ACTION',
      message: 'Ação não reconhecida'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = sanitizeError(error);
    return new Response(JSON.stringify({ 
      error: 'INTERNAL_ERROR',
      message: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
