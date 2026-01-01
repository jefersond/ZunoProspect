import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { data: adminRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    const isAdmin = !!adminRole;
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
    const leadId = url.searchParams.get('id');
    const method = req.method;

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

    // GET /api-leads?id=<uuid> - Get single lead
    if (method === 'GET' && leadId) {
      const encryptionKey = Deno.env.get('LEADS_ENCRYPTION_KEY');
      if (!encryptionKey) {
        console.error('LEADS_ENCRYPTION_KEY not configured');
        return new Response(JSON.stringify({ error: 'Configuração de criptografia ausente' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: leads, error } = await supabaseAdmin
        .rpc('set_encryption_key_and_get_lead_by_id', { 
          p_encryption_key: encryptionKey,
          p_lead_id: leadId, 
          p_user_id: userId 
        });

      const lead = leads?.[0];

      if (error || !lead) {
        console.error('Lead fetch error:', error?.message || 'Not found');
        return new Response(JSON.stringify({ error: 'Lead não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, data: lead }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /api-leads - List leads with pagination
    if (method === 'GET') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
      const status = url.searchParams.get('status');
      const foco = url.searchParams.get('foco');
      const salvo = url.searchParams.get('salvo');
      const offset = (page - 1) * limit;

      // Build query
      let query = supabaseAdmin
        .from('leads')
        .select('id, nome, cidade, nicho, foco, status, rating, total_reviews, probabilidade_conversao, salvo, created_at, updated_at', { count: 'exact' })
        .eq('user_id', userId);

      if (status) query = query.eq('status', status);
      if (foco) query = query.eq('foco', foco);
      if (salvo !== null) query = query.eq('salvo', salvo === 'true');

      const { data: leads, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return new Response(JSON.stringify({ 
        success: true, 
        data: leads,
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
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
