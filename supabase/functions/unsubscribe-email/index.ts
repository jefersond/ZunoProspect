import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const hashEmail = async (email: string): Promise<string> => {
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const htmlResponse = (title: string, message: string, status = 200) =>
  new Response(
    `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f6f7f9; color: #18181b; }
    main { max-width: 560px; margin: 12vh auto; background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }
    h1 { margin: 0 0 12px; font-size: 24px; }
    p { color: #52525b; line-height: 1.6; }
    a { color: #4f46e5; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${message}</p>
    <p><a href="https://www.zunopropect.com.br">Voltar para o Zuno Prospect</a></p>
  </main>
</body>
</html>`,
    { status, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
  );

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("uid");
    const source = url.searchParams.get("source") || "email";
    const reason = url.searchParams.get("reason") || "user_unsubscribed";

    if (!userId) {
      return htmlResponse(
        "Não foi possível concluir",
        "O link de descadastro está incompleto. Responda ao e-mail recebido pedindo descadastro que removemos você manualmente.",
        400,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData?.user?.email) {
      return htmlResponse(
        "Não foi possível concluir",
        "Não encontramos esse usuário. Responda ao e-mail recebido pedindo descadastro que removemos você manualmente.",
        404,
      );
    }

    const email = userData.user.email;
    const emailFingerprint = await hashEmail(email);

    const { error } = await supabase
      .from("email_unsubscribes")
      .upsert(
        {
          user_id: userId,
          email,
          email_fingerprint: emailFingerprint,
          source,
          reason,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (error) {
      console.error("[unsubscribe-email] Failed to save unsubscribe:", error);
      return htmlResponse(
        "Erro ao descadastrar",
        "Não conseguimos registrar seu descadastro agora. Tente novamente em alguns minutos.",
        500,
      );
    }

    await supabase.from("email_events").insert({
      user_id: userId,
      email_type: source,
      event_type: "unsubscribe",
      metadata: { reason },
    });

    return htmlResponse(
      "Descadastro confirmado",
      "Pronto. Você não receberá novas campanhas de marketing do Zuno Prospect nesse e-mail.",
    );
  } catch (error: any) {
    console.error("[unsubscribe-email] Unhandled error:", error);
    return htmlResponse(
      "Erro ao descadastrar",
      "Não conseguimos registrar seu descadastro agora. Tente novamente em alguns minutos.",
      500,
    );
  }
});
