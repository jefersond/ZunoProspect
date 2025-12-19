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

  // Stripe desativado - usar Kiwify para checkout
  return new Response(
    JSON.stringify({ 
      error: "Stripe desativado. Use Kiwify para checkout/assinatura.",
      redirect: "https://pay.kiwify.com.br" 
    }),
    { 
      status: 410, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
});
