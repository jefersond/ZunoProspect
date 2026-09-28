const PLAN_ID = "65afe64e16b04952a6b4b451aae83388";
const COLLECTOR_ID = "3716084566";
const MP_API = "https://api.mercadopago.com";
const ZANOTELLI_OWNER_VERIFY_URL = "https://fxoovelvhzzqasekmlvr.supabase.co/functions/v1/verify-owner-diagnostic-temp";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });

const maskEmail = (value: unknown) => {
  const email = String(value || "").trim();
  const at = email.indexOf("@");
  if (at <= 0) return email ? "***" : null;
  return `${email.slice(0, Math.min(2, at))}***@${email.slice(at + 1)}`;
};

async function requireZanotelliOwner(request: Request) {
  if (request.headers.get("origin")) throw new Error("browser_origin_forbidden");
  if (request.headers.get("x-zanotelli-diagnostic-version") !== "1") throw new Error("bridge_version_required");
  const auth = request.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/i.test(auth)) throw new Error("auth_required");

  const response = await fetch(ZANOTELLI_OWNER_VERIFY_URL, {
    method: "GET",
    headers: {
      authorization: auth,
      "x-zanotelli-diagnostic-version": "1",
      accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(response.status === 403 ? "owner_aal2_required" : "owner_session_invalid");
  const payload = await response.json().catch(() => ({}));
  if (payload?.ok !== true || payload?.owner !== true || payload?.aal2 !== true) {
    throw new Error("owner_session_invalid");
  }
}

async function mpGet(token: string, path: string) {
  const response = await fetch(`${MP_API}${path}`, {
    method: "GET",
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

Deno.serve(async (request) => {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  try {
    await requireZanotelliOwner(request);
  } catch (cause) {
    const code = String((cause as Error)?.message || "not_authorized");
    return json({ error: code }, code.includes("aal2") || code.includes("owner") || code.includes("browser") ? 403 : 401);
  }

  const mpToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") || "";
  if (!mpToken) return json({ error: "mercado_pago_not_configured" }, 503);

  const plan = await mpGet(mpToken, `/preapproval_plan/${PLAN_ID}`);

  let preapprovals = await mpGet(mpToken, `/preapproval/search?preapproval_plan_id=${encodeURIComponent(PLAN_ID)}&limit=20&offset=0`);
  let preapprovalResults = Array.isArray(preapprovals.payload?.results) ? preapprovals.payload.results : [];
  if (!preapprovals.ok) {
    preapprovals = await mpGet(mpToken, "/preapproval/search?limit=20&offset=0");
    preapprovalResults = Array.isArray(preapprovals.payload?.results)
      ? preapprovals.payload.results.filter((x: any) => String(x?.preapproval_plan_id || "") === PLAN_ID)
      : [];
  }

  const end = new Date();
  const begin = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    sort: "date_created",
    criteria: "desc",
    range: "date_created",
    begin_date: begin.toISOString(),
    end_date: end.toISOString(),
    "collector.id": COLLECTOR_ID,
    limit: "50",
    offset: "0",
  });

  let payments = await mpGet(mpToken, `/v1/payments/search?${params.toString()}`);
  let paymentResults = Array.isArray(payments.payload?.results) ? payments.payload.results : [];
  if (!payments.ok) {
    const fallback = new URLSearchParams({
      sort: "date_created",
      criteria: "desc",
      range: "date_created",
      begin_date: begin.toISOString(),
      end_date: end.toISOString(),
      limit: "50",
      offset: "0",
    });
    payments = await mpGet(mpToken, `/v1/payments/search?${fallback.toString()}`);
    paymentResults = Array.isArray(payments.payload?.results)
      ? payments.payload.results.filter((x: any) => String(x?.collector_id || "") === COLLECTOR_ID)
      : [];
  }

  const pp = plan.payload || {};
  const sanitizedPreapprovals = preapprovalResults.slice(0,20).map((x:any)=>({
    id:x?.id??null,
    status:x?.status??null,
    payer_id:x?.payer_id??null,
    payer_email_masked:maskEmail(x?.payer_email),
    preapproval_plan_id:x?.preapproval_plan_id??null,
    external_reference:x?.external_reference??null,
    reason:x?.reason??null,
    date_created:x?.date_created??null,
    last_modified:x?.last_modified??null,
  }));
  const sanitizedPayments = paymentResults.slice(0,50).map((x:any)=>({
    id:x?.id??null,
    status:x?.status??null,
    status_detail:x?.status_detail??null,
    payer_id:x?.payer?.id??null,
    transaction_amount:x?.transaction_amount??null,
    payment_method_id:x?.payment_method_id??null,
    payment_type_id:x?.payment_type_id??null,
    date_created:x?.date_created??null,
  }));

  return json({
    readonly:true,
    secret_exposed:false,
    owner_aal2:true,
    plan_get:{
      ok:plan.ok,
      http_status:plan.status,
      data:plan.ok?{
        id:pp?.id??null,
        status:pp?.status??null,
        collector_id:pp?.collector_id??null,
        application_id:pp?.application_id??null,
      }:null,
    },
    preapproval_search:{
      ok:preapprovals.ok,
      http_status:preapprovals.status,
      count:sanitizedPreapprovals.length,
      data:sanitizedPreapprovals,
    },
    payments_search:{
      ok:payments.ok,
      http_status:payments.status,
      window_utc:{begin:begin.toISOString(),end:end.toISOString()},
      count:sanitizedPayments.length,
      data:sanitizedPayments,
    },
  });
});