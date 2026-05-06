import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_LEADS_LIMIT, isAdminEmail } from "@/config/admin";

const FREE_PLAN_LIMIT = 20;

interface SubscriptionInfo {
  plan_name: string;
  leads_limit: number;
  leads_used: number;
  leads_remaining: number;
  billing_period_end: string;
  is_admin?: boolean;
  usa_addon?: boolean;
  usa_addon_active_until?: string | null;
  buscas_saldo?: number;
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

const starterFallback = (isAdmin: boolean, saldo = 0): SubscriptionInfo => {
  if (isAdmin) {
    return {
      plan_name: "admin",
      leads_limit: -1,
      leads_used: 0,
      leads_remaining: ADMIN_LEADS_LIMIT,
      billing_period_end: defaultPeriodEnd(),
      is_admin: true,
      usa_addon: true,
      usa_addon_active_until: null,
      buscas_saldo: ADMIN_LEADS_LIMIT,
    };
  }

  return {
    plan_name: "free",
    leads_limit: FREE_PLAN_LIMIT,
    leads_used: 0,
    leads_remaining: FREE_PLAN_LIMIT + Math.max(0, saldo),
    billing_period_end: defaultPeriodEnd(),
    is_admin: false,
    usa_addon: false,
    usa_addon_active_until: null,
    buscas_saldo: Math.max(0, saldo),
  };
};

export const useSubscription = (): UseSubscriptionReturn => {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const ensureProfile = useCallback(async (user: any, admin: boolean) => {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("buscas_saldo")
      .eq("id", user.id)
      .maybeSingle();

    if (!profileData && !profileError) {
      await supabase.from("profiles").insert({
        id: user.id,
        nome_completo: user.user_metadata?.full_name || user.user_metadata?.name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        buscas_saldo: admin ? ADMIN_LEADS_LIMIT : 0,
      });

      return admin ? ADMIN_LEADS_LIMIT : 0;
    }

    if (admin && (profileData?.buscas_saldo ?? 0) < ADMIN_LEADS_LIMIT) {
      await supabase
        .from("profiles")
        .update({ buscas_saldo: ADMIN_LEADS_LIMIT })
        .eq("id", user.id);
      return ADMIN_LEADS_LIMIT;
    }

    return profileData?.buscas_saldo ?? (admin ? ADMIN_LEADS_LIMIT : 0);
  }, []);

  const fetchSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSubscription(null);
        setIsAdmin(false);
        return;
      }

      const emailAdmin = isAdminEmail(user.email);
      const { data: adminCheck, error: adminError } = await supabase
        .rpc("is_admin", { _user_id: user.id });

      const admin = emailAdmin || adminCheck === true;
      setIsAdmin(admin);

      if (adminError && !emailAdmin) {
        console.warn("Erro ao verificar admin:", adminError.message);
      }

      const saldo = await ensureProfile(user, admin);

      const { data, error: fetchError } = await supabase
        .rpc("get_subscription_info", { p_user_id: user.id });

      const { data: subData } = await supabase
        .from("user_subscriptions")
        .select("usa_addon, usa_addon_active_until")
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) {
        console.error("Erro ao buscar assinatura via RPC:", fetchError);
        setError(fetchError.message);
        setSubscription(starterFallback(admin, saldo));
        return;
      }

      const subInfo = data?.[0];
      if (!subInfo) {
        setSubscription(starterFallback(admin, saldo));
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
          buscas_saldo: ADMIN_LEADS_LIMIT,
        });
        return;
      }

      const planRemaining = subInfo.leads_limit === -1
        ? ADMIN_LEADS_LIMIT
        : Math.max(0, subInfo.leads_remaining ?? 0);
      const bonusSaldo = Math.max(0, saldo ?? 0);
      const effectiveRemaining = planRemaining + bonusSaldo;

      setSubscription({
        ...subInfo,
        leads_limit: subInfo.leads_limit === 0 ? FREE_PLAN_LIMIT : subInfo.leads_limit,
        leads_remaining: effectiveRemaining,
        is_admin: false,
        usa_addon: subData?.usa_addon ?? false,
        usa_addon_active_until: subData?.usa_addon_active_until ?? null,
        buscas_saldo: bonusSaldo,
      });
    } catch (err: any) {
      console.error("Erro ao buscar assinatura:", err);
      setError(err.message);
      setSubscription(starterFallback(false));
    } finally {
      setLoading(false);
    }
  }, [ensureProfile]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const canUseLeads = useCallback((count: number): boolean => {
    if (loading) return true;
    if (isAdmin) return true;
    if (!subscription) return true;
    if (subscription.leads_limit === -1) return true;
    return subscription.leads_remaining >= Math.max(1, count);
  }, [subscription, isAdmin, loading]);

  const incrementLeadsUsed = useCallback(async (count: number): Promise<boolean> => {
    try {
      if (count <= 0) return true;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const admin = isAdmin || isAdminEmail(user.email);

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
      starter: "Começar",
      pro: "Pro",
      agencia: "Agencia",
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
    if (!subscription.usa_addon) return false;
    if (!subscription.usa_addon_active_until) return false;
    return new Date(subscription.usa_addon_active_until) > new Date();
  }, [subscription])();

  const canUseUsaProspecting = useCallback((): boolean => {
    if (isAdmin) return true;
    if (!subscription) return false;
    if (subscription.plan_name === "agencia") return true;
    if (subscription.plan_name !== "starter") return hasUsaAddon;
    return false;
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
