import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_LOGS_PEPPER = Deno.env.get("EMAIL_LOGS_PEPPER") || "";
const LEADS_ENCRYPTION_KEY = Deno.env.get("LEADS_ENCRYPTION_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "Zuno Prospect <contato@zunoprospect.com.br>";
const RESEND_REPLY_TO_EMAIL = Deno.env.get("RESEND_REPLY_TO_EMAIL") || "zunopropect@gmail.com";

// Rate limiting and retry configuration
const RATE_LIMIT_DELAY = 1200; // 1.2s between emails to stay well under 2/sec limit
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2s delay before retry on rate limit

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Send email with retry logic for rate limiting
const sendEmailWithRetry = async (
  emailPayload: {
    from: string;
    replyTo?: string;
    to: string[];
    subject: string;
    html: string;
  },
  retries = 0
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });
    
    const result = await response.json();
    
    // Handle rate limiting (429 status)
    if (response.status === 429) {
      if (retries < MAX_RETRIES) {
        console.log(`Rate limited (429), retrying in ${RETRY_DELAY}ms... (attempt ${retries + 1}/${MAX_RETRIES})`);
        await delay(RETRY_DELAY * (retries + 1)); // Exponential backoff
        return sendEmailWithRetry(emailPayload, retries + 1);
      }
      return { success: false, error: `Rate limit exceeded after ${MAX_RETRIES} retries` };
    }
    
    if (!response.ok) {
      return { success: false, error: result.message || 'Unknown error' };
    }
    
    return { success: true, data: result };
  } catch (err: any) {
    // Handle network errors or other exceptions
    if (retries < MAX_RETRIES) {
      console.log(`Error sending email, retrying... (attempt ${retries + 1}/${MAX_RETRIES}): ${err.message}`);
      await delay(RETRY_DELAY * (retries + 1));
      return sendEmailWithRetry(emailPayload, retries + 1);
    }
    return { success: false, error: err.message };
  }
};

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

interface SendCampaignRequest {
  campaignId: string;
}

serve(async (req: Request): Promise<Response> => {
  const corsCheck = handleCorsRequest(req);
  if (corsCheck) return corsCheck;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check if user is admin
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

    // Get campaign details
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

    // Get target users based on segment
    let usersQuery = supabase
      .from("user_subscriptions")
      .select("user_id, plan_name, leads_used_this_month");

    // Apply segment filter
    if (campaign.segmento === "starter") {
      usersQuery = usersQuery.eq("plan_name", "starter");
    } else if (campaign.segmento === "pro") {
      usersQuery = usersQuery.eq("plan_name", "pro");
    } else if (campaign.segmento === "agencia") {
      usersQuery = usersQuery.eq("plan_name", "agencia");
    } else if (campaign.segmento === "inativos") {
      // Todos os usuários que não usaram leads este mês
      usersQuery = usersQuery.eq("leads_used_this_month", 0);
    } else if (campaign.segmento === "starter_inativos") {
      // Starter que nunca usaram o sistema
      usersQuery = usersQuery.eq("plan_name", "starter").eq("leads_used_this_month", 0);
    } else if (campaign.segmento === "nao_pagantes") {
      // Todos do plano Starter (não pagantes)
      usersQuery = usersQuery.eq("plan_name", "starter");
    }
    // "todos" gets all users

    console.log(`Buscando usuários para segmento: ${campaign.segmento}`);

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

    // Get user emails from auth
    let sentCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const sub of subscriptions) {
      try {
        // Get user email from auth.users
        const { data: authUser } = await supabase.auth.admin.getUserById(sub.user_id);
        
        if (!authUser?.user?.email) {
          console.log(`Usuário ${sub.user_id} sem email`);
          continue;
        }

        const userEmail = authUser.user.email;

        // Convert plain text to HTML if needed (detect by checking for HTML tags)
        let emailHtml = campaign.conteudo;
        const hasHtmlTags = /<[a-z][\s\S]*>/i.test(campaign.conteudo);
        
        if (!hasHtmlTags) {
          // Convert plain text to styled HTML
          const textWithLinks = campaign.conteudo
            .replace(/\n/g, '<br>')
            .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color: #3b82f6; text-decoration: underline;">$1</a>');
          
          emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #18181b; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Zuno Propect</h1>
              </div>
              <div style="background: white; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="color: #3f3f46; font-size: 16px; line-height: 1.8; white-space: pre-wrap;">${textWithLinks}</p>
              </div>
              <div style="text-align: center; padding: 20px; color: #a1a1aa; font-size: 12px;">
                <p>Zuno Propect - Prospecção Inteligente com IA</p>
              </div>
            </div>
          `;
        }

        // Send email via Resend API with retry logic
        const emailResult = await sendEmailWithRetry({
          from: RESEND_FROM_EMAIL,
          replyTo: RESEND_REPLY_TO_EMAIL,
          to: [userEmail],
          subject: campaign.assunto,
          html: emailHtml,
        });

        // Log email using secure function with HMAC fingerprint and non-identifying mask
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
          console.error("Erro ao inserir log de email:", logError);
        }

        if (!emailResult.success) {
          errorCount++;
          errors.push(`${userEmail}: ${emailResult.error}`);
          console.error(`Erro ao enviar para ${userEmail}:`, emailResult.error);
        } else {
          sentCount++;
          console.log(`Email enviado para ${userEmail}`);
        }

        // Delay between emails to respect rate limit
        await delay(RATE_LIMIT_DELAY);
      } catch (err: any) {
        errorCount++;
        errors.push(`Erro: ${err.message}`);
        console.error("Erro ao enviar para usuário:", err);
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

    console.log(`Campanha ${campaignId}: ${sentCount} enviados, ${errorCount} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        errors: errorCount,
        errorDetails: errors.slice(0, 5), // Return first 5 errors
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Erro na função:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get("Origin")) },
      }
    );
  }
});
