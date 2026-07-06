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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
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

// Hash API key using SHA-256
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  const corsCheck = handleCorsRequest(req);
  if (corsCheck) return corsCheck;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: 'API Key não fornecida',
        hint: 'Adicione o header x-api-key com sua API Key'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate API key format
    if (!apiKey.startsWith('zuno_')) {
      return new Response(JSON.stringify({ error: 'Formato de API Key inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Hash and lookup key
    const keyHash = await hashApiKey(apiKey);
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from('api_keys')
      .select('id, user_id, revoked_at')
      .eq('key_hash', keyHash)
      .single();

    if (keyError || !keyData) {
      return new Response(JSON.stringify({ error: 'API Key inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (keyData.revoked_at) {
      return new Response(JSON.stringify({ error: 'API Key revogada' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = keyData.user_id;

    // Update last_used_at
    await supabaseAdmin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyData.id);

    // Verify user has Agency plan or is admin
    const { data: subscription } = await supabaseAdmin
      .from('user_subscriptions')
      .select('plan_name')
      .eq('user_id', userId)
      .single();

    const { data: isAdmin } = await supabaseAdmin.rpc('is_admin', { _user_id: userId });
    const isAgency = subscription?.plan_name === 'agencia';

    if (!isAdmin && !isAgency) {
      return new Response(JSON.stringify({ 
        error: 'API de Integração disponível apenas para o plano Agência' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const method = req.method;

    // Extract lead ID from path (/api-leads/{id}) or query param (?id=...)
    const pathParts = url.pathname.split('/').filter(Boolean);
    const lastSegment = pathParts[pathParts.length - 1];
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pathLeadId = UUID_REGEX.test(lastSegment) ? lastSegment : null;
    const leadId = url.searchParams.get('id') || pathLeadId;

    // GET /api-leads?action=analytics - Get analytics summary
    if (method === 'GET' && action === 'analytics') {
      // Count leads by status
      const { data: statusCounts } = await supabaseAdmin
        .from('leads')
        .select('status')
        .eq('user_id', userId);

      const analytics = {
        total_leads: statusCounts?.length || 0,
        by_status: {} as Record<string, number>,
        by_foco: {} as Record<string, number>,
        saved_leads: 0,
      };

      // Get saved count
      const { count: savedCount } = await supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('salvo', true);

      analytics.saved_leads = savedCount || 0;

      // Count by status
      statusCounts?.forEach(lead => {
        const status = lead.status || 'novo';
        analytics.by_status[status] = (analytics.by_status[status] || 0) + 1;
      });

      // Count by foco
      const { data: focoCounts } = await supabaseAdmin
        .from('leads')
        .select('foco')
        .eq('user_id', userId);

      focoCounts?.forEach(lead => {
        const foco = lead.foco || 'outros';
        analytics.by_foco[foco] = (analytics.by_foco[foco] || 0) + 1;
      });

      return new Response(JSON.stringify({ success: true, data: analytics }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /api-leads/{id} or ?id=<uuid> - Get single lead with decrypted contacts
    if (method === 'GET' && leadId) {
      const encryptionKey = Deno.env.get('LEADS_ENCRYPTION_KEY');

      if (encryptionKey) {
        // Use the filtered RPC (proven to work) and pick the lead by ID
        const { data: allLeads, error: rpcError } = await supabaseAdmin
          .rpc('set_encryption_key_and_get_leads_filtered', {
            p_encryption_key: encryptionKey,
            p_salvo: null,
            p_user_id: userId,
            p_search_run_id: null
          });

        if (rpcError) throw rpcError;

        const raw = (allLeads || []).find((l: any) => l.id === leadId);

        if (!raw) {
          return new Response(JSON.stringify({ error: 'Lead não encontrado' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const lead = {
          id: raw.id,
          nome: raw.nome,
          cidade: raw.cidade,
          nicho: raw.nicho,
          foco: raw.foco,
          status: raw.status,
          rating: raw.rating,
          total_reviews: raw.total_reviews,
          probabilidade_conversao: raw.probabilidade_conversao,
          salvo: raw.salvo,
          phone: raw.whatsapp_number || raw.telefone || '',
          email: raw.email || '',
          instagram: raw.instagram_url || '',
          website: raw.website || '',
          created_at: raw.created_at,
          updated_at: raw.updated_at,
        };

        return new Response(JSON.stringify({ success: true, data: lead }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fallback: unencrypted single lead
      const { data: rows, error } = await supabaseAdmin
        .from('leads')
        .select('id, nome, cidade, nicho, foco, status, rating, total_reviews, probabilidade_conversao, salvo, created_at, updated_at')
        .eq('id', leadId)
        .eq('user_id', userId)
        .limit(1);

      const lead = rows?.[0];
      if (error || !lead) {
        return new Response(JSON.stringify({ error: 'Lead não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, data: lead }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /api-leads - List leads with pagination + decrypted contact fields
    if (method === 'GET') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
      const statusFilter = url.searchParams.get('status');
      const focoFilter = url.searchParams.get('foco');
      const salvoParam = url.searchParams.get('salvo');
      const offset = (page - 1) * limit;

      const encryptionKey = Deno.env.get('LEADS_ENCRYPTION_KEY');
      let leads: any[];
      let total: number;

      if (encryptionKey) {
        // Use RPC to get decrypted contact data (same as internal app)
        const salvoValue = salvoParam === 'true' ? true : salvoParam === 'false' ? false : null;
        const { data: rpcLeads, error: rpcError } = await supabaseAdmin
          .rpc('set_encryption_key_and_get_leads_filtered', {
            p_encryption_key: encryptionKey,
            p_salvo: salvoValue,
            p_user_id: userId,
            p_search_run_id: null
          });

        if (rpcError) throw rpcError;

        let filtered: any[] = rpcLeads || [];
        if (statusFilter) filtered = filtered.filter((l: any) => l.status === statusFilter);
        if (focoFilter) filtered = filtered.filter((l: any) => l.foco === focoFilter);

        total = filtered.length;
        const paginated = filtered.slice(offset, offset + limit);

        leads = paginated.map((l: any) => ({
          id: l.id,
          nome: l.nome,
          cidade: l.cidade,
          nicho: l.nicho,
          foco: l.foco,
          status: l.status,
          rating: l.rating,
          total_reviews: l.total_reviews,
          probabilidade_conversao: l.probabilidade_conversao,
          salvo: l.salvo,
          phone: l.whatsapp_number || l.telefone || '',
          email: l.email || '',
          instagram: l.instagram_url || '',
          website: l.website || '',
          created_at: l.created_at,
          updated_at: l.updated_at,
        }));
      } else {
        // Fallback: unencrypted query (contact fields absent)
        let query = supabaseAdmin
          .from('leads')
          .select('id, nome, cidade, nicho, foco, status, rating, total_reviews, probabilidade_conversao, salvo, created_at, updated_at', { count: 'exact' })
          .eq('user_id', userId);

        if (statusFilter) query = query.eq('status', statusFilter);
        if (focoFilter) query = query.eq('foco', focoFilter);
        if (salvoParam !== null) query = query.eq('salvo', salvoParam === 'true');

        const { data, error, count } = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) throw error;
        leads = data || [];
        total = count || 0;
      }

      return new Response(JSON.stringify({
        success: true,
        data: leads,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PATCH /api-leads - Update lead
    if (method === 'PATCH') {
      const body = await req.json();
      const { id, status, notas, salvo } = body;

      if (!id) {
        return new Response(JSON.stringify({ error: 'ID do lead é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const updateData: Record<string, any> = {};
      if (status !== undefined) updateData.status = status;
      if (notas !== undefined) updateData.notas = notas;
      if (salvo !== undefined) updateData.salvo = salvo;

      if (Object.keys(updateData).length === 0) {
        return new Response(JSON.stringify({ error: 'Nenhum campo para atualizar' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabaseAdmin
        .from('leads')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId)
        .select('id, nome, status, notas, salvo')
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: 'Lead não encontrado ou não autorizado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Lead updated via API: ${id} by user ${userId}`);

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in api-leads:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
