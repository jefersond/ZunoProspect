import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_LEADS_LIMIT, isAdminEmail, isAdminUser } from "@/config/admin";
import { useAuth } from "@/hooks/useAuth";

export const PLAN_LIMITS = {
  free: { leads_limit: 20, ai_limit: 3 },
  starter: { leads_limit: 300, ai_limit: 30 },
  pro: { leads_limit: 800, ai_limit: 100 },
  agency: { leads_limit: 2000, ai_limit: 300 },
  admin: { leads_limit: 999999, ai_limit: 999999 }
} as const;

export function normalizePlanName(value: unknown): string {
  const key = String(value || "").trim().toLowerCase();

  if (key === "iniciante" || key === "starter" || key === "basic") return "starter";
  if (key === "agency" || key === "agencia" || key === "agência") return "agency";
  if (key === "pro") return "pro";
  if (key === "admin") return "admin";
  return "free";
}

const starterFallback = (isAdmin: boolean): SubscriptionInfo => {
  if (isAdmin) {
    return {
      plan_name: "admin",
      leads_limit: 999999,
      leads_used: 0,
      leads_remaining: 999999,
      ai_limit: 999999,
      ai_used: 0,
      ai_remaining: 999999,
      ai_available_total: 999999,
      billing_period_end: defaultPeriodEnd(),
      is_admin: true,
      usa_addon: true,
      usa_addon_active_until: null,
      us_prospecting_addon_status: "active",
      leads_bonus_balance: 999999,
      leads_available_total: 999999,
    };
  }

  const limits = PLAN_LIMITS.free;
  return {
    plan_name: "free",
    leads_limit: limits.leads_limit,
    leads_used: 0,
    leads_remaining: limits.leads_limit,
    ai_limit: limits.ai_limit,
    ai_used: 0,
    ai_remaining: limits.ai_limit,
    ai_available_total: limits.ai_limit,
    billing_period_end: defaultPeriodEnd(),
    is_admin: false,
    usa_addon: false,
    usa_addon_active_until: null,
    us_prospecting_addon_status: null,
    leads_bonus_balance: 0,
    leads_available_total: limits.leads_limit,
  };
};

