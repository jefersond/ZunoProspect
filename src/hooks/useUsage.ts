import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isAdminUser } from "@/config/admin";

export type UsageInfo = {
  plan_name: string;
  leads_limit: number;
  leads_used: number;
  leads_remaining: number;
  ai_limit: number;
  ai_used: number;
  ai_remaining: number;
  ai_available_total: number;
  leads_bonus_balance: number;
  leads_available_total: number;
  billing_period_end: string;
  is_admin: boolean;
};

type UseUsageReturn = {
  usage: UsageInfo;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  canSearchLeads: boolean;
  canAnalyzeAI: boolean;
  leadsRemaining: number;
  aiRemaining: number;
  leadsBonusBalance: number;
  leadsAvailableTotal: number;
  isAdmin: boolean;
};

const DEFAULT_USAGE: UsageInfo = {
  plan_name: "free",
  leads_limit: 20,
  leads_used: 0,
  leads_remaining: 20,
  ai_limit: 3,
  ai_used: 0,
  ai_remaining: 3,
  ai_available_total: 3,
  leads_bonus_balance: 0,
  leads_available_total: 20,
  billing_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  is_admin: false,
};

function asSafeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeUsage(raw: Partial<UsageInfo> | null | undefined, email?: string | null): UsageInfo {
  const isAdmin = isAdminUser({ email }, { is_admin: raw?.is_admin === true });

  if (isAdmin) {
    return {
      ...DEFAULT_USAGE,
      ...raw,
      plan_name: "admin",
      leads_limit: 999999,
      leads_used: asSafeNumber(raw?.leads_used),
      leads_remaining: 999999,
      ai_limit: 999999,
      ai_used: asSafeNumber(raw?.ai_used),
      ai_remaining: 999999,
      ai_available_total: 999999,
      leads_bonus_balance: 999999,
      leads_available_total: 999999,
      billing_period_end: raw?.billing_period_end || DEFAULT_USAGE.billing_period_end,
      is_admin: true,
    };
  }

  const leadsLimit = Math.max(0, asSafeNumber(raw?.leads_limit, DEFAULT_USAGE.leads_limit));
  const leadsUsed = Math.max(0, asSafeNumber(raw?.leads_used));
  const leadsRemaining = Math.max(0, asSafeNumber(raw?.leads_remaining, leadsLimit - leadsUsed));
  const aiLimit = Math.max(0, asSafeNumber(raw?.ai_limit, DEFAULT_USAGE.ai_limit));
  const aiUsed = Math.max(0, asSafeNumber(raw?.ai_used));
  const aiRemaining = Math.max(0, asSafeNumber(raw?.ai_remaining ?? raw?.ai_available_total, aiLimit - aiUsed));
  const leadsBonusBalance = Math.max(0, asSafeNumber(raw?.leads_bonus_balance));
  const leadsAvailableTotal = Math.max(
    0,
    asSafeNumber(raw?.leads_available_total, leadsRemaining + leadsBonusBalance),
  );

  return {
    plan_name: raw?.plan_name || DEFAULT_USAGE.plan_name,
    leads_limit: leadsLimit,
    leads_used: leadsUsed,
    leads_remaining: leadsRemaining,
    ai_limit: aiLimit,
    ai_used: aiUsed,
    ai_remaining: aiRemaining,
    ai_available_total: aiRemaining,
    leads_bonus_balance: leadsBonusBalance,
    leads_available_total: leadsAvailableTotal,
    billing_period_end: raw?.billing_period_end || DEFAULT_USAGE.billing_period_end,
    is_admin: false,
  };
}

export function useUsage(): UseUsageReturn {
  const [usage, setUsage] = useState<UsageInfo>(DEFAULT_USAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUsage(DEFAULT_USAGE);
        return;
      }

      const { data, error: usageError } = await supabase.rpc("get_current_user_usage", {});

      if (usageError) throw usageError;

      const currentUsage = data?.[0]
        ? { ...data[0], plan_name: data[0].plan, ai_remaining: data[0].ai_available_total }
        : null;
      setUsage(normalizeUsage(currentUsage, user.email));
    } catch (err: any) {
      console.error("Erro ao buscar uso do plano:", err);
      setError(err.message || "Erro ao buscar uso do plano");
      setUsage(DEFAULT_USAGE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const derived = useMemo(() => {
    const isAdmin = usage.is_admin || usage.leads_limit >= 999999 || usage.ai_limit >= 999999;
    const leadsRemaining = isAdmin ? 999999 : Math.max(0, usage.leads_remaining);
    const aiRemaining = isAdmin ? 999999 : Math.max(0, usage.ai_remaining);
    const leadsAvailableTotal = isAdmin ? 999999 : Math.max(0, usage.leads_available_total);

    return {
      isAdmin,
      leadsRemaining,
      aiRemaining,
      leadsAvailableTotal,
      canSearchLeads: isAdmin || leadsAvailableTotal > 0,
      canAnalyzeAI: isAdmin || aiRemaining > 0,
      leadsBonusBalance: isAdmin ? 999999 : Math.max(0, usage.leads_bonus_balance),
    };
  }, [usage]);

  return {
    usage,
    loading,
    error,
    refetch: fetchUsage,
    canSearchLeads: derived.canSearchLeads,
    canAnalyzeAI: derived.canAnalyzeAI,
    leadsRemaining: derived.leadsRemaining,
    aiRemaining: derived.aiRemaining,
    leadsBonusBalance: derived.leadsBonusBalance,
    leadsAvailableTotal: derived.leadsAvailableTotal,
    isAdmin: derived.isAdmin,
  };
}
