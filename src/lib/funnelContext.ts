import { supabase } from "@/integrations/supabase/client";

export type UsageLike = {
  plan_name?: string | null;
  plan?: string | null;
  leads_limit?: number | null;
  leads_used?: number | null;
  leads_remaining?: number | null;
  leads_available_total?: number | null;
  ai_limit?: number | null;
  ai_used?: number | null;
  ai_remaining?: number | null;
  ai_available_total?: number | null;
};

export type UpgradeSource =
  | "limit_reached"
  | "navbar"
  | "pricing_page"
  | "dashboard"
  | "after_search"
  | "after_ai_analysis"
  | "modal_upgrade"
  | "usage_card"
  | "checkout_page"
  | "unknown";

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function storageHasPrefix(prefix: string) {
  if (typeof window === "undefined") return false;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

export async function getFunnelContext(usage?: UsageLike | null, source: UpgradeSource = "unknown") {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id || null;
  const plan = String(usage?.plan_name || usage?.plan || "free").toLowerCase();
  const leadsLimit = safeNumber(usage?.leads_limit, plan === "free" ? 20 : 0);
  const leadsUsed = safeNumber(usage?.leads_used);
  const aiLimit = safeNumber(usage?.ai_limit, plan === "free" ? 3 : 0);
  const aiUsed = safeNumber(usage?.ai_used);
  const currentLeadsAvailable = safeNumber(
    usage?.leads_available_total ?? usage?.leads_remaining,
    Math.max(0, leadsLimit - leadsUsed),
  );
  const currentAiAvailable = safeNumber(
    usage?.ai_available_total ?? usage?.ai_remaining,
    Math.max(0, aiLimit - aiUsed),
  );

  const hasFirstSearchMarker = userId
    ? Boolean(localStorage.getItem(`zuno_first_search_completed_${userId}`))
    : storageHasPrefix("zuno_first_search_completed_");
  const hasFirstAiMarker = userId
    ? Boolean(localStorage.getItem(`zuno_first_ai_analysis_completed_${userId}`))
    : storageHasPrefix("zuno_first_ai_analysis_completed_");

  return {
    source,
    user_plan: plan,
    user_plan_before_checkout: plan,
    current_leads_available: currentLeadsAvailable,
    current_ai_available: currentAiAvailable,
    leads_used: leadsUsed,
    leads_limit: leadsLimit,
    ai_used: aiUsed,
    ai_limit: aiLimit,
    has_done_first_search: hasFirstSearchMarker || leadsUsed > 0,
    has_done_first_ai_analysis: hasFirstAiMarker || aiUsed > 0,
    path: typeof window === "undefined" ? null : window.location.pathname,
  };
}
