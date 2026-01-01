import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

// ============= CONFIGURATION =============
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "";
const RESEND_REPLY_TO_EMAIL = Deno.env.get("RESEND_REPLY_TO_EMAIL") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============= VALIDATION =============
const validateFromEmail = (from: string): { valid: boolean; error?: string } => {
  if (!from || from.trim() === "") {
    return { valid: false, error: "RESEND_FROM_EMAIL não configurado" };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const namedEmailRegex = /^.+\s<[^\s@]+@[^\s@]+\.[^\s@]+>$/;
  
  if (!emailRegex.test(from) && !namedEmailRegex.test(from)) {
    return { 
      valid: false, 
      error: `Formato inválido: "${from}". Use "email@dominio.com" ou "Nome <email@dominio.com>"` 
    };
  }
  
  return { valid: true };
};

interface TestEmailRequest {
  toEmail: string;
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
      return new Response(JSON.stringify({ error: "Apenas administradores" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { toEmail }: TestEmailRequest = await req.json();

    if (!toEmail) {
      return new Response(JSON.stringify({ error: "Email de destino obrigatório" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ============= VALIDATE CONFIG =============
    const configStatus: any = {
      resend_api_key: RESEND_API_KEY ? "✅ Configurado" : "❌ Não configurado",
      resend_from_email: RESEND_FROM_EMAIL || "❌ Não configurado",
      resend_reply_to_email: RESEND_REPLY_TO_EMAIL || "(não definido)",
    };

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({
        success: false,
        error: "RESEND_API_KEY não configurado",
        config: configStatus,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const fromValidation = validateFromEmail(RESEND_FROM_EMAIL);
    if (!fromValidation.valid) {
      return new Response(JSON.stringify({
        success: false,
        error: fromValidation.error,
        config: configStatus,
        hint: 'Configure RESEND_FROM_EMAIL como "Nome <email@dominio.com>" ou "email@dominio.com"',
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ============= SEND TEST EMAIL =============
    const resend = new Resend(RESEND_API_KEY);
    
    const emailPayload: any = {
      from: RESEND_FROM_EMAIL,
      to: [toEmail],
      subject: "🧪 Teste de Configuração - Zuno Prospect",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
            <h1 style="color: white; margin: 0;">✅ Email Configurado!</h1>
          </div>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #374151; margin: 0 0 15px;">Configurações utilizadas:</h3>
            <p style="color: #6b7280; margin: 5px 0;"><strong>From:</strong> ${RESEND_FROM_EMAIL}</p>
            <p style="color: #6b7280; margin: 5px 0;"><strong>Reply-To:</strong> ${RESEND_REPLY_TO_EMAIL || 'não definido'}</p>
            <p style="color: #6b7280; margin: 5px 0;"><strong>Enviado para:</strong> ${toEmail}</p>
            <p style="color: #6b7280; margin: 5px 0;"><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
          </div>
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Este é um email de teste do sistema Zuno Prospect.
          </p>
        </div>
      `,
    };
    
    if (RESEND_REPLY_TO_EMAIL) {
      emailPayload.reply_to = RESEND_REPLY_TO_EMAIL;
    }

    console.log("[Test] Sending test email...");
    console.log("[Test] Payload:", JSON.stringify({ 
      from: emailPayload.from, 
      to: emailPayload.to, 
      reply_to: emailPayload.reply_to 
    }));

    const emailResponse = await resend.emails.send(emailPayload);

    if (emailResponse.error) {
      console.error("[Test] Resend error:", emailResponse.error);
      return new Response(JSON.stringify({
        success: false,
        error: emailResponse.error.message,
        config: configStatus,
        resend_response: emailResponse.error,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("[Test] Email sent successfully:", emailResponse.data);

    return new Response(JSON.stringify({
      success: true,
      message: `Email de teste enviado para ${toEmail}`,
      config: configStatus,
      resend_response: emailResponse.data,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("[Test] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
