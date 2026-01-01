import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

// ============= CONFIGURATION =============
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "";
const RESEND_REPLY_TO_EMAIL = Deno.env.get("RESEND_REPLY_TO_EMAIL") || "";

const JOB_NAME = "send-welcome-email";
const LOCK_DURATION_MINUTES = 10;
const RATE_LIMIT_DELAY = 1500;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============= VALIDATION =============
const validateConfig = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!RESEND_API_KEY) {
    errors.push("RESEND_API_KEY não configurado");
  }
  
  if (!RESEND_FROM_EMAIL) {
    errors.push("RESEND_FROM_EMAIL não configurado");
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const namedEmailRegex = /^.+\s<[^\s@]+@[^\s@]+\.[^\s@]+>$/;
    
    if (!emailRegex.test(RESEND_FROM_EMAIL) && !namedEmailRegex.test(RESEND_FROM_EMAIL)) {
      errors.push(`Formato inválido de RESEND_FROM_EMAIL: "${RESEND_FROM_EMAIL}"`);
    }
  }
  
  return { valid: errors.length === 0, errors };
};

// ============= RESEND SDK =============
let resend: Resend | null = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
}

// ============= JOB LOCK HELPERS =============
async function acquireLock(supabase: any): Promise<boolean> {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + LOCK_DURATION_MINUTES * 60 * 1000);
  const lockId = `${now.getTime()}-${Math.random().toString(36).substring(7)}`;
  
  const { data, error } = await supabase
    .from("email_job_locks")
    .update({ locked_until: lockUntil.toISOString(), locked_by: lockId })
    .eq("job_name", JOB_NAME)
    .or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`)
    .select()
    .single();
  
  if (error || !data) {
    console.log(`[Lock] Could not acquire lock for ${JOB_NAME}`);
    return false;
  }
  
  console.log(`[Lock] Acquired for ${JOB_NAME}`);
  return true;
}

async function releaseLock(supabase: any): Promise<void> {
  await supabase
    .from("email_job_locks")
    .update({ locked_until: null, locked_by: null })
    .eq("job_name", JOB_NAME);
  console.log(`[Lock] Released for ${JOB_NAME}`);
}

// ============= EMAIL TEMPLATE =============
const generateWelcomeEmailHtml = (nome: string, ctaUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao Zuno Prospect!</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700;">
                🎉 Bem-vindo ao Zuno Prospect!
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 15px 0 0; font-size: 18px;">
                Sua conta foi criada com sucesso
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">
                ${nome ? `Olá, ${nome.split(' ')[0]}! 👋` : 'Olá! 👋'}
              </h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Parabéns por dar o primeiro passo para <strong>revolucionar sua prospecção</strong>. 
                Você agora tem acesso a uma ferramenta que usa <strong>Inteligência Artificial</strong> 
                para encontrar os melhores leads para o seu negócio.
              </p>
              <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #22c55e;">
                <p style="color: #166534; font-size: 18px; margin: 0; font-weight: 600;">
                  🎁 Você tem <strong>30 leads gratuitos</strong> para começar!
                </p>
              </div>
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 18px;">
                  🚀 Com o Zuno Prospect você pode:
                </h3>
                <ul style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li><strong>Encontrar leads qualificados</strong> com WhatsApp, Instagram e email</li>
                  <li><strong>Análise de IA</strong> que mostra a probabilidade de conversão</li>
                  <li><strong>Plano de abordagem personalizado</strong> para cada lead</li>
                  <li><strong>Organizar e exportar</strong> seus leads para Excel</li>
                </ul>
              </div>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                <strong>Comece agora mesmo!</strong> Escolha uma cidade, digite o nicho que você atende 
                e deixe a IA trabalhar para você.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%); color: #ffffff; text-decoration: none; padding: 18px 50px; border-radius: 8px; font-size: 18px; font-weight: 600; box-shadow: 0 4px 14px rgba(139, 92, 246, 0.4);">
                      🔍 Encontrar Meus Primeiros Leads
                    </a>
                  </td>
                </tr>
              </table>
              <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
                <p style="color: #ffffff; font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">
                  🎁 Cupom exclusivo de boas-vindas
                </p>
                <p style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px; font-family: monospace; letter-spacing: 3px;">
                  ZUNO10
                </p>
                <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 0;">
                  <strong>10% de desconto</strong> em qualquer plano!
                </p>
              </div>
              <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 20px 0 0;">
                Se precisar de ajuda, é só responder este email. Estamos aqui para você!
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">
                Você recebeu este email porque se cadastrou no Zuno Prospect.<br>
                Caso não queira receber mais emails, responda com "Cancelar".
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 15px 0 0; text-align: center;">
                © 2024 Zuno Prospect. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  console.log("[send-welcome-email] Function invoked");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ============= VALIDATE CONFIG =============
  const configValidation = validateConfig();
  if (!configValidation.valid) {
    console.error("[Config] Validation failed:", configValidation.errors);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Configuração inválida", 
        details: configValidation.errors 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  console.log(`[Config] From: ${RESEND_FROM_EMAIL}`);
  console.log(`[Config] Reply-To: ${RESEND_REPLY_TO_EMAIL || 'não definido'}`);

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    const body = await req.json().catch(() => ({}));
    const { userId, email, nome } = body;

    console.log("[Request] Params:", { userId, hasEmail: !!email, hasNome: !!nome });

    // ============= BATCH PROCESSING (no userId) =============
    if (!userId) {
      console.log("[Batch] Checking for pending welcome emails...");
      
      // Try to acquire lock for batch processing
      const hasLock = await acquireLock(supabaseAdmin);
      if (!hasLock) {
        return new Response(
          JSON.stringify({ success: true, message: "Job already running", processed: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const { data: pending, error: pendingError } = await supabaseAdmin
          .from('welcome_emails_sent')
          .select('id, user_id')
          .eq('status', 'pending')
          .limit(10);

        if (pendingError) throw pendingError;

        if (!pending || pending.length === 0) {
          console.log("[Batch] No pending emails");
          return new Response(
            JSON.stringify({ success: true, message: "No pending emails", processed: 0 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`[Batch] Found ${pending.length} pending emails`);

        let sent = 0;
        let errors = 0;

        for (const record of pending) {
          try {
            const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(record.user_id);
            
            if (userError || !userData?.user?.email) {
              console.error(`[Batch] User ${record.user_id} not found`);
              await supabaseAdmin
                .from('welcome_emails_sent')
                .update({ status: 'failed', error_message: 'User not found' })
                .eq('id', record.id);
              errors++;
              continue;
            }

            const userEmail = userData.user.email;
            const userName = userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || null;

            console.log(`[Batch] Sending to: ${userEmail.substring(0, 5)}***`);

            const ctaUrl = "https://zunoprospect.com.br/prospeccao";
            const emailHtml = generateWelcomeEmailHtml(userName, ctaUrl);

            const emailPayload: any = {
              from: RESEND_FROM_EMAIL,
              to: [userEmail],
              subject: "🎉 Bem-vindo ao Zuno Prospect! Seus 30 leads gratuitos estão esperando",
              html: emailHtml,
            };
            
            if (RESEND_REPLY_TO_EMAIL) {
              emailPayload.reply_to = RESEND_REPLY_TO_EMAIL;
            }

            const emailResponse = await resend!.emails.send(emailPayload);

            if (emailResponse.error) {
              console.error(`[Batch] Resend error:`, emailResponse.error);
              await supabaseAdmin
                .from('welcome_emails_sent')
                .update({ status: 'failed', error_message: emailResponse.error.message })
                .eq('id', record.id);
              errors++;
            } else {
              console.log(`[Batch] Email sent to ${record.user_id}`);
              await supabaseAdmin
                .from('welcome_emails_sent')
                .update({ status: 'sent', sent_at: new Date().toISOString() })
                .eq('id', record.id);
              sent++;
            }

            await delay(RATE_LIMIT_DELAY);
          } catch (err: any) {
            console.error(`[Batch] Error for ${record.user_id}:`, err);
            await supabaseAdmin
              .from('welcome_emails_sent')
              .update({ status: 'failed', error_message: err.message })
              .eq('id', record.id);
            errors++;
          }
        }

        return new Response(
          JSON.stringify({ success: true, processed: pending.length, sent, errors }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } finally {
        await releaseLock(supabaseAdmin);
      }
    }

    // ============= SINGLE USER (with userId) =============
    let userEmail = email;
    let userName = nome;

    if (!userEmail) {
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      if (userError || !userData?.user?.email) {
        console.error(`[Single] User ${userId} not found`);
        return new Response(
          JSON.stringify({ success: false, error: "User not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userEmail = userData.user.email;
      userName = userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || nome || null;
    }

    console.log(`[Single] Sending to: ${userEmail.substring(0, 5)}***`);

    const ctaUrl = "https://zunoprospect.com.br/prospeccao";
    const emailHtml = generateWelcomeEmailHtml(userName, ctaUrl);

    const emailPayload: any = {
      from: RESEND_FROM_EMAIL,
      to: [userEmail],
      subject: "🎉 Bem-vindo ao Zuno Prospect! Seus 30 leads gratuitos estão esperando",
      html: emailHtml,
    };
    
    if (RESEND_REPLY_TO_EMAIL) {
      emailPayload.reply_to = RESEND_REPLY_TO_EMAIL;
    }

    console.log(`[Single] Payload: from=${emailPayload.from}, reply_to=${emailPayload.reply_to || 'none'}`);

    const emailResponse = await resend!.emails.send(emailPayload);

    if (emailResponse.error) {
      console.error("[Single] Resend error:", emailResponse.error);
      return new Response(
        JSON.stringify({ success: false, error: emailResponse.error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Single] Welcome email sent successfully!");

    return new Response(
      JSON.stringify({ success: true, message: "Welcome email sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[Error] Unhandled:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
