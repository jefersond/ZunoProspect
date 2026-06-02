import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isAdminUser } from "@/config/admin";
import { useAuth } from "@/hooks/useAuth";

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
  const isFetchingRef = useRef(false);
  const { user, loading: authLoading } = useAuth();

  const fetchUsage = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (user && isAdminUser(user)) {
      setUsage({
        plan_name: "admin",
        leads_limit: 999999,
        leads_used: 0,
        leads_remaining: 999999,
        ai_limit: 999999,
        ai_used: 0,
        ai_remaining: 999999,
        ai_available_total: 999999,
        leads_bonus_balance: 999999,
        leads_available_total: 999999,
        billing_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_admin: true,
      });
      setLoading(false);
      isFetchingRef.current = false;
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (!user) {
        setUsage(DEFAULT_USAGE);
        setLoading(false);
        isFetchingRef.current = false;
        return;
      }

      // Executa consulta RPC e tenta ler direto do banco em paralelo para maior tolerância a falhas
      const [usageResponse, subResponse] = await Promise.all([
        supabase.rpc("get_current_user_usage", {}).catch(err => {
          console.warn("[useUsage] RPC get_current_user_usage falhou:", err);
          return { data: null, error: err };
        }),
        supabase
          .from("user_subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle()
      ]);

      const { data: usageData, error: usageError } = usageResponse;
      const { data: directSub } = subResponse;

      // Se ambos falharem de verdade
      if (usageError && !directSub) {
        throw usageError || new Error("Falha ao recuperar assinatura direta");
      }

      let planName = "free";
      let leadsLimit = 20;
      let aiLimit = 3;
      let leadsUsed = 0;
      let aiUsed = 0;
      let leadsBonus = 0;
      let billingPeriodEnd = DEFAULT_USAGE.billing_period_end;
      let isAdmin = false;

      // Mapeamento e limites oficiais
      const limitsMap = {
        free: { leads_limit: 20, ai_limit: 3 },
        starter: { leads_limit: 300, ai_limit: 30 },
        pro: { leads_limit: 800, ai_limit: 100 },
        agency: { leads_limit: 2000, ai_limit: 300 },
        admin: { leads_limit: 999999, ai_limit: 999999 }
      };

      const normalizeName = (name: string) => {
        const lowerName = String(name || "").trim().toLowerCase();
        if (lowerName === "iniciante" || lowerName === "starter" || lowerName === "basic") return "starter";
        if (lowerName === "agency" || lowerName === "agencia" || lowerName === "agência") return "agency";
        if (lowerName === "pro") return "pro";
        if (lowerName === "admin") return "admin";
        return "free";
      };

      const isSubActive = directSub && ["active", "trialing"].includes(directSub.subscription_status?.toLowerCase());

      if (directSub) {
        planName = normalizeName(directSub.plan_name);
        leadsUsed = directSub.leads_used_this_month ?? 0;
        aiUsed = directSub.ai_used_this_month ?? 0;
        billingPeriodEnd = directSub.billing_period_end || directSub.current_period_end || billingPeriodEnd;

        // Se a assinatura estiver cancelada/inativa, cai para free
        if (!isSubActive && planName !== "admin") {
          planName = "free";
        }

        const planLimits = limitsMap[planName as keyof typeof limitsMap] || limitsMap.free;
        leadsLimit = planLimits.leads_limit;
        aiLimit = planLimits.ai_limit;
      }

      const subInfo = usageData?.[0];
      if (subInfo) {
        const rpcPlan = normalizeName(subInfo.plan || subInfo.plan_name);
        // Só aceita o plano da RPC se a assinatura direta não disser que está cancelada
        if (!directSub || isSubActive || rpcPlan === "admin") {
          planName = rpcPlan;
          leadsLimit = subInfo.leads_limit || leadsLimit;
          aiLimit = subInfo.ai_limit || aiLimit;
        }
        leadsUsed = subInfo.leads_used ?? leadsUsed;
        aiUsed = subInfo.ai_used ?? aiUsed;
        leadsBonus = subInfo.leads_bonus_balance ?? leadsBonus;
        billingPeriodEnd = subInfo.billing_period_end || billingPeriodEnd;
        isAdmin = subInfo.is_admin || isAdmin;
      }

      // Se for admin
      if (isAdmin || planName === "admin") {
        setUsage({
          plan_name: "admin",
          leads_limit: 999999,
          leads_used: 0,
          leads_remaining: 999999,
          ai_limit: 999999,
          ai_used: 0,
          ai_remaining: 999999,
          ai_available_total: 999999,
          leads_bonus_balance: 999999,
          leads_available_total: 999999,
          billing_period_end: billingPeriodEnd,
          is_admin: true,
        });
        return;
      }

      // Garantir limites oficiais
      const limits = limitsMap[planName as keyof typeof limitsMap] || limitsMap.free;
      const finalLeadsLimit = leadsLimit || limits.leads_limit;
      const finalAiLimit = aiLimit || limits.ai_limit;

      const leadsRemaining = Math.max(0, finalLeadsLimit - leadsUsed);
      const aiRemaining = Math.max(0, finalAiLimit - aiUsed);
      const bonusSaldo = Math.max(0, leadsBonus);
      const effectiveRemaining = leadsRemaining + bonusSaldo;

      setUsage({
        plan_name: planName,
        leads_limit: finalLeadsLimit,
        leads_used: leadsUsed,
        leads_remaining: leadsRemaining,
        ai_limit: finalAiLimit,
        ai_used: aiUsed,
        ai_remaining: aiRemaining,
        ai_available_total: aiRemaining,
        leads_bonus_balance: bonusSaldo,
        leads_available_total: effectiveRemaining,
        billing_period_end: billingPeriodEnd,
        is_admin: false,
      });

    } catch (err: any) {
      console.error("Erro ao buscar uso do plano:", err);
      setError(err.message || "Erro ao buscar uso do plano");
      const isUserAdmin = user ? isAdminUser(user) : false;
      if (isUserAdmin) {
        setUsage({
          plan_name: "admin",
          leads_limit: 999999,
          leads_used: 0,
          leads_remaining: 999999,
          ai_limit: 999999,
          ai_used: 0,
          ai_remaining: 999999,
          ai_available_total: 999999,
          leads_bonus_balance: 999999,
          leads_available_total: 999999,
          billing_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          is_admin: true,
        });
      } else {
        setUsage(DEFAULT_USAGE);
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    // Se o auth ainda está carregando a sessão, mantemos o loading do plano ativo
    // e evitamos fazer requisições precoces ao Supabase
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user?.id) {
      setUsage(DEFAULT_USAGE);
      setLoading(false);
      return;
    }

    // Timeout de segurança contra carregamento infinito (máximo 8 segundos)
    const safetyTimeout = setTimeout(() => {
      setLoading((currLoading) => {
        if (currLoading) {
          console.warn("[useUsage] Timeout de 8s atingido. Forçando fim do loading.");
          setUsage((currUsage) => currUsage || DEFAULT_USAGE);
          return false;
        }
        return currLoading;
      });
    }, 8000);

    fetchUsage();

    return () => {
      clearTimeout(safetyTimeout);
    };
  }, [user?.id, authLoading, fetchUsage]);

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
