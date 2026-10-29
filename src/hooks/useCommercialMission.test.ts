// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCommercialMission, MISSION_STORAGE_KEYS } from "./useCommercialMission";

// Mock do hook useAuth
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "test-user-123", email: "user@example.com" },
    session: null,
  }),
}));

// Mock do analytics
vi.mock("@/lib/analytics", () => ({
  safeTrackEvent: vi.fn(),
  trackEvent: vi.fn(),
}));

describe("useCommercialMission", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("inicia em 'idle' no primeiro acesso", () => {
    const { result } = renderHook(() => useCommercialMission());
    expect(result.current.phase).toBe("idle");
    expect(result.current.step).toBe(1);
    expect(result.current.isLoaded).toBe(true);
  });

  it("permite disparar o convite e aceitar iniciando a missão comercial", () => {
    const { result } = renderHook(() => useCommercialMission());

    act(() => {
      result.current.triggerMissionInvite();
    });

    expect(result.current.phase).toBe("invite");
    expect(localStorage.getItem(MISSION_STORAGE_KEYS.phase("test-user-123"))).toBe("invite");

    act(() => {
      result.current.startMission();
    });

    expect(result.current.phase).toBe("commercial_mission");
    expect(result.current.step).toBe(1);
    expect(localStorage.getItem(MISSION_STORAGE_KEYS.phase("test-user-123"))).toBe("commercial_mission");
    expect(localStorage.getItem(MISSION_STORAGE_KEYS.step("test-user-123"))).toBe("1");
  });

  it("avança e retrocede passos progressivamente", () => {
    const { result } = renderHook(() => useCommercialMission());

    act(() => {
      result.current.startMission();
    });

    act(() => {
      result.current.nextStep();
    });
    expect(result.current.step).toBe(2);

    act(() => {
      result.current.nextStep();
    });
    expect(result.current.step).toBe(3);

    act(() => {
      result.current.prevStep();
    });
    expect(result.current.step).toBe(2);
  });

  it("conclui a missão ao avançar além do último passo", () => {
    const { result } = renderHook(() => useCommercialMission());

    act(() => {
      result.current.resumeMission(7);
    });

    expect(result.current.step).toBe(7);

    act(() => {
      result.current.nextStep(7);
    });

    expect(result.current.phase).toBe("completed");
    expect(localStorage.getItem(MISSION_STORAGE_KEYS.dismissed("test-user-123"))).toBe("true");
  });

  it("permite descartar / pular a missão", () => {
    const { result } = renderHook(() => useCommercialMission());

    act(() => {
      result.current.startMission();
      result.current.dismissMission();
    });

    expect(result.current.phase).toBe("idle");
    expect(localStorage.getItem(MISSION_STORAGE_KEYS.dismissed("test-user-123"))).toBe("true");
  });

  it("resetTutorialState limpa apenas as chaves do tutorial e preserva chaves de autenticação", () => {
    // Configura auth e tutorial no localStorage
    localStorage.setItem("sb-auth-token", "jwt-token-valido-123");
    localStorage.setItem("user_theme_preference", "dark");
    localStorage.setItem(MISSION_STORAGE_KEYS.phase("test-user-123"), "completed");
    localStorage.setItem(MISSION_STORAGE_KEYS.step("test-user-123"), "7");
    localStorage.setItem(MISSION_STORAGE_KEYS.dismissed("test-user-123"), "true");
    localStorage.setItem(MISSION_STORAGE_KEYS.searchGuideDismissed("test-user-123"), "true");

    const { result } = renderHook(() => useCommercialMission());

    act(() => {
      result.current.resetTutorialState();
    });

    expect(result.current.phase).toBe("idle");
    expect(result.current.step).toBe(1);

    // Chaves do tutorial foram removidas
    expect(localStorage.getItem(MISSION_STORAGE_KEYS.phase("test-user-123"))).toBeNull();
    expect(localStorage.getItem(MISSION_STORAGE_KEYS.step("test-user-123"))).toBeNull();
    expect(localStorage.getItem(MISSION_STORAGE_KEYS.dismissed("test-user-123"))).toBeNull();
    expect(localStorage.getItem(MISSION_STORAGE_KEYS.searchGuideDismissed("test-user-123"))).toBeNull();

    // Chaves de autenticação e preferências NÃO foram tocadas
    expect(localStorage.getItem("sb-auth-token")).toBe("jwt-token-valido-123");
    expect(localStorage.getItem("user_theme_preference")).toBe("dark");
  });
});
