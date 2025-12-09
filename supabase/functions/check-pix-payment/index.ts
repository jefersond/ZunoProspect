import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-PIX-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const { paymentId } = await req.json();
    if (!paymentId) throw new Error("Payment ID is required");
    logStep("Checking payment", { paymentId });

    // Autenticar usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) throw new Error("ASAAS_API_KEY not configured");

    const asaasBaseUrl = asaasApiKey.startsWith("$aact_") 
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

    // Verificar status do pagamento
    const paymentResponse = await fetch(`${asaasBaseUrl}/payments/${paymentId}`, {
      headers: {
        "access_token": asaasApiKey,
        "Content-Type": "application/json",
      },
    });

    const payment = await paymentResponse.json();
    if (payment.errors) {
      logStep("Payment fetch error", payment.errors);
      throw new Error(payment.errors[0]?.description || "Erro ao verificar pagamento");
    }
    logStep("Payment status", { status: payment.status, value: payment.value });

    // Se pagamento confirmado, atualizar assinatura
    if (payment.status === "CONFIRMED" || payment.status === "RECEIVED") {
      logStep("Payment confirmed, updating subscription");

      // Extrair dados do plano da referência externa (formato: "userId|plan|isAnnual")
      let planData = { plan_name: "pro", is_annual: false };
      try {
        if (payment.externalReference) {
          const ref = payment.externalReference;
          // Novo formato compacto: "userId|plan|isAnnual"
          if (ref.includes('|')) {
            const parts = ref.split('|');
            planData = {
              plan_name: parts[1] || 'pro',
              is_annual: parts[2] === 'true'
            };
            logStep("Parsed compact reference", planData);
          } else {
            // Fallback para formato JSON antigo
            planData = JSON.parse(ref);
            logStep("Parsed JSON reference", planData);
          }
        }
      } catch (e) {
        logStep("Could not parse external reference", { ref: payment.externalReference });
      }

      // Determinar limites baseado no plano
      const leadsLimit = planData.plan_name === "agencia" ? -1 : 100;
      
      // Calcular período de billing
      const billingStart = new Date();
      const billingEnd = new Date();
      if (planData.is_annual) {
        billingEnd.setFullYear(billingEnd.getFullYear() + 1);
      } else {
        billingEnd.setMonth(billingEnd.getMonth() + 1);
      }

      // Atualizar ou inserir assinatura
      const { error: upsertError } = await supabaseClient
        .from("user_subscriptions")
        .upsert({
          user_id: user.id,
          plan_name: planData.plan_name,
          leads_limit: leadsLimit,
          is_annual: planData.is_annual,
          billing_period_start: billingStart.toISOString(),
          billing_period_end: billingEnd.toISOString(),
          leads_used_this_month: 0,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        });

      if (upsertError) {
        logStep("Subscription upsert error", upsertError);
        throw new Error("Erro ao atualizar assinatura");
      }
      logStep("Subscription updated successfully");
    }

    return new Response(JSON.stringify({
      status: payment.status,
      confirmed: payment.status === "CONFIRMED" || payment.status === "RECEIVED",
      value: payment.value,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
