import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error("Usuário não autenticado");

    const { planKey, leadsQty, isAnual } = await req.json();
    const leadsLimit = planKey === "agencia" ? -1 : Number(leadsQty || 100);

    // Mapeamento simplificado - Você deve ajustar os IDs de preço no seu painel Stripe
    // Se não tiver IDs, a função vai falhar até você criá-los
    let priceId = "";
    
    // Lógica de exemplo para busca de preços dinâmicos ou pré-definidos
    // Idealmente, você criaria esses produtos/preços no Stripe
    if (planKey === 'pro') {
      priceId = isAnual ? "price_pro_anual" : "price_pro_mensal";
    } else if (planKey === 'agencia') {
      priceId = isAnual ? "price_agencia_anual" : "price_agencia_mensal";
    }

    // Criar sessão de checkout
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: `Zuno Prospect - Plano ${planKey.toUpperCase()} (${leadsQty} leads)`,
              description: `Acesso ao sistema de prospecção B2B - ${isAnual ? 'Anual' : 'Mensal'}`,
            },
            // Valor dinâmico baseado na regra de negócio (leadsQty)
            // Aqui você pode integrar com o useLeadPricing se quiser precisão total
            unit_amount: 9900, // Exemplo: R$ 99,00. Ajustar conforme necessário.
            recurring: {
              interval: isAnual ? "year" : "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/prospeccao?checkout=success`,
      cancel_url: `${req.headers.get("origin")}/checkout?plano=${planKey}&anual=${isAnual}&checkout=canceled`,
      metadata: {
        supabase_user_id: user.id,
        user_id: user.id,
        plan_key: planKey,
        leads_qty: leadsQty.toString(),
        leads_limit: String(leadsLimit),
        is_annual: String(!!isAnual),
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
