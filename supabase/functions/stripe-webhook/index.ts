import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^14.20.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Limites oficiais conforme especificação
const PLAN_LIMITS: Record<string, { plan: string; leadsLimit: number; aiLimit: number }> = {
  free: { plan: "free", leadsLimit: 20, aiLimit: 3 },
  starter: { plan: "starter", leadsLimit: 300, aiLimit: 30 },
  pro: { plan: "pro", leadsLimit: 800, aiLimit: 100 },
  agency: { plan: "agencia", leadsLimit: 2000, aiLimit: 300 },
  agencia: { plan: "agencia", leadsLimit: 2000, aiLimit: 300 },
};

function getPlanLimits(planKey: string | undefined) {
  const normalized = (planKey || "pro").trim().toLowerCase();
  return PLAN_LIMITS[normalized] ?? PLAN_LIMITS.pro;
}

function normalizePlanDbName(planId: string): string {
  const norm = String(planId || "").toLowerCase().trim();
  if (norm === "agency" || norm === "agencia" || norm === "agência") return "agencia";
  if (norm === "starter" || norm === "iniciante") return "starter";
  if (norm === "pro") return "pro";
  return "free";
}

function stripeId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
  return null;
}

function isAddonMetadata(metadata?: Stripe.Metadata | null) {
  return metadata?.type === "addon" && metadata?.addon_id === "us_prospecting" && Boolean(metadata?.user_id);
}

// Resolvedor de plano inteligente baseado em Price ID / Valor (ETAPA EXTRA - 3 e 8)
function resolvePlanByStripeData(
  priceId: string | null,
  amount: number | null,
  metadataPlanId: string | null
): { planId: string; planResolutionSource: string; hasPlanConflict: boolean; conflictDetails?: any } {
  let resolvedPlan = "pro"; // default
  let resolutionSource = "default";
  let hasConflict = false;
  let conflictDetails: any = null;

  // 1. Mapeamento por Price ID fixo conhecido ou por padrões de lookup key no Stripe (se existirem)
  const knownPrices: Record<string, string> = {
    "price_1Tazy0FgIIQ1aOHHT0IHZiH8": "pro",
  };

  if (priceId && knownPrices[priceId]) {
    resolvedPlan = knownPrices[priceId];
    resolutionSource = "stripe_price_id";
  } 
  // 2. Mapeamento por Valor (amount) - Este é o mais confiável e determinístico para preços dinâmicos!
  else if (amount !== null) {
    const amountVal = Math.round(amount);
    // Starter: R$ 47 (4700 centavos) ou R$ 470 anual (47000 centavos)
    if (amountVal === 4700 || amountVal === 47000 || amountVal === 47) {
      resolvedPlan = "starter";
      resolutionSource = "stripe_amount";
    }
    // Pro: R$ 97 (9700 centavos) ou R$ 970 anual (97000 centavos)
    else if (amountVal === 9700 || amountVal === 97000 || amountVal === 97) {
      resolvedPlan = "pro";
      resolutionSource = "stripe_amount";
    }
    // Agency: R$ 247 (24700 centavos) ou R$ 2470 anual (247000 centavos)
    else if (amountVal === 24700 || amountVal === 247000 || amountVal === 247) {
      resolvedPlan = "agency";
      resolutionSource = "stripe_amount";
    } else {
      // Se o valor não bater exatamente, usamos o metadado como fallback
      if (metadataPlanId) {
        resolvedPlan = metadataPlanId;
        resolutionSource = "stripe_metadata";
      }
    }
  } 
  // 3. Fallback para metadados
  else if (metadataPlanId) {
    resolvedPlan = metadataPlanId;
    resolutionSource = "stripe_metadata";
  }

  // Normalizar
  resolvedPlan = normalizePlanDbName(resolvedPlan);

  // Verificar se há conflito com metadados
  if (metadataPlanId) {
    const normMetadataPlan = normalizePlanDbName(metadataPlanId);
    if (resolvedPlan !== normMetadataPlan) {
      hasConflict = true;
      conflictDetails = {
        metadata_plan_id: metadataPlanId,
        stripe_price_plan_id: resolvedPlan,
        stripe_price_id: priceId,
        stripe_amount: amount,
      };
      console.warn(`[stripe-webhook] Conflito de plano detectado! Metadata: ${metadataPlanId}, Resolvido por valor/price_id: ${resolvedPlan}`);
    }
  }

  return {
    planId: resolvedPlan,
    planResolutionSource: resolutionSource,
    hasPlanConflict: hasConflict,
    conflictDetails,
  };
}

