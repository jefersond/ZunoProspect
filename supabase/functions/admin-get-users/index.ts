import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-GET-USERS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Starting admin-get-users function');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logStep('No authorization header');
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin status
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      logStep('User verification failed', { error: userError?.message });
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: isAdmin } = await supabaseAdmin.rpc('is_admin', { _user_id: user.id });
    
    if (!isAdmin) {
      logStep('User is not admin', { userId: user.id });
      return new Response(JSON.stringify({ error: 'Acesso negado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logStep('Admin verified, fetching users');

    // Fetch all auth users
    const { data: { users: authUsers }, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000
    });

    if (authError) {
      logStep('Error fetching auth users', { error: authError.message });
      throw authError;
    }

    logStep('Auth users fetched', { count: authUsers.length });

    // Fetch profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, nome_completo, empresa, created_at');

    if (profilesError) {
      logStep('Error fetching profiles', { error: profilesError.message });
      throw profilesError;
    }

    // Fetch subscriptions
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('user_id, plan_name, leads_limit, leads_used_this_month, is_annual, billing_period_start, billing_period_end, usa_addon');

    if (subsError) {
      logStep('Error fetching subscriptions', { error: subsError.message });
      throw subsError;
    }

    // Create lookup maps
    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
    const subscriptionsMap = new Map(subscriptions?.map(s => [s.user_id, s]) || []);

    // Combine data
    const combinedUsers = authUsers.map(authUser => {
      const profile = profilesMap.get(authUser.id);
      const subscription = subscriptionsMap.get(authUser.id);

      return {
        id: authUser.id,
        email: authUser.email || '',
        nome_completo: profile?.nome_completo || '',
        empresa: profile?.empresa || '',
        plan_name: subscription?.plan_name || 'starter',
        leads_limit: subscription?.leads_limit || 0,
        leads_used_this_month: subscription?.leads_used_this_month || 0,
        is_annual: subscription?.is_annual || false,
        usa_addon: subscription?.usa_addon || false,
        billing_period_start: subscription?.billing_period_start || null,
        billing_period_end: subscription?.billing_period_end || null,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
      };
    });

    // Sort by created_at descending (newest first)
    combinedUsers.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    logStep('Users combined successfully', { count: combinedUsers.length });

    // Calculate stats
    const stats = {
      total: combinedUsers.length,
      byPlan: {
        starter: combinedUsers.filter(u => u.plan_name === 'starter').length,
        iniciante: combinedUsers.filter(u => u.plan_name === 'iniciante').length,
        pro: combinedUsers.filter(u => u.plan_name === 'pro').length,
        agencia: combinedUsers.filter(u => u.plan_name === 'agencia').length,
      },
      annual: combinedUsers.filter(u => u.is_annual).length,
      withUsaAddon: combinedUsers.filter(u => u.usa_addon).length,
    };

    return new Response(JSON.stringify({ users: combinedUsers, stats }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStep('Error in admin-get-users', { error: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
