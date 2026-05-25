import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createTestEmailTemplate } from "../_shared/emailTemplates.ts";

// ============= CONFIGURATION =============
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "";
const RESEND_REPLY_TO_EMAIL = Deno.env.get("RESEND_REPLY_TO_EMAIL") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

// ============= VALIDATION =============
const validateFromEmail = (from: string): { valid: boolean; error?: string } => {
  if (!from || from.trim() === "") {
    return { valid: false, error: "RESEND_FROM_EMAIL nao configurado" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const namedEmailRegex = /^.+\s<[^\s@]+@[^\s@]+\.[^\s@]+>$/;

  if (!emailRegex.test(from) && !namedEmailRegex.test(from)) {
    return {
      valid: false,
      error: `Formato invalido: "${from}". Use "email@dominio.com" ou "Nome <email@dominio.com>"`,
    };
  }

  const email = from.match(/<([^>]+)>/)?.[1] || from;
  const domain = email.split("@")[1]?.toLowerCase();
  if (domain !== "zunopropect.com.br") {
    return {
      valid: false,
      error: `Remetente invalido: use o dominio verificado zunopropect.com.br.`,
    };
  }

  return { valid: true };
};

// ============= RESEND API HELPER =============
async function sendEmailViaResend(payload: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
}): Promise<{ data?: any; error?: { message: string; status?: number; body?: unknown } }> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let data: any = null;
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      data = responseText;
    }

    if (!response.ok) {
      return {
        error: {
          message: data?.message || data?.error || "Erro ao enviar email pela Resend",
          status: response.status,
          body: data,
        },
      };
    }

    return { data };
  } catch (error: any) {
    return { error: { message: error.message } };
  }
}

interface TestEmailRequest {
  email?: string;
  recipientEmail?: string;
  toEmail?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({
      error: "Metodo nao permitido",
      details: "Use POST para enviar email de teste.",
    }, 405);
  }

  try {
    // ============= AUTH CHECK =============
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({
        error: "Usuario nao autenticado",
        details: "Authorization header ausente",
      }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({
        error: "Usuario nao autenticado",
        details: userError?.message || "Token invalido",
      }, 401);
    }

    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin", { _user_id: user.id });

    if (adminError) {
      console.error("[Test] Admin check error:", adminError.message);
      return jsonResponse({
        error: "Erro ao validar admin",
        details: adminError.message,
      }, 500);
    }

    if (
      !isAdmin && 
      user.email !== "jeferson.zanotell@gmail.com" && 
      user.email !== "falecom@klsalescompany.com" && 
      user.email !== "kiefferlinconts@gmail.com"
    ) {
      return jsonResponse({
        error: "Acesso negado",
        details: "Usuario nao e admin.",
      }, 403);
    }

    const body: TestEmailRequest = await req.json().catch(() => ({}));
    const toEmail = body.email || body.recipientEmail || body.toEmail;

    if (!toEmail) {
      return jsonResponse({
        error: "Email de destino obrigatorio",
        details: "Envie email, recipientEmail ou toEmail no payload.",
      }, 400);
    }

    // ============= VALIDATE CONFIG =============
    const configStatus: any = {
      resend_api_key: RESEND_API_KEY ? "Configurado" : "Nao configurado",
      resend_from_email: RESEND_FROM_EMAIL || "Nao configurado",
      resend_reply_to_email: RESEND_REPLY_TO_EMAIL || "(nao definido)",
    };

    if (!RESEND_API_KEY) {
      return jsonResponse({
        success: false,
        error: "RESEND_API_KEY nao configurada",
        config: configStatus,
      }, 500);
    }

    const fromValidation = validateFromEmail(RESEND_FROM_EMAIL);
    if (!fromValidation.valid) {
      return jsonResponse({
        success: false,
        error: fromValidation.error,
        config: configStatus,
        hint: 'Configure RESEND_FROM_EMAIL como "Nome <email@dominio.com>" ou "email@dominio.com"',
      }, 500);
    }

    // ============= SEND TEST EMAIL =============
    const dateTime = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    });
    const testTemplate = createTestEmailTemplate({
      from: RESEND_FROM_EMAIL,
      replyTo: RESEND_REPLY_TO_EMAIL || "nao definido",
      recipient: toEmail,
      dateTime,
    });

    const emailPayload: any = {
      from: RESEND_FROM_EMAIL,
      to: [toEmail],
      subject: "Configuracao de e-mail concluida - Zuno Propect",
      html: testTemplate.html,
      text: testTemplate.text,
    };

    if (RESEND_REPLY_TO_EMAIL) {
      emailPayload.reply_to = RESEND_REPLY_TO_EMAIL;
    }

    console.log("[Test] Sending test email...");
    console.log("[Test] Payload:", JSON.stringify({
      from: emailPayload.from,
      to: emailPayload.to,
      reply_to: emailPayload.reply_to,
    }));

    const emailResponse = await sendEmailViaResend(emailPayload);

    if (emailResponse.error) {
      console.error("[Test] Resend error:", emailResponse.error);
      return jsonResponse({
        success: false,
        error: "Erro da Resend ao enviar email de teste",
        details: emailResponse.error.message,
        status: emailResponse.error.status,
        config: configStatus,
        resend_response: emailResponse.error,
      }, 500);
    }

    console.log("[Test] Email sent successfully:", emailResponse.data);

    return jsonResponse({
      success: true,
      message: `Email de teste enviado para ${toEmail}`,
      config: configStatus,
      resend_response: emailResponse.data,
    });
  } catch (error: any) {
    console.error("Erro test-email-config:", error);
    return jsonResponse({
      success: false,
      error: "Erro ao enviar e-mail de teste",
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
