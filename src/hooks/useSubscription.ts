import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionInfo {
  plan_name: string;
  leads_limit: number;
  leads_used: number;
  leads_remaining: number;
  billing_period_end: string;
  is_admin?: boolean;
  usa_addon?: boolean;
  usa_addon_active_until?: string | null;
  buscas_saldo?: number; // Novo campo da tabela profiles
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

export const useSubscription = (): UseSubscriptionReturn => {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

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

      // Verifica se é admin
      const { data: adminCheck } = await supabase
        .rpc('is_admin', { _user_id: user.id });
      
      setIsAdmin(adminCheck === true);

      // Usa a função RPC para obter info da assinatura
      const { data, error: fetchError } = await supabase
        .rpc('get_subscription_info', { p_user_id: user.id });

      if (fetchError) {
        // Se não encontrar, cria assinatura padrão
        if (fetchError.code === 'PGRST116') {
          const { data: newSub, error: insertError } = await supabase
            .from('user_subscriptions')
            .insert({ user_id: user.id, plan_name: 'starter', leads_limit: 30 })
            .select()
            .single();

          if (insertError) throw insertError;
          
          setSubscription({
            plan_name: 'starter',
            leads_limit: 10,
            leads_used: 0,
            leads_remaining: 10,
            billing_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            is_admin: adminCheck === true,
            usa_addon: false,
            usa_addon_active_until: null,
          });
          return;
        }
        throw fetchError;
      }

      if (data && data.length > 0) {
        // Fetch additional info from profiles and user_subscriptions
        const { data: profileData } = await supabase
          .from('profiles')
          .select('buscas_saldo')
          .eq('id', user.id)
          .single();

        const { data: subData } = await supabase
          .from('user_subscriptions')
          .select('usa_addon, usa_addon_active_until')
          .eq('user_id', user.id)
          .single();

        const subInfo = data[0];
        const saldo = profileData?.buscas_saldo ?? 0;

        // Se for plano starter, o limite real é o buscas_saldo
        const isStarter = subInfo.plan_name === 'starter';
        
        setSubscription({ 
          ...subInfo,
          leads_limit: isStarter ? Math.max(subInfo.leads_limit, saldo + subInfo.leads_used) : subInfo.leads_limit,
          leads_remaining: isStarter ? saldo : subInfo.leads_remaining,
          is_admin: adminCheck === true,
          usa_addon: subData?.usa_addon ?? false,
          usa_addon_active_until: subData?.usa_addon_active_until ?? null,
          buscas_saldo: saldo
        });
      } else {
        // ... fallback logic if needed
      }
    } catch (err: any) {
      console.error("Erro ao buscar assinatura:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const canUseLeads = useCallback((count: number): boolean => {
    if (isAdmin) return true; // Admin tem acesso ilimitado
    if (!subscription) return false;
    if (subscription.leads_limit === -1) return true; // Ilimitado
    return subscription.leads_remaining >= count;
  }, [subscription, isAdmin]);

  const incrementLeadsUsed = useCallback(async (count: number): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // 1. Desconta do saldo do perfil (buscas_saldo)
      const { data: profile } = await supabase
        .from('profiles')
        .select('buscas_saldo')
        .eq('id', user.id)
        .single();

      if (profile) {
        const novoSaldo = Math.max(0, (profile.buscas_saldo || 0) - count);
        await supabase
          .from('profiles')
          .update({ buscas_saldo: novoSaldo })
          .eq('id', user.id);
      }

      // 2. Incrementa o contador da assinatura também (para histórico)
      const { data, error } = await supabase
        .rpc('increment_leads_used', { p_user_id: user.id, p_count: count });

      if (error) throw error;

      await fetchSubscription();
      return true;
    } catch (err: any) {
      console.error("Erro ao incrementar leads usados:", err);
      return false;
    }
  }, [fetchSubscription]);

  const getPlanDisplayName = useCallback((): string => {
    if (!subscription) return "Carregando...";
    if (isAdmin) return "Admin (Ilimitado)";
    
    // Mapeamento: plan_name no banco -> nome exibido
    // O plano "Iniciante" é armazenado como "pro" com 100 leads
    // O plano "Pro" é armazenado como "pro" com 200 leads
    if (subscription.plan_name === "pro") {
      if (subscription.leads_limit === 100) {
        return "Iniciante";
      }
      return "Pro";
    }
    
    const names: Record<string, string> = {
      starter: "Starter (Gratuito)",
      iniciante: "Iniciante",
      pro: "Pro",
      agencia: "Agência",
    };
    return names[subscription.plan_name] || subscription.plan_name;
  }, [subscription, isAdmin]);

  const getUsagePercentage = useCallback((): number => {
    if (isAdmin) return 0; // Admin não tem limite
    if (!subscription) return 0;
    if (subscription.leads_limit === -1) return 0; // Ilimitado
    if (subscription.leads_limit === 0) return 100;
    return Math.round((subscription.leads_used / subscription.leads_limit) * 100);
  }, [subscription, isAdmin]);

  // Check if USA add-on is active
  const hasUsaAddon = useCallback((): boolean => {
    if (!subscription) return false;
    if (!subscription.usa_addon) return false;
    if (!subscription.usa_addon_active_until) return false;
    return new Date(subscription.usa_addon_active_until) > new Date();
  }, [subscription])();

  // Check if user can use USA prospecting
  const canUseUsaProspecting = useCallback((): boolean => {
    if (isAdmin) return true;
    if (!subscription) return false;
    // Agency plan has USA included
    if (subscription.plan_name === 'agencia') return true;
    // Paid plans (pro, iniciante) need add-on - starter cannot use
    if (subscription.plan_name !== 'starter') {
      return hasUsaAddon;
    }
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