export const useSubscription = (): UseSubscriptionReturn => {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const isFetchingRef = useRef(false);
  const { user, loading: authLoading } = useAuth();

  const fetchSubscription = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (user && isAdminUser(user)) {
      setSubscription({
        plan_name: "admin",
        leads_limit: 999999,
        leads_used: 0,
        leads_remaining: 999999,
        ai_limit: 999999,
        ai_used: 0,
        ai_remaining: 999999,
        ai_available_total: 999999,
        billing_period_end: defaultPeriodEnd(),
        is_admin: true,
        usa_addon: true,
        usa_addon_active_until: null,
        us_prospecting_addon_status: "active",
        leads_bonus_balance: 999999,
        leads_available_total: 999999,
      });
      setIsAdmin(true);
      setLoading(false);
      isFetchingRef.current = false;
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (!user) {
        setSubscription(null);
        setIsAdmin(false);
        setLoading(false);
        isFetchingRef.current = false;
        return;
      }

      // Executa todas as consultas de dados em paralelo para maxima performance
      const [
        adminResponse,
        usageResponse,
        subResponse,
        addonResponse
      ] = await Promise.all([
        supabase.rpc("is_admin", { _user_id: user.id }),
        supabase.rpc("get_current_user_usage", {}).catch(err => {
          console.warn("[useSubscription] RPC get_current_user_usage falhou:", err);
          return { data: null, error: err };
        }),
        supabase
          .from("user_subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_addons")
          .select("status")
          .eq("user_id", user.id)
          .eq("addon_id", "us_prospecting")
          .maybeSingle()
      ]);

      const { data: adminCheck, error: adminError } = adminResponse;
      const { data: usageData, error: fetchError } = usageResponse;
      const { data: directSub } = subResponse;
      const { data: addonData, error: addonError } = addonResponse;

      const admin = isAdminUser(user, { is_admin: adminCheck === true });
      setIsAdmin(admin);

      if (adminError && !isAdminEmail(user.email)) {
        console.warn("Erro ao verificar admin:", adminError.message);
      }

      if (addonError) {
        console.warn("Erro ao buscar add-on EUA:", addonError.message);
      }

      // RESOLVER PLANO CONFORME REGRA 3 E 4
      let rawPlanName = "free";
      let billingEnd = defaultPeriodEnd();
      let leadsUsed = 0;
      let aiUsed = 0;
      let leadsBonus = 0;

      // Verificar se existe assinatura ativa/trialing em user_subscriptions
      const isSubActive = directSub && ["active", "trialing"].includes(directSub.subscription_status?.toLowerCase());

      if (directSub) {
        rawPlanName = directSub.plan_name || "free";
        billingEnd = directSub.billing_period_end || directSub.current_period_end || defaultPeriodEnd();
        leadsUsed = directSub.leads_used_this_month ?? 0;
        aiUsed = directSub.ai_used_this_month ?? 0;
      }

      // Se a RPC de uso retornou dados, enriquecemos as variáveis
      const subInfo = usageData?.[0];
      if (subInfo) {
        rawPlanName = subInfo.plan || subInfo.plan_name || rawPlanName;
        leadsUsed = subInfo.leads_used ?? leadsUsed;
        aiUsed = subInfo.ai_used ?? aiUsed;
        leadsBonus = subInfo.leads_bonus_balance ?? leadsBonus;
        billingEnd = subInfo.billing_period_end || billingEnd;
      }

      // Regra 4: Normalização
      let normalizedPlan = normalizePlanName(rawPlanName);

      // Regra A/B: Se não existir assinatura ativa/trialing, reverte para Free
      // (a menos que seja admin)
      if (directSub && !isSubActive && normalizedPlan !== "free" && normalizedPlan !== "admin") {
        console.warn(`[useSubscription] Assinatura ${normalizedPlan} inativa (${directSub.subscription_status}). Revertendo para Free.`);
        normalizedPlan = "free";
      }

      // Regra 5: Limites oficiais
      const limits = PLAN_LIMITS[normalizedPlan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;

      if (admin) {
        setSubscription({
          plan_name: "admin",
          leads_limit: 999999,
          leads_used: 0,
          leads_remaining: 999999,
          ai_limit: 999999,
          ai_used: 0,
          ai_remaining: 999999,
          ai_available_total: 999999,
          billing_period_end: billingEnd,
          is_admin: true,
          usa_addon: true,
          usa_addon_active_until: directSub?.usa_addon_active_until ?? null,
          us_prospecting_addon_status: "active",
          leads_bonus_balance: 999999,
          leads_available_total: 999999,
        });
        return;
      }

      const planRemaining = Math.max(0, limits.leads_limit - leadsUsed);
      const bonusSaldo = Math.max(0, leadsBonus);
      const effectiveRemaining = planRemaining + bonusSaldo;

      setSubscription({
        plan_name: normalizedPlan,
        leads_limit: limits.leads_limit,
        leads_used: leadsUsed,
        leads_remaining: effectiveRemaining,
        ai_limit: limits.ai_limit,
        ai_used: aiUsed,
        ai_remaining: Math.max(0, limits.ai_limit - aiUsed),
        ai_available_total: Math.max(0, limits.ai_limit - aiUsed),
        billing_period_end: billingEnd,
        is_admin: false,
        usa_addon: addonData?.status === "active" || directSub?.usa_addon === true,
        usa_addon_active_until: directSub?.usa_addon_active_until ?? null,
        us_prospecting_addon_status: addonData?.status ?? null,
        leads_bonus_balance: bonusSaldo,
        leads_available_total: effectiveRemaining,
      });
    } catch (err: any) {
      console.error("Erro ao buscar assinatura:", err);
      setError(err.message);
      const isUserAdmin = user ? isAdminUser(user) : false;
      setSubscription(starterFallback(isUserAdmin));
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
      setSubscription(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    // Timeout de segurança contra carregamento infinito (máximo 8 segundos)
    const safetyTimeout = setTimeout(() => {
      setLoading((currLoading) => {
        if (currLoading) {
          console.warn("[useSubscription] Timeout de 8s atingido. Forçando fim do loading.");
          setSubscription((currSub) => currSub || starterFallback(false));
          return false;
        }
        return currLoading;
      });
    }, 8000);

    fetchSubscription();

    return () => {
      clearTimeout(safetyTimeout);
    };
  }, [user?.id, authLoading, fetchSubscription]);

  const canUseLeads = useCallback((count: number): boolean => {
    if (loading) return true;
    if (isAdmin) return true;
    if (!subscription) return true;
    if (subscription.leads_limit === -1) return true;
    return (subscription.leads_available_total ?? subscription.leads_remaining) >= Math.max(1, count);
  }, [subscription, isAdmin, loading]);

  const incrementLeadsUsed = useCallback(async (count: number): Promise<boolean> => {
    try {
      if (count <= 0) return true;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const admin = isAdmin || isAdminUser(user);
      if (admin) {
        await fetchSubscription();
        return true;
      }

      const { error: incrementError } = await supabase
        .rpc("increment_leads_used", { p_user_id: user.id, p_count: count });

      if (incrementError) throw incrementError;

      await fetchSubscription();
      return true;
    } catch (err: any) {
      console.error("Erro ao incrementar leads usados:", err);
      return false;
    }
  }, [fetchSubscription, isAdmin]);

  const getPlanDisplayName = useCallback((): string => {
    if (isAdmin) return "Admin (Ilimitado)";
    if (!subscription) return "Carregando...";

    const names: Record<string, string> = {
      free: "Free",
      iniciante: "Iniciante",
      starter: "Iniciante",
      pro: "Pro",
      agencia: "Agência",
      agency: "Agência",
      admin: "Admin (Ilimitado)",
    };
    return names[subscription.plan_name] || subscription.plan_name;
  }, [subscription, isAdmin]);

  const getUsagePercentage = useCallback((): number => {
    if (isAdmin) return 0;
    if (!subscription) return 0;
    if (subscription.leads_limit === -1) return 0;
    if (subscription.leads_limit <= 0) return 0;
    return Math.min(100, Math.round((subscription.leads_used / subscription.leads_limit) * 100));
  }, [subscription, isAdmin]);

  const hasUsaAddon = useCallback((): boolean => {
    if (!subscription) return false;
    if (subscription.us_prospecting_addon_status === "active") return true;
    if (!subscription.usa_addon) return false;
    if (!subscription.usa_addon_active_until) return true;
    return new Date(subscription.usa_addon_active_until) > new Date();
  }, [subscription])();

  const canUseUsaProspecting = useCallback((): boolean => {
    if (isAdmin) return true;
    return hasUsaAddon;
  }, [subscription, isAdmin, hasUsaAddon]);

  return {
    subscription,
    loading,
    error,
    isAdmin,
    refetch: fetchSubscription,
    canUseLeads,
    incrementLeadsUsed,
    getPlanDisplayName,
    getUsagePercentage,
    hasUsaAddon,
    canUseUsaProspecting,
  };
};
