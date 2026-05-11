import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ADMIN_TEST_EMAIL = "jeferson.zanotell@gmail.com";
const MAX_EMAILS_PER_SEND = Number(Deno.env.get("EMAIL_MAX_PER_SEND") || "50");
const COOLDOWN_DAYS = Number(Deno.env.get("EMAIL_COOLDOWN_DAYS") || "7");
const PUBLIC_SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") || "https://www.zunopropect.com.br").replace(/\/$/, "");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "";
const RESEND_REPLY_TO_EMAIL = Deno.env.get("RESEND_REPLY_TO_EMAIL") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SendCampaignRequest {
  mode?: "test" | "send";
  campaignId?: string;
  recipientEmail?: string;
  email?: string;
  testMode?: boolean;
  dryRun?: boolean;
  confirmed?: boolean;
}

interface Recipient {
  userId: string;
  email: string;
  name: string | null;
  planName: string | null;
  leadsUsed: number;
  createdAt: string | null;
  lastSignInAt: string | null;
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const maskEmail = (email: string) => {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const textToHtml = (text: string) => {
  const escaped = escapeHtml(text);
  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#4f46e5;text-decoration:underline;">$1</a>',
  );
  return linked.replace(/\n/g, "<br>");
};

const addEmailShell = (
  content: string,
  hasHtmlTags: boolean,
  userId: string,
  emailType: string,
  queueId: string,
) => {
  const openUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/track-email-open?uid=${encodeURIComponent(userId)}&type=${encodeURIComponent(emailType)}&qid=${encodeURIComponent(queueId)}`;
  const unsubscribeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/unsubscribe-email?uid=${encodeURIComponent(userId)}&source=${encodeURIComponent(emailType)}`;
  const openPixel = `<img src="${openUrl}" width="1" height="1" style="display:none;" alt="" />`;

  if (/<!doctype|<html[\s>]/i.test(content)) {
    let fullHtml = content
      .replace(/{{UNSUBSCRIBE_URL}}/g, unsubscribeUrl)
      .replace(/{{OPEN_PIXEL}}/g, openPixel);

    if (!fullHtml.includes(openUrl)) {
      fullHtml = fullHtml.replace(/<\/body>/i, `${openPixel}</body>`);
    }

    return fullHtml;
  }

  const bodyHtml = hasHtmlTags ? content : `<p style="margin:0;color:#3f3f46;font-size:16px;line-height:1.8;">${textToHtml(content)}</p>`;

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr><td style="background:#18181b;padding:22px 28px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;">Zuno Prospect</h1>
        </td></tr>
        <tr><td style="padding:32px 28px;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="background:#fafafa;padding:20px 28px;border-top:1px solid #e4e4e7;text-align:center;">
          <p style="color:#71717a;font-size:12px;line-height:1.6;margin:0;">
            Você recebeu este e-mail porque criou uma conta no Zuno Prospect.
            <br />
            <a href="${unsubscribeUrl}" style="color:#71717a;text-decoration:underline;">Descadastrar deste tipo de comunicação</a>
          </p>
          <p style="color:#a1a1aa;font-size:12px;margin:12px 0 0;">${PUBLIC_SITE_URL}</p>
          <img src="${openUrl}" width="1" height="1" style="display:none;" alt="" />
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

const withTrackedLinks = (html: string, userId: string, emailType: string, queueId: string) => {
  const functionBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/track-email-click`;
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (_match, rawUrl) => {
    if (rawUrl.includes("/functions/v1/track-email-click") || rawUrl.includes("/functions/v1/unsubscribe-email")) {
      return `href="${rawUrl}"`;
    }

    const tracked = `${functionBase}?uid=${encodeURIComponent(userId)}&type=${encodeURIComponent(emailType)}&qid=${encodeURIComponent(queueId)}&redirect=${encodeURIComponent(rawUrl)}`;
    return `href="${tracked}"`;
  });
};

const sendViaResend = async (payload: {
  to: string;
  subject: string;
  html: string;
}) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      reply_to: RESEND_REPLY_TO_EMAIL || undefined,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = data?.message || data?.error || "Erro ao enviar pelo Resend";
    console.error("[send-email-campaign] Resend error:", {
      status: response.status,
      details,
      body: data,
    });
    throw new Error(details);
  }
  return data;
};

const getAuthedAdmin = async (req: Request, supabase: any) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { error: jsonResponse({ error: "Não autorizado" }, 401) };

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return { error: jsonResponse({ error: "Usuário não autenticado" }, 401) };

  const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: user.id });
  if (!isAdmin) return { error: jsonResponse({ error: "Acesso negado. Apenas administradores." }, 403) };

  return { user };
};

const loadRecipients = async (supabase: any, segment: string): Promise<Recipient[]> => {
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authError) throw authError;

  const { data: subscriptions, error: subsError } = await supabase
    .from("user_subscriptions")
    .select("user_id, plan_name, leads_used_this_month, created_at");
  if (subsError) throw subsError;

  const authById = new Map((authUsers?.users || []).map((user: any) => [user.id, user]));
  const recipients: Recipient[] = [];

  for (const sub of subscriptions || []) {
    const authUser = authById.get(sub.user_id);
    if (!authUser?.email) continue;

    const planName = sub.plan_name || "starter";
    const leadsUsed = sub.leads_used_this_month || 0;
    const lastSignInAt = authUser.last_sign_in_at || null;
    const lastSignInDate = lastSignInAt ? new Date(lastSignInAt) : null;
    const daysSinceSignIn = lastSignInDate
      ? (Date.now() - lastSignInDate.getTime()) / (1000 * 60 * 60 * 24)
      : 999;

    let include = true;
    if (segment === "starter" || segment === "nao_pagantes" || segment === "signup_not_paid") include = planName === "starter";
    else if (segment === "pro") include = planName === "pro";
    else if (segment === "agencia") include = planName === "agencia";
    else if (segment === "paying") include = planName !== "starter";
    else if (segment === "inativos" || segment === "never_searched") include = leadsUsed === 0;
    else if (segment === "starter_inativos") include = planName === "starter" && leadsUsed === 0;
    else if (segment === "free_active") include = planName === "starter" && leadsUsed > 0;
    else if (segment === "searched_not_returned") include = leadsUsed > 0 && daysSinceSignIn >= 7;
    else if (segment === "inactive_old") include = daysSinceSignIn >= 30;
    else if (segment === "internal_admins") include = normalizeEmail(authUser.email) === ADMIN_TEST_EMAIL;
    else if (segment === "clicked_pricing") include = false;

    if (!include) continue;

    recipients.push({
      userId: sub.user_id,
      email: authUser.email,
      name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || null,
      planName,
      leadsUsed,
      createdAt: sub.created_at || authUser.created_at || null,
      lastSignInAt,
    });
  }

  return recipients;
};

const applySafetyFilters = async (supabase: any, recipients: Recipient[]) => {
  const unique = new Map<string, Recipient>();
  for (const recipient of recipients) {
    const email = normalizeEmail(recipient.email);
    if (isValidEmail(email)) unique.set(email, { ...recipient, email });
  }

  const deduped = Array.from(unique.values());
  if (deduped.length === 0) {
    return {
      allowed: [],
      skipped: {
        invalid_or_duplicate: recipients.length,
        unsubscribed: 0,
        cooldown: 0,
      },
    };
  }

  const userIds = deduped.map((recipient) => recipient.userId);
  const emails = deduped.map((recipient) => recipient.email);

  const { data: unsubByUser } = await supabase
    .from("email_unsubscribes")
    .select("user_id, email")
    .in("user_id", userIds);

  const { data: unsubByEmail } = await supabase
    .from("email_unsubscribes")
    .select("user_id, email")
    .in("email", emails);

  const unsubscribes = [...(unsubByUser || []), ...(unsubByEmail || [])];

  const unsubUserIds = new Set((unsubscribes || []).map((row: any) => row.user_id).filter(Boolean));
  const unsubEmails = new Set((unsubscribes || []).map((row: any) => normalizeEmail(row.email || "")).filter(Boolean));

  const cooldownSince = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("email_queue")
    .select("user_id, to_email")
    .gte("created_at", cooldownSince)
    .in("user_id", userIds);

  const recentUserIds = new Set((recent || []).map((row: any) => row.user_id).filter(Boolean));
  const recentEmails = new Set((recent || []).map((row: any) => normalizeEmail(row.to_email || "")).filter(Boolean));

  const allowed: Recipient[] = [];
  const skipped = {
    invalid_or_duplicate: recipients.length - deduped.length,
    unsubscribed: 0,
    cooldown: 0,
  };

  for (const recipient of deduped) {
    if (unsubUserIds.has(recipient.userId) || unsubEmails.has(recipient.email)) {
      skipped.unsubscribed++;
      continue;
    }
    if (recentUserIds.has(recipient.userId) || recentEmails.has(recipient.email)) {
      skipped.cooldown++;
      continue;
    }
    allowed.push(recipient);
  }

  return { allowed, skipped };
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({
      error: "Metodo nao permitido",
      details: "Use POST para enviar ou testar campanhas.",
    }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    const auth = await getAuthedAdmin(req, supabase);
    if (auth.error) return auth.error;

    const body: SendCampaignRequest = await req.json().catch(() => ({}));
    const campaignId = body.campaignId;
    const testMode = body.mode === "test" || body.testMode === true;
    const dryRun = body.dryRun === true;
    const confirmed = body.confirmed === true;
    const recipientEmail = normalizeEmail(body.recipientEmail || body.email || ADMIN_TEST_EMAIL);

    console.log("send-email-campaign payload:", {
      hasCampaignId: !!campaignId,
      hasRecipientEmail: !!body.recipientEmail,
      hasEmail: !!body.email,
      hasSubject: false,
      hasContent: false,
      isTest: testMode,
      segment: null,
      mode: body.mode || null,
    });
    if (!campaignId) {
      return jsonResponse({
        error: "Payload invalido",
        details: "Campo campaignId e obrigatorio.",
      }, 400);
    }

    if (testMode && !isValidEmail(recipientEmail)) {
      return jsonResponse({
        error: "Payload invalido",
        details: "Campo recipientEmail deve conter um e-mail valido.",
      }, 400);
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();
    if (campaignError || !campaign) {
      return jsonResponse({
        error: "Campanha nao encontrada",
        details: campaignError?.message || "Verifique se campaignId existe.",
      }, 404);
    }

    const subject = String(campaign.assunto || "").trim();
    const content = String(campaign.conteudo || "").trim();
    console.log("send-email-campaign campaign:", {
      campaignId,
      hasSubject: !!subject,
      hasContent: !!content,
      isTest: testMode,
      segment: campaign.segmento || null,
    });

    if (!subject || !content) {
      return jsonResponse({
        error: "Campanha incompleta",
        details: "Complete assunto e mensagem antes de enviar teste.",
      }, 400);
    }

    if (!dryRun && !testMode && !confirmed) {
      return jsonResponse({
        error: "Confirmação obrigatória",
        details: "Envios reais exigem confirmed: true depois de revisar segmento e limite.",
      }, 400);
    }

    if (!dryRun && (!RESEND_API_KEY || !RESEND_FROM_EMAIL)) {
      return jsonResponse({
        error: "Configuração de e-mail incompleta",
        details: !RESEND_API_KEY ? "RESEND_API_KEY nao configurada." : "RESEND_FROM_EMAIL nao configurada.",
        requiredSecrets: ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "RESEND_REPLY_TO_EMAIL", "PUBLIC_SITE_URL"],
      }, 500);
    }

    if (!dryRun && !testMode) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: sentToday } = await supabase
        .from("email_campaigns")
        .select("id, nome")
        .neq("id", campaignId)
        .in("status", ["enviando", "enviada"])
        .gte("sent_at", today.toISOString())
        .limit(1);

      if (sentToday && sentToday.length > 0) {
        return jsonResponse({
          error: "Limite diário atingido",
          details: `Já existe uma campanha enviada hoje: ${sentToday[0].nome}`,
        }, 429);
      }
    }

    const segment = testMode ? "test" : campaign.segmento;
    const rawRecipients = testMode
      ? [{
          userId: auth.user.id,
          email: recipientEmail,
          name: auth.user.user_metadata?.full_name || auth.user.user_metadata?.name || "Admin",
          planName: "admin",
          leadsUsed: 0,
          createdAt: auth.user.created_at || null,
          lastSignInAt: auth.user.last_sign_in_at || null,
        }]
      : await loadRecipients(supabase, segment);
    const { allowed, skipped } = testMode
      ? { allowed: rawRecipients, skipped: { invalid_or_duplicate: 0, unsubscribed: 0, cooldown: 0 } }
      : await applySafetyFilters(supabase, rawRecipients);
    const recipients = allowed.slice(0, testMode ? 1 : MAX_EMAILS_PER_SEND);

    if (dryRun) {
      return jsonResponse({
        success: true,
        dryRun: true,
        segment,
        totalMatched: rawRecipients.length,
        eligible: allowed.length,
        cappedTo: recipients.length,
        limit: testMode ? 1 : MAX_EMAILS_PER_SEND,
        skipped,
      });
    }

    if (recipients.length === 0) {
      return jsonResponse({
        error: "Nenhum destinatario elegivel",
        details: testMode
          ? "Informe recipientEmail valido para enviar o teste da campanha."
          : "Nenhum usuario do segmento passou nos filtros de envio.",
        segment,
        skipped,
      }, 400);
    }

    await supabase
      .from("email_campaigns")
      .update({ status: testMode ? "rascunho" : "enviando", last_error: null, updated_at: new Date().toISOString() })
      .eq("id", campaignId);

    let sent = 0;
    let errors = 0;
    const errorDetails: string[] = [];
    const hasHtmlTags = /<[a-z][\s\S]*>/i.test(campaign.conteudo);
    const emailType = testMode ? "campaign_test" : "campaign";

    for (const recipient of recipients) {
      const { data: queueItem, error: queueError } = await supabase
        .from("email_queue")
        .insert({
          to_email: recipient.email,
          to_name: recipient.name,
          subject: testMode ? `[TESTE] ${campaign.assunto}` : campaign.assunto,
          html_content: campaign.conteudo,
          email_type: emailType,
          campaign_id: campaignId,
          user_id: recipient.userId,
          metadata: { campaign_name: campaign.nome, segment, testMode },
          status: "pending",
          provider: "resend",
        })
        .select("id")
        .single();

      if (queueError || !queueItem) {
        errors++;
        errorDetails.push(`${maskEmail(recipient.email)}: ${queueError?.message || "erro ao criar fila"}`);
        continue;
      }

      const html = withTrackedLinks(
        addEmailShell(campaign.conteudo, hasHtmlTags, recipient.userId, emailType, queueItem.id),
        recipient.userId,
        emailType,
        queueItem.id,
      );

      try {
        const resendResponse = await sendViaResend({
          to: recipient.email,
          subject: testMode ? `[TESTE] ${campaign.assunto}` : campaign.assunto,
          html,
        });

        await supabase
          .from("email_queue")
          .update({
            html_content: html,
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: resendResponse?.id || null,
          })
          .eq("id", queueItem.id);

        await supabase.from("email_logs").insert({
          campaign_id: campaignId,
          queue_id: queueItem.id,
          user_id: recipient.userId,
          user_email_masked: maskEmail(recipient.email),
          status: "enviado",
          sent_at: new Date().toISOString(),
        });

        await supabase.from("email_events").insert({
          campaign_id: campaignId,
          queue_id: queueItem.id,
          user_id: recipient.userId,
          email_type: emailType,
          event_type: "sent",
          metadata: { provider: "resend", testMode },
        });

        sent++;
      } catch (error: any) {
        errors++;
        errorDetails.push(`${maskEmail(recipient.email)}: ${error.message}`);
        await supabase
          .from("email_queue")
          .update({
            html_content: html,
            status: "failed",
            error_message: error.message,
            retry_count: 1,
          })
          .eq("id", queueItem.id);

        await supabase.from("email_logs").insert({
          campaign_id: campaignId,
          queue_id: queueItem.id,
          user_id: recipient.userId,
          user_email_masked: maskEmail(recipient.email),
          status: "erro",
          error_message: error.message,
          sent_at: new Date().toISOString(),
        });
      }
    }

    if (!testMode) {
      await supabase
        .from("email_campaigns")
        .update({
          total_enviados: sent,
          recipient_count: recipients.length,
          status: sent > 0 ? "enviada" : "erro",
          sent_at: new Date().toISOString(),
          last_error: errorDetails[0] || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);
    }

    return jsonResponse({
      success: true,
      testMode,
      sent,
      errors,
      skipped,
      limit: testMode ? 1 : MAX_EMAILS_PER_SEND,
      capped: allowed.length > recipients.length,
      from: RESEND_FROM_EMAIL,
      replyTo: RESEND_REPLY_TO_EMAIL,
      errorDetails: errorDetails.slice(0, 5),
    });
  } catch (error: any) {
    console.error("[send-email-campaign] Unhandled error:", error);
    return jsonResponse({ error: "Erro interno do servidor", details: error.message }, 500);
  }
});
