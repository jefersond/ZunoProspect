import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
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
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        error: 'API de Integração disponível apenas para o plano Agência' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data: keys }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST - Create new API key
    if (method === 'POST') {
      const body = await req.json();
      const { name } = body;

      if (!name || name.trim().length === 0) {
        return new Response(JSON.stringify({ error: 'Nome da API Key é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
          error: 'Limite de 5 API Keys ativas atingido. Revogue uma key existente.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

      if (error) throw error;

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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE - Revoke API key
    if (method === 'DELETE') {
      const body = await req.json();
      const { key_id } = body;

      if (!key_id) {
        return new Response(JSON.stringify({ error: 'ID da API Key é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        return new Response(JSON.stringify({ error: 'API Key não encontrada ou já revogada' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`API Key revoked for user ${user.id}: ${data.key_preview}`);

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'API Key revogada com sucesso' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in api-keys-manage:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
