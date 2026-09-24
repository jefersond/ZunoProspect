import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authHeader = req.headers.get("authorization") || "";
  if (!supabaseUrl || !anonKey || !serviceRole || !authHeader) return json({ error: "not_configured" }, 500);

  const authed = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: authData } = await authed.auth.getUser();
  if (!authData.user?.id) return json({ error: "authentication_required" }, 401);

  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
  const requestBody = await req.json().catch(() => ({}));
  const action = requestBody?.action === "cancel_subscription" ? "cancel_subscription" : "portal";

  const { data: subscription, error } = await admin.from("user_subscriptions")
    .select("billing_provider,stripe_customer_id,stripe_subscription_id,mercado_pago_subscription_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (error || !subscription) return json({ error: "subscription_not_found" }, 404);

  if (subscription.billing_provider === "stripe" || subscription.stripe_customer_id || subscription.stripe_subscription_id) {
    const response = await fetch(`${supabaseUrl}/functions/v1/create-customer-portal-session`, {
      method: "POST",
      headers: { authorization: authHeader, "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json().catch(() => ({}));
    return json(payload, response.status);
  }

  if (subscription.billing_provider !== "mercado_pago" || !subscription.mercado_pago_subscription_id) {
    return json({ error: "billing_provider_not_manageable" }, 409);
  }

  if (action === "portal") {
    return json({ ok: true, provider: "mercado_pago", manageInApp: true }, 200);
  }

  const token = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") || "";
  if (!token) return json({ error: "mercado_pago_credentials_missing" }, 503);

  const response = await fetch(
    `https://api.mercadopago.com/preapproval/${encodeURIComponent(subscription.mercado_pago_subscription_id)}`,
    {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ status: "canceled" }),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: payload?.message || "mercado_pago_cancel_failed" }, 502);

  return json({ ok: true, provider: "mercado_pago", status: payload?.status || "canceled" }, 200);
});
