// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { OfferClarificationDialog } from "./OfferClarificationDialog";
import type { SellerProfile } from "@/lib/sellerProfile";

describe("OfferClarificationDialog", () => {
  afterEach(() => {
    cleanup();
  });
  const profileIncomplete: SellerProfile = {
    display_name: "Rodrigo Silva",
    company_name: "AutoAtende",
    service_category: "automacao",
    service_offered: "Automação de WhatsApp",
    offer_description: "",
    target_audience: "Clínicas odontológicas",
    commercial_maturity: "equilibrado",
  };

  it("renderiza a pergunta contextual para Automação de WhatsApp", () => {
    render(
      <OfferClarificationDialog
        open={true}
        onOpenChange={vi.fn()}
        profile={profileIncomplete}
        onSaveOffer={vi.fn()}
        onContinueExploratory={vi.fn()}
      />
    );

    expect(screen.getByText("Refinamento Rápido da Oferta")).toBeTruthy();
    expect(screen.getByText("Automação de WhatsApp")).toBeTruthy();
    expect(
      screen.getByText("Qual problema sua automação resolve para o tipo de empresa que você quer atender?")
    ).toBeTruthy();
    expect(screen.getByTestId("btn-skip-clarification")).toBeTruthy();
  });

  it("permite continuar sem responder chamando onContinueExploratory", () => {
    const onContinueExploratory = vi.fn();
    render(
      <OfferClarificationDialog
        open={true}
        onOpenChange={vi.fn()}
        profile={profileIncomplete}
        onSaveOffer={vi.fn()}
        onContinueExploratory={onContinueExploratory}
      />
    );

    const skipBtn = screen.getByTestId("btn-skip-clarification");
    fireEvent.click(skipBtn);

    expect(onContinueExploratory).toHaveBeenCalledTimes(1);
  });

  it("permite responder e salvar chamando onSaveOffer com o texto fornecido", () => {
    const onSaveOffer = vi.fn();
    render(
      <OfferClarificationDialog
        open={true}
        onOpenChange={vi.fn()}
        profile={profileIncomplete}
        onSaveOffer={onSaveOffer}
        onContinueExploratory={vi.fn()}
      />
    );

    const input = screen.getByTestId("offer-clarification-input");
    fireEvent.change(input, {
      target: {
        value: "Reduzimos faltas em consultas médicas e odontológicas com confirmação no WhatsApp.",
      },
    });

    const saveBtn = screen.getByTestId("btn-save-clarification") as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
    fireEvent.click(saveBtn);

    expect(onSaveOffer).toHaveBeenCalledWith(
      "Reduzimos faltas em consultas médicas e odontológicas com confirmação no WhatsApp."
    );
  });
});
