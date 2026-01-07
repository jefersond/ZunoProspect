import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate tracking pixel URL with optional test_id for A/B tracking
const generateTrackingPixel = (userId: string, emailType: string, testId?: string): string => {
  let trackingUrl = `${SUPABASE_URL}/functions/v1/track-email-open?uid=${encodeURIComponent(userId)}&type=${encodeURIComponent(emailType)}`;
  if (testId) {
    trackingUrl += `&test_id=${encodeURIComponent(testId)}`;
  }
  return `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="" />`;
};

// Generate trackable CTA link
const generateTrackableLink = (userId: string, emailType: string, destinationUrl: string, testId?: string): string => {
  let trackingUrl = `${SUPABASE_URL}/functions/v1/track-email-click?uid=${encodeURIComponent(userId)}&type=${encodeURIComponent(emailType)}&redirect=${encodeURIComponent(destinationUrl)}`;
  if (testId) {
    trackingUrl += `&test_id=${encodeURIComponent(testId)}`;
  }
  return trackingUrl;
};

// Coupon banner HTML
const generateCouponBanner = (): string => `
  <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
    <p style="color: #ffffff; font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">
      🎁 Cupom exclusivo para você
    </p>
    <p style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px; font-family: monospace; letter-spacing: 3px;">
      ZUNO10
    </p>
    <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 0;">
      <strong>10% de desconto</strong> em qualquer plano!
    </p>
  </div>
`;

interface UserToOnboard {
  user_id: string;
  email: string;
  nome_completo: string | null;
  leads_used: number;
  saved_leads_count?: number;
}

