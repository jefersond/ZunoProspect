export const FB_PIXEL_ID = "1395903565453591";

type MetaParams = Record<string, any>;

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: unknown;
  }
}

const trackedEvents = new Set<string>();
const isDev = import.meta.env.DEV;

const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "ref",
  "offer",
] as const;

function safeStorage(storage: Storage | undefined, key: string, value?: string) {
  try {
    if (!storage) return null;
    if (value) storage.setItem(`zuno_${key}`, value);
    return storage.getItem(`zuno_${key}`);
  } catch {
    return null;
  }
}

export function captureAttributionParams() {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);
  const attribution: MetaParams = {};

  ATTRIBUTION_KEYS.forEach((key) => {
    const value = params.get(key);
    const persisted = safeStorage(localStorage, key, value || undefined);
    const sessionPersisted = safeStorage(sessionStorage, key, value || undefined);
    const resolved = value || persisted || sessionPersisted;
    if (resolved) attribution[key] = resolved;
  });

  return attribution;
}

export function getAttributionParams() {
  return captureAttributionParams();
}

function withAttribution(params?: MetaParams) {
  return {
    ...getAttributionParams(),
    ...(params || {}),
  };
}

function isPixelLoaded() {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

export function trackMetaEvent(eventName: string, params?: MetaParams) {
  if (typeof window === "undefined") return;
  const payload = withAttribution(params);

  if (!isPixelLoaded()) {
    if (isDev) console.warn("[MetaPixel] fbq nao encontrado:", eventName, payload);
    return;
  }

  window.fbq!("track", eventName, payload);

  if (isDev) {
    console.log("[MetaPixel] Evento padrao:", eventName, payload);
  }
}

export function trackMetaCustomEvent(eventName: string, params?: MetaParams) {
  if (typeof window === "undefined") return;
  const payload = withAttribution(params);

  if (!isPixelLoaded()) {
    if (isDev) console.warn("[MetaPixel] fbq nao encontrado:", eventName, payload);
    return;
  }

  window.fbq!("trackCustom", eventName, payload);

  if (isDev) {
    console.log("[MetaPixel] Evento customizado:", eventName, payload);
  }
}

export function trackOnce(key: string, callback: () => void) {
  if (trackedEvents.has(key)) return;
  trackedEvents.add(key);
  callback();
}

export function trackPageView() {
  trackMetaEvent("PageView");
}

export function trackViewContent(params: MetaParams = {}) {
  trackMetaEvent("ViewContent", params);
}

export function trackLead(params: MetaParams = {}) {
  trackMetaEvent("Lead", params);
}

export function trackInitiateCheckout(params: MetaParams = {}) {
  trackMetaEvent("InitiateCheckout", params);
}

export function trackAddPaymentInfo(params: MetaParams = {}) {
  trackMetaEvent("AddPaymentInfo", params);
}

export function trackPurchase(params: MetaParams = {}) {
  trackMetaEvent("Purchase", params);
}

export function trackCompleteRegistration(params: MetaParams = {}) {
  trackMetaEvent("CompleteRegistration", params);
}

export function trackExitIntent(params: MetaParams = {}) {
  trackMetaCustomEvent("ExitIntent", params);
}

export function trackScrollDepth(params: MetaParams = {}) {
  trackMetaCustomEvent("ScrollDepth", params);
}
