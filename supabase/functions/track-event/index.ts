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
        email === "jeferson.zanotell@gmail.com"
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

    // Helper de normalização local de criativos
    function normalizeCreativeName(utmContent: string | null): string {
      if (!utmContent || utmContent.trim() === "") {
        return "sem_utm_content";
      }
      const trimmed = utmContent.trim();
      const map: Record<string, string> = {
        "120246631612400725": "quem_abordar",
        "120246630603260725": "o_que_falar",
        "leads_conversas": "leads_conversas",
        "quem_abordar": "quem_abordar",
        "o_que_falar": "o_que_falar",
        "link_in_bio": "link_in_bio",
        "sem_utm_content": "sem_utm_content",
      };
      return map[trimmed] || trimmed;
    }

    // Rotina de Sincronização e Atribuição de Origem Multitoque no Backend
    if (userId) {
      try {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("first_utm_source, last_seen_at")
          .eq("id", userId)
          .single();

        const updates: Record<string, any> = {};
        const eventFirstTouch = body.first_touch;
        const eventLastTouch = body.last_touch;

        // 1. Regra do First Touch: se o profile no banco tem first touch vazio, e temos first touch no evento
        if (eventFirstTouch && typeof eventFirstTouch === "object" && (!profile || !profile.first_utm_source)) {
          const firstType = eventFirstTouch.event_source_type || "unknown";
          const rawContent = eventFirstTouch.utm_content;
          const creative = rawContent ? normalizeCreativeName(rawContent) : null;

          updates.first_utm_source = eventFirstTouch.utm_source;
          updates.first_utm_medium = eventFirstTouch.utm_medium;
          updates.first_utm_campaign = eventFirstTouch.utm_campaign;
          updates.first_utm_content = eventFirstTouch.utm_content;
          updates.first_referrer = eventFirstTouch.referrer;
          updates.first_landing_page = eventFirstTouch.landing_url;
          updates.first_seen_at = eventFirstTouch.captured_at || new Date().toISOString();
          updates.first_event_source_type = firstType;
          updates.first_creative_name = creative;
        }

        // 2. Regra do Last Touch: sempre atualiza se for mais recente ou se o banco não tiver
        const eventLastCapturedAt = eventLastTouch?.captured_at;
        const shouldUpdateLast = eventLastTouch && typeof eventLastTouch === "object" && (
          !profile || 
          !profile.last_seen_at || 
          (eventLastCapturedAt && new Date(eventLastCapturedAt).getTime() > new Date(profile.last_seen_at).getTime())
        );

        if (shouldUpdateLast) {
          const lastType = eventLastTouch.event_source_type || "unknown";
          const rawContent = eventLastTouch.utm_content;
          const creative = rawContent ? normalizeCreativeName(rawContent) : null;

          updates.last_utm_source = eventLastTouch.utm_source;
          updates.last_utm_medium = eventLastTouch.utm_medium;
          updates.last_utm_campaign = eventLastTouch.utm_campaign;
          updates.last_utm_content = eventLastTouch.utm_content;
          updates.last_referrer = eventLastTouch.referrer;
          updates.last_landing_page = eventLastTouch.landing_url;
          updates.last_seen_at = eventLastTouch.captured_at || new Date().toISOString();
          updates.last_event_source_type = lastType;
          updates.last_creative_name = creative;
          updates.updated_at = new Date().toISOString();
        }

        if (Object.keys(updates).length > 0) {
          const { error: profileUpdateErr } = await supabaseAdmin
            .from("profiles")
            .update(updates)
            .eq("id", userId);

          if (profileUpdateErr) {
            console.warn("[track-event] sync profiles failed", profileUpdateErr.message);
          }
        }
      } catch (err) {
        console.warn("[track-event] unexpected attribution sync error", err);
      }
    }

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
