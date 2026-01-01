import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

// ============= CONFIGURATION =============
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_LOGS_PEPPER = Deno.env.get("EMAIL_LOGS_PEPPER") || "";
const LEADS_ENCRYPTION_KEY = Deno.env.get("LEADS_ENCRYPTION_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "";
const RESEND_REPLY_TO_EMAIL = Deno.env.get("RESEND_REPLY_TO_EMAIL") || "";

// Rate limiting configuration
const RATE_LIMIT_DELAY = 1500; // 1.5s between emails
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const JOB_NAME = "send-email-campaign";
const LOCK_DURATION_MINUTES = 30; // Max lock duration

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============= VALIDATION HELPERS =============
const validateFromEmail = (from: string): { valid: boolean; error?: string } => {
  if (!from || from.trim() === "") {
    return { valid: false, error: "RESEND_FROM_EMAIL não configurado" };
  }
  
  // Format: "email@domain.com" or "Name <email@domain.com>"
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const namedEmailRegex = /^.+\s<[^\s@]+@[^\s@]+\.[^\s@]+>$/;
  
  if (!emailRegex.test(from) && !namedEmailRegex.test(from)) {
    return { 
      valid: false, 
      error: `Formato inválido de RESEND_FROM_EMAIL: "${from}". Use "email@dominio.com" ou "Nome <email@dominio.com>"` 
    };
  }
  
  return { valid: true };
};

// ============= RESEND SDK SETUP =============
let resend: Resend | null = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
}

// Send email with retry logic
const sendEmailWithRetry = async (
  emailPayload: {
    from: string;
    reply_to?: string;
    to: string[];
    subject: string;
    html: string;
  },
  retries = 0
): Promise<{ success: boolean; data?: any; error?: string }> => {
  if (!resend) {
    return { success: false, error: "RESEND_API_KEY não configurado" };
  }
  
  try {
    console.log(`[Email] Sending to ${emailPayload.to[0]?.substring(0, 5)}*** (attempt ${retries + 1})`);
    console.log(`[Email] From: ${emailPayload.from}, Reply-To: ${emailPayload.reply_to || 'não definido'}`);
    
    const emailResponse = await resend.emails.send(emailPayload);
    
    if (emailResponse.error) {
      const errorMessage = emailResponse.error.message || '';
      console.error(`[Email] Resend error: ${errorMessage}`);
      
      // Handle rate limiting
      if (errorMessage.toLowerCase().includes('rate') || errorMessage.toLowerCase().includes('too many')) {
        if (retries < MAX_RETRIES) {
          console.log(`[Email] Rate limited, retrying in ${RETRY_DELAY * (retries + 1)}ms...`);
          await delay(RETRY_DELAY * (retries + 1));
          return sendEmailWithRetry(emailPayload, retries + 1);
        }
        return { success: false, error: `Rate limit após ${MAX_RETRIES} tentativas` };
      }
      
      return { success: false, error: errorMessage };
    }
    
    console.log(`[Email] Sent successfully: ${emailResponse.data?.id}`);
    return { success: true, data: emailResponse };
  } catch (err: any) {
    console.error(`[Email] Exception: ${err.message}`);
    if (retries < MAX_RETRIES) {
      await delay(RETRY_DELAY * (retries + 1));
      return sendEmailWithRetry(emailPayload, retries + 1);
    }
    return { success: false, error: err.message };
  }
};

// ============= CORS HELPER =============
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

