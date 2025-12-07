import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

// Sanitize error messages to prevent internal system details exposure
const sanitizeError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[CREATE-PIX-ASAAS] Full error:", message);
  
  // Return generic messages for known error patterns
  if (message.includes("Email") || message.includes("Nome") || message.includes("CPF")) {
    return message; // Keep validation messages as they're user-facing
  }
  if (message.includes("ASAAS") || message.includes("asaas")) {
    return "Erro ao processar pagamento PIX. Tente novamente.";
  }
  if (message.includes("Invalid plan")) {
    return "Plano selecionado inválido.";
  }
  if (message.includes("cliente") || message.includes("customer")) {
    return "Erro ao processar dados do cliente. Verifique as informações.";
  }
  if (message.includes("QR Code") || message.includes("PIX")) {
    return "Erro ao gerar código PIX. Tente novamente.";
  }
  return "Erro ao processar pagamento. Tente novamente.";
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
      ? `Zuno Propect ${plano} - Anual`
      : `Zuno Propect ${plano} - Mensal`;

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
        // Formato compacto: userId|plan_name|is_annual (máx 100 chars)
        externalReference: `${userId || 'guest'}|${plano.toLowerCase()}|${isAnual ? '1' : '0'}`,
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
    logStep("ERROR", { message: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: sanitizeError(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
