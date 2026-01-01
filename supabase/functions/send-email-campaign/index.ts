import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============= CONFIGURATION =============
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface SendCampaignRequest {
  campaignId: string;
}

// ============= QUEUE EMAIL FUNCTION =============
async function queueEmail(
  supabase: any,
  toEmail: string,
  toName: string | null,
  subject: string,
  htmlContent: string,
  emailType: string,
  campaignId: string | null = null,
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
        campaign_id: campaignId,
        metadata,
        user_id: userId,
        status: "pending"
      })
      .select("id")
      .single();

    if (error) {
      console.error("[Queue] Error inserting email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, queueId: data.id };
  } catch (err: any) {
    console.error("[Queue] Exception:", err);
    return { success: false, error: err.message };
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // ============= QUEUE EMAILS =============
    let queuedCount = 0;
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
        const userName = authUser.user.user_metadata?.full_name || authUser.user.user_metadata?.name || null;

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

        const queueResult = await queueEmail(
          supabase,
          userEmail,
          userName,
          campaign.assunto,
          emailHtml,
          "campaign",
          campaignId,
          { campaign_name: campaign.nome, segment: campaign.segmento },
          sub.user_id
        );

        if (!queueResult.success) {
          errorCount++;
          errors.push(`${userEmail.substring(0, 5)}***: ${queueResult.error}`);
        } else {
          queuedCount++;
        }
      } catch (err: any) {
        errorCount++;
        errors.push(`Erro: ${err.message}`);
        console.error("Erro ao enfileirar:", err);
      }
    }

    // Update campaign stats
    await supabase
      .from("email_campaigns")
      .update({
        total_enviados: queuedCount,
        status: "enviando",
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    console.log(`[Campaign] Queued: ${queuedCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        queued: queuedCount,
        errors: errorCount,
        errorDetails: errors.slice(0, 5),
        message: `${queuedCount} emails adicionados à fila. Configure o n8n para processar a fila.`
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Erro na função:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor", details: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
