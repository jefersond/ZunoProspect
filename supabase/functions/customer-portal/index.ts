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

  // Stripe desativado - usar Kiwify para gerenciamento de assinatura
  return new Response(
    JSON.stringify({ 
      error: "Stripe desativado. Use Kiwify para gerenciar sua assinatura.",
      help_url: "https://ajuda.kiwify.com.br/pt-br/article/como-cancelar-a-assinatura-do-produto-que-comprei-19d0my1/",
      portal_url: "https://dashboard.kiwify.com.br/login/"
    }),
    { 
      status: 410, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
});
