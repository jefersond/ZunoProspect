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

// ============= RATE LIMITING =============
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 60; // Max requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }
  
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// ============= ALLOWED FIELDS WHITELIST =============
const ALLOWED_SENSITIVE_FIELDS = [
  'telefone',
  'email',
  'whatsapp_number',
  'website',
  'instagram_url',
  'endereco',
  'cnpj_telefone',
  'cnpj_email'
] as const;

type SensitiveField = typeof ALLOWED_SENSITIVE_FIELDS[number];

interface LeadsSensitiveRequest {
  leadId: string;
  fields?: string[];
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Check origin
  if (origin && corsHeaders["Access-Control-Allow-Origin"] === "") {
    return new Response(JSON.stringify({ error: "Origem não autorizada" }), { 
      status: 403, 
      headers: { "Content-Type": "application/json" } 
    });
  }

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

    // Verify authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("❌ [leads-sensitive] Authentication failed");
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get client info for rate limiting and logging
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                      req.headers.get("cf-connecting-ip") || 
                      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Rate limit check (by user + IP)
    const rateLimitKey = `${user.id}:${ipAddress}`;
    const rateLimit = checkRateLimit(rateLimitKey);
    
    if (!rateLimit.allowed) {
      console.warn(`⚠️ [leads-sensitive] Rate limit exceeded for ${user.id}`);
      return new Response(JSON.stringify({ 
        error: "Limite de requisições excedido. Tente novamente em alguns segundos." 
      }), {
        status: 429,
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": "0",
          "Retry-After": "60"
        },
      });
    }

    // Parse request
    const body: LeadsSensitiveRequest = await req.json();
    const { leadId, fields } = body;

    // Validate leadId
    if (!leadId || typeof leadId !== 'string') {
      return new Response(JSON.stringify({ error: "leadId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(leadId)) {
      return new Response(JSON.stringify({ error: "leadId inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter requested fields to allowed whitelist
    let requestedFields: SensitiveField[] = [...ALLOWED_SENSITIVE_FIELDS];
    if (fields && Array.isArray(fields)) {
      requestedFields = fields.filter(
        (f): f is SensitiveField => ALLOWED_SENSITIVE_FIELDS.includes(f as SensitiveField)
      );
      if (requestedFields.length === 0) {
        return new Response(JSON.stringify({ error: "Nenhum campo válido solicitado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`📊 [leads-sensitive] User: ${user.id} | Lead: ${leadId} | Fields: ${requestedFields.join(',')} | IP: ${ipAddress}`);

    // Admin client for database operations with encryption key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Call the secure wrapper function that sets encryption key and validates ownership
    // SECURITY: Encryption key passed as parameter, restricted to service_role
    const { data: sensitiveData, error: rpcError } = await supabaseAdmin
      .rpc('set_encryption_key_and_get_lead_sensitive', {
        p_encryption_key: encryptionKey,
        p_lead_id: leadId,
        p_fields: requestedFields
      });

    if (rpcError) {
      console.error("❌ [leads-sensitive] RPC error:", rpcError.message);
      
      // Map error codes to HTTP status
      if (rpcError.message.includes('Não autenticado') || rpcError.code === 'P0401') {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (rpcError.message.includes('Lead não encontrado') || rpcError.code === 'P0404') {
        return new Response(JSON.stringify({ error: "Lead não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (rpcError.message.includes('Acesso negado') || rpcError.code === 'P0403') {
        return new Response(JSON.stringify({ error: "Acesso negado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (rpcError.message.includes('Encryption key') || rpcError.code === 'P0500') {
        console.error("❌ [leads-sensitive] Encryption key error - check configuration");
        return new Response(JSON.stringify({ error: "Erro de configuração de segurança" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw rpcError;
    }

    // Log access (async, don't block response) - without logging sensitive data
    supabaseAdmin.rpc('log_leads_access', {
      p_user_id: user.id,
      p_action_type: 'view_sensitive',
      p_lead_ids: [leadId],
      p_leads_count: 1,
      p_ip_address: ipAddress,
      p_user_agent: userAgent.substring(0, 500),
      p_request_params: { fields: requestedFields } // Only log field names, not values
    }).then(({ error }) => {
      if (error) console.error("⚠️ [leads-sensitive] Failed to log access:", error);
    });

    console.log(`✅ [leads-sensitive] Data returned for lead ${leadId} to user ${user.id}`);

    // Remove _meta from response if present (internal use only)
    const responseData = { ...sensitiveData };
    delete responseData._meta;

    return new Response(JSON.stringify({ 
      success: true, 
      data: responseData,
      leadId
    }), {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "Cache-Control": "no-store, no-cache, must-revalidate"
      },
    });

  } catch (error: unknown) {
    console.error('❌ [leads-sensitive] Error:', error);
    
    // Never expose internal error details
    return new Response(JSON.stringify({ error: "Erro ao processar requisição" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
