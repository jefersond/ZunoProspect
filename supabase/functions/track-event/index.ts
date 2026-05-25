import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function firstIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null;
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
}

function cleanString(value: unknown, maxLength = 1000) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function detectDevice(userAgent: string | null) {
  const ua = userAgent || "";
  const device_type = /ipad|tablet/i.test(ua)
    ? "tablet"
    : /mobile|iphone|android/i.test(ua)
      ? "mobile"
      : "desktop";
  const browser = /edg/i.test(ua)
    ? "Edge"
    : /chrome|crios/i.test(ua)
      ? "Chrome"
      : /safari/i.test(ua)
        ? "Safari"
        : /firefox|fxios/i.test(ua)
          ? "Firefox"
          : null;
  const os = /windows/i.test(ua)
    ? "Windows"
    : /android/i.test(ua)
      ? "Android"
      : /iphone|ipad|ios/i.test(ua)
        ? "iOS"
        : /mac os|macintosh/i.test(ua)
          ? "macOS"
          : /linux/i.test(ua)
            ? "Linux"
            : null;

  return { device_type, browser, os };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase env vars missing" }, 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const eventName = cleanString(body.event_name || body.event_type, 120);
    const eventType = cleanString(body.event_type || body.event_name, 120);

    if (!eventName) {
      return jsonResponse({ error: "event_name is required", details: "Send event_name or event_type in the request body." }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    const userAgent = req.headers.get("user-agent");
    const detected = detectDevice(userAgent);
    let userId: string | null = null;
    let email: string | null = null;
    let isInternal = Boolean(body.is_internal_event);
    let eventSource = cleanString(body.event_source_type, 50) || "unknown";

    if (authHeader && token) {
      const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await supabaseAuthed.auth.getUser(token);
      userId = data.user?.id ?? null;
      email = data.user?.email ?? null;

      if (
        email === "jeferson.zanotell@gmail.com" || 
        email === "falecom@klsalescompany.com" || 
        email === "kiefferlinconts@gmail.com"
      ) {
        isInternal = true;
        eventSource = "internal_test";
      }
    } else {
      email = cleanString(body.user_email, 200) || null;
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await supabaseAdmin.from("app_events").insert({
      user_id: userId,
      email,
      user_email: email,
      is_internal_event: isInternal,
      event_source_type: eventSource,
      anonymous_id: cleanString(body.anonymous_id, 200),
      session_id: cleanString(body.session_id, 200),
      event_type: eventType || eventName,
      event_name: eventName,
      page_url: cleanString(body.page_url, 2000),
      path: cleanString(body.path, 500),
      pathname: cleanString(body.pathname, 500),
      referrer: cleanString(body.referrer, 2000),
      utm_source: cleanString(body.utm_source, 200),
      utm_medium: cleanString(body.utm_medium, 200),
      utm_campaign: cleanString(body.utm_campaign, 300),
      utm_content: cleanString(body.utm_content, 300),
      utm_term: cleanString(body.utm_term, 300),
      fbclid: cleanString(body.fbclid, 500),
      ref: cleanString(body.ref, 500),
      offer: cleanString(body.offer, 200),
      first_touch: typeof body.first_touch === "object" && body.first_touch !== null ? body.first_touch : null,
      last_touch: typeof body.last_touch === "object" && body.last_touch !== null ? body.last_touch : null,
      metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {},
      device_type: cleanString(body.device_type, 80) || detected.device_type,
      browser: cleanString(body.browser, 80) || detected.browser,
      os: cleanString(body.os, 80) || detected.os,
      ip_address: firstIp(req),
      user_agent: userAgent,
      event_data: typeof body.event_data === "object" && body.event_data !== null
        ? body.event_data
        : (typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {}),
    });

    if (error) {
      console.warn("[track-event] insert failed", error.message);
      return jsonResponse({ ok: false, error: "insert_failed", details: error.message }, 500);
    }

    return jsonResponse({ ok: true, event_name: eventName }, 200);
  } catch (error) {
    console.warn("[track-event] unexpected failure", error);
    return jsonResponse({ ok: false, error: "unexpected_failure", details: error instanceof Error ? error.message : String(error) }, 500);
  }
});