// Ativação e persistência centralizada do plano (ETAPA 4)
async function sendPaymentRecoveryEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  params: {
    userId: string | null;
    email: string;
    nome: string;
    plano: string;
    invoiceId: string;
    subscriptionId: string | null;
    hostedInvoiceUrl: string | null;
  }
) {
  const invoiceId = params.invoiceId;
  const email = params.email;

  // 1. Checar se já foi enviado e-mail de recuperação para este invoice_id
  const { data: existingLog, error: logError } = await supabaseAdmin
    .from("payment_recovery_email_logs")
    .select("id")
    .eq("invoice_id", invoiceId)
    .eq("event_type", "payment_failed")
    .maybeSingle();

  if (logError) {
    console.error("[stripe-webhook] Erro ao checar logs de e-mail de recuperação:", logError);
  }

  if (existingLog) {
    console.log(`[stripe-webhook] E-mail de recuperação já enviado anteriormente para invoice_id=${invoiceId}. Ignorando.`);
    return;
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
  const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "Zuno Propect <contato@zunopropect.com.br>";
  const RESEND_REPLY_TO_EMAIL = Deno.env.get("RESEND_REPLY_TO_EMAIL") || "";

  if (!RESEND_API_KEY) {
    console.error("[stripe-webhook] RESEND_API_KEY não configurada no ambiente. Não é possível enviar e-mail de recuperação.");
    return;
  }

  // 2. Preparar links
  const defaultAppUrl = "https://www.zunopropect.com.br/prospeccao";
  const payUrl = params.hostedInvoiceUrl || defaultAppUrl;
  const ZUNO_SUPPORT_WHATSAPP = "553298511685";
  const whatsappMsg = encodeURIComponent("Olá! Meu teste da Zuno terminou, mas o pagamento não foi concluído. Preciso de ajuda para regularizar.");
  const whatsappUrl = `https://wa.me/${ZUNO_SUPPORT_WHATSAPP}?text=${whatsappMsg}`;

  // 3. Montar HTML
  const nomeDisplay = params.nome ? params.nome.split(' ')[0] : 'Parceiro';
  const planoDisplay = params.plano ? params.plano.toUpperCase() : 'Zuno Prospect';
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Não conseguimos concluir o pagamento da Zuno</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0f0e;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b0f0e;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#111816;border:1px solid #1f2d29;border-radius:12px;overflow:hidden;padding:40px 30px;">
          <tr>
            <td align="center" style="padding-bottom:30px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="36" height="36" align="center" valign="middle" style="background-color:#10d98a;color:#0b0f0e;font-size:20px;font-weight:900;border-radius:8px;font-family:sans-serif;">Z</td>
                  <td style="padding-left:10px;font-size:22px;font-weight:800;color:#f4f4f5;letter-spacing:-0.5px;">Zuno Propect</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td>
              <h2 style="color:#f4f4f5;font-size:20px;margin-top:0;margin-bottom:16px;font-weight:700;">Oi, ${nomeDisplay}, tudo bem?</h2>
              <p style="color:#9ca3af;font-size:15px;line-height:24px;margin-bottom:24px;">
                Seu teste da Zuno terminou, mas não conseguimos concluir o pagamento do plano <strong>${planoDisplay}</strong>.
              </p>
              <p style="color:#9ca3af;font-size:15px;line-height:24px;margin-bottom:30px;">
                Isso pode acontecer por limite, cartão virtual, bloqueio do banco ou dados do cartão.
              </p>
              <p style="color:#9ca3af;font-size:15px;line-height:24px;margin-bottom:30px;">
                Para continuar usando a Zuno, atualize o pagamento pelo botão abaixo:
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:30px;">
              <a href="${payUrl}" style="display:inline-block;background-color:#10d98a;color:#0b0f0e;text-decoration:none;padding:14px 28px;font-size:15px;font-weight:700;border-radius:8px;box-shadow:0 4px 12px rgba(16,217,138,0.2);">
                Atualizar pagamento
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="border-top:1px solid #1f2d29;padding-top:24px;">
              <p style="color:#9ca3af;font-size:14px;margin:0 0 16px 0;">
                Se precisar de ajuda, fale comigo pelo suporte.
              </p>
              <a href="${whatsappUrl}" target="_blank" style="display:inline-block;color:#10d98a;text-decoration:none;font-size:14px;font-weight:600;">
                💬 Falar com suporte no WhatsApp
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const textContent = `
Oi, ${nomeDisplay}, tudo bem?

Seu teste da Zuno terminou, mas não conseguimos concluir o pagamento do plano ${planoDisplay}.

Isso pode acontecer por limite, cartão virtual, bloqueio do banco ou dados do cartão.

Para continuar usando a Zuno, atualize o pagamento pelo link abaixo:
${payUrl}

Se precisar de ajuda, fale comigo pelo suporte.
WhatsApp: ${whatsappUrl}
  `.trim();

  // 4. Enviar via Resend
  let status = "failed";
  let errorMessage: string | null = null;
  let sentAt: string | null = null;

  try {
    const payload = {
      from: RESEND_FROM_EMAIL,
      to: [email],
      subject: "Não conseguimos concluir o pagamento da Zuno",
      html: htmlContent,
      text: textContent,
      reply_to: RESEND_REPLY_TO_EMAIL || undefined,
    };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok && data?.id) {
      status = "sent";
      sentAt = new Date().toISOString();
      console.log(`[stripe-webhook] E-mail de recuperação enviado com sucesso para ${email}. ID do Resend: ${data.id}`);
    } else {
      errorMessage = data?.message || data?.error || `Erro HTTP ${response.status} da API Resend`;
      console.error(`[stripe-webhook] Falha no retorno do Resend ao enviar para ${email}:`, errorMessage);
    }
  } catch (err: any) {
    errorMessage = err.message || "Exceção desconhecida no fetch do Resend";
    console.error(`[stripe-webhook] Exceção ao enviar e-mail via Resend para ${email}:`, err);
  }

  // 5. Inserir log no banco de dados para evitar duplicidade futuramente
  const { error: insertError } = await supabaseAdmin
    .from("payment_recovery_email_logs")
    .insert({
      user_id: params.userId,
      invoice_id: invoiceId,
      subscription_id: params.subscriptionId,
      email: email,
      event_type: "payment_failed",
      status: status,
      sent_at: sentAt,
      error_message: errorMessage,
    });

  if (insertError) {
    console.error("[stripe-webhook] Erro ao gravar log de e-mail de recuperação:", insertError);
  }

  // Registrar também o evento no app_events
  await logAppEvent(supabaseAdmin, params.userId, status === "sent" ? "Payment_Recovery_Email_Sent" : "Payment_Recovery_Email_Failed", {
    invoice_id: invoiceId,
    subscription_id: params.subscriptionId,
    email: email,
    error_message: errorMessage,
    status: status
  });
}

