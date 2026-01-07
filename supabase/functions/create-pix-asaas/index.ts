import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ============= CORS HELPER =============
// Configure a env var ALLOWED_ORIGINS com os domínios permitidos separados por vírgula
// Exemplo: "https://meuapp.lovable.app,https://meudominio.com.br,http://localhost:5173"
function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const allowedOriginsEnv = Deno.env.get("ALLOWED_ORIGINS") || "";
  const allowedOrigins = allowedOriginsEnv.split(",").map((o) => o.trim()).filter(Boolean);
  
  const origin = (allowedOrigins.length === 0 || (requestOrigin && allowedOrigins.includes(requestOrigin)))
    ? (requestOrigin || "*")
    : "";
    
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

function handleCorsRequest(req: Request): Response | null {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (origin && corsHeaders["Access-Control-Allow-Origin"] === "") {
    return new Response(JSON.stringify({ error: "Origem não autorizada" }), { 
      status: 403, 
      headers: { "Content-Type": "application/json" } 
    });
  }
  
  return null;
}

// Preços em centavos para cada plano
const PLANO_PRECOS = {
  pro_mensal: 9700, // R$ 97,00
  pro_anual: 97000, // R$ 970,00
  agencia_mensal: 24700, // R$ 247,00
  agencia_anual: 247000, // R$ 2.470,00
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PIX-ASAAS] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsCheck = handleCorsRequest(req);
  if (corsCheck) return corsCheck;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const { plano, isAnual, customerName, customerCpf, customerEmail, customerWhatsapp } = await req.json();
    logStep("Request body", { plano, isAnual, customerName, customerCpf, customerWhatsapp, customerEmail });

    // Validar dados obrigatórios
    if (!customerEmail) throw new Error("Email é obrigatório");
    if (!customerName) throw new Error("Nome é obrigatório");
    if (!customerCpf) throw new Error("CPF é obrigatório");

    // Tentar autenticar usuário (opcional para landing page)
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabaseClient.auth.getUser(token);
      if (data.user?.id) {
        userId = data.user.id;
        logStep("User authenticated", { userId });
      }
    }
    logStep("Processing for", { userId: userId || "guest", email: customerEmail });

    // Determinar o valor baseado no plano e período
    const planKey = plano.toLowerCase() === "pro" 
      ? (isAnual ? "pro_anual" : "pro_mensal")
      : (isAnual ? "agencia_anual" : "agencia_mensal");
    
    const valorCentavos = PLANO_PRECOS[planKey as keyof typeof PLANO_PRECOS];
    if (!valorCentavos) throw new Error(`Invalid plan: ${plano}`);
    const valor = valorCentavos / 100; // Asaas usa valor em reais
    logStep("Value determined", { planKey, valor });

    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) throw new Error("ASAAS_API_KEY not configured");

    // Usar ambiente de produção ou sandbox baseado na chave
    const asaasBaseUrl = asaasApiKey.startsWith("$aact_") 
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";
    logStep("Asaas environment", { baseUrl: asaasBaseUrl });

    // 1. Buscar ou criar cliente no Asaas
    const searchCustomerResponse = await fetch(
      `${asaasBaseUrl}/customers?email=${encodeURIComponent(customerEmail)}`,
      {
        headers: {
          "access_token": asaasApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    let customerId: string;
    const searchResult = await searchCustomerResponse.json();
    logStep("Customer search result", { totalCount: searchResult.totalCount });

    if (searchResult.data && searchResult.data.length > 0) {
      customerId = searchResult.data[0].id;
      logStep("Found existing customer", { customerId });
    } else {
      // Criar novo cliente
      const createCustomerResponse = await fetch(`${asaasBaseUrl}/customers`, {
        method: "POST",
        headers: {
          "access_token": asaasApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: customerName || customerEmail.split("@")[0] || "Cliente",
          email: customerEmail,
          cpfCnpj: customerCpf?.replace(/\D/g, "") || undefined,
          mobilePhone: customerWhatsapp?.replace(/\D/g, "") || undefined,
          notificationDisabled: false,
        }),
      });

      const newCustomer = await createCustomerResponse.json();
      if (newCustomer.errors) {
        logStep("Customer creation error", newCustomer.errors);
        throw new Error(newCustomer.errors[0]?.description || "Erro ao criar cliente no Asaas");
      }
      customerId = newCustomer.id;
      logStep("Created new customer", { customerId });
    }

    // 2. Criar cobrança PIX
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // Vencimento em 1 dia
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const descricaoPlano = isAnual 
      ? `Zuno Prospect ${plano} - Anual`
      : `Zuno Prospect ${plano} - Mensal`;

    const createPaymentResponse = await fetch(`${asaasBaseUrl}/payments`, {
      method: "POST",
      headers: {
        "access_token": asaasApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: valor,
        dueDate: dueDateStr,
        description: descricaoPlano,
        // Formato compacto: "userId|plan|isAnnual" (max ~50 chars)
        externalReference: `${userId || 'guest'}|${plano.toLowerCase()}|${isAnual}`,
      }),
    });

    const payment = await createPaymentResponse.json();
    if (payment.errors) {
      logStep("Payment creation error", payment.errors);
      throw new Error(payment.errors[0]?.description || "Erro ao criar cobrança PIX");
    }
    logStep("Payment created", { paymentId: payment.id, status: payment.status });

    // 3. Obter QR Code PIX
    const pixQrCodeResponse = await fetch(`${asaasBaseUrl}/payments/${payment.id}/pixQrCode`, {
      headers: {
        "access_token": asaasApiKey,
        "Content-Type": "application/json",
      },
    });

    const pixData = await pixQrCodeResponse.json();
    if (pixData.errors) {
      logStep("PIX QR Code error", pixData.errors);
      throw new Error(pixData.errors[0]?.description || "Erro ao gerar QR Code PIX");
    }
    logStep("PIX QR Code generated", { success: !!pixData.encodedImage });

    return new Response(JSON.stringify({
      success: true,
      paymentId: payment.id,
      pixCopiaECola: pixData.payload,
      qrCodeBase64: pixData.encodedImage,
      valor: valor,
      descricao: descricaoPlano,
      vencimento: dueDateStr,
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
