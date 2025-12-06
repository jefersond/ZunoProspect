import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// INPUT VALIDATION
// ============================================

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

function isValidName(name: string): boolean {
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 100;
}

// ============================================
// RATE LIMITING
// ============================================

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute for key management

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitMap.get(userId);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetIn: record.resetTime - now };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count, resetIn: record.resetTime - now };
}

// ============================================
// ERROR HANDLING
// ============================================

function sanitizeError(error: unknown): string {
  console.error('Internal error:', error);
  return 'Erro interno do servidor';
}

// Generate a random API key
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'zuno_';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get user from auth header
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

    // Create client with user's token
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ 
        error: 'USER_NOT_FOUND',
        message: 'Usuário não encontrado'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check rate limit
    const rateLimit = checkRateLimit(user.id);
    const rateLimitHeaders = {
      'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
      'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(rateLimit.resetIn / 1000).toString(),
    };

    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ 
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Limite de requisições excedido. Tente novamente em alguns segundos.',
        retry_after: Math.ceil(rateLimit.resetIn / 1000)
      }), {
        status: 429,
        headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create admin client for operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user has Agency plan
    const { data: subscription } = await supabaseAdmin
      .from('user_subscriptions')
      .select('plan_name')
      .eq('user_id', user.id)
      .single();

    // Check if user is admin
    const { data: adminRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    const isAdmin = !!adminRole;
    const isAgency = subscription?.plan_name === 'agencia';

    if (!isAdmin && !isAgency) {
      return new Response(JSON.stringify({ 
        error: 'PLAN_NOT_ALLOWED',
        message: 'API de Integração disponível apenas para o plano Agência' 
      }), {
        status: 403,
        headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
      });
    }

    const method = req.method;

    // GET - List user's API keys
    if (method === 'GET') {
      const { data: keys, error } = await supabaseAdmin
        .from('api_keys')
        .select('id, name, key_preview, last_used_at, created_at, revoked_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error:', error);
        return new Response(JSON.stringify({ 
          error: 'DATABASE_ERROR',
          message: 'Erro ao consultar chaves'
        }), {
          status: 500,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, data: keys }), {
        headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST - Create new API key
    if (method === 'POST') {
      let body;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ 
          error: 'INVALID_JSON',
          message: 'Corpo da requisição inválido'
        }), {
          status: 400,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { name } = body;

      if (!isValidName(name)) {
        return new Response(JSON.stringify({ 
          error: 'INVALID_NAME',
          message: 'Nome da API Key é obrigatório e deve ter entre 1 e 100 caracteres'
        }), {
          status: 400,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check max keys limit (5 per user)
      const { count } = await supabaseAdmin
        .from('api_keys')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('revoked_at', null);

      if ((count || 0) >= 5) {
        return new Response(JSON.stringify({ 
          error: 'MAX_KEYS_REACHED',
          message: 'Limite de 5 API Keys ativas atingido. Revogue uma key existente.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate new key
      const apiKey = generateApiKey();
      const keyHash = await hashApiKey(apiKey);
      const keyPreview = apiKey.substring(0, 12) + '...';

      // Save to database
      const { data: newKey, error } = await supabaseAdmin
        .from('api_keys')
        .insert({
          user_id: user.id,
          name: name.trim(),
          key_hash: keyHash,
          key_preview: keyPreview,
        })
        .select('id, name, key_preview, created_at')
        .single();

      if (error) {
        console.error('Database error:', error);
        return new Response(JSON.stringify({ 
          error: 'DATABASE_ERROR',
          message: 'Erro ao criar chave'
        }), {
          status: 500,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`API Key created for user ${user.id}: ${keyPreview}`);

      // Return full key ONLY on creation
      return new Response(JSON.stringify({ 
        success: true, 
        data: {
          ...newKey,
          api_key: apiKey, // Full key - only shown once!
        },
        message: 'API Key criada com sucesso. Guarde-a em local seguro - ela não será mostrada novamente!'
      }), {
        headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE - Revoke API key
    if (method === 'DELETE') {
      let body;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ 
          error: 'INVALID_JSON',
          message: 'Corpo da requisição inválido'
        }), {
          status: 400,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { key_id } = body;

      if (!key_id) {
        return new Response(JSON.stringify({ 
          error: 'KEY_ID_REQUIRED',
          message: 'ID da API Key é obrigatório'
        }), {
          status: 400,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate UUID
      if (!isValidUUID(key_id)) {
        return new Response(JSON.stringify({ 
          error: 'INVALID_KEY_ID_FORMAT',
          message: 'Formato de ID inválido'
        }), {
          status: 400,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify ownership and revoke
      const { data, error } = await supabaseAdmin
        .from('api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', key_id)
        .eq('user_id', user.id)
        .is('revoked_at', null)
        .select()
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ 
          error: 'KEY_NOT_FOUND',
          message: 'API Key não encontrada ou já revogada'
        }), {
          status: 404,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`API Key revoked for user ${user.id}: ${data.key_preview}`);

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'API Key revogada com sucesso' 
      }), {
        headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      error: 'METHOD_NOT_ALLOWED',
      message: 'Método não permitido'
    }), {
      status: 405,
      headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
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