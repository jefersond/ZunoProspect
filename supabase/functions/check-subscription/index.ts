import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Stripe desativado - assinatura é gerenciada via webhook Kiwify + tabela user_subscriptions
  return new Response(
    JSON.stringify({ 
      error: "Stripe desativado. Use Kiwify para checkout/assinatura. Verificação de assinatura é feita via tabela user_subscriptions.",
      info: "A assinatura é atualizada automaticamente pelo webhook Kiwify."
    }),
    { 
      status: 410, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
});