// ============= JOB LOCK HELPERS =============
async function acquireLock(supabase: any): Promise<{ acquired: boolean; reason?: string }> {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + LOCK_DURATION_MINUTES * 60 * 1000);
  const lockId = `${now.getTime()}-${Math.random().toString(36).substring(7)}`;
  
  // Try to acquire lock (only if not locked or lock expired)
  const { data, error } = await supabase
    .from("email_job_locks")
    .update({ 
      locked_until: lockUntil.toISOString(), 
      locked_by: lockId 
    })
    .eq("job_name", JOB_NAME)
    .or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`)
    .select()
    .single();
  
  if (error || !data) {
    // Check if there's an active lock
    const { data: existingLock } = await supabase
      .from("email_job_locks")
      .select("locked_until, locked_by")
      .eq("job_name", JOB_NAME)
      .single();
    
    if (existingLock?.locked_until && new Date(existingLock.locked_until) > now) {
      return { 
        acquired: false, 
        reason: `Job já em execução (lock até ${existingLock.locked_until})` 
      };
    }
    
    return { acquired: false, reason: "Não foi possível adquirir lock" };
  }
  
  console.log(`[Lock] Acquired for ${JOB_NAME}, expires at ${lockUntil.toISOString()}`);
  return { acquired: true };
}

async function releaseLock(supabase: any): Promise<void> {
  await supabase
    .from("email_job_locks")
    .update({ locked_until: null, locked_by: null })
    .eq("job_name", JOB_NAME);
  
  console.log(`[Lock] Released for ${JOB_NAME}`);
}

interface SendCampaignRequest {
  campaignId: string;
}

serve(async (req: Request): Promise<Response> => {
  const corsCheck = handleCorsRequest(req);
  if (corsCheck) return corsCheck;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // ============= VALIDATE CONFIGURATION =============
    if (!RESEND_API_KEY) {
      console.error("[Config] RESEND_API_KEY não configurado");
      return new Response(JSON.stringify({ 
        error: "RESEND_API_KEY não configurado. Configure nas variáveis de ambiente." 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    
    const fromValidation = validateFromEmail(RESEND_FROM_EMAIL);
    if (!fromValidation.valid) {
      console.error(`[Config] ${fromValidation.error}`);
      return new Response(JSON.stringify({ error: fromValidation.error }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    
    console.log(`[Config] From: ${RESEND_FROM_EMAIL}`);
    console.log(`[Config] Reply-To: ${RESEND_REPLY_TO_EMAIL || 'não definido'}`);

    // ============= AUTH CHECK =============
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: user.id });
    
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas administradores." }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { campaignId }: SendCampaignRequest = await req.json();

    if (!campaignId) {
      return new Response(JSON.stringify({ error: "ID da campanha é obrigatório" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ============= ACQUIRE LOCK =============
    const lockResult = await acquireLock(supabase);
    if (!lockResult.acquired) {
      console.log(`[Lock] Failed to acquire: ${lockResult.reason}`);
      return new Response(JSON.stringify({ 
        error: lockResult.reason,
        hint: "Aguarde a conclusão do envio anterior ou tente novamente em alguns minutos."
      }), {
        status: 409,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    try {
      // ============= GET CAMPAIGN =============
      const { data: campaign, error: campaignError } = await supabase
        .from("email_campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();

      if (campaignError || !campaign) {
        console.error("Erro ao buscar campanha:", campaignError);
        return new Response(JSON.stringify({ error: "Campanha não encontrada" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // ============= GET TARGET USERS =============
      let usersQuery = supabase
        .from("user_subscriptions")
        .select("user_id, plan_name, leads_used_this_month");

      if (campaign.segmento === "starter") {
        usersQuery = usersQuery.eq("plan_name", "starter");
      } else if (campaign.segmento === "pro") {
        usersQuery = usersQuery.eq("plan_name", "pro");
      } else if (campaign.segmento === "agencia") {
        usersQuery = usersQuery.eq("plan_name", "agencia");
      } else if (campaign.segmento === "inativos") {
        usersQuery = usersQuery.eq("leads_used_this_month", 0);
      } else if (campaign.segmento === "starter_inativos") {
        usersQuery = usersQuery.eq("plan_name", "starter").eq("leads_used_this_month", 0);
      } else if (campaign.segmento === "nao_pagantes") {
        usersQuery = usersQuery.eq("plan_name", "starter");
      }

      console.log(`[Campaign] Segment: ${campaign.segmento}`);

      const { data: subscriptions, error: subsError } = await usersQuery;

      if (subsError) {
        console.error("Erro ao buscar usuários:", subsError);
        return new Response(JSON.stringify({ error: "Erro ao buscar usuários" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (!subscriptions || subscriptions.length === 0) {
        return new Response(JSON.stringify({ error: "Nenhum usuário encontrado para este segmento" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      console.log(`[Campaign] Found ${subscriptions.length} users`);

      // ============= SEND EMAILS =============
      let sentCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const sub of subscriptions) {
        try {
          const { data: authUser } = await supabase.auth.admin.getUserById(sub.user_id);
          
          if (!authUser?.user?.email) {
            console.log(`[Skip] User ${sub.user_id} has no email`);
            continue;
          }

          const userEmail = authUser.user.email;

          // Convert plain text to HTML if needed
          let emailHtml = campaign.conteudo;
          const hasHtmlTags = /<[a-z][\s\S]*>/i.test(campaign.conteudo);
          
          if (!hasHtmlTags) {
            const textWithLinks = campaign.conteudo
              .replace(/\n/g, '<br>')
              .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color: #3b82f6; text-decoration: underline;">$1</a>');
            
            emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #18181b; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">Zuno Prospect</h1>
                </div>
                <div style="background: white; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
                  <p style="color: #3f3f46; font-size: 16px; line-height: 1.8; white-space: pre-wrap;">${textWithLinks}</p>
                </div>
                <div style="text-align: center; padding: 20px; color: #a1a1aa; font-size: 12px;">
                  <p>Zuno Prospect - Prospecção Inteligente com IA</p>
                </div>
              </div>
            `;
          }

          // Build email payload
          const emailPayload: any = {
            from: RESEND_FROM_EMAIL,
            to: [userEmail],
            subject: campaign.assunto,
            html: emailHtml,
          };
          
          if (RESEND_REPLY_TO_EMAIL) {
            emailPayload.reply_to = RESEND_REPLY_TO_EMAIL;
          }

          const emailResult = await sendEmailWithRetry(emailPayload);

          // Log email
          if (EMAIL_LOGS_PEPPER && LEADS_ENCRYPTION_KEY) {
            const { error: logError } = await supabase.rpc('insert_email_log_secure', {
              p_pepper: EMAIL_LOGS_PEPPER,
              p_encryption_key: LEADS_ENCRYPTION_KEY,
              p_campaign_id: campaignId,
              p_user_id: sub.user_id,
              p_user_email: userEmail,
              p_status: emailResult.success ? "enviado" : "erro",
              p_error_message: emailResult.error || null,
            });
            
            if (logError) {
              console.error("Erro ao inserir log:", logError);
            }
          }

          if (!emailResult.success) {
            errorCount++;
            errors.push(`${userEmail.substring(0, 5)}***: ${emailResult.error}`);
          } else {
            sentCount++;
          }

          // Rate limit delay
          await delay(RATE_LIMIT_DELAY);
        } catch (err: any) {
          errorCount++;
          errors.push(`Erro: ${err.message}`);
          console.error("Erro ao enviar:", err);
        }
      }

      // Update campaign stats
      await supabase
        .from("email_campaigns")
        .update({
          total_enviados: sentCount,
          status: "enviada",
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);

      console.log(`[Campaign] Complete: ${sentCount} sent, ${errorCount} errors`);

      return new Response(
        JSON.stringify({
          success: true,
          sent: sentCount,
          errors: errorCount,
          errorDetails: errors.slice(0, 5),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } finally {
      // Always release lock
      await releaseLock(supabase);
    }
  } catch (error: any) {
    console.error("Erro na função:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor", details: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get("Origin")) },
      }
    );
  }
});
