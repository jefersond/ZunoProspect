import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Product IDs para identificar o tier
const PRODUCT_TO_PLAN: Record<string, { name: string; limit: number }> = {
  "prod_TWEFSMSIvMciEf": { name: "pro", limit: 100 },      // Pro Mensal
  "prod_TWEFRP0vj2cK6G": { name: "pro", limit: 100 },      // Pro Anual
  "prod_TWEGOuTTo54vfZ": { name: "agencia", limit: -1 },   // Agencia Mensal
  "prod_TWEG5k5ZMWS6hf": { name: "agencia", limit: -1 },   // Agencia Anual
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No Stripe customer found, returning starter status");
      return new Response(JSON.stringify({ 
        subscribed: false,
        plan_name: "starter",
        leads_limit: 10,
        subscription_end: null,
        is_annual: false
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      logStep("No active subscription found");
      return new Response(JSON.stringify({ 
        subscribed: false,
        plan_name: "starter",
        leads_limit: 10,
        subscription_end: null,
        is_annual: false
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const subscription = subscriptions.data[0];
    const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
    logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });

    // Determinar o plano baseado no product ID
    const productId = subscription.items.data[0].price.product as string;
    const priceInterval = subscription.items.data[0].price.recurring?.interval;
    const isAnnual = priceInterval === "year";
    
    const planInfo = PRODUCT_TO_PLAN[productId] || { name: "pro", limit: 100 };
    logStep("Determined plan info", { productId, planInfo, isAnnual });

    // Atualizar a tabela user_subscriptions com os dados do Stripe
    const billingPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();
    const { error: updateError } = await supabaseClient
      .from('user_subscriptions')
      .update({
        plan_name: planInfo.name,
        leads_limit: planInfo.limit,
        is_annual: isAnnual,
        billing_period_start: billingPeriodStart,
        billing_period_end: subscriptionEnd,
      })
      .eq('user_id', user.id);

    if (updateError) {
      logStep("Warning: failed to update user_subscriptions", { error: updateError.message });
    } else {
      logStep("Updated user_subscriptions table");
    }

    return new Response(JSON.stringify({
      subscribed: true,
      plan_name: planInfo.name,
      leads_limit: planInfo.limit,
      subscription_end: subscriptionEnd,
      is_annual: isAnnual
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
