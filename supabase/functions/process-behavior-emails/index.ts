import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// ============= CONFIGURATION =============
const SCAN_USER_LIMIT = 25;
const PROCESS_BATCH_SIZE = 5;
const RESEND_TIMEOUT_MS = 8000;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "Zuno Propect <contato@zunopropect.com.br>";
const RESEND_REPLY_TO_EMAIL = Deno.env.get("RESEND_REPLY_TO_EMAIL") || "contato@zunopropect.com.br";
const BEHAVIOR_EMAIL_TEST_MODE = Deno.env.get("BEHAVIOR_EMAIL_TEST_MODE") === "true";
const BEHAVIOR_EMAIL_ALLOWED_TEST_RECIPIENTS = (Deno.env.get("BEHAVIOR_EMAIL_ALLOWED_TEST_RECIPIENTS") || "jeferson.zanotell@gmail.com")
  .split(",")
  .map(email => email.trim().toLowerCase());

interface EmailTemplatePayload {
  title: string;
  preheader: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  microcopy: string;
}

// ============= TEMPLATES GENERATORS =============
function behaviorEmailLayout(payload: EmailTemplatePayload & { unsubscribeUrl: string }): string {
  const { title, preheader, body, ctaLabel, ctaUrl, microcopy, unsubscribeUrl } = payload;
  
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f0e; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%;">
  <!-- Preheader invisível -->
  <div style="display: none; max-height: 0px; overflow: hidden; opacity: 0; color: transparent; font-size: 1px; line-height: 1px;">
    ${preheader}
  </div>

  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #0b0f0e; padding: 40px 10px;">
    <tr>
      <td align="center">
        <!-- Container Central -->
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%; border-collapse: collapse;">
          <!-- Topo/Header -->
          <tr>
            <td style="padding: 0 0 24px 0; text-align: left;">
              <span style="font-size: 16px; font-weight: 700; letter-spacing: 0.5px; color: #10d98a;">
                Zuno Propect
              </span>
            </td>
          </tr>
          
          <!-- Card Principal -->
          <tr>
            <td style="background-color: #111816; border: 1px solid #1f2d29; border-radius: 12px; padding: 40px 32px; text-align: left;">
              <!-- Título -->
              <h1 style="margin: 0 0 20px 0; font-size: 22px; font-weight: 700; color: #ffffff; line-height: 1.3;">
                ${title}
              </h1>
              
              <!-- Corpo de Texto -->
              <p style="margin: 0 0 32px 0; font-size: 15px; line-height: 1.6; color: #f4f4f5; white-space: pre-line;">
                ${body}
              </p>

              <!-- Bloco do Botão CTA -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="left">
                    <a href="${ctaUrl}" target="_blank" style="display: inline-block; background-color: #10d98a; color: #0b0f0e; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 700; text-align: center;">
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Microcopy / Texto Secundário -->
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #9ca3af;">
                ${microcopy}
              </p>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="padding: 32px 24px 0 24px; text-align: center;">
              <p style="margin: 0 0 12px 0; font-size: 12px; line-height: 1.6; color: #9ca3af;">
                Você recebeu este e-mail porque criou uma conta no Zuno Propect.
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 1.6;">
                <a href="${unsubscribeUrl}" target="_blank" style="color: #9ca3af; text-decoration: underline;">
                  Descadastrar
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function behaviorEmailText(payload: EmailTemplatePayload & { unsubscribeUrl: string }): string {
  const { title, body, ctaLabel, ctaUrl, microcopy, unsubscribeUrl } = payload;
  return `${title}

${body}

👉 ${ctaLabel}:
${ctaUrl}

---
${microcopy}

---
Você recebeu este e-mail porque criou uma conta no Zuno Propect.
Descadastrar:
${unsubscribeUrl}
`;
}

// ============= DEFINIÇÃO DOS TEMPLATES =============
const emailTemplates: Record<string, (metadata: any) => EmailTemplatePayload> = {
  signup_no_search_1h: () => ({
    title: "Faça sua primeira busca",
    preheader: "Comece encontrando empresas por cidade e nicho.",
    body: `Você criou sua conta no Zuno Propect, mas ainda não fez sua primeira busca.
 
Comece escolhendo uma cidade e um nicho. O Zuno encontra empresas e ajuda você a transformar isso em oportunidades de abordagem.`,
    ctaLabel: "Fazer minha primeira busca",
    ctaUrl: "https://www.zunopropect.com.br/prospeccao?utm_source=email&utm_medium=behavior&utm_campaign=signup_no_search_1h",
    microcopy: "Você começa com 20 leads grátis e 3 análises IA."
  }),
  
  search_no_ai_1h: () => ({
    title: "Gere sua primeira abordagem com IA",
    preheader: "Use a IA para transformar um lead em uma mensagem com contexto.",
    body: `Você já encontrou leads no Zuno.
 
O próximo passo é escolher uma empresa e gerar uma abordagem com IA para WhatsApp, Instagram ou e-mail.`,
    ctaLabel: "Gerar abordagem com IA",
    ctaUrl: "https://www.zunopropect.com.br/prospeccao?utm_source=email&utm_medium=behavior&utm_campaign=search_no_ai_1h",
    microcopy: "Esse é o momento em que uma lista vira uma conversa com contexto."
  }),
 
  ai_used_continue_2h: () => ({
    title: "Continue analisando seus melhores leads",
    preheader: "Você ainda pode gerar mais abordagens com IA.",
    body: `Você já usou a IA do Zuno para gerar contexto de abordagem.
 
Agora escolha outro lead com potencial e gere uma nova mensagem antes de tomar a decisão de contato.`,
    ctaLabel: "Analisar outro lead",
    ctaUrl: "https://www.zunopropect.com.br/prospeccao?utm_source=email&utm_medium=behavior&utm_campaign=ai_used_continue_2h",
    microcopy: "Priorize empresas que parecem ter mais chance de responder."
  }),
 
  ai_limit_no_upgrade_1h: () => ({
    title: "Libere mais análises IA",
    preheader: "Continue gerando abordagens com mais análises IA.",
    body: `Você usou suas análises IA grátis no Zuno Propect.
 
Com um plano pago, você pode continuar transformando leads em abordagens com mais contexto para WhatsApp, Instagram e e-mail.`,
    ctaLabel: "Ver planos",
    ctaUrl: "https://www.zunopropect.com.br/precos?utm_source=email&utm_medium=behavior&utm_campaign=ai_limit_no_upgrade_1h",
    microcopy: "O Starter libera 30 análises IA por mês. O Pro libera 100 análises IA por mês."
  }),
 
  checkout_abandoned_1h: () => ({
    title: "Continue com o plano Starter",
    preheader: "Continue de onde parou no plano Starter.",
    body: `Você iniciou o checkout do plano Starter no Zuno Propect, mas não finalizou a assinatura.
 
Com o Starter, você libera 30 análises IA por mês para continuar transformando leads em abordagens mais claras para WhatsApp, Instagram e e-mail.`,
    ctaLabel: "Continuar com o Starter",
    ctaUrl: "https://www.zunopropect.com.br/precos?utm_source=email&utm_medium=behavior&utm_campaign=checkout_abandoned_1h&utm_content=starter",
    microcopy: "Se o checkout anterior expirou, criaremos uma nova sessão segura."
  }),
 
  hot_user_inactive_24h: () => ({
    title: "Continue sua prospecção",
    preheader: "Volte para continuar sua prospecção no Zuno.",
    body: `Você já encontrou leads e usou a IA do Zuno para gerar abordagens com contexto.
 
Volte para continuar analisando oportunidades e organizar sua próxima abordagem.`,
    ctaLabel: "Voltar para o Zuno",
    ctaUrl: "https://www.zunopropect.com.br/prospeccao?utm_source=email&utm_medium=behavior&utm_campaign=hot_user_inactive_24h",
    microcopy: "Continue de onde parou e mantenha sua prospecção em movimento."
  })
};

// ============= RESEND SENDER HELPER =============
async function sendEmailViaResend(payload: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
}): Promise<{ success: boolean; data?: any; error?: any }> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    if (!RESEND_API_KEY) {
      return { success: false, error: "RESEND_API_KEY não configurada no ambiente." };
    }

    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const responseText = await response.text();
    let data: any = null;
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      data = responseText;
    }

    if (!response.ok) {
      return {
        success: false,
        error: data?.message || data?.error || `Erro HTTP ${response.status} da API Resend`,
      };
    }

    return { success: true, data };
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);
    if (error?.name === "AbortError") {
      return { success: false, error: `Timeout ao chamar Resend apos ${RESEND_TIMEOUT_MS}ms` };
    }
    return { success: false, error: error.message || String(error) };
  }
}

