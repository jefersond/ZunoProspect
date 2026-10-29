import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  CommercialGoalVersion,
  DailyPerformance,
  WeeklyPerformance,
  MonthlyPerformance,
  UserInteractionRecord,
} from "@/types/commercialPerformance";
import {
  DEFAULT_TIMEZONE,
  getLocalDateString,
} from "@/utils/timezoneDateUtils";
import {
  DEFAULT_GOAL_CONFIG,
  getActiveGoalForDate,
  createOrUpdateGoalVersion,
} from "@/utils/commercialGoalsManager";
import {
  calculateDailyPerformance,
  calculateWeeklyPerformance,
  calculateMonthlyPerformance,
} from "@/utils/commercialAggregator";
import type { LeadProspeccao } from "@/types/lead";
import { useToast } from "@/hooks/use-toast";

const LOCAL_STORAGE_GOALS_KEY = "zuno_commercial_goals_history";
const LOCAL_STORAGE_TZ_KEY = "zuno_commercial_timezone";

export interface UseCommercialPerformanceProps {
  leads?: LeadProspeccao[];
}

export function useCommercialPerformance({ leads = [] }: UseCommercialPerformanceProps = {}) {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [timezone, setTimezone] = useState<string>(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_TZ_KEY) || DEFAULT_TIMEZONE;
    } catch {
      return DEFAULT_TIMEZONE;
    }
  });

  const [goalsHistory, setGoalsHistory] = useState<CommercialGoalVersion[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_GOALS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn("Erro ao ler metas do localStorage:", e);
    }
    return [DEFAULT_GOAL_CONFIG];
  });

  const [interactions, setInteractions] = useState<UserInteractionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inicialização e sincronização do usuário
  useEffect(() => {
    let isMounted = true;

    async function initUser() {
      try {
        setLoading(true);
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser || !isMounted) return;

        setUser(authUser);

        // 1. Resolução do Fuso Horário
        const metaTz = authUser.user_metadata?.timezone;
        if (metaTz && typeof metaTz === "string") {
          setTimezone(metaTz);
          try {
            localStorage.setItem(LOCAL_STORAGE_TZ_KEY, metaTz);
          } catch {}
        }

        // 2. Resolução do Histórico de Metas
        const metaGoals = authUser.user_metadata?.commercial_goals_history;
        if (Array.isArray(metaGoals) && metaGoals.length > 0) {
          setGoalsHistory(metaGoals);
          try {
            localStorage.setItem(LOCAL_STORAGE_GOALS_KEY, JSON.stringify(metaGoals));
          } catch {}
        }

        // 3. Leitura segura do histórico de interações em public.interacoes
        await loadInteractions(authUser.id);
      } catch (err: any) {
        if (isMounted) {
          console.error("Erro ao inicializar metas comerciais:", err);
          setError(err.message || "Falha ao carregar dados de desempenho comercial");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadInteractions = useCallback(async (userId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from("interacoes")
        .select(`
          id,
          tipo,
          conteudo,
          data_interacao,
          lead_id,
          user_id,
          created_at
        `)
        .eq("user_id", userId)
        .order("data_interacao", { ascending: false });

      if (fetchError) throw fetchError;

      const formatted: UserInteractionRecord[] = (data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        lead_id: row.lead_id,
        tipo: row.tipo || "primeira_abordagem",
        conteudo: row.conteudo || "",
        data_interacao: row.data_interacao,
        created_at: row.created_at,
      }));

      setInteractions(formatted);
    } catch (err: any) {
      console.warn("Aviso ao carregar public.interacoes:", err.message);
      // Fallback gracioso caso a leitura falhe
    }
  }, []);

  // Metas vigentes para a data atual
  const todayStr = useMemo(() => getLocalDateString(new Date(), timezone), [timezone]);

  const activeGoal = useMemo(() => {
    return getActiveGoalForDate(goalsHistory, todayStr);
  }, [goalsHistory, todayStr]);

  // Cálculos reativos de desempenho
  const daily = useMemo<DailyPerformance>(() => {
    return calculateDailyPerformance(interactions, goalsHistory, leads, new Date(), timezone);
  }, [interactions, goalsHistory, leads, timezone]);

  const weekly = useMemo<WeeklyPerformance>(() => {
    return calculateWeeklyPerformance(interactions, goalsHistory, new Date(), timezone);
  }, [interactions, goalsHistory, timezone]);

  const monthly = useMemo<MonthlyPerformance>(() => {
    return calculateMonthlyPerformance(interactions, goalsHistory, leads, new Date(), timezone);
  }, [interactions, goalsHistory, leads, timezone]);

  /**
   * Salva novas metas comerciais.
   * Regra de Ouro: Registra prospectivamente na data de hoje sem sobrescrever histórico passado.
   */
  const saveGoals = useCallback(
    async (newGoals: {
      daily: number;
      weekly: number;
      monthly: number;
      workdays_per_week?: number;
    }) => {
      try {
        const updatedHistory = createOrUpdateGoalVersion(goalsHistory, newGoals, todayStr);
        setGoalsHistory(updatedHistory);

        try {
          localStorage.setItem(LOCAL_STORAGE_GOALS_KEY, JSON.stringify(updatedHistory));
        } catch {}

        if (user) {
          const { error: updateError } = await supabase.auth.updateUser({
            data: { commercial_goals_history: updatedHistory },
          });
          if (updateError) {
            console.warn("Aviso ao salvar histórico de metas no user_metadata:", updateError.message);
          }
        }

        toast({
          title: "Metas atualizadas com sucesso!",
          description: `Diária: ${newGoals.daily} | Semanal: ${newGoals.weekly} | Mensal: ${newGoals.monthly}`,
        });
        return true;
      } catch (err: any) {
        toast({
          title: "Erro ao salvar metas",
          description: err.message || "Tente novamente em instantes.",
          variant: "destructive",
        });
        return false;
      }
    },
    [goalsHistory, todayStr, user, toast]
  );

  /**
   * Atualiza o fuso horário comercial do usuário.
   */
  const saveTimezone = useCallback(
    async (newTimezone: string) => {
      try {
        setTimezone(newTimezone);
        try {
          localStorage.setItem(LOCAL_STORAGE_TZ_KEY, newTimezone);
        } catch {}

        if (user) {
          await supabase.auth.updateUser({
            data: { timezone: newTimezone },
          });
        }

        toast({
          title: "Fuso horário atualizado",
          description: `Horário comercial ajustado para ${newTimezone}.`,
        });
        return true;
      } catch (err: any) {
        toast({
          title: "Erro ao atualizar fuso horário",
          description: err.message,
          variant: "destructive",
        });
        return false;
      }
    },
    [user, toast]
  );

  /**
   * REGISTRO EXPLÍCITO DE CONTATO COMERCIAL REALIZADO.
   * Regra Obrigatória 1: Não avança por cliques em links, cópia de mensagem ou mudança de status.
   * Requer confirmação explícita do usuário.
   */
  const registerExplicitContact = useCallback(
    async ({
      leadId,
      leadNome,
      tipo = "primeira_abordagem",
      conteudo = "Contato realizado e confirmado pelo usuário",
    }: {
      leadId: string;
      leadNome?: string;
      tipo?: string;
      conteudo?: string;
    }) => {
      if (!user) {
        toast({
          title: "Autenticação necessária",
          description: "Faça login para registrar contatos comerciais.",
          variant: "destructive",
        });
        return false;
      }

      try {
        const nowIso = new Date().toISOString();

        // Inserção atômica na tabela public.interacoes com RLS
        const { data, error: insertError } = await supabase
          .from("interacoes")
          .insert({
            user_id: user.id,
            lead_id: leadId,
            tipo,
            conteudo,
            data_interacao: nowIso,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        const newRecord: UserInteractionRecord = {
          id: data?.id || `int_${Date.now()}`,
          user_id: user.id,
          lead_id: leadId,
          tipo,
          conteudo,
          data_interacao: nowIso,
          lead_nome: leadNome,
        };

        // Atualização em tempo real do estado local
        setInteractions((prev) => [newRecord, ...prev]);

        toast({
          title: "Contato comercial registrado!",
          description: leadNome
            ? `Contato com "${leadNome}" contabilizado na meta de hoje.`
            : "Contato contabilizado na sua meta de hoje.",
        });

        return true;
      } catch (err: any) {
        console.error("Erro ao registrar interação em public.interacoes:", err);
        toast({
          title: "Erro ao registrar contato",
          description: err.message || "Não foi possível salvar o contato no histórico.",
          variant: "destructive",
        });
        return false;
      }
    },
    [user, toast]
  );

  const refresh = useCallback(() => {
    if (user?.id) {
      loadInteractions(user.id);
    }
  }, [user, loadInteractions]);

  return {
    timezone,
    activeGoal,
    goalsHistory,
    daily,
    weekly,
    monthly,
    loading,
    error,
    saveGoals,
    saveTimezone,
    registerExplicitContact,
    refresh,
  };
}