// ============= EMAIL TEMPLATES =============
const generateFirstEmailHtml = (nome: string, userId: string, testId?: string) => {
  const ctaUrl = generateTrackableLink(userId, 'first_24h', 'https://zunoprospect.com.br/prospeccao', testId);
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden;">
        <tr><td style="background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🚀 Zuno Prospect</h1>
        </td></tr>
        <tr><td style="padding: 40px 30px;">
          <h2 style="color: #1f2937; margin: 0 0 20px;">${nome ? `${nome.split(' ')[0]}, enquanto você lê isso...` : 'Enquanto você lê isso...'} ⏰</h2>
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
            <strong>Seus concorrentes estão fechando negócios</strong> com leads que você poderia ter encontrado primeiro.
            Você tem <strong>30 leads gratuitos</strong> parados.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
            <tr><td align="center">
              <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                🔍 Encontrar Meus Leads Agora
              </a>
            </td></tr>
          </table>
          ${generateCouponBanner()}
        </td></tr>
        <tr><td style="background-color: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">
            Você recebeu este email porque se cadastrou no Zuno Prospect.
          </p>
          ${generateTrackingPixel(userId, 'first_24h', testId)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

const generateSaveLeadsEmailHtml = (nome: string, leadsUsed: number, userId: string, testId?: string) => {
  const ctaUrl = generateTrackableLink(userId, 'used_not_saved', 'https://zunoprospect.com.br/prospeccao', testId);
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden;">
        <tr><td style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">💾 Zuno Prospect</h1>
        </td></tr>
        <tr><td style="padding: 40px 30px;">
          <h2 style="color: #1f2937; margin: 0 0 20px;">${nome ? `${nome.split(' ')[0]}, você encontrou ${leadsUsed} leads ótimos...` : `Você encontrou ${leadsUsed} leads ótimos...`} 🎯</h2>
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
            Cada lead tem <strong>WhatsApp, Instagram e email</strong> — informações valiosas. <strong>Não deixe isso ir embora.</strong>
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
            <tr><td align="center">
              <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                🔍 Buscar e Salvar Meus Leads
              </a>
            </td></tr>
          </table>
          ${generateCouponBanner()}
        </td></tr>
        <tr><td style="background-color: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb;">
          ${generateTrackingPixel(userId, 'used_not_saved', testId)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

// ============= QUEUE EMAIL FUNCTION =============
async function queueEmail(
  supabase: any,
  toEmail: string,
  toName: string | null,
  subject: string,
  htmlContent: string,
  emailType: string,
  metadata: Record<string, any> = {},
  userId: string | null = null
): Promise<{ success: boolean; queueId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("email_queue")
      .insert({
        to_email: toEmail,
        to_name: toName,
        subject,
        html_content: htmlContent,
        email_type: emailType,
        metadata,
        user_id: userId,
        status: "pending"
      })
      .select("id")
      .single();

    if (error) {
      console.error("[Queue] Error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, queueId: data.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting onboarding email job...");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) throw authError;

    let totalQueued = 0;
    let allErrors: string[] = [];

    // ============= EMAIL 1: First 24h =============
    console.log("Processing first_24h emails...");
    
    const { data: usersNoLeads } = await supabase
      .from('user_subscriptions')
      .select(`user_id, leads_used_this_month, profiles!inner(nome_completo)`)
      .eq('leads_used_this_month', 0);

    for (const subscription of usersNoLeads || []) {
      const authUser = authUsers.users.find(u => u.id === subscription.user_id);
      if (!authUser?.email) continue;
      
      const hoursSinceRegistration = (Date.now() - new Date(authUser.created_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceRegistration < 24) continue;
      
      const { data: existingEmail } = await supabase
        .from('onboarding_emails_sent')
        .select('id')
        .eq('user_id', subscription.user_id)
        .eq('email_type', 'first_24h')
        .maybeSingle();
      
      if (existingEmail) continue;

      const emailHtml = generateFirstEmailHtml(
        (subscription.profiles as any)?.nome_completo || '',
        subscription.user_id
      );

      const result = await queueEmail(
        supabase,
        authUser.email,
        (subscription.profiles as any)?.nome_completo || null,
        "🔍 Seus concorrentes já estão prospectando - e você?",
        emailHtml,
        "onboarding_first_24h",
        { email_type: 'first_24h' },
        subscription.user_id
      );

      if (result.success) {
        await supabase.from('onboarding_emails_sent').insert({
          user_id: subscription.user_id,
          email_type: 'first_24h',
        });
        totalQueued++;
      } else {
        allErrors.push(`first_24h - ${authUser.email}: ${result.error}`);
      }
    }

    // ============= EMAIL 2: Used leads but haven't saved =============
    console.log("Processing used_not_saved emails...");
    
    const { data: usersWithLeads } = await supabase
      .from('user_subscriptions')
      .select(`user_id, leads_used_this_month, profiles!inner(nome_completo)`)
      .gt('leads_used_this_month', 0);

    for (const subscription of usersWithLeads || []) {
      const authUser = authUsers.users.find(u => u.id === subscription.user_id);
      if (!authUser?.email) continue;
      
      const hoursSinceRegistration = (Date.now() - new Date(authUser.created_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceRegistration < 48) continue;
      
      const { data: existingEmail } = await supabase
        .from('onboarding_emails_sent')
        .select('id')
        .eq('user_id', subscription.user_id)
        .eq('email_type', 'used_not_saved')
        .maybeSingle();
      
      if (existingEmail) continue;

      const { count: savedLeadsCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', subscription.user_id)
        .eq('salvo', true);
      
      if ((savedLeadsCount || 0) > 0) continue;

      const emailHtml = generateSaveLeadsEmailHtml(
        (subscription.profiles as any)?.nome_completo || '',
        subscription.leads_used_this_month,
        subscription.user_id
      );

      const result = await queueEmail(
        supabase,
        authUser.email,
        (subscription.profiles as any)?.nome_completo || null,
        "💡 Dica: Salve seus melhores leads para não perdê-los!",
        emailHtml,
        "onboarding_used_not_saved",
        { email_type: 'used_not_saved', leads_used: subscription.leads_used_this_month },
        subscription.user_id
      );

      if (result.success) {
        await supabase.from('onboarding_emails_sent').insert({
          user_id: subscription.user_id,
          email_type: 'used_not_saved',
        });
        totalQueued++;
      } else {
        allErrors.push(`used_not_saved - ${authUser.email}: ${result.error}`);
      }
    }

    const result = {
      success: true,
      emailsQueued: totalQueued,
      errors: allErrors.length > 0 ? allErrors : undefined,
      message: `${totalQueued} emails adicionados à fila. Configure o n8n para processar.`,
      timestamp: new Date().toISOString(),
    };

    console.log("Onboarding email job completed:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in send-onboarding-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
