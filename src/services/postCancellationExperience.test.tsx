import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Experiência Pós-Cancelamento do Starter — Testes de Conformidade", () => {
  const profileSource = fs.readFileSync(path.resolve("src/pages/Profile.tsx"), "utf8");

  it("1. Contém mensagem clara de confirmação pós-cancelamento com cotas reais do useUsage", () => {
    expect(profileSource).toContain("Assinatura cancelada. Você continua com acesso ao plano Gratuito");
    expect(profileSource).toContain("{leadsDisponiveis}");
    expect(profileSource).toContain("{aiDisponiveis}");
    expect(profileSource).toContain("Os recursos avançados de planos pagos foram encerrados.");
  });

  it("2. Oferece ação principal 'Continuar no plano Gratuito' e ação secundária 'Ver planos'", () => {
    expect(profileSource).toContain("Continuar no plano Gratuito");
    expect(profileSource).toContain("Ver planos");
  });

  it("3. Garante que 'Continuar no plano Gratuito' mantém o usuário no app (navega para /prospeccao sem deslogar)", () => {
    expect(profileSource).toContain('navigate("/prospeccao")');
    expect(profileSource).not.toMatch(/handleCancelSubscription[\s\S]*?navigate\(["']\/precos["']\)/);
    expect(profileSource).not.toMatch(/handleCancelSubscription[\s\S]*?navigate\(["']\/["']\)/);
    expect(profileSource).not.toMatch(/handleCancelSubscription[\s\S]*?signOut/);
  });

  it("4. Informa explicitamente a preservação de leads salvos, histórico e análises", () => {
    expect(profileSource).toContain("Seus leads salvos, histórico e análises anteriores foram preservados");
  });

  it("5. Trata falha na Stripe exibindo erro sem afirmar cancelamento concluído", () => {
    expect(profileSource).toContain('title: "Erro ao cancelar"');
    expect(profileSource).toContain('throw new Error(data?.error || error?.message || "Erro ao cancelar assinatura.");');
  });

  it("6. Apresenta banner de status cancelado e diálogo de feedback pós-cancelamento", () => {
    expect(profileSource).toContain('data-testid="cancellation-status-banner"');
    expect(profileSource).toContain('data-testid="cancel-success-dialog"');
  });
});
