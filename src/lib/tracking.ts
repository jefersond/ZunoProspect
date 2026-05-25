import { supabase } from "@/integrations/supabase/client";
import { getAttributionParams } from "@/lib/metaPixel";
import { normalizeCreativeName } from "./creativeMap";

type EventMetadata = Record<string, unknown>;

export type EventSourceType =
  | "paid"
  | "organic"
  | "direct"
  | "referral"
  | "internal_test"
  | "unknown";

export const INTERNAL_TEST_EMAILS = [
  "jeferson.zanotell@gmail.com",
  "falecom@klsalescompany.com",
  "kiefferlinconts@gmail.com"
];

export type TouchAttribution = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  ref: string | null;
  offer: string | null;
  landing_url: string | null;
  referrer: string | null;
  captured_at: string;
};

const ANONYMOUS_ID_KEY = "zuno_anonymous_id";
const SESSION_ID_KEY = "zuno_session_id";
const FIRST_TOUCH_KEY = "zuno_first_touch";
const LAST_TOUCH_KEY = "zuno_last_touch";
const TRACKED_ONCE_KEY = "zuno_tracked_once";
const ATTRIBUTION_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "ref", "offer"] as const;
const isDev = import.meta.env.DEV;

function createId(prefix: string) {
  const cryptoId = globalThis.crypto?.randomUUID?.();
  return `${prefix}_${cryptoId || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

function safeGet(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // Tracking must never block the product.
  }
}

function parseStoredTouch(value: string | null): TouchAttribution | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as TouchAttribution;
  } catch {
    return null;
  }
}

function createTouch(params: URLSearchParams): TouchAttribution | null {
  const values = ATTRIBUTION_KEYS.reduce<Record<string, string | null>>((acc, key) => {
    acc[key] = params.get(key);
    return acc;
  }, {});

  const hasAttribution = ATTRIBUTION_KEYS.some((key) => Boolean(values[key]));
  if (!hasAttribution) return null;

  return {
    utm_source: values.utm_source,
    utm_medium: values.utm_medium,
    utm_campaign: values.utm_campaign,
    utm_content: values.utm_content,
    utm_term: values.utm_term,
    fbclid: values.fbclid,
    ref: values.ref,
    offer: values.offer,
    landing_url: typeof window === "undefined" ? null : window.location.href,
    referrer: typeof document === "undefined" ? null : document.referrer || null,
    captured_at: new Date().toISOString(),
  };
}

export function getAnonymousId() {
  if (typeof window === "undefined") return createId("anon");
  const existing = safeGet(localStorage, ANONYMOUS_ID_KEY);
  if (existing) return existing;
  const next = createId("anon");
  safeSet(localStorage, ANONYMOUS_ID_KEY, next);
  return next;
}

export function getSessionId() {
  if (typeof window === "undefined") return createId("sess");
  const existing = safeGet(sessionStorage, SESSION_ID_KEY);
  if (existing) return existing;
  const next = createId("sess");
  safeSet(sessionStorage, SESSION_ID_KEY, next);
  return next;
}

export function captureAttributionFromUrl() {
  if (typeof window === "undefined") {
    return { first_touch: null, last_touch: null };
  }

  const params = new URLSearchParams(window.location.search);
  const currentTouch = createTouch(params);
  const existingFirstTouch = parseStoredTouch(safeGet(localStorage, FIRST_TOUCH_KEY));
  const existingLastTouch = parseStoredTouch(safeGet(localStorage, LAST_TOUCH_KEY));

  if (currentTouch && !existingFirstTouch) {
    safeSet(localStorage, FIRST_TOUCH_KEY, JSON.stringify(currentTouch));
  }

  if (currentTouch) {
    safeSet(localStorage, LAST_TOUCH_KEY, JSON.stringify(currentTouch));
  }

  return {
    first_touch: currentTouch && !existingFirstTouch ? currentTouch : existingFirstTouch,
    last_touch: currentTouch || existingLastTouch,
  };
}

export function initTracking() {
  if (typeof window === "undefined") return;
  getAnonymousId();
  getSessionId();
  captureAttributionFromUrl();
}

export function getAttribution() {
  if (typeof window === "undefined") {
    return {
      first_touch: null,
      last_touch: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      fbclid: null,
      ref: null,
      offer: null,
    };
  }

  const captured = captureAttributionFromUrl();
  const lastTouch = captured.last_touch;
  const metaAttribution = getAttributionParams();

  return {
    first_touch: captured.first_touch,
    last_touch: captured.last_touch,
    utm_source: lastTouch?.utm_source || metaAttribution.utm_source || null,
    utm_medium: lastTouch?.utm_medium || metaAttribution.utm_medium || null,
    utm_campaign: lastTouch?.utm_campaign || metaAttribution.utm_campaign || null,
    utm_content: lastTouch?.utm_content || metaAttribution.utm_content || null,
    utm_term: lastTouch?.utm_term || metaAttribution.utm_term || null,
    fbclid: lastTouch?.fbclid || metaAttribution.fbclid || null,
    ref: lastTouch?.ref || metaAttribution.ref || null,
    offer: lastTouch?.offer || metaAttribution.offer || null,
  };
}

function browserName(userAgent: string) {
  if (/edg/i.test(userAgent)) return "Edge";
  if (/chrome|crios/i.test(userAgent)) return "Chrome";
  if (/safari/i.test(userAgent)) return "Safari";
  if (/firefox|fxios/i.test(userAgent)) return "Firefox";
  return "Outro";
}

function osName(userAgent: string) {
  if (/windows/i.test(userAgent)) return "Windows";
  if (/android/i.test(userAgent)) return "Android";
  if (/iphone|ipad|ios/i.test(userAgent)) return "iOS";
  if (/mac os|macintosh/i.test(userAgent)) return "macOS";
  if (/linux/i.test(userAgent)) return "Linux";
  return "Outro";
}

function deviceType(userAgent: string) {
  if (/ipad|tablet/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|android/i.test(userAgent)) return "mobile";
  return "desktop";
}

function shouldTrackOnce(key: string) {
  if (typeof window === "undefined") return true;
  try {
    const current = JSON.parse(sessionStorage.getItem(TRACKED_ONCE_KEY) || "[]") as string[];
    if (current.includes(key)) return false;
    sessionStorage.setItem(TRACKED_ONCE_KEY, JSON.stringify([...current, key].slice(-200)));
    return true;
  } catch {
    return true;
  }
}

export function detectInternalEvent(): boolean {
  if (typeof window === "undefined") return false;

  const urlParams = new URLSearchParams(window.location.search);
  const internalParam = urlParams.get("internal");
  const testParam = urlParams.get("test");
  const debugParam = urlParams.get("debug");

  if (internalParam === "false") {
    sessionStorage.removeItem("zuno_internal_test");
    localStorage.removeItem("zuno_internal_test");
    return false;
  }

  if (internalParam === "true" || testParam === "true" || debugParam === "true") {
    sessionStorage.setItem("zuno_internal_test", "true");
    return true;
  }

  const isInternalSession = sessionStorage.getItem("zuno_internal_test") === "true";
  const isInternalLocal = localStorage.getItem("zuno_internal_test") === "true";

  if (isInternalSession || isInternalLocal) return true;

  const hostname = window.location.hostname;
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.includes("preview") ||
    (hostname.includes("vercel.app") && !hostname.includes("zunopropect"))
  ) {
    return true;
  }

  return false;
}

export function classifyEventSource(
  isInternal: boolean,
  attribution: ReturnType<typeof getAttribution>,
  referrer: string | null
): EventSourceType {
  if (isInternal) return "internal_test";

  const isPaid =
    attribution.utm_source === "meta" ||
    (attribution.utm_medium && attribution.utm_medium.includes("paid")) ||
    !!attribution.fbclid ||
    (attribution.utm_source && ["fb", "facebook", "instagram", "ads", "google"].includes(attribution.utm_source.toLowerCase()));

  if (isPaid) return "paid";

  if (referrer) {
    const rLower = referrer.toLowerCase();
    const isSearchEngine =
      rLower.includes("google") ||
      rLower.includes("bing") ||
      rLower.includes("yahoo") ||
      rLower.includes("duckduckgo");
    
    if (isSearchEngine && !attribution.utm_source && !attribution.utm_medium) {
      return "organic";
    }

    if (!rLower.includes(window.location.hostname)) {
      return "referral";
    }
  }

  if (!referrer && !attribution.utm_source && !attribution.utm_medium && !attribution.utm_campaign) {
    return "direct";
  }

  return "unknown";
}

export async function trackEvent(eventName: string, metadata: EventMetadata = {}) {
  try {
    if (typeof window === "undefined") return;

    initTracking();
    const attribution = getAttribution();
    const sessionId = getSessionId();
    const eventKey = `${eventName}:${window.location.pathname}:${sessionId}`;

    if (eventName === "page_view" && !shouldTrackOnce(eventKey)) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userAgent = navigator.userAgent || "";
    const userEmail = session?.user?.email || null;
    let isInternal = detectInternalEvent();

    if (userEmail && INTERNAL_TEST_EMAILS.includes(userEmail)) {
      isInternal = true;
    }

    const eventSource = classifyEventSource(isInternal, attribution, document.referrer || null);
    const rawUtmContent = attribution.utm_content || "sem_utm_content";
    const creativeName = normalizeCreativeName(rawUtmContent);
    const enrichedMetadata = {
      ...metadata,
      utm_content_original: rawUtmContent,
      utm_content_normalized: creativeName,
      creative_name: creativeName,
    };

    const payload = {
      event_name: eventName,
      event_type: eventName,
      metadata: enrichedMetadata,
      event_data: enrichedMetadata,
      path: window.location.pathname,
      pathname: window.location.pathname,
      page_url: window.location.href,
      referrer: document.referrer || null,
      anonymous_id: getAnonymousId(),
      session_id: sessionId,
      device_type: deviceType(userAgent),
      browser: browserName(userAgent),
      os: osName(userAgent),
      is_internal_event: isInternal,
      event_source_type: eventSource,
      user_email: userEmail,
      ...attribution,
    };

    await supabase.functions.invoke("track-event", {
      body: payload,
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });

    if (isDev) {
      console.log("[tracking] event", eventName, payload);
    }
  } catch (error) {
    if (isDev) {
      console.warn("[tracking] event ignored", eventName, error);
    }
  }
}

export function trackPageView(metadata?: EventMetadata) {
  return trackEvent("page_view", metadata);
}

export function trackCtaClick(metadata?: EventMetadata) {
  return trackEvent("cta_clicked", metadata);
}

export function trackSignupCompleted(metadata?: EventMetadata) {
  return trackEvent("signup_completed", metadata);
}

export function trackFirstSearchCompleted(metadata?: EventMetadata) {
  return trackEvent("first_search_completed", metadata);
}

export function trackUpgradeClicked(metadata?: EventMetadata) {
  return trackEvent("upgrade_clicked", metadata);
}

export function trackCheckoutStarted(metadata?: EventMetadata) {
  return trackEvent("checkout_started", metadata);
}

export function trackPurchaseCompleted(metadata?: EventMetadata) {
  return trackEvent("purchase_completed", metadata);
}
