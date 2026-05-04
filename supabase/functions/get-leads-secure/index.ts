import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ============= CORS HELPER =============
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

// Rate limit configuration
const RATE_LIMIT_MAX_REQUESTS = 30; // Max requests per window
const RATE_LIMIT_WINDOW_MINUTES = 1; // Window in minutes

interface GetLeadsRequest {
  action: 'list' | 'view_detail' | 'export';
  salvo?: boolean | string | null;
  leadId?: string;
  page?: number;
  limit?: number;
  noPagination?: boolean;
  searchRunId?: string;
}

serve(async (req) => {
  const corsCheck = handleCorsRequest(req);
  if (corsCheck) return corsCheck;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // SECURITY: Get encryption key from external secret (NOT from database)
    const encryptionKey = Deno.env.get('LEADS_ENCRYPTION_KEY');
    if (!encryptionKey) {
      console.error("❌ LEADS_ENCRYPTION_KEY not configured");
      return new Response(JSON.stringify({ error: "Configuração de segurança inválida" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Client for user auth verification
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    });

    // Admin client for database operations with encryption key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("❌ Authentication failed:", authError?.message);
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request
    const body: GetLeadsRequest = await req.json();
    const { action = 'list', salvo, leadId, page = 1, limit = 200, noPagination = false, searchRunId } = body;

    // IMPORTANT: Normalize salvo parameter - handle string/boolean conversion
    // The value can come as string "true"/"false" or boolean true/false
    const salvoValue = salvo === true || salvo === 'true' ? true : 
                       salvo === false || salvo === 'false' ? false : null;

    // Validate inputs
    const validActions = ['list', 'view_detail', 'export'];
    if (!validActions.includes(action)) {
      return new Response(JSON.stringify({ error: "Ação inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get client info for logging
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                      req.headers.get("cf-connecting-ip") || 
                      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    console.log(`📊 [${action}] User: ${user.id} | IP: ${ipAddress} | salvo: ${salvo} → normalized: ${salvoValue} | searchRunId: ${searchRunId || 'none'}`);

    // Check rate limit for list/export actions
    if (action === 'list' || action === 'export') {
      const { data: rateLimitData, error: rateLimitError } = await supabaseAdmin
        .rpc('check_leads_rate_limit', {
          p_user_id: user.id,
          p_max_requests: RATE_LIMIT_MAX_REQUESTS,
          p_window_minutes: RATE_LIMIT_WINDOW_MINUTES
        });

      if (rateLimitError) {
        console.error("❌ Rate limit check error:", rateLimitError);
      } else if (rateLimitData && !rateLimitData.allowed) {
        console.warn(`⚠️ Rate limit exceeded for user ${user.id}: ${rateLimitData.current_count}/${rateLimitData.limit}`);
        return new Response(JSON.stringify({ 
          error: "Limite de requisições excedido. Tente novamente em alguns minutos.",
          rate_limit: {
            remaining: 0,
            limit: rateLimitData.limit,
            reset_in_minutes: RATE_LIMIT_WINDOW_MINUTES
          }
        }), {
          status: 429,
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "X-RateLimit-Limit": String(rateLimitData.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(RATE_LIMIT_WINDOW_MINUTES * 60)
          },
        });
      }
    }

    let responseData: any;
    let leadsCount = 0;
    let leadIds: string[] = [];

    // Handle different actions
    if (action === 'view_detail' && leadId) {
      // Get single lead with full details using secure wrapper
      // SECURITY: Encryption key passed as parameter, restricted to service_role
      const { data: leads, error } = await supabaseAdmin
        .rpc('get_lead_decrypted_by_id', {
          p_lead_id: leadId, 
          p_user_id: user.id 
        });

      if (error) {
        console.error("❌ Error fetching lead detail:", error);
        throw error;
      }

      if (!leads || leads.length === 0) {
        return new Response(JSON.stringify({ error: "Lead não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      responseData = leads[0];
      leadsCount = 1;
      leadIds = [leadId];
      
    } else if (action === 'list' || action === 'export') {
      // Get leads list with optional filtering using secure wrapper
      // SECURITY: Encryption key passed as parameter, restricted to service_role
      const { data: leads, error } = await supabaseAdmin
        .rpc('set_encryption_key_and_get_leads_filtered', { 
          p_encryption_key: encryptionKey,
          p_salvo: salvoValue,
          p_user_id: user.id,
          p_search_run_id: searchRunId || null
        });

      if (error) {
        console.error("❌ Error fetching leads:", error);
        throw error;
      }

      // Leads already filtered by user_id in the RPC function
      const userLeads = leads || [];
      
      // Apply pagination for list (not export)
      // When searchRunId is provided, skip pagination (return all from that search)
      const skipPagination = noPagination || !!searchRunId;
      const safeLimit = Math.min(Math.max(1, limit), action === 'export' ? 500 : 300);
      const offset = (Math.max(1, page) - 1) * safeLimit;
      
      const paginatedLeads = action === 'export' 
        ? userLeads.slice(0, 500) // Export limit
        : skipPagination 
          ? userLeads // Return all leads when searchRunId is provided or noPagination is true
          : userLeads.slice(offset, offset + safeLimit);

      leadsCount = paginatedLeads.length;
      leadIds = paginatedLeads.map((l: any) => l.id);

      responseData = {
        leads: paginatedLeads,
        pagination: {
          page,
          limit: safeLimit,
          total: userLeads.length,
          total_pages: Math.ceil(userLeads.length / safeLimit)
        }
      };
    }

    // Log access (async, don't wait)
    supabaseAdmin.rpc('log_leads_access', {
      p_user_id: user.id,
      p_action_type: action,
      p_lead_ids: leadIds.length > 0 ? leadIds : null,
      p_leads_count: leadsCount,
      p_ip_address: ipAddress,
      p_user_agent: userAgent.substring(0, 500), // Limit user agent length
      p_request_params: { salvo, page, limit }
    }).then(({ error }) => {
      if (error) console.error("⚠️ Failed to log access:", error);
    });

    // Get rate limit info for response headers
    const { data: rateLimitInfo } = await supabaseAdmin.rpc('check_leads_rate_limit', {
      p_user_id: user.id,
      p_max_requests: RATE_LIMIT_MAX_REQUESTS,
      p_window_minutes: RATE_LIMIT_WINDOW_MINUTES
    });

    console.log(`✅ [${action}] Returned ${leadsCount} leads for user ${user.id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      data: responseData,
      rate_limit: rateLimitInfo ? {
        remaining: rateLimitInfo.remaining,
        limit: rateLimitInfo.limit,
        reset_in_minutes: RATE_LIMIT_WINDOW_MINUTES
      } : undefined
    }), {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        ...(rateLimitInfo ? {
          "X-RateLimit-Limit": String(rateLimitInfo.limit),
          "X-RateLimit-Remaining": String(rateLimitInfo.remaining),
          "X-RateLimit-Reset": String(RATE_LIMIT_WINDOW_MINUTES * 60)
        } : {})
      },
    });

  } catch (error: unknown) {
    console.error('❌ Error in get-leads-secure:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