async function activateUserPlan(
  supabaseAdmin: ReturnType<typeof createClient>,
  params: {
    userId: string;
    email?: string | null;
    planId: string;
    billingCycle?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    status: string;
    trialStart?: string | null;
    trialEnd?: string | null;
    cancelAtPeriodEnd?: boolean;
    canceledAt?: string | null;
    
    // Novos campos opcionais de recuperação de pagamento
    paymentStatus?: string | null;
    latestInvoiceId?: string | null;
    hostedInvoiceUrl?: string | null;
    lastPaymentFailedAt?: string | null;
    lastPaymentSucceededAt?: string | null;
    amountRemaining?: number | null;
    amountDue?: number | null;
    invoiceAttemptCount?: number | null;
  }
) {
  const normPlan = normalizePlanDbName(params.planId);
  const isCanceled = ["cancelled", "canceled", "unpaid", "incomplete_expired"].includes(params.status.toLowerCase());
  
  // Limites oficiais de limites de leads/IA
  let targetPlan = normPlan;
  let leadsLimit = 20;
  let aiLimit = 3;
  let subscriptionStatus = params.status;

  if (isCanceled) {
    targetPlan = "free";
    leadsLimit = 20;
    aiLimit = 3;
    subscriptionStatus = "cancelled";
  } else {
    if (normPlan === "starter") {
      leadsLimit = 300;
      aiLimit = 30;
    } else if (normPlan === "pro") {
      leadsLimit = 800;
      aiLimit = 100;
    } else if (normPlan === "agencia") {
      leadsLimit = 2000;
      aiLimit = 300;
    }
  }

  // Obter limites existentes para preservar o uso mensal (Não zerar créditos fora do ciclo)
  const { data: existingSub } = await supabaseAdmin
    .from("user_subscriptions")
    .select("leads_used_this_month, ai_used_this_month")
    .eq("user_id", params.userId)
    .maybeSingle();

  const leadsUsed = existingSub?.leads_used_this_month ?? 0;
  const aiUsed = existingSub?.ai_used_this_month ?? 0;

  const now = new Date();
  const periodStart = params.currentPeriodStart || now.toISOString();
  let periodEnd = params.currentPeriodEnd;
  if (!periodEnd) {
    const end = new Date(now);
    if (params.billingCycle === "yearly" || params.billingCycle === "annual" || params.billingCycle === "year") {
      end.setFullYear(end.getFullYear() + 1);
    } else {
      end.setMonth(end.getMonth() + 1);
    }
    periodEnd = end.toISOString();
  }

  // Fazer o upsert da assinatura
  const { error } = await supabaseAdmin
    .from("user_subscriptions")
    .upsert({
      user_id: params.userId,
      plan_name: targetPlan,
      leads_limit: leadsLimit,
      ai_limit: aiLimit,
      leads_used_this_month: leadsUsed,
      ai_used_this_month: aiUsed,
      billing_period_start: periodStart,
      billing_period_end: periodEnd,
      is_annual: params.billingCycle === "yearly" || params.billingCycle === "annual" || params.billingCycle === "year",
      subscription_status: subscriptionStatus,
      stripe_customer_id: params.stripeCustomerId ?? null,
      stripe_subscription_id: params.stripeSubscriptionId ?? null,
      stripe_price_id: params.stripePriceId ?? null,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      billing_cycle: params.billingCycle || "monthly",
      trial_start: params.trialStart ?? null,
      trial_end: params.trialEnd ?? null,
      cancel_at_period_end: params.cancelAtPeriodEnd ?? false,
      canceled_at: params.canceledAt ?? null,
      updated_at: now.toISOString(),
      
      // Novos campos de recuperação de pagamento
      status: subscriptionStatus,
      payment_status: params.paymentStatus ?? null,
      latest_invoice_id: params.latestInvoiceId ?? null,
      hosted_invoice_url: params.hostedInvoiceUrl ?? null,
      last_payment_failed_at: params.lastPaymentFailedAt ?? null,
      last_payment_succeeded_at: params.lastPaymentSucceededAt ?? null,
      amount_remaining: params.amountRemaining ?? null,
      amount_due: params.amountDue ?? null,
      invoice_attempt_count: params.invoiceAttemptCount ?? null,
    }, { onConflict: "user_id" });

  if (error) {
    console.error("Erro ao fazer upsert em user_subscriptions:", error);
    throw error;
  }

  // Calcular trial_days_remaining se estiver em trial
  let trialDaysRemaining: number | null = null;
  if (subscriptionStatus === "trialing" && params.trialEnd) {
    const trialEndDate = new Date(params.trialEnd);
    const diff = trialEndDate.getTime() - now.getTime();
    trialDaysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  // Atualizar a tabela profiles para espelhar as informações
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      plan_id: targetPlan,
      subscription_status: subscriptionStatus,
      trial_start: params.trialStart ?? null,
      trial_end: params.trialEnd ?? null,
      trial_days_remaining: trialDaysRemaining,
      stripe_customer_id: params.stripeCustomerId ?? null,
      stripe_subscription_id: params.stripeSubscriptionId ?? null,
      
      // Novos campos em profiles
      current_plan: targetPlan,
      payment_status: params.paymentStatus ?? null,
    })
    .eq("id", params.userId);

  if (profileError) {
    console.warn("[activateUserPlan] Erro ao atualizar tabela profiles:", profileError);
  }

  // Trigger do bonus de indicação (referral)
  if (!isCanceled && ["starter", "pro", "agencia"].includes(targetPlan)) {
    await rewardReferralForPaidPlan(supabaseAdmin, params.userId, targetPlan);
  }

  // Agendar sequência de e-mails do trial (dias 3, 6 e 7)
  // Fire-and-forget: erro aqui não interrompe a ativação do plano.
  if (subscriptionStatus === 'trialing' && !isCanceled) {
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', params.userId)
        .maybeSingle();

      await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/schedule-trial-emails`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            user_id:          params.userId,
            email:            params.email,
            name:             profile?.full_name ?? '',
            trial_started_at: params.trialStart,
          }),
        }
      );
      console.log(`[activateUserPlan] E-mails do trial agendados para ${params.userId}`);
    } catch (emailErr) {
      console.warn('[activateUserPlan] Falha ao agendar e-mails do trial (não crítico):', emailErr);
    }
  }

  console.log(`[activateUserPlan] Plano ${targetPlan} ativado com sucesso para o usuário ${params.userId}. Limites - leads: ${leadsLimit}, IA: ${aiLimit}`);
}


// Pipeline de busca robusta do usuário em caso de metadados ausentes (ETAPA 5)
async function findUserByStripeData(
  supabaseAdmin: ReturnType<typeof createClient>,
  stripe: Stripe,
  params: {
    session?: Stripe.Checkout.Session | null;
    subscription?: Stripe.Subscription | null;
    customerId?: string | null;
    customerEmail?: string | null;
  }
): Promise<{ userId: string | null; email: string | null }> {
  // 1. session.metadata.user_id
  if (params.session?.metadata?.user_id) {
    const uId = params.session.metadata.user_id;
    const email = params.session.metadata.user_email || params.session.customer_details?.email || params.session.customer_email || null;
    if (uId) return { userId: uId, email };
  }
  if (params.session?.metadata?.supabase_user_id) {
    const uId = params.session.metadata.supabase_user_id;
    const email = params.session.metadata.user_email || params.session.customer_details?.email || params.session.customer_email || null;
    if (uId) return { userId: uId, email };
  }

  // 2. subscription.metadata.user_id
  if (params.subscription?.metadata?.user_id) {
    const uId = params.subscription.metadata.user_id;
    const email = params.subscription.metadata.user_email || null;
    if (uId) return { userId: uId, email };
  }
  if (params.subscription?.metadata?.supabase_user_id) {
    const uId = params.subscription.metadata.supabase_user_id;
    const email = params.subscription.metadata.user_email || null;
    if (uId) return { userId: uId, email };
  }

  // 3. session.client_reference_id
  if (params.session?.client_reference_id) {
    const uId = params.session.client_reference_id;
    const email = params.session.customer_details?.email || params.session.customer_email || null;
    if (uId) return { userId: uId, email };
  }

  // 4. stripeCustomerId já salvo no banco de dados (user_addons, user_subscriptions, ou payment_events)
  if (params.customerId) {
    // Procurar em user_addons
    const { data: addonData } = await supabaseAdmin
      .from("user_addons")
      .select("user_id")
      .eq("stripe_customer_id", params.customerId)
      .limit(1)
      .maybeSingle();
    if (addonData?.user_id) {
      return { userId: addonData.user_id, email: null };
    }

    // Procurar em user_subscriptions
    const { data: subData } = await supabaseAdmin
      .from("user_subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", params.customerId)
      .limit(1)
      .maybeSingle();
    if (subData?.user_id) {
      return { userId: subData.user_id, email: null };
    }

    // Procurar em payment_events
    const { data: eventData } = await supabaseAdmin
      .from("payment_events")
      .select("user_id")
      .eq("stripe_customer_id", params.customerId)
      .not("user_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (eventData?.user_id) {
      return { userId: eventData.user_id, email: null };
    }
  }

  // 5. Look up by email (from params or customer details)
  let emailToLookup = params.customerEmail || params.session?.customer_details?.email || params.session?.customer_email || null;
  
  if (params.customerId && !emailToLookup) {
    try {
      const customer = await stripe.customers.retrieve(params.customerId);
      if (!customer.deleted) {
        emailToLookup = customer.email;
      }
    } catch (e) {
      console.warn("Erro ao recuperar email do customer no Stripe:", e);
    }
  }

  if (emailToLookup) {
    try {
      // 1. Tenta buscar usando a RPC de busca direta por e-mail (evita paginação e é indexada)
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc("get_user_id_by_email", {
        p_email: emailToLookup,
      });
      
      if (!rpcError && rpcData) {
        console.log(`[stripe-webhook] Usuário localizado via RPC get_user_id_by_email: ${rpcData} para o e-mail ${emailToLookup}`);
        return { userId: rpcData, email: emailToLookup };
      }

      if (rpcError) {
        console.warn("[stripe-webhook] Falha ao executar RPC get_user_id_by_email, usando fallback listUsers:", rpcError.message);
      }

      // 2. Fallback de segurança buscando com perPage estendido para 1000
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const user = authData?.users?.find(u => u.email?.toLowerCase() === emailToLookup!.toLowerCase());
      if (user?.id) {
        console.log(`[stripe-webhook] Usuário localizado via listUsers (fallback): ${user.id} para o e-mail ${emailToLookup}`);
        return { userId: user.id, email: emailToLookup };
      }
    } catch (authError) {
      console.error("[stripe-webhook] Erro ao buscar usuário por email:", authError);
    }
  }

  return { userId: null, email: emailToLookup };
}

async function upsertAddon(
  supabaseAdmin: ReturnType<typeof createClient>,
  params: {
    userId: string;
    addonId: string;
    status: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
  },
) {
  const now = new Date().toISOString();
  const isActive = params.status === "active";
  const { error } = await supabaseAdmin
    .from("user_addons")
    .upsert({
      user_id: params.userId,
      addon_id: params.addonId,
      status: params.status,
      provider: "stripe",
      stripe_customer_id: params.stripeCustomerId ?? null,
      stripe_subscription_id: params.stripeSubscriptionId ?? null,
      stripe_price_id: params.stripePriceId ?? null,
      activated_at: isActive ? now : undefined,
      cancelled_at: params.status === "cancelled" ? now : null,
      updated_at: now,
    }, { onConflict: "user_id,addon_id" });

  if (error) throw error;
}

async function logAppEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string | null,
  eventType: string,
  eventData: Record<string, unknown>,
  emailFallback?: string | null,
) {
  try {
    let sourceEvent: any = null;
    let profile: any = null;
    if (userId) {
      const [eventRes, profileRes] = await Promise.all([
        supabaseAdmin
          .from("app_events")
          .select("email,anonymous_id,session_id,utm_source,utm_medium,utm_campaign,utm_content,utm_term,fbclid,ref,offer")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle()
      ]);
      sourceEvent = eventRes.data;
      profile = profileRes.data;
    }

    const firstTouchObj = profile?.first_utm_source ? {
      utm_source: profile.first_utm_source,
      utm_medium: profile.first_utm_medium,
      utm_campaign: profile.first_utm_campaign,
      utm_content: profile.first_utm_content,
      referrer: profile.first_referrer,
      landing_page: profile.first_landing_page,
      seen_at: profile.first_seen_at,
      event_source_type: profile.first_event_source_type,
      creative_name: profile.first_creative_name,
    } : null;

    const lastTouchObj = profile?.last_utm_source ? {
      utm_source: profile.last_utm_source,
      utm_medium: profile.last_utm_medium,
      utm_campaign: profile.last_utm_campaign,
      utm_content: profile.last_utm_content,
      referrer: profile.last_referrer,
      landing_page: profile.last_landing_page,
      seen_at: profile.last_seen_at,
      event_source_type: profile.last_event_source_type,
      creative_name: profile.last_creative_name,
    } : null;

    const now = new Date().toISOString();
    const enrichedData = {
      ...eventData,
      first_touch: firstTouchObj,
      last_touch: lastTouchObj,
      first_utm_source: profile?.first_utm_source || null,
      first_utm_campaign: profile?.first_utm_campaign || null,
      first_utm_content: profile?.first_utm_content || null,
      first_event_source_type: profile?.first_event_source_type || null,
      last_utm_source: profile?.last_utm_source || null,
      last_utm_campaign: profile?.last_utm_campaign || null,
      last_utm_content: profile?.last_utm_content || null,
      last_event_source_type: profile?.last_event_source_type || null,
    };

    const { error } = await supabaseAdmin.from("app_events").insert({
      user_id: userId || null,
      email: sourceEvent?.email || emailFallback || eventData.email || eventData.user_email || null,
      anonymous_id: sourceEvent?.anonymous_id || null,
      session_id: sourceEvent?.session_id || null,
      event_type: eventType,
      event_name: eventType,
      event_data: enrichedData,
      metadata: enrichedData,
      ip_address: null,
      user_agent: "stripe-webhook",
      utm_source: profile?.last_utm_source || sourceEvent?.utm_source || null,
      utm_medium: profile?.last_utm_medium || sourceEvent?.utm_medium || null,
      utm_campaign: profile?.last_utm_campaign || sourceEvent?.utm_campaign || null,
      utm_content: profile?.last_utm_content || sourceEvent?.utm_content || null,
      utm_term: sourceEvent?.utm_term || null,
      fbclid: sourceEvent?.fbclid || null,
      ref: sourceEvent?.ref || null,
      offer: sourceEvent?.offer || null,
      first_touch: firstTouchObj,
      last_touch: lastTouchObj,
      created_at: now,
    });
    
    if (error) {
      console.error("[stripe-webhook] Erro ao inserir na tabela app_events:", error);
    }
  } catch (eventError) {
    console.warn("[stripe-webhook] Falha ao registrar app_event", eventError);
  }
}

async function checkDuplicatePurchaseEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string | null,
  checkoutSessionId: string | null,
  subscriptionId: string | null
): Promise<boolean> {
  if (!userId) return false;
  
  try {
    let query = supabaseAdmin
      .from("app_events")
      .select("id")
      .eq("user_id", userId)
      .eq("event_name", "purchase_completed");
      
    const conditions: string[] = [];
    if (checkoutSessionId) {
      conditions.push(`metadata->>stripe_checkout_session_id.eq.${checkoutSessionId}`);
      conditions.push(`event_data->>stripe_checkout_session_id.eq.${checkoutSessionId}`);
    }
    if (subscriptionId) {
      conditions.push(`metadata->>stripe_subscription_id.eq.${subscriptionId}`);
      conditions.push(`event_data->>stripe_subscription_id.eq.${subscriptionId}`);
    }
    
    if (conditions.length > 0) {
      query = query.or(conditions.join(','));
    } else {
      return false;
    }
    
    const { data, error } = await query.limit(1);
    if (error) {
      console.warn("[stripe-webhook] Erro ao checar duplicidade de purchase event:", error);
      return false;
    }
    
    return data && data.length > 0;
  } catch (e) {
    console.warn("[stripe-webhook] Falha ao executar checkDuplicatePurchaseEvent:", e);
    return false;
  }
}

async function checkDuplicateTrialStartedEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string | null,
  subscriptionId: string | null
): Promise<boolean> {
  if (!userId || !subscriptionId) return false;
  
  try {
    const { data, error } = await supabaseAdmin
      .from("app_events")
      .select("id")
      .eq("user_id", userId)
      .eq("event_name", "trial_started")
      .or(`metadata->>stripe_subscription_id.eq.${subscriptionId},event_data->>stripe_subscription_id.eq.${subscriptionId}`)
      .limit(1);
      
    if (error) {
      console.warn("[stripe-webhook] Erro ao checar duplicidade de trial_started event:", error);
      return false;
    }
    
    return data && data.length > 0;
  } catch (e) {
    console.warn("[stripe-webhook] Falha ao executar checkDuplicateTrialStartedEvent:", e);
    return false;
  }
}

async function logPaymentEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
  values: Record<string, unknown>,
) {
  try {
    await supabaseAdmin
      .from("payment_events")
      .upsert(values, { onConflict: "provider,provider_event_id" });
  } catch (eventError) {
    console.warn("[stripe-webhook] Falha ao registrar payment_event", eventError);
  }
}

async function rewardReferralForPaidPlan(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  planName: string,
) {
  if (!["starter", "iniciante", "pro", "agency", "agencia"].includes(planName)) return;

  const { error } = await supabaseAdmin.rpc("reward_referral_for_paid_plan", {
    p_referred_user_id: userId,
    p_plan_name: planName,
    p_paid_at: new Date().toISOString(),
  });

  if (error) {
    console.warn("[stripe-webhook] Falha ao liberar bonus de indicacao", {
      userId,
      planName,
      error: error.message,
    });
  }
}

async function updateAddonFromSubscription(
  supabaseAdmin: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription,
  statusOverride?: string,
) {
  const metadata = subscription.metadata;
  if (!isAddonMetadata(metadata)) return false;

  const status = statusOverride
    || (["active", "trialing"].includes(subscription.status) ? "active" : subscription.status);
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;

  await upsertAddon(supabaseAdmin, {
    userId: metadata.user_id,
    addonId: metadata.addon_id,
    status,
    stripeCustomerId: stripeId(subscription.customer),
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
  });

  console.log("Stripe add-on atualizado", {
    userId: metadata.user_id,
    addonId: metadata.addon_id,
    status,
    subscriptionId: subscription.id,
  });

  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({
      ok: true,
      function: "stripe-webhook",
      message: "Webhook function deployed. POST requires Stripe signature.",
      env: {
        STRIPE_WEBHOOK_SECRET: Boolean(endpointSecret),
        STRIPE_SECRET_KEY: Boolean(Deno.env.get("STRIPE_SECRET_KEY")),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      ok: false,
      error: "Method not allowed. Use GET for health or POST for Stripe events.",
    }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response(JSON.stringify({
      ok: false,
      error: "No Stripe signature. POST requires a valid Stripe-Signature header.",
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new Response(JSON.stringify({ ok: false, error: `Webhook Error: ${err.message}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    let eventUserId: string | null = null;
    let eventPlanName: string | null = null;
    let eventStatus: string | null = null;
    let stripeCustomerId: string | null = null;
    let stripeSubscriptionId: string | null = null;
    let stripeCheckoutSessionId: string | null = null;
    let amount: number | null = null;
    let currency: string | null = null;

    console.log(`[stripe-webhook] Recebido evento Stripe: ${event.type} (ID: ${event.id})`);

    // 1. checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata;
      
      const { userId, email } = await findUserByStripeData(supabaseAdmin, stripe, {
        session,
        customerId: stripeId(session.customer),
      });

      eventUserId = userId;
      stripeCustomerId = stripeId(session.customer);
      stripeSubscriptionId = stripeId(session.subscription);
      stripeCheckoutSessionId = session.id;
      amount = session.amount_total ?? null;
      currency = session.currency ?? null;

      // RESOLVER O PLANO COM MÁXIMA SEGURANÇA
      let resolvedPriceId: string | null = null;
      let trialStart: string | null = null;
      let trialEnd: string | null = null;
      let cancelAtPeriodEnd = false;
      let canceledAt: string | null = null;
      let subStatus = "active";

      if (stripeSubscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          resolvedPriceId = sub.items?.data?.[0]?.price?.id || null;
          trialStart = sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null;
          trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
          cancelAtPeriodEnd = sub.cancel_at_period_end;
          canceledAt = sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null;
          subStatus = sub.status;
        } catch (e) {
          console.warn("Erro ao buscar subscription no Stripe para obter dados:", e);
        }
      }

      const { planId: finalPlanId, planResolutionSource, hasPlanConflict, conflictDetails } = resolvePlanByStripeData(
        resolvedPriceId,
        amount,
        metadata?.plan_id || metadata?.plan_key || null
      );
      
      eventPlanName = finalPlanId;
      eventStatus = session.payment_status || session.status || null;

      if (!eventUserId) {
        console.error(`[stripe-webhook] checkout.session.completed recebido sem user_id correspondente (ID do Evento: ${event.id})`);
        
        await logAppEvent(supabaseAdmin, null, "Payment_Plan_Activation_Failed", {
          stripe_event_id: event.id,
          event_type: event.type,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_checkout_session_id: stripeCheckoutSessionId,
          plan_id: finalPlanId,
          amount_total: amount,
          error_message: "Usuário não encontrado para ativação automática.",
        }, email || session.customer_details?.email || session.customer_email);
      } else {
        if (isAddonMetadata(metadata)) {
          await upsertAddon(supabaseAdmin, {
            userId: eventUserId,
            addonId: metadata.addon_id,
            status: "active",
            stripeCustomerId,
            stripeSubscriptionId,
          });
          console.log(`[stripe-webhook] Add-on ${metadata.addon_id} ativado via checkout.session.completed para o usuário ${eventUserId}`);
        } else {
          // Ativação do plano principal
          const billingCycle = metadata?.billing_cycle || "monthly";
          
          await activateUserPlan(supabaseAdmin, {
            userId: eventUserId,
            email,
            planId: finalPlanId,
            billingCycle,
            stripeCustomerId,
            stripeSubscriptionId,
            stripePriceId: resolvedPriceId,
            status: subStatus,
            trialStart,
            trialEnd,
            cancelAtPeriodEnd,
            canceledAt,
          });
          
          await logAppEvent(supabaseAdmin, eventUserId, "Payment_Plan_Activated", {
            stripe_event_id: event.id,
            event_type: event.type,
            plan_id: finalPlanId,
            email,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
            stripe_checkout_session_id: stripeCheckoutSessionId,
          });

          // REGISTRAR TRIAL INICIADO SE A ASSINATURA ESTIVER EM STATUS TRIALING
          if (subStatus === "trialing") {
            const hasTrialDuplicate = await checkDuplicateTrialStartedEvent(
              supabaseAdmin,
              eventUserId,
              stripeSubscriptionId
            );

            if (!hasTrialDuplicate) {
              await logAppEvent(supabaseAdmin, eventUserId, "trial_started", {
                stripe_event_id: event.id,
                stripe_checkout_session_id: stripeCheckoutSessionId,
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: stripeSubscriptionId,
                stripe_price_id: resolvedPriceId,
                plan_id: finalPlanId,
                plan_name: finalPlanId === "starter" ? "Starter" : finalPlanId === "pro" ? "Pro" : finalPlanId === "agency" ? "Agency" : "Free",
                value: 0,
                currency: currency?.toUpperCase() || "BRL",
                billing_cycle: billingCycle === "yearly" || billingCycle === "annual" || billingCycle === "year" ? "yearly" : "monthly",
                source: "stripe_webhook",
              });
              console.log(`[stripe-webhook] Evento trial_started registrado via checkout.session.completed para ${eventUserId}`);
            }
          }

          // REGISTRAR COMPRA IMEDIATAMENTE NO TEMPO REAL SE O PAGAMENTO ESTIVER CONFIRMADO
          if (eventStatus === "paid" || session.payment_status === "paid") {
            const hasDuplicate = await checkDuplicatePurchaseEvent(
              supabaseAdmin,
              eventUserId,
              stripeCheckoutSessionId,
              stripeSubscriptionId
            );

            if (!hasDuplicate) {
              await logAppEvent(supabaseAdmin, eventUserId, "purchase_completed", {
                stripe_event_id: event.id,
                stripe_checkout_session_id: stripeCheckoutSessionId,
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: stripeSubscriptionId,
                stripe_price_id: resolvedPriceId,
                plan_id: finalPlanId,
                plan_name: finalPlanId === "starter" ? "Starter" : finalPlanId === "pro" ? "Pro" : finalPlanId === "agency" ? "Agency" : "Free",
                value: amount ? amount / 100 : 0,
                currency: currency?.toUpperCase() || "BRL",
                billing_cycle: billingCycle === "yearly" || billingCycle === "annual" || billingCycle === "year" ? "yearly" : "monthly",
                source: "stripe_webhook",
                plan_resolution_source: planResolutionSource,
                has_plan_conflict: hasPlanConflict,
                conflict_details: conflictDetails,
              });
              console.log(`[stripe-webhook] Evento purchase_completed registrado com sucesso via checkout.session.completed para ${eventUserId}`);
            }
          }
        }
      }
    }

    // 2. customer.subscription.created e customer.subscription.updated
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const metadata = subscription.metadata;
      
      const { userId, email } = await findUserByStripeData(supabaseAdmin, stripe, {
        subscription,
        customerId: stripeId(subscription.customer),
      });

      eventUserId = userId;
      stripeCustomerId = stripeId(subscription.customer);
      stripeSubscriptionId = subscription.id;
      
      const priceId = subscription.items?.data?.[0]?.price?.id || null;
      const subscriptionAmount = subscription.items?.data?.[0]?.price?.unit_amount || null;
      currency = subscription.items?.data?.[0]?.price?.currency || null;

      const { planId: finalPlanId, planResolutionSource, hasPlanConflict, conflictDetails } = resolvePlanByStripeData(
        priceId,
        subscriptionAmount,
        metadata?.plan_id || metadata?.plan_key || null
      );
      
      eventPlanName = finalPlanId;
      eventStatus = subscription.status;

      if (isAddonMetadata(metadata)) {
        await updateAddonFromSubscription(supabaseAdmin, subscription);
      } else {
        if (!eventUserId) {
          console.warn(`[stripe-webhook] customer.subscription.created/updated recebido sem user_id mapeado (ID do Evento: ${event.id})`);
        } else {
          const billingCycle = metadata?.billing_cycle || "monthly";
          const trialStart = subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null;
          const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
          const cancelAtPeriodEnd = subscription.cancel_at_period_end;
          const canceledAt = subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null;

          // Se estiver em trial e o usuário marcou para cancelar, cancela imediatamente no Stripe
          if (subscription.status === "trialing" && cancelAtPeriodEnd) {
            console.log(`[stripe-webhook] Assinatura em trial detectada com cancel_at_period_end=true. Cancelando imediatamente no Stripe para o usuário ${eventUserId}.`);
            try {
              await stripe.subscriptions.cancel(subscription.id);
              // Dispara o rebaixamento local imediatamente
              await activateUserPlan(supabaseAdmin, {
                userId: eventUserId,
                email,
                planId: "free",
                billingCycle,
                stripeCustomerId,
                stripeSubscriptionId,
                stripePriceId: priceId,
                currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
                status: "cancelled",
                trialStart,
                trialEnd,
                cancelAtPeriodEnd: false,
                canceledAt: new Date().toISOString(),
              });
              
              await logAppEvent(supabaseAdmin, eventUserId, "Subscription_Canceled_Trial_Immediate", {
                stripe_event_id: event.id,
                event_type: event.type,
                plan_id: finalPlanId,
                email,
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: stripeSubscriptionId,
              });
              
              await logAppEvent(supabaseAdmin, eventUserId, "cancel_trial", {
                stripe_event_id: event.id,
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: stripeSubscriptionId,
                plan_id: finalPlanId,
                reason: "trial_immediate_cancel",
              });

              // Retornar da execução pois já processamos o cancelamento
              return new Response(JSON.stringify({ received: true, forced_trial_cancel: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            } catch (cancelError) {
              console.error(`[stripe-webhook] Erro ao forçar cancelamento imediato no Stripe para ${subscription.id}:`, cancelError);
            }
          }

          let paymentStatus = "paid";
          if (subscription.status === "past_due" || subscription.status === "unpaid") {
            paymentStatus = "failed";
          } else if (subscription.status === "incomplete") {
            paymentStatus = "requires_payment_method";
          }

          await activateUserPlan(supabaseAdmin, {
            userId: eventUserId,
            email,
            planId: finalPlanId,
            billingCycle,
            stripeCustomerId,
            stripeSubscriptionId,
            stripePriceId: priceId,
            currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            status: subscription.status,
            trialStart,
            trialEnd,
            cancelAtPeriodEnd,
            canceledAt,
            
            paymentStatus,
            latestInvoiceId: subscription.latest_invoice ? stripeId(subscription.latest_invoice) : undefined,
          });

          await logAppEvent(supabaseAdmin, eventUserId, "Subscription_Updated", {
            stripe_event_id: event.id,
            event_type: event.type,
            plan_id: finalPlanId,
            email,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
          });

          if (subscription.status === "trialing") {
            const hasTrialDuplicate = await checkDuplicateTrialStartedEvent(
              supabaseAdmin,
              eventUserId,
              stripeSubscriptionId
            );

            if (!hasTrialDuplicate) {
              await logAppEvent(supabaseAdmin, eventUserId, "trial_started", {
                stripe_event_id: event.id,
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: stripeSubscriptionId,
                stripe_price_id: priceId,
                plan_id: finalPlanId,
                plan_name: finalPlanId === "starter" ? "Starter" : finalPlanId === "pro" ? "Pro" : finalPlanId === "agency" ? "Agency" : "Free",
                value: 0,
                currency: currency?.toUpperCase() || "BRL",
                billing_cycle: billingCycle === "yearly" || billingCycle === "annual" || billingCycle === "year" ? "yearly" : "monthly",
                source: "stripe_webhook",
              });
              console.log(`[stripe-webhook] Evento trial_started registrado via customer.subscription.created/updated para ${eventUserId}`);
            }
          }
        }
      }
    }

    // 3. customer.subscription.deleted
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const metadata = subscription.metadata;

      const { userId, email } = await findUserByStripeData(supabaseAdmin, stripe, {
        subscription,
        customerId: stripeId(subscription.customer),
      });

      eventUserId = userId;
      stripeCustomerId = stripeId(subscription.customer);
      stripeSubscriptionId = subscription.id;
      eventStatus = "cancelled";

      if (isAddonMetadata(metadata)) {
        await updateAddonFromSubscription(supabaseAdmin, subscription, "cancelled");
      } else {
        if (!eventUserId) {
          console.warn(`[stripe-webhook] customer.subscription.deleted recebido sem user_id mapeado (ID do Evento: ${event.id})`);
        } else {
          // Downgrade para Free
          const trialStart = subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null;
          const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
          const canceledAt = subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null;

          await activateUserPlan(supabaseAdmin, {
            userId: eventUserId,
            email,
            planId: "free",
            billingCycle: "monthly",
            stripeCustomerId,
            stripeSubscriptionId,
            status: "cancelled",
            trialStart,
            trialEnd,
            cancelAtPeriodEnd: false,
            canceledAt,
            paymentStatus: "canceled",
          });

          await logAppEvent(supabaseAdmin, eventUserId, "Subscription_Canceled", {
            stripe_event_id: event.id,
            event_type: event.type,
            plan_id: metadata?.plan_id || "free",
            email,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
          });

          // Se estava em trial no momento do cancelamento
          const isTrial = subscription.trial_end && new Date(subscription.trial_end * 1000) > new Date();
          if (isTrial) {
            await logAppEvent(supabaseAdmin, eventUserId, "cancel_trial", {
              stripe_event_id: event.id,
              stripe_customer_id: stripeCustomerId,
              stripe_subscription_id: stripeSubscriptionId,
              plan_id: metadata?.plan_id || "free",
              reason: "subscription_deleted_during_trial",
            });
          }
        }
      }
    }

    // 4. invoice.payment_succeeded, invoice.payment_failed e invoice.paid
    if (event.type === "invoice.payment_succeeded" || event.type === "invoice.payment_failed" || event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = stripeId(invoice.subscription);
      const isFailed = event.type === "invoice.payment_failed";
      eventStatus = isFailed ? "failed" : "paid";
      stripeCustomerId = stripeId(invoice.customer);
      stripeSubscriptionId = subscriptionId;
      stripeCheckoutSessionId = stripeId(invoice.charge) || null;
      amount = invoice.amount_paid || invoice.amount_due || null;
      currency = invoice.currency || null;

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const metadata = subscription.metadata;

        const { userId, email } = await findUserByStripeData(supabaseAdmin, stripe, {
          subscription,
          customerId: stripeCustomerId,
        });

        eventUserId = userId;
        const priceId = subscription.items?.data?.[0]?.price?.id || null;

        const { planId: finalPlanId, planResolutionSource, hasPlanConflict, conflictDetails } = resolvePlanByStripeData(
          priceId,
          amount,
          metadata?.plan_id || metadata?.plan_key || metadata?.addon_id || null
        );

        eventPlanName = finalPlanId;

        if (isAddonMetadata(metadata)) {
          await updateAddonFromSubscription(
            supabaseAdmin,
            subscription,
            isFailed ? "past_due" : "active",
          );
        } else {
          if (!eventUserId) {
            console.warn(`[stripe-webhook] invoice event recebido sem user_id mapeado (ID do Evento: ${event.id})`);
            
            if (isFailed) {
              await logAppEvent(supabaseAdmin, null, "Payment_Plan_Activation_Failed", {
                stripe_event_id: event.id,
                event_type: event.type,
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: stripeSubscriptionId,
                error_message: "Falha de pagamento de fatura para usuário não mapeado.",
              }, email || invoice.customer_email || invoice.customer_name);
            }
          } else {
            const billingCycle = metadata?.billing_cycle || "monthly";
            
            const trialStart = subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null;
            const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
            const cancelAtPeriodEnd = subscription.cancel_at_period_end;
            const canceledAt = subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null;

            await activateUserPlan(supabaseAdmin, {
              userId: eventUserId,
              email,
              planId: finalPlanId,
              billingCycle,
              stripeCustomerId,
              stripeSubscriptionId,
              stripePriceId: priceId,
              currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
              status: isFailed ? "past_due" : subscription.status,
              trialStart,
              trialEnd,
              cancelAtPeriodEnd,
              canceledAt,
              
              // Novos campos de faturamento/recuperação
              paymentStatus: isFailed ? "failed" : "paid",
              latestInvoiceId: invoice.id,
              hostedInvoiceUrl: invoice.hosted_invoice_url,
              lastPaymentFailedAt: isFailed ? new Date().toISOString() : undefined,
              lastPaymentSucceededAt: !isFailed ? new Date().toISOString() : undefined,
              amountRemaining: invoice.amount_remaining,
              amountDue: invoice.amount_due,
              invoiceAttemptCount: invoice.attempt_count,
            });

            if (isFailed) {
              await logAppEvent(supabaseAdmin, eventUserId, "Payment_Failed", {
                stripe_event_id: event.id,
                event_type: event.type,
                plan_id: finalPlanId,
                email,
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: stripeSubscriptionId,
                invoice_id: invoice.id,
                amount_due: invoice.amount_due,
                amount_remaining: invoice.amount_remaining,
                hosted_invoice_url: invoice.hosted_invoice_url,
                attempt_count: invoice.attempt_count,
              });

              // Obter o nome do usuário a partir dos profiles se possível para o e-mail
              let userName = "";
              if (eventUserId) {
                const { data: prof } = await supabaseAdmin
                  .from("profiles")
                  .select("nome_completo")
                  .eq("id", eventUserId)
                  .maybeSingle();
                userName = prof?.nome_completo || "";
              }

              // Dispara o e-mail de recuperação sem duplicar
              await sendPaymentRecoveryEmail(supabaseAdmin, {
                userId: eventUserId,
                email: email || invoice.customer_email || "",
                nome: userName,
                plano: finalPlanId,
                invoiceId: invoice.id,
                subscriptionId: stripeSubscriptionId,
                hostedInvoiceUrl: invoice.hosted_invoice_url,
              });
            } else {
              await logAppEvent(supabaseAdmin, eventUserId, "Payment_Recovered", {
                stripe_event_id: event.id,
                event_type: event.type,
                plan_id: finalPlanId,
                email,
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: stripeSubscriptionId,
                invoice_id: invoice.id,
                amount_paid: invoice.amount_paid || amount || 0,
              });

              await logAppEvent(supabaseAdmin, eventUserId, "Payment_Plan_Activated", {
                stripe_event_id: event.id,
                event_type: event.type,
                plan_id: finalPlanId,
                email,
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: stripeSubscriptionId,
              });

              // REGISTRAR COMPRA SE NÃO TIVER SIDO REGISTRADA ANTES (GARANTE IDEMPOTÊNCIA)
              const hasDuplicate = await checkDuplicatePurchaseEvent(
                supabaseAdmin,
                eventUserId,
                null,
                stripeSubscriptionId
              );

              if (!hasDuplicate) {
                await logAppEvent(supabaseAdmin, eventUserId, "purchase_completed", {
                  stripe_event_id: event.id,
                  stripe_checkout_session_id: null,
                  stripe_customer_id: stripeCustomerId,
                  stripe_subscription_id: stripeSubscriptionId,
                  stripe_price_id: priceId,
                  plan_id: finalPlanId,
                  plan_name: finalPlanId === "starter" ? "Starter" : finalPlanId === "pro" ? "Pro" : finalPlanId === "agency" ? "Agency" : "Free",
                  value: amount ? amount / 100 : 0,
                  currency: currency?.toUpperCase() || "BRL",
                  billing_cycle: billingCycle === "yearly" || billingCycle === "annual" || billingCycle === "year" ? "yearly" : "monthly",
                  source: "stripe_webhook",
                  plan_resolution_source: planResolutionSource,
                  has_plan_conflict: hasPlanConflict,
                  conflict_details: conflictDetails,
                });
                console.log(`[stripe-webhook] Evento purchase_completed registrado com sucesso via invoice.payment_succeeded/paid para ${eventUserId}`);
              }
            }
          }
        }
      }
    }

    // Registra todos os eventos de pagamento no banco com restrição UNIQUE de provider_event_id para idempotência
    await logPaymentEvent(supabaseAdmin, {
      user_id: eventUserId,
      event_type: event.type,
      provider: "stripe",
      provider_event_id: event.id,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_checkout_session_id: stripeCheckoutSessionId,
      plan_name: eventPlanName,
      amount,
      currency,
      status: eventStatus,
      event_data: event.data.object as Record<string, unknown>,
    });
  } catch (error: any) {
    console.error("Erro ao processar webhook Stripe:", {
      eventType: event.type,
      message: error?.message,
    });
    
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
