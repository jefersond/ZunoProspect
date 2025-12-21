import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionInfo {
  plan_name: string;
  leads_limit: number;
  leads_used: number;
  leads_remaining: number;
  billing_period_end: string;
  is_admin?: boolean;
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
            .insert({ user_id: user.id, plan_name: 'starter', leads_limit: 10 })
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
          });
          return;
        }
        throw fetchError;
      }

      if (data && data.length > 0) {
        setSubscription({ ...data[0], is_admin: adminCheck === true });
      } else {
        // Cria assinatura padrão se não existir
        const { error: insertError } = await supabase
          .from('user_subscriptions')
          .insert({ user_id: user.id, plan_name: 'starter', leads_limit: 10 });

        if (insertError && insertError.code !== '23505') { // Ignora erro de duplicidade
          throw insertError;
        }
        
        setSubscription({
          plan_name: 'starter',
          leads_limit: 10,
          leads_used: 0,
          leads_remaining: 10,
          billing_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          is_admin: adminCheck === true,
        });
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

      const { data, error } = await supabase
        .rpc('increment_leads_used', { p_user_id: user.id, p_count: count });

      if (error) throw error;

      // Atualiza o estado local
      if (data === true) {
        await fetchSubscription();
        return true;
      }
      return false;
    } catch (err: any) {
      console.error("Erro ao incrementar leads usados:", err);
      return false;
    }
  }, [fetchSubscription]);

  const getPlanDisplayName = useCallback((): string => {
    if (!subscription) return "Carregando...";
    if (isAdmin) return "Admin (Ilimitado)";
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
  };
};
