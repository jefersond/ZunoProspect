import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_LEADS_LIMIT, isAdminEmail, isAdminUser } from "@/config/admin";
import { useAuth } from "@/hooks/useAuth";

const FREE_PLAN_LIMIT = 20;

interface SubscriptionInfo {
  plan?: string;
  plan_name: string;
  leads_limit: number;
  leads_used: number;
  leads_remaining: number;
  billing_period_end: string;
  ai_limit?: number;
  ai_used?: number;
  ai_remaining?: number;
  ai_available_total?: number;
  is_admin?: boolean;
  usa_addon?: boolean;
  usa_addon_active_until?: string | null;
  us_prospecting_addon_status?: string | null;
  leads_bonus_balance?: number;
  leads_available_total?: number;
}

interface UseSubscriptionReturn {
  subscription: SubscriptionInfo | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  refetch: () => Promise<void>;
  canUseLeads: (count: number) => boolean;
  incrementLeadsUsed: (count: number) => Promise<boolean>;
  getPlanDisplayName: () => string;
  getUsagePercentage: () => number;
  hasUsaAddon: boolean;
  canUseUsaProspecting: () => boolean;
}

const defaultPeriodEnd = () =>
  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

const starterFallback = (isAdmin: boolean): SubscriptionInfo => {
  if (isAdmin) {
    return {
      plan_name: "admin",
      leads_limit: -1,
      leads_used: 0,
      leads_remaining: ADMIN_LEADS_LIMIT,
      ai_limit: ADMIN_LEADS_LIMIT,
      ai_used: 0,
      ai_remaining: ADMIN_LEADS_LIMIT,
      ai_available_total: ADMIN_LEADS_LIMIT,
      billing_period_end: defaultPeriodEnd(),
      is_admin: true,
      usa_addon: true,
      usa_addon_active_until: null,
      us_prospecting_addon_status: "active",
      leads_bonus_balance: ADMIN_LEADS_LIMIT,
      leads_available_total: ADMIN_LEADS_LIMIT,
    };
  }

  return {
    plan_name: "free",
    leads_limit: FREE_PLAN_LIMIT,
    leads_used: 0,
    leads_remaining: FREE_PLAN_LIMIT,
    ai_limit: 3,
    ai_used: 0,
    ai_remaining: 3,
    ai_available_total: 3,
    billing_period_end: defaultPeriodEnd(),
    is_admin: false,
    usa_addon: false,
    usa_addon_active_until: null,
    us_prospecting_addon_status: null,
    leads_bonus_balance: 0,
    leads_available_total: FREE_PLAN_LIMIT,
  };
};

export const useSubscription = (): UseSubscriptionReturn => {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const isFetchingRef = useRef(false);
  const { user } = useAuth();

  const fetchSubscription = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (user && isAdminUser(user)) {
      setSubscription({
        plan_name: "admin",
        leads_limit: -1,
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
        supabase.rpc("get_current_user_usage", {}),
        supabase
          .from("user_subscriptions")
          .select("usa_addon, usa_addon_active_until")
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
      const { data, error: fetchError } = usageResponse;
      const { data: subData } = subResponse;
      const { data: addonData, error: addonError } = addonResponse;

      const admin = isAdminUser(user, { is_admin: adminCheck === true });
      setIsAdmin(admin);

      if (adminError && !isAdminEmail(user.email)) {
        console.warn("Erro ao verificar admin:", adminError.message);
      }

      if (addonError) {
        console.warn("Erro ao buscar add-on EUA:", addonError.message);
      }

      if (fetchError) {
        console.error("Erro ao buscar assinatura via RPC:", fetchError);
        setError(fetchError.message);
        setSubscription(starterFallback(admin));
        return;
      }

      const subInfo = data?.[0];
      if (!subInfo) {
        setSubscription(starterFallback(admin));
        return;
      }

      if (admin) {
        setSubscription({
          ...subInfo,
          plan_name: "admin",
          leads_limit: -1,
          leads_remaining: ADMIN_LEADS_LIMIT,
          is_admin: true,
          usa_addon: true,
          usa_addon_active_until: subData?.usa_addon_active_until ?? null,
          us_prospecting_addon_status: "active",
          ai_limit: ADMIN_LEADS_LIMIT,
          ai_used: 0,
          ai_remaining: ADMIN_LEADS_LIMIT,
          ai_available_total: ADMIN_LEADS_LIMIT,
          leads_bonus_balance: ADMIN_LEADS_LIMIT,
          leads_available_total: ADMIN_LEADS_LIMIT,
        });
        return;
      }

      const planRemaining = subInfo.leads_limit === -1
        ? ADMIN_LEADS_LIMIT
        : Math.max(0, (subInfo.leads_limit ?? FREE_PLAN_LIMIT) - (subInfo.leads_used ?? 0));
      const bonusSaldo = Math.max(0, subInfo.leads_bonus_balance ?? 0);
      const effectiveRemaining = Math.max(0, subInfo.leads_available_total ?? planRemaining + bonusSaldo);

      setSubscription({
        ...subInfo,
        plan_name: subInfo.plan ?? subInfo.plan_name ?? "free",
        leads_limit: subInfo.leads_limit === 0 ? FREE_PLAN_LIMIT : subInfo.leads_limit,
        leads_remaining: effectiveRemaining,
        ai_remaining: Math.max(0, subInfo.ai_available_total ?? subInfo.ai_remaining ?? 0),
        is_admin: false,
        usa_addon: addonData?.status === "active" || subData?.usa_addon === true,
        usa_addon_active_until: subData?.usa_addon_active_until ?? null,
        us_prospecting_addon_status: addonData?.status ?? null,
        leads_bonus_balance: bonusSaldo,
        leads_available_total: effectiveRemaining,
      });
    } catch (err: any) {
      console.error("Erro ao buscar assinatura:", err);
      setError(err.message);
      setSubscription(starterFallback(false));
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
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
  }, [user?.id, fetchSubscription]);

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

    if (subscription.plan_name === "pro") {
      if (subscription.leads_limit === 100) return "Iniciante";
      return "Pro";
    }

    const names: Record<string, string> = {
      free: "Free",
      iniciante: "Iniciante",
      starter: "Iniciante",
      pro: "Pro",
      agencia: "Agência",
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
