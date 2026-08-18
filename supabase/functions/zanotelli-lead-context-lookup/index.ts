import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_BODY_BYTES = 4096;
const MAX_CLOCK_SKEW_SECONDS = 300;
const HASH_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_ID_RE = /^[a-zA-Z0-9:_-]{8,180}$/;
const ALLOWED_KEYS = new Set([
  "request_id",
  "lead_reference",
  "phone_hash",
  "email_hash",
  "domain_hash",
  "company_hash",
  "responsible_hash",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function hexToBytes(value: string) {
  const normalized = value.replace(/^sha256=/i, "").trim();
  if (!/^[0-9a-f]{64}$/i.test(normalized)) return null;
  return new Uint8Array(normalized.match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)));
}

async function verifyHmac(secret: string, message: string, signature: string) {
  const signatureBytes = hexToBytes(signature);
  if (!signatureBytes) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(message));
}

function optionalHash(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase().trim();
  return HASH_RE.test(normalized) ? normalized : undefined;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json({ status: "invalid_request" }, 405);

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ status: "invalid_request" }, 413);
  }

  const timestampHeader = req.headers.get("x-zanotelli-timestamp") || "";
  const signature = req.headers.get("x-zanotelli-signature") || "";
  const timestamp = Number(timestampHeader);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > MAX_CLOCK_SKEW_SECONDS) {
    return json({ status: "unauthorized" }, 401);
  }

  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    return json({ status: "invalid_request" }, 400);
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json({ status: "invalid_request" }, 413);
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return json({ status: "invalid_request" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !ALLOWED_KEYS.has(key))) {
    return json({ status: "invalid_request" }, 400);
  }

  const requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
  const leadReference = body.lead_reference == null || body.lead_reference === ""
    ? null
    : typeof body.lead_reference === "string" && UUID_RE.test(body.lead_reference.trim())
      ? body.lead_reference.trim().toLowerCase()
      : undefined;
  const phoneHash = optionalHash(body.phone_hash);
  const emailHash = optionalHash(body.email_hash);
  const domainHash = optionalHash(body.domain_hash);
  const companyHash = optionalHash(body.company_hash);
  const responsibleHash = optionalHash(body.responsible_hash);

  if (
    !REQUEST_ID_RE.test(requestId)
    || leadReference === undefined
    || phoneHash === undefined
    || emailHash === undefined
    || domainHash === undefined
    || companyHash === undefined
    || responsibleHash === undefined
    || ![leadReference, phoneHash, emailHash, domainHash, companyHash].some(Boolean)
  ) {
    return json({ status: "invalid_request" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return json({ status: "temporarily_unavailable" }, 503);

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: secret, error: secretError } = await admin.rpc("internal_zanotelli_context_bridge_secret");
  if (secretError || typeof secret !== "string" || !secret) {
    console.error(JSON.stringify({ request_id: requestId, operation: "load_bridge_secret", status: "error" }));
    return json({ status: "temporarily_unavailable", request_id: requestId }, 503);
  }

  const verified = await verifyHmac(secret, `${timestampHeader}.${rawBody}`, signature);
  if (!verified) return json({ status: "unauthorized", request_id: requestId }, 401);

  const { data, error } = await admin.rpc("internal_lookup_zanotelli_lead_context_v2", {
    p_lead_reference: leadReference,
    p_phone_hash: phoneHash,
    p_email_hash: emailHash,
    p_domain_hash: domainHash,
    p_company_hash: companyHash,
    p_responsible_hash: responsibleHash,
  });

  if (error) {
    console.error(JSON.stringify({ request_id: requestId, operation: "lookup_lead_context_v2", status: "error" }));
    return json({ status: "temporarily_unavailable", request_id: requestId }, 503);
  }

  const result = data && typeof data === "object" ? data as Record<string, unknown> : { status: "unresolved" };
  const status = typeof result.status === "string" ? result.status : "unresolved";
  const matchedBy = typeof result.matched_by === "string" ? result.matched_by : null;

  console.log(JSON.stringify({
    request_id: requestId,
    operation: "zanotelli_lead_context_lookup_v2",
    status,
    matched: status === "matched",
    matched_by: matchedBy,
  }));

  return json({ ...result, request_id: requestId });
});
