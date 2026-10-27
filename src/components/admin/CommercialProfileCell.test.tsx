// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommercialProfileCell, CommercialStateBadge } from "./CommercialProfileCell";

describe("CommercialProfileCell", () => {
  it("sem perfil mostra 'Não informado'", () => {
    render(<CommercialProfileCell profile={{ filled: false, complete: false, display_name: "", company_name: "", service_category_label: "", service_offered: "", offer_description: "", target_audience: "" }} />);
    expect(screen.getByTestId("commercial-profile-empty").textContent).toBe("Não informado");
  });
  it("perfil parcial mostra campos vazios como 'Não informado' e sinaliza incompleto", () => {
    render(<CommercialProfileCell profile={{ filled: true, complete: false, display_name: "Ana", company_name: "", service_category_label: "Sites", service_offered: "Sites para oficinas", offer_description: "", target_audience: "" }} />);
    const text = screen.getByTestId("commercial-profile").textContent;
    expect(text).toContain("Categoria: Sites");
    expect(text).toContain("Oferta: Não informado");
    expect(text).toContain("Perfil incompleto");
  });
  it("badge de estado usa os rótulos reais", () => {
    const { rerender } = render(<CommercialStateBadge state="paid_active" />);
    expect(screen.getByTestId("commercial-state-badge").textContent).toBe("Pago ativo");
    rerender(<CommercialStateBadge state="indefinido" />);
    expect(screen.getByTestId("commercial-state-badge").textContent).toMatch(/Indefinido/);
    rerender(<CommercialStateBadge state="trial" />);
    expect(screen.getByTestId("commercial-state-badge").textContent).toBe("Em teste");
  });
});
