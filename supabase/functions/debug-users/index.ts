import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const emails = ["falecom@klsalescompany.com", "zunopropect@gmail.com"];
    const results: Record<string, any> = {};

    for (const email of emails) {
      // 1. Buscar no auth.users
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      });

      const user = authData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (!user) {
        results[email] = { found_in_auth: false };
        continue;
      }

      // 2. Buscar no user_subscriptions
      const { data: sub, error: subError } = await supabaseAdmin
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      // 3. Buscar no profiles
      const { data: profile, error: profError } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      results[email] = {
        found_in_auth: true,
        user_id: user.id,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        subscription: sub || null,
        subscription_error: subError ? subError.message : null,
        profile: profile || null,
        profile_error: profError ? profError.message : null
      };
    }

    // Listar as 5 primeiras assinaturas ativas na tabela apenas para ter nocao se existem
    const { data: activeSubs } = await supabaseAdmin
      .from("user_subscriptions")
      .select("user_id, plan_name, subscription_status, billing_period_end")
      .limit(5);

    return new Response(JSON.stringify({ success: true, results, active_subs_preview: activeSubs }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
