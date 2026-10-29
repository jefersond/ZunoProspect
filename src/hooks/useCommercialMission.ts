import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";

const safeTrackEvent = (eventName: string, eventData: Record<string, unknown>) => {
  try {
    trackEvent(eventName, eventData);
  } catch (trackingError) {
    console.warn("[Tracking] Falhou, mas não bloqueia UI", trackingError);
  }
};

export type MissionPhase = "idle" | "search_tour" | "invite" | "commercial_mission" | "completed";

export const MISSION_STORAGE_KEYS = {
  phase: (userId: string) => `zuno_comm_mission_phase_${userId}`,
  step: (userId: string) => `zuno_comm_mission_step_${userId}`,
  dismissed: (userId: string) => `zuno_comm_mission_dismissed_${userId}`,
  searchGuideDismissed: (userId: string) => `zuno_first_search_guide_dismissed_${userId}`,
};

export function useCommercialMission() {
  const { user } = useAuth();
  const userId = user?.id;

  const [phase, setPhase] = useState<MissionPhase>("idle");
  const [step, setStep] = useState<number>(1);
  const [isLoaded, setIsLoaded] = useState(false);

  // Carrega estado persistido do usuário
  useEffect(() => {
    if (!userId) {
      setIsLoaded(true);
      return;
    }

    const syncState = () => {
      try {
        const savedPhase = localStorage.getItem(MISSION_STORAGE_KEYS.phase(userId)) as MissionPhase | null;
        if (savedPhase === "completed") {
          setPhase("completed");
          setIsLoaded(true);
          return;
        }

        const isDismissed = localStorage.getItem(MISSION_STORAGE_KEYS.dismissed(userId)) === "true";
        if (isDismissed) {
          setPhase("idle");
          setIsLoaded(true);
          return;
        }

        const savedStep = localStorage.getItem(MISSION_STORAGE_KEYS.step(userId));

        if (savedPhase && ["invite", "commercial_mission"].includes(savedPhase)) {
          setPhase(savedPhase);
          setStep(savedStep ? Math.max(1, parseInt(savedStep, 10)) : 1);
        } else {
          setPhase("idle");
        }
      } catch (e) {
        console.warn("[useCommercialMission] Erro ao carregar estado da missão comercial:", e);
        setPhase("idle");
      } finally {
        setIsLoaded(true);
      }
    };

    syncState();
    window.addEventListener("zuno:commercial-mission-sync", syncState);
    return () => window.removeEventListener("zuno:commercial-mission-sync", syncState);
  }, [userId]);

  const notifySync = () => {
    try {
      window.dispatchEvent(new CustomEvent("zuno:commercial-mission-sync"));
    } catch {
      // safe fallback
    }
  };

  // Iniciar convite da Missão Comercial (disparado após busca de leads com sucesso)
  const triggerMissionInvite = useCallback(() => {
    if (!userId) return;
    const isDismissed = localStorage.getItem(MISSION_STORAGE_KEYS.dismissed(userId)) === "true";
    if (isDismissed) return;

    setPhase("invite");
    localStorage.setItem(MISSION_STORAGE_KEYS.phase(userId), "invite");
    safeTrackEvent("commercial_mission_invite_shown", { source: "first_search_success" });
    notifySync();
  }, [userId]);

  // Aceitar convite e iniciar os passos da missão
  const startMission = useCallback(() => {
    if (!userId) return;
    setPhase("commercial_mission");
    setStep(1);
    localStorage.setItem(MISSION_STORAGE_KEYS.phase(userId), "commercial_mission");
    localStorage.setItem(MISSION_STORAGE_KEYS.step(userId), "1");
    safeTrackEvent("commercial_mission_started", { step: 1 });
    notifySync();
  }, [userId]);

  // Avançar para próximo passo da missão
  const nextStep = useCallback((totalSteps = 7) => {
    if (!userId) return;
    setStep((curr) => {
      const next = curr + 1;
      if (next > totalSteps) {
        // Concluída
        setPhase("completed");
        localStorage.setItem(MISSION_STORAGE_KEYS.phase(userId), "completed");
        localStorage.setItem(MISSION_STORAGE_KEYS.dismissed(userId), "true");
        safeTrackEvent("commercial_mission_completed", { totalSteps });
        notifySync();
        return curr;
      }
      localStorage.setItem(MISSION_STORAGE_KEYS.step(userId), String(next));
      safeTrackEvent("commercial_mission_step_completed", { completedStep: curr, nextStep: next });
      notifySync();
      return next;
    });
  }, [userId]);

  // Voltar um passo
  const prevStep = useCallback(() => {
    if (!userId) return;
    setStep((curr) => {
      const prev = Math.max(1, curr - 1);
      localStorage.setItem(MISSION_STORAGE_KEYS.step(userId), String(prev));
      notifySync();
      return prev;
    });
  }, [userId]);

  // Pular ou descartar a missão
  const dismissMission = useCallback(() => {
    if (!userId) return;
    setPhase("idle");
    localStorage.setItem(MISSION_STORAGE_KEYS.dismissed(userId), "true");
    localStorage.setItem(MISSION_STORAGE_KEYS.phase(userId), "idle");
    safeTrackEvent("commercial_mission_skipped", { currentStep: step });
    notifySync();
  }, [userId, step]);

  // Reabrir ou retomar a missão a pedido do usuário
  const resumeMission = useCallback((targetStep = 1) => {
    if (!userId) return;
    localStorage.removeItem(MISSION_STORAGE_KEYS.dismissed(userId));
    setPhase("commercial_mission");
    setStep(targetStep);
    localStorage.setItem(MISSION_STORAGE_KEYS.phase(userId), "commercial_mission");
    localStorage.setItem(MISSION_STORAGE_KEYS.step(userId), String(targetStep));
    notifySync();
  }, [userId]);

  // Resetar apenas o estado do tutorial para testes manuais seguros
  const resetTutorialState = useCallback(() => {
    if (!userId) return;
    localStorage.removeItem(MISSION_STORAGE_KEYS.phase(userId));
    localStorage.removeItem(MISSION_STORAGE_KEYS.step(userId));
    localStorage.removeItem(MISSION_STORAGE_KEYS.dismissed(userId));
    localStorage.removeItem(MISSION_STORAGE_KEYS.searchGuideDismissed(userId));
    setPhase("idle");
    setStep(1);
    notifySync();
  }, [userId]);

  return {
    phase,
    step,
    isLoaded,
    triggerMissionInvite,
    startMission,
    nextStep,
    prevStep,
    dismissMission,
    resumeMission,
    resetTutorialState,
  };
}
