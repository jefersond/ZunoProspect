import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[KIWIFY-WEBHOOK] ${step}${detailsStr}`);
};

// Mark A/B test email results as converted when user makes a purchase
const markABTestConversions = async (supabase: any, userId: string) => {
  try {
    // Find all A/B test results for this user that haven't been marked as converted
    const { data: abResults, error: fetchError } = await supabase
      .from('email_ab_results')
      .select('id, converted_at')
      .eq('user_id', userId)
      .is('converted_at', null);
    
    if (fetchError) {
      logStep("Error fetching A/B results for conversion", { error: fetchError.message });
      return;
    }
    
    if (!abResults || abResults.length === 0) {
      logStep("No A/B test results to mark as converted", { userId });
      return;
    }
    
    // Mark all as converted
    const { error: updateError } = await supabase
      .from('email_ab_results')
      .update({ converted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('converted_at', null);
    
    if (updateError) {
      logStep("Error marking A/B results as converted", { error: updateError.message });
    } else {
      logStep("Marked A/B test results as converted", { userId, count: abResults.length });
    }
  } catch (err) {
    logStep("Exception in markABTestConversions", { error: String(err) });
  }
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received", { method: req.method });

    // Validar token do webhook
    const webhookToken = Deno.env.get("KIWIFY_WEBHOOK_TOKEN");
    const authHeader = req.headers.get("x-kiwify-signature") || req.headers.get("authorization");
    
    // Kiwify pode enviar o token de diferentes formas
    const receivedToken = authHeader?.replace("Bearer ", "");
    
    if (webhookToken && receivedToken !== webhookToken) {
      logStep("Token validation failed");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse do body
    const body = await req.json();
    logStep("Payload received", { 
      event: body.order_status,
      customer_email: body.Customer?.email,
      product_name: body.Product?.product_name 
    });

    // Verificar se é evento de compra aprovada
    // Kiwify envia "paid" ou "approved" dependendo da configuração
    const validStatuses = ["paid", "approved", "completed"];
    if (!validStatuses.includes(body.order_status?.toLowerCase())) {
      logStep("Ignoring non-purchase event", { status: body.order_status });
      return new Response(JSON.stringify({ message: "Event ignored" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extrair dados do cliente e produto
    const customerEmail = body.Customer?.email;
    const customerName = body.Customer?.full_name;
    const productName = body.Product?.product_name || "";
    
    if (!customerEmail) {
      logStep("ERROR: No customer email in payload");
      return new Response(JSON.stringify({ error: "Customer email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determinar plano e período baseado no nome do produto
    // IMPORTANTE: O banco aceita apenas: starter, pro, agencia
    // "Iniciante" no produto = "pro" no banco com 100 leads
    let planName = "pro";
    let isAnnual = false;
    let leadsLimit = 200; // Pro padrão agora tem 200 leads

    const productNameLower = productName.toLowerCase();
    
    // Check if it's USA add-on purchase
    const isUsaAddon = productNameLower.includes("usa") || productNameLower.includes("eua") || productNameLower.includes("estados unidos");
    
    // Verificar tipo de plano baseado no nome do produto
    if (productNameLower.includes("iniciante")) {
      // Plano "Iniciante" é mapeado para "pro" no banco, mas com 100 leads
      planName = "pro";
      leadsLimit = 100;
      logStep("Produto Iniciante detectado - mapeando para plan_name=pro com 100 leads");
    } else if (productNameLower.includes("agencia") || productNameLower.includes("agência")) {
      planName = "agencia";
      leadsLimit = -1; // Ilimitado
    } else if (productNameLower.includes("pro") && !isUsaAddon) {
      planName = "pro";
      leadsLimit = 200;
    }
    
    if (productNameLower.includes("anual") || productNameLower.includes("annual")) {
      isAnnual = true;
    }

    logStep("Plan determined", { planName, isAnnual, leadsLimit, isUsaAddon });

    // Criar cliente Supabase com service role
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Buscar usuário pelo email
    const { data: userData, error: userError } = await supabaseClient.auth.admin.listUsers();
    
    if (userError) {
      logStep("ERROR listing users", { error: userError.message });
      return new Response(JSON.stringify({ error: "Failed to list users" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.users.find(u => u.email?.toLowerCase() === customerEmail.toLowerCase());
    
    if (!user) {
      logStep("User not found, creating account", { email: customerEmail });
      
      // Criar usuário se não existir
      const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email: customerEmail,
        email_confirm: true,
        user_metadata: { full_name: customerName }
      });
      
      if (createError) {
        logStep("ERROR creating user", { error: createError.message });
        return new Response(JSON.stringify({ error: "Failed to create user" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (!newUser.user) {
        logStep("ERROR: User created but no user object returned");
        return new Response(JSON.stringify({ error: "User creation failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Usar o novo usuário
      const userId = newUser.user.id;
      
      // Calcular período de billing
      const now = new Date();
      const billingPeriodEnd = new Date(now);
      if (isAnnual) {
        billingPeriodEnd.setFullYear(billingPeriodEnd.getFullYear() + 1);
      } else {
        billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);
      }

      // Inserir nova assinatura
      const { error: insertError } = await supabaseClient
        .from("user_subscriptions")
        .insert({
          user_id: userId,
          plan_name: planName,
          leads_limit: leadsLimit,
          is_annual: isAnnual,
          leads_used_this_month: 0,
          billing_period_start: now.toISOString(),
          billing_period_end: billingPeriodEnd.toISOString(),
        });

      if (insertError) {
        logStep("ERROR inserting subscription", { error: insertError.message });
        return new Response(JSON.stringify({ error: "Failed to create subscription" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      logStep("Subscription created for new user", { userId, planName });
      
    } else {
      // Usuário já existe, atualizar assinatura
      const userId = user.id;
      logStep("User found", { userId });
      
      // Calcular período de billing
      const now = new Date();
      const billingPeriodEnd = new Date(now);
      if (isAnnual) {
        billingPeriodEnd.setFullYear(billingPeriodEnd.getFullYear() + 1);
      } else {
        billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);
      }

      // Verificar se já existe assinatura
      const { data: existingSub } = await supabaseClient
        .from("user_subscriptions")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingSub) {
        // Atualizar assinatura existente
        const { error: updateError } = await supabaseClient
          .from("user_subscriptions")
          .update({
            plan_name: planName,
            leads_limit: leadsLimit,
            is_annual: isAnnual,
            leads_used_this_month: 0,
            billing_period_start: now.toISOString(),
            billing_period_end: billingPeriodEnd.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq("user_id", userId);

        if (updateError) {
          logStep("ERROR updating subscription", { error: updateError.message });
          return new Response(JSON.stringify({ error: "Failed to update subscription" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // If USA add-on purchase, activate it
        if (isUsaAddon) {
          const usaAddonUntil = new Date();
          usaAddonUntil.setMonth(usaAddonUntil.getMonth() + 1);
          
          await supabaseClient
            .from("user_subscriptions")
            .update({
              usa_addon: true,
              usa_addon_active_until: usaAddonUntil.toISOString(),
            })
            .eq("user_id", userId);
          
          logStep("USA add-on activated", { userId, until: usaAddonUntil.toISOString() });
        }

        // Mark A/B test conversions for this user
        await markABTestConversions(supabaseClient, userId);

        logStep("Subscription updated", { userId, planName });
      } else {
        // Inserir nova assinatura
        const { error: insertError } = await supabaseClient
          .from("user_subscriptions")
          .insert({
            user_id: userId,
            plan_name: planName,
            leads_limit: leadsLimit,
            is_annual: isAnnual,
            leads_used_this_month: 0,
            billing_period_start: now.toISOString(),
            billing_period_end: billingPeriodEnd.toISOString(),
          });

        if (insertError) {
          logStep("ERROR inserting subscription", { error: insertError.message });
          return new Response(JSON.stringify({ error: "Failed to create subscription" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        logStep("Subscription created", { userId, planName });
      }
    }

    logStep("Webhook processed successfully");
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in webhook", { message: errorMessage });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
