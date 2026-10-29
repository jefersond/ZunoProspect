// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  CommercialMissionGuide,
  COMMERCIAL_MISSION_STEPS,
} from "./CommercialMissionGuide";

describe("CommercialMissionGuide", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("não renderiza nada quando a fase é 'idle' ou 'completed'", () => {
    const { container: c1 } = render(
      <CommercialMissionGuide
        phase="idle"
        currentStep={1}
        onStartMission={vi.fn()}
        onStepChange={vi.fn()}
        onDismiss={vi.fn()}
        onComplete={vi.fn()}
      />
    );
    expect(c1.innerHTML).toBe("");

    const { container: c2 } = render(
      <CommercialMissionGuide
        phase="completed"
        currentStep={7}
        onStartMission={vi.fn()}
        onStepChange={vi.fn()}
        onDismiss={vi.fn()}
        onComplete={vi.fn()}
      />
    );
    expect(c2.innerHTML).toBe("");
  });

  it("renderiza o modal de convite na fase 'invite'", () => {
    const onStart = vi.fn();
    const onDismiss = vi.fn();

    render(
      <CommercialMissionGuide
        phase="invite"
        currentStep={1}
        onStartMission={onStart}
        onStepChange={vi.fn()}
        onDismiss={onDismiss}
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByText("Você encontrou suas primeiras oportunidades!")).toBeTruthy();
    expect(
      screen.getByText(
        "Agora vamos preparar uma abordagem personalizada, entender como registrar contatos e organizar seu próximo acompanhamento."
      )
    ).toBeTruthy();

    const startBtn = screen.getByRole("button", { name: /Iniciar Missão Comercial/i });
    fireEvent.click(startBtn);
    expect(onStart).toHaveBeenCalledTimes(1);

    const exploreBtn = screen.getByRole("button", { name: /Explorar sozinho/i });
    fireEvent.click(exploreBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renderiza os 7 passos com textos corretos e aviso de hipótese de IA", () => {
    expect(COMMERCIAL_MISSION_STEPS).toHaveLength(7);

    // Passo 3 deve conter o aviso de que IA é hipótese comercial
    expect(COMMERCIAL_MISSION_STEPS[2].description).toContain(
      "As análises da IA são hipóteses comerciais para enriquecer sua conversa, não fatos comprovados."
    );

    // Passo 4 deve conter o aviso sobre cópia e WhatsApp
    expect(COMMERCIAL_MISSION_STEPS[3].description).toContain(
      "Copiar uma mensagem ou abrir o WhatsApp não consome créditos nem contabiliza contato automaticamente."
    );

    // Passo 5 deve conter a orientação sobre contatos reais
    expect(COMMERCIAL_MISSION_STEPS[4].description).toContain(
      "Você só deve registrar contatos que realmente aconteceram."
    );

    // Passo 7 deve mencionar metas personalizáveis
    expect(COMMERCIAL_MISSION_STEPS[6].description).toContain(
      "Suas metas são 100% personalizáveis."
    );
  });

  it("avança sem exigir atividade comercial fictícia (botão Próximo ativo)", () => {
    const onStepChange = vi.fn();

    render(
      <CommercialMissionGuide
        phase="commercial_mission"
        currentStep={1}
        onStartMission={vi.fn()}
        onStepChange={onStepChange}
        onDismiss={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByText("1. Encontrar Oportunidades")).toBeTruthy();
    const nextBtn = screen.getByRole("button", { name: /Próximo/i });
    expect(nextBtn).toBeTruthy();

    fireEvent.click(nextBtn);
    expect(onStepChange).toHaveBeenCalledWith(2);
  });

  it("permite concluir a missão no passo 7 sem forçar salvamento", () => {
    const onComplete = vi.fn();

    render(
      <CommercialMissionGuide
        phase="commercial_mission"
        currentStep={7}
        onStartMission={vi.fn()}
        onStepChange={vi.fn()}
        onDismiss={vi.fn()}
        onComplete={onComplete}
      />
    );

    expect(screen.getByText("7. Meta Comercial e Desempenho")).toBeTruthy();
    const completeBtn = screen.getByRole("button", { name: /Concluir Missão/i });
    expect(completeBtn).toBeTruthy();

    fireEvent.click(completeBtn);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("fecha o guia ao pressionar a tecla Escape", () => {
    const onDismiss = vi.fn();

    render(
      <CommercialMissionGuide
        phase="commercial_mission"
        currentStep={3}
        onStartMission={vi.fn()}
        onStepChange={vi.fn()}
        onDismiss={onDismiss}
        onComplete={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("permite pular a missão a qualquer momento", () => {
    const onDismiss = vi.fn();

    render(
      <CommercialMissionGuide
        phase="commercial_mission"
        currentStep={4}
        onStartMission={vi.fn()}
        onStepChange={vi.fn()}
        onDismiss={onDismiss}
        onComplete={vi.fn()}
      />
    );

    const skipBtn = screen.getByRole("button", { name: /Pular missão/i });
    fireEvent.click(skipBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("exibe fallback gracioso quando o elemento âncora não está presente no DOM", () => {
    render(
      <CommercialMissionGuide
        phase="commercial_mission"
        currentStep={7} // painel de metas pode estar na outra tela
        onStartMission={vi.fn()}
        onStepChange={vi.fn()}
        onDismiss={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByText(/Dica:/i)).toBeTruthy();
    expect(screen.getByText(/Acesse a área de Painel de Metas/i)).toBeTruthy();
    expect(screen.getByText(/Abrir Carteira de Leads Salvos/i)).toBeTruthy();
  });
});
