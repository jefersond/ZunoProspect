import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^14.20.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY não configurada no servidor");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Usuário não autenticado");
    }

    const body = await req.json();
    const { planKey, leadsQty, isAnual } = body;

    // Lógica de cálculo de preço copiada exatamente do useLeadPricing.ts do frontend
    const basePrices: Record<string, number> = {
      starter: 47,
      pro: 97,
      agencia: 147,
    };
    
    const planName = planKey || "starter";
    const leadsQuantity = leadsQty || 100;
    const basePrice = basePrices[planName] || basePrices.starter;
    const leadsAboveBase = Math.max(0, leadsQuantity - 100);
    const increments = leadsAboveBase / 50;
    const monthlyPrice = basePrice + (increments * 23.50);
    
    // Calcula preço total da transação
    // Se anual, o preço é mensal x 10 (2 meses de desconto)
    const finalPrice = isAnual 
      ? Math.round(monthlyPrice * 10) 
      : Math.round(monthlyPrice * 100) / 100;

    // Stripe SDK
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Procura por um cliente existente no Stripe com este email
    let customerId;
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabaseUUID: user.id,
        },
      });
      customerId = customer.id;
    }

    // Determina o nome do produto e plano
    const productNames: Record<string, string> = {
      starter: "Iniciante",
      pro: "Pro",
      agencia: "Agência",
    };
    const productNameFriendly = productNames[planName] || "Plano";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: `ReachGen - Plano ${productNameFriendly} (${leadsQuantity} leads)`,
              description: `Acesso ao plano ${productNameFriendly} com cota de ${leadsQuantity} leads ${isAnual ? "por ano" : "por mês"}.`,
            },
            unit_amount: Math.round(finalPrice * 100), // Stripe usa centavos
            recurring: {
              interval: isAnual ? "year" : "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/dashboard?payment=success`,
      cancel_url: `${req.headers.get("origin")}/dashboard?payment=cancelled`,
      metadata: {
        supabase_user_id: user.id,
        plan_key: planName,
        leads_limit: leadsQuantity.toString(),
        is_annual: isAnual ? "true" : "false",
      },
      payment_method_collection: "if_required",
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Erro no checkout do Stripe:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
