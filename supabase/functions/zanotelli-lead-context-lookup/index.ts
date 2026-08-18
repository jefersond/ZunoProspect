import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_BODY_BYTES = 2048;
const MAX_CLOCK_SKEW_SECONDS = 300;
const HASH_RE = /^[0-9a-f]{64}$/i;
const REQUEST_ID_RE = /^[a-zA-Z0-9:_-]{8,180}$/;

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

  const phoneHash = typeof body.phone_hash === "string" ? body.phone_hash.toLowerCase().trim() : "";
  const requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
  if (!HASH_RE.test(phoneHash) || !REQUEST_ID_RE.test(requestId)) {
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

  const { data, error } = await admin.rpc("internal_lookup_zanotelli_lead_context", {
    p_phone_hash: phoneHash,
  });

  if (error) {
    console.error(JSON.stringify({ request_id: requestId, operation: "lookup_lead_context", status: "error" }));
    return json({ status: "temporarily_unavailable", request_id: requestId }, 503);
  }

  const result = data && typeof data === "object" ? data as Record<string, unknown> : { status: "unresolved" };
  const status = typeof result.status === "string" ? result.status : "unresolved";

  console.log(JSON.stringify({
    request_id: requestId,
    operation: "zanotelli_lead_context_lookup",
    status,
    matched: status === "matched",
  }));

  return json({ ...result, request_id: requestId });
});
