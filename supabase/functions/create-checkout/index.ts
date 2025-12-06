import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Price IDs mapeados para os planos
const PRICE_IDS = {
  pro_mensal: "price_1SZBmzFgIIQ1aOHHXSRs6gZZ",
  pro_anual: "price_1SZBnHFgIIQ1aOHHGG7ElhHC",
  agencia_mensal: "price_1SZBnXFgIIQ1aOHHQlJiIGlE",
  agencia_anual: "price_1SZBnjFgIIQ1aOHHtjSWVtYg",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

// Sanitize error messages to prevent internal system details exposure
const sanitizeError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[CREATE-CHECKOUT] Full error:", message);
  
  // Return generic messages for known error patterns
  if (message.includes("authorization") || message.includes("authenticated")) {
    return "Erro de autenticação. Por favor, faça login novamente.";
  }
  if (message.includes("STRIPE") || message.includes("stripe")) {
    return "Erro ao processar pagamento. Tente novamente.";
  }
  if (message.includes("Invalid plan")) {
    return "Plano selecionado inválido.";
  }
  return "Erro ao processar checkout. Tente novamente.";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const { plano, isAnual } = await req.json();
    logStep("Request body", { plano, isAnual });

    // Autenticar usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Determinar o price_id baseado no plano e período
    const planKey = plano.toLowerCase() === "pro" 
      ? (isAnual ? "pro_anual" : "pro_mensal")
      : (isAnual ? "agencia_anual" : "agencia_mensal");
    
    const priceId = PRICE_IDS[planKey as keyof typeof PRICE_IDS];
    if (!priceId) throw new Error(`Invalid plan: ${plano}`);
    logStep("Price ID determined", { planKey, priceId });

    // Inicializar Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Verificar se já existe um customer para este email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    // Criar sessão de checkout
    const origin = req.headers.get("origin") || "https://yklmfcgbtprwhjehipte.lovableproject.com";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      payment_method_types: ["card"],
      success_url: `${origin}/profile?checkout=success`,
      cancel_url: `${origin}/profile?checkout=canceled`,
      metadata: {
        user_id: user.id,
        plan_name: plano.toLowerCase(),
        is_annual: isAnual ? "true" : "false",
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    logStep("ERROR", { message: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: sanitizeError(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