// ============= HASH EMAIL FOR UNSUBSCRIBE MATCHING =============
const hashEmail = async (email: string): Promise<string> => {
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

// ============= HANDLER PRINCIPAL =============
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({
      ok: true,
      function: "process-behavior-emails",
      message: "Behavior email processor deployed. POST processes a limited batch.",
      batchSize: PROCESS_BATCH_SIZE,
      resendTimeoutMs: RESEND_TIMEOUT_MS,
      env: {
        RESEND_API_KEY: Boolean(RESEND_API_KEY),
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
      error: "Method not allowed. Use GET for health or POST for processing.",
    }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Detectar Payload e Ação
    let body: any = {};
    if (req.method === "POST") {
      body = await req.json().catch(() => ({}));
    }

    const { action = "cron", email: targetTestEmail, automation_key: testAutomationKey } = body;

    if (action === "ping" || action === "health") {
      return new Response(JSON.stringify({
        ok: true,
        function: "process-behavior-emails",
        message: "Health check only. No emails were queued or sent.",
        batchSize: PROCESS_BATCH_SIZE,
        resendTimeoutMs: RESEND_TIMEOUT_MS,
        env: {
          RESEND_API_KEY: Boolean(RESEND_API_KEY),
          SUPABASE_SERVICE_ROLE_KEY: Boolean(supabaseServiceKey),
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // FLUXO DE DISPARO DE TESTE (ADMIN ONLY)
    // ==========================================
    if (action === "send_test") {
      if (!targetTestEmail || !testAutomationKey) {
        return new Response(JSON.stringify({ success: false, error: "Parâmetros de teste ausentes." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const emailKey = testAutomationKey.trim();
      const templateGenerator = emailTemplates[emailKey];
      if (!templateGenerator) {
        return new Response(JSON.stringify({ success: false, error: `Automação ${emailKey} inválida.` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Procurar usuário pelo email de teste para puxar o ID
      let userId: string | null = null;
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const matchedUser = authUsers?.users?.find(u => u.email?.toLowerCase() === targetTestEmail.toLowerCase());
      if (matchedUser) {
        userId = matchedUser.id;
      }

      const unsubscribeUrl = userId
        ? `${supabaseUrl}/functions/v1/unsubscribe-email?uid=${encodeURIComponent(userId)}&source=${encodeURIComponent(emailKey)}`
        : `https://zunopropect.com.br/unsubscribe?email_hash=${await hashEmail(targetTestEmail)}`;

      const templatePayload = templateGenerator({});
      const html = behaviorEmailLayout({ ...templatePayload, unsubscribeUrl });
      const text = behaviorEmailText({ ...templatePayload, unsubscribeUrl });

      const emailPayload = {
        from: RESEND_FROM_EMAIL,
        to: [targetTestEmail],
        subject: `[TESTE] ${templatePayload.title}`,
        html,
        text,
        reply_to: RESEND_REPLY_TO_EMAIL,
      };

      console.log(`[TEST MODE] Enviando email ${emailKey} para ${targetTestEmail}...`);
      const resendRes = await sendEmailViaResend(emailPayload);

      return new Response(JSON.stringify(resendRes), {
        status: resendRes.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // FLUXO A: SCAN BEHAVIOR AUTOMATIONS (SCANNER)
    // ==========================================
    // Este bloco descobre usuários qualificados e enfileira na behavior_email_queue
    const scanBehaviorAutomations = async () => {
      console.log("[Scanner] Iniciando varredura comportamental...");
      const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: SCAN_USER_LIMIT,
      });
      if (listError) throw listError;

      const now = new Date();

      for (const user of authUsers.users) {
        if (!user.email) continue;
        const userEmail = user.email.toLowerCase();

        // 1. Verificar se usuário já comprou (Purchase / Plano Pago)
        // Buscamos em user_subscriptions
        const { data: subscription } = await supabase
          .from("user_subscriptions")
          .select("plan_name")
          .eq("user_id", user.id)
          .maybeSingle();

        const isPaidUser = subscription && ["starter", "pro", "agency"].includes(String(subscription.plan_name).toLowerCase());

        // Carregar eventos deste usuário no app_events
        const { data: userEvents } = await supabase
          .from("app_events")
          .select("event_name, created_at, metadata")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        const events = userEvents || [];

        const hasSearch = events.some(e => ["search_completed", "Search Completed", "first_search_completed"].includes(e.event_name));
        const hasAi = events.some(e => ["AI_Analysis_Completed", "First_AI_Analysis_Completed", "ai_analysis_completed"].includes(e.event_name));
        const hasCheckout = events.some(e => ["InitiateCheckout", "checkout_started"].includes(e.event_name));
        const hasPurchase = events.some(e => ["Purchase", "purchase_completed"].includes(e.event_name)) || isPaidUser;

        const hoursSinceRegistration = (now.getTime() - new Date(user.created_at).getTime()) / (1000 * 60 * 60);

        // --- AUTOMATION 1: signup_no_search_1h ---
        if (hoursSinceRegistration >= 1 && !hasSearch) {
          const scheduledTime = new Date(new Date(user.created_at).getTime() + 60 * 60 * 1000);
          await enqueueEmail(user.id, userEmail, "signup_no_search_1h", scheduledTime);
        }

        // --- AUTOMATION 2: search_no_ai_1h ---
        if (hasSearch && !hasAi) {
          const firstSearchEvent = events.find(e => ["search_completed", "Search Completed", "first_search_completed"].includes(e.event_name));
          if (firstSearchEvent) {
            const firstSearchTime = new Date(firstSearchEvent.created_at);
            const hoursSinceFirstSearch = (now.getTime() - firstSearchTime.getTime()) / (1000 * 60 * 60);
            if (hoursSinceFirstSearch >= 1) {
              const scheduledTime = new Date(firstSearchTime.getTime() + 60 * 60 * 1000);
              await enqueueEmail(user.id, userEmail, "search_no_ai_1h", scheduledTime);
            }
          }
        }

        // --- AUTOMATION 3: checkout_abandoned_1h ---
        if (hasCheckout && !hasPurchase) {
          const lastCheckoutEvent = [...events]
            .reverse()
            .find(e => ["InitiateCheckout", "checkout_started"].includes(e.event_name));
          if (lastCheckoutEvent) {
            const checkoutTime = new Date(lastCheckoutEvent.created_at);
            const hoursSinceCheckout = (now.getTime() - checkoutTime.getTime()) / (1000 * 60 * 60);
            if (hoursSinceCheckout >= 1) {
              const scheduledTime = new Date(checkoutTime.getTime() + 60 * 60 * 1000);
              await enqueueEmail(user.id, userEmail, "checkout_abandoned_1h", scheduledTime);
            }
          }
        }

        // --- AUTOMATION 4: ai_limit_no_upgrade_1h ---
        const limitReachedEvent = events.find(e => e.event_name === "AI_Limit_Reached_Shown");
        if (limitReachedEvent && !hasPurchase) {
          const limitTime = new Date(limitReachedEvent.created_at);
          const hoursSinceLimit = (now.getTime() - limitTime.getTime()) / (1000 * 60 * 60);
          if (hoursSinceLimit >= 1) {
            const scheduledTime = new Date(limitTime.getTime() + 60 * 60 * 1000);
            await enqueueEmail(user.id, userEmail, "ai_limit_no_upgrade_1h", scheduledTime);
          }
        }

        // --- AUTOMATION 5: hot_user_inactive_24h ---
        if (hasSearch && hasAi && !hasPurchase) {
          const lastEvent = events[events.length - 1];
          if (lastEvent) {
            const lastEventTime = new Date(lastEvent.created_at);
            const hoursSinceLastActivity = (now.getTime() - lastEventTime.getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastActivity >= 24) {
              const scheduledTime = new Date(lastEventTime.getTime() + 24 * 60 * 60 * 1000);
              await enqueueEmail(user.id, userEmail, "hot_user_inactive_24h", scheduledTime);
            }
          }
        }

        // --- AUTOMATION 6: ai_used_continue_2h ---
        if (hasAi && !hasPurchase) {
          const firstAiEvent = events.find(e => ["AI_Analysis_Completed", "First_AI_Analysis_Completed", "ai_analysis_completed"].includes(e.event_name));
          if (firstAiEvent) {
            const firstAiTime = new Date(firstAiEvent.created_at);
            const hoursSinceFirstAi = (now.getTime() - firstAiTime.getTime()) / (1000 * 60 * 60);
            if (hoursSinceFirstAi >= 2) {
              // Checar se ainda tem AI_Available > 0
              const aiUsed = subscription?.plan_name ? 0 : events.filter(e => ["AI_Analysis_Completed", "First_AI_Analysis_Completed", "ai_analysis_completed"].includes(e.event_name)).length;
              const aiAvailable = 3 - aiUsed;
              if (aiAvailable > 0) {
                const scheduledTime = new Date(firstAiTime.getTime() + 2 * 60 * 60 * 1000);
                await enqueueEmail(user.id, userEmail, "ai_used_continue_2h", scheduledTime);
              }
            }
          }
        }
      }
    };

    // Helper para inserir na fila
    const enqueueEmail = async (userId: string, email: string, key: string, scheduledFor: Date) => {
      // 1. Verificar se o e-mail ou user_id está descadastrado antes de enfileirar
      const fingerprint = await hashEmail(email);
      const { data: isUnsub } = await supabase
        .from("email_unsubscribes")
        .select("id")
        .or(`user_id.eq.${userId},email_fingerprint.eq.${fingerprint}`)
        .maybeSingle();

      if (isUnsub) {
        console.log(`[Queue] Email skipped from enqueue due to unsubscribe: ${email}`);
        return;
      }

      const { data: existing } = await supabase
        .from("behavior_email_queue")
        .select("id")
        .eq("email", email)
        .eq("automation_key", key)
        .maybeSingle();

      if (!existing) {
        const { error, data } = await supabase
          .from("behavior_email_queue")
          .insert({
            user_id: userId,
            email: email,
            automation_key: key,
            scheduled_for: scheduledFor.toISOString(),
            status: "pending"
          })
          .select("id")
          .single();

        if (!error && data) {
          console.log(`[Queue] Enfileirado com sucesso: ${key} para ${email}`);
          // Registrar log de enfileiramento
          await supabase.from("behavior_email_logs").insert({
            queue_id: data.id,
            user_id: userId,
            email: email,
            automation_key: key,
            status: "queued"
          });
          // Registrar no app_events
          await trackBehaviorEvent(userId, email, key, data.id, "Behavior_Email_Queued", { scheduled_for: scheduledFor.toISOString() });
        }
      }
    };

    // Helper para rastrear evento
    const trackBehaviorEvent = async (userId: string | null, email: string, key: string, queueId: string, eventName: string, meta: Record<string, any> = {}) => {
      await supabase.from("app_events").insert({
        user_id: userId,
        event_name: eventName,
        is_internal_event: false,
        event_source_type: "internal",
        metadata: {
          automation_key: key,
          queue_id: queueId,
          campaign: key,
          email: email,
          ...meta
        }
      });
    };

    // ==========================================
    // FLUXO B: PROCESS PENDING BEHAVIOR EMAILS (DESPACHADOR)
    // ==========================================
    // Este bloco busca itens na fila pendentes cujo scheduled_for <= now()
    const processPendingBehaviorEmails = async () => {
      console.log("[Processor] Buscando emails pendentes programados...");
      const stats = { processed: 0, sent: 0, failed: 0, skipped: 0 };
      const { data: pendingItems, error: fetchError } = await supabase
        .from("behavior_email_queue")
        .select("*")
        .eq("status", "pending")
        .lte("scheduled_for", new Date().toISOString())
        .order("scheduled_for", { ascending: true })
        .limit(PROCESS_BATCH_SIZE);

      if (fetchError) throw fetchError;
      console.log(`[Processor] Encontrados ${pendingItems?.length || 0} e-mails pendentes.`);

      for (const item of pendingItems || []) {
        stats.processed += 1;
        let skipReason: string | null = null;

        // 1. Verificação de Unsubscribe
        const fingerprint = await hashEmail(item.email);
        const { data: unsubscribed } = await supabase
          .from("email_unsubscribes")
          .select("id")
          .or(`user_id.eq.${item.user_id},email_fingerprint.eq.${fingerprint}`)
          .maybeSingle();

        if (unsubscribed) {
          skipReason = "unsubscribed";
        }

        // 2. Carregar informações do plano do usuário em tempo real
        let isPaidUser = false;
        if (item.user_id && !skipReason) {
          const { data: subscription } = await supabase
            .from("user_subscriptions")
            .select("plan_name")
            .eq("user_id", item.user_id)
            .maybeSingle();
          isPaidUser = subscription && ["starter", "pro", "agency"].includes(String(subscription.plan_name).toLowerCase());
        }

        // 3. Double-Check de Ação Concluída e Precedência de Compra
        if (item.user_id && !skipReason) {
          const { data: userEvents } = await supabase
            .from("app_events")
            .select("event_name, created_at")
            .eq("user_id", item.user_id);

          const events = userEvents || [];

          const hasSearch = events.some(e => ["search_completed", "Search Completed", "first_search_completed"].includes(e.event_name));
          const hasAi = events.some(e => ["AI_Analysis_Completed", "First_AI_Analysis_Completed", "ai_analysis_completed"].includes(e.event_name));
          const hasPurchase = events.some(e => ["Purchase", "purchase_completed"].includes(e.event_name)) || isPaidUser;

          // Se comprou, está estritamente excluído de e-mails comportamentais de upgrade/checkout abandonado/reengajamento
          if (hasPurchase && ["checkout_abandoned_1h", "ai_limit_no_upgrade_1h", "hot_user_inactive_24h", "ai_used_continue_2h"].includes(item.automation_key)) {
            skipReason = "purchased_user";
          }

          // Double check de ação concluída
          if (!skipReason) {
            if (item.automation_key === "signup_no_search_1h" && hasSearch) {
              skipReason = "already_completed";
            } else if (item.automation_key === "search_no_ai_1h" && hasAi) {
              skipReason = "already_completed";
            } else if (item.automation_key === "checkout_abandoned_1h" && hasPurchase) {
              skipReason = "already_completed";
            } else if (item.automation_key === "ai_limit_no_upgrade_1h" && hasPurchase) {
              skipReason = "already_completed";
            } else if (item.automation_key === "ai_used_continue_2h" && hasPurchase) {
              skipReason = "already_completed";
            }
          }
        }

        // 4. Rate-Limit Diário: 1 e-mail comportamental por dia
        if (!skipReason) {
          const { count } = await supabase
            .from("behavior_email_queue")
            .select("*", { count: "exact", head: true })
            .eq("email", item.email)
            .eq("status", "sent")
            .gte("sent_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

          if ((count || 0) >= 1) {
            skipReason = "daily_limit_reached";
          }
        }

        // 5. Test Mode Recipient Verification
        if (!skipReason && BEHAVIOR_EMAIL_TEST_MODE) {
          if (!BEHAVIOR_EMAIL_ALLOWED_TEST_RECIPIENTS.includes(item.email.toLowerCase())) {
            skipReason = "test_mode_recipient_not_allowed";
          }
        }

        // --- EXECUTAR O DISPARO OU PULAR ---
        if (skipReason) {
          console.log(`[Processor] Pulo de e-mail ${item.automation_key} para ${item.email} por motivo: ${skipReason}`);
          await supabase
            .from("behavior_email_queue")
            .update({
              status: "skipped",
              skipped_at: new Date().toISOString(),
              skip_reason: skipReason
            })
            .eq("id", item.id);

          await supabase.from("behavior_email_logs").insert({
            queue_id: item.id,
            user_id: item.user_id,
            email: item.email,
            automation_key: item.automation_key,
            status: "skipped",
            metadata: { skip_reason: skipReason }
          });

          await trackBehaviorEvent(item.user_id, item.email, item.automation_key, item.id, "Behavior_Email_Skipped", { reason: skipReason });
          stats.skipped += 1;
        } else {
          // Despachar e-mail
          const templateGenerator = emailTemplates[item.automation_key];
          if (!templateGenerator) {
            console.error(`[Processor] Template não encontrado para a chave: ${item.automation_key}`);
            const errorMsg = `Template nao encontrado: ${item.automation_key}`;
            await supabase
              .from("behavior_email_queue")
              .update({
                status: "failed",
                failed_at: new Date().toISOString(),
                skip_reason: errorMsg
              })
              .eq("id", item.id);

            await supabase.from("behavior_email_logs").insert({
              queue_id: item.id,
              user_id: item.user_id,
              email: item.email,
              automation_key: item.automation_key,
              status: "failed",
              error_message: errorMsg
            });
            stats.failed += 1;
            continue;
          }

          const unsubscribeUrl = item.user_id
            ? `${supabaseUrl}/functions/v1/unsubscribe-email?uid=${encodeURIComponent(item.user_id)}&source=${encodeURIComponent(item.automation_key)}`
            : `https://zunopropect.com.br/unsubscribe?email_hash=${await hashEmail(item.email)}`;

          const templatePayload = templateGenerator({});
          const html = behaviorEmailLayout({ ...templatePayload, unsubscribeUrl });
          const text = behaviorEmailText({ ...templatePayload, unsubscribeUrl });

          const emailPayload = {
            from: RESEND_FROM_EMAIL,
            to: [item.email],
            subject: templatePayload.title,
            html,
            text,
            reply_to: RESEND_REPLY_TO_EMAIL,
          };

          console.log(`[Processor] Enviando e-mail ${item.automation_key} para ${item.email}...`);
          const resendResult = await sendEmailViaResend(emailPayload);

          if (resendResult.success) {
            const messageId = resendResult.data?.id || null;
            await supabase
              .from("behavior_email_queue")
              .update({
                status: "sent",
                sent_at: new Date().toISOString(),
                resend_message_id: messageId
              })
              .eq("id", item.id);

            await supabase.from("behavior_email_logs").insert({
              queue_id: item.id,
              user_id: item.user_id,
              email: item.email,
              automation_key: item.automation_key,
              status: "sent",
              resend_message_id: messageId
            });

            await trackBehaviorEvent(item.user_id, item.email, item.automation_key, item.id, "Behavior_Email_Sent", { resend_message_id: messageId });
            console.log(`[Processor] E-mail ${item.automation_key} enviado com sucesso para ${item.email}.`);
            stats.sent += 1;
          } else {
            console.error(`[Processor] Falha ao enviar e-mail via Resend:`, resendResult.error);
            const errorMsg = String(resendResult.error);
            await supabase
              .from("behavior_email_queue")
              .update({
                status: "failed",
                failed_at: new Date().toISOString(),
                skip_reason: errorMsg
              })
              .eq("id", item.id);

            await supabase.from("behavior_email_logs").insert({
              queue_id: item.id,
              user_id: item.user_id,
              email: item.email,
              automation_key: item.automation_key,
              status: "failed",
              error_message: errorMsg
            });

            await trackBehaviorEvent(item.user_id, item.email, item.automation_key, item.id, "Behavior_Email_Failed", { error_message: errorMsg });
            stats.failed += 1;
          }
        }
      }
      return stats;
    };

    // Rodar sequencialmente o Scanner e o Processor
    await scanBehaviorAutomations();
    const stats = await processPendingBehaviorEmails();

    return new Response(JSON.stringify({
      ok: true,
      success: true,
      message: stats.processed === 0 ? "Nenhum e-mail pendente." : "Varredura e envio comportamental concluidos.",
      batchSize: PROCESS_BATCH_SIZE,
      ...stats,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Erro geral na Edge Function process-behavior-emails:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
