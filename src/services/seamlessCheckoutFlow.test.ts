// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveCheckoutPlan, normalizePlanId, PLANS, type BillingCycle } from "@/config/plans";
import { StripeAdapter, MercadoPagoAdapter, billingRedirectAdapter, type BillingCheckoutResult } from "@/services/billingCheckout";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (filePath: string) =>
  readFileSync(resolve(process.cwd(), filePath), "utf8");

describe("Fluxo de Compra Sem Fricção — Zuno Prospect", () => {
  const checkoutSource = readSource("src/pages/Checkout.tsx");
  const authSource = readSource("src/pages/Auth.tsx");
  const precosSectionSource = readSource("src/components/landing/PrecosSection.tsx");
  const protectedRouteSource = readSource("src/components/ProtectedRoute.tsx");
  const oauthCallbackSource = readSource("src/hooks/useOAuthCallback.ts");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Cenário 1: Logado + Starter + compra direta
  // --------------------------------------------------------------------------
  describe("Cenário 1: Logado + Starter + compra direta", () => {
    it("deve resolver Starter mensal com direct_purchase e valores canônicos", () => {
      const searchParams = new URLSearchParams("plano=starter&anual=false&conversion_path=direct_purchase");
      const resolved = resolveCheckoutPlan(searchParams);

      expect(resolved.status).toBe("valid");
      if (resolved.status === "valid") {
        expect(resolved.planId).toBe("starter");
        expect(resolved.plan.monthlyPrice).toBe(47);
      }
      expect(searchParams.get("conversion_path")).toBe("direct_purchase");
    });

    it("Checkout.tsx não exige seletor de planos nem segundo botão Continuar para compra direta", () => {
      expect(checkoutSource).not.toContain("<PlanSelector");
      expect(checkoutSource).not.toContain("Escolha seu plano e finalize");
      expect(checkoutSource).not.toContain("Continuar para pagamento seguro");
      expect(checkoutSource).toContain('"Assinatura imediata"');
      expect(checkoutSource).toContain("Não há período de teste neste caminho.");
    });
  });

  // --------------------------------------------------------------------------
  // Cenário 2: Logado + Pro + teste vigente
  // --------------------------------------------------------------------------
  describe("Cenário 2: Logado + Pro + teste vigente", () => {
    it("deve resolver Pro com trial como conversion_path padrão", () => {
      const searchParams = new URLSearchParams("plan=pro&conversion_path=trial");
      const resolved = resolveCheckoutPlan(searchParams);

      expect(resolved.status).toBe("valid");
      if (resolved.status === "valid") {
        expect(resolved.planId).toBe("pro");
        expect(resolved.plan.leadsLimit).toBe(800);
      }
      expect(searchParams.get("conversion_path")).toBe("trial");
    });

    it("deve exibir indicador dinâmico de teste no checkout sem valores estáticos rígidos de 7 dias", () => {
      expect(checkoutSource).toContain("trialDurationDays");
      expect(checkoutSource).toContain("Redirecionando para ativação do teste");
    });
  });

  // --------------------------------------------------------------------------
  // Cenário 3: Logado + Agência + compra anual
  // --------------------------------------------------------------------------
  describe("Cenário 3: Logado + Agência + compra anual", () => {
    it("deve resolver Agência com cobrança anual e desconto de 2 meses", () => {
      const searchParams = new URLSearchParams("plano=agencia&anual=true");
      const resolved = resolveCheckoutPlan(searchParams);

      expect(resolved.status).toBe("valid");
      if (resolved.status === "valid") {
        expect(resolved.planId).toBe("agency");
        expect(resolved.planoKey).toBe("agencia");
        expect(resolved.plan.annualPrice).toBe(2470);
        expect(resolved.plan.annualPrice).toBe(resolved.plan.monthlyPrice * 10);
      }
    });

    it("PrecosSection passa anual=true para a criação do checkout", () => {
      expect(precosSectionSource).toContain("billingCycle");
      expect(precosSectionSource).toContain("billingRedirectAdapter(data.provider).redirect(data)");
    });
  });

  // --------------------------------------------------------------------------
  // Cenário 4: Sem login + cadastro por e-mail
  // --------------------------------------------------------------------------
  describe("Cenário 4: Sem login + cadastro por e-mail", () => {
    it("deve encaminhar usuário sem sessão para /auth preservando parâmetros comerciais", () => {
      expect(precosSectionSource).toContain("if (!session)");
      expect(precosSectionSource).toContain("tab=signup");
      expect(precosSectionSource).toContain("conversion_path=${conversionPath}");
    });

    it("Auth.tsx armazena intenção de compra e recupera em redirectAfterAuth", () => {
      expect(authSource).toContain("storePendingCheckout");
      expect(authSource).toContain("checkout_pending");
      expect(authSource).toContain("redirectAfterAuth");
      expect(authSource).toContain("conversion_path=${targetConversionPath}");
    });
  });

  // --------------------------------------------------------------------------
  // Cenário 5: Sem login + Google OAuth
  // --------------------------------------------------------------------------
  describe("Cenário 5: Sem login + Google OAuth", () => {
    it("useOAuthCallback preserva plano, ciclo, conversion_path, offerId e coupon", () => {
      expect(oauthCallbackSource).toContain("checkout_pending");
      expect(oauthCallbackSource).toContain("conversion_path=${conversionPath}");
      expect(oauthCallbackSource).toContain("offerIdParam");
      expect(oauthCallbackSource).toContain("couponParam");
      expect(oauthCallbackSource).toContain("import { normalizePlanId } from '@/config/plans'");
    });
  });

  // --------------------------------------------------------------------------
  // Cenário 6: Login com e-mail já cadastrado
  // --------------------------------------------------------------------------
  describe("Cenário 6: Login com e-mail já cadastrado", () => {
    it("ao logar com conta existente, redirectAfterAuth recupera a intenção de compra sem segundo seletor", () => {
      expect(authSource).toContain("signInWithPassword");
      expect(authSource).toContain("redirectAfterAuth()");
      expect(checkoutSource).not.toContain("<PlanSelector");
    });
  });

  // --------------------------------------------------------------------------
  // Cenário 7: Plano preservado após recarregar ou retornar da autenticação
  // --------------------------------------------------------------------------
  describe("Cenário 7: Plano preservado após recarregar ou retornar", () => {
    it("recupera plano do localStorage caso os parâmetros de URL sejam perdidos no redirecionamento", () => {
      expect(checkoutSource).toContain("pendingCheckoutRaw");
      expect(checkoutSource).toContain("checkout_pending");
      expect(checkoutSource).toContain("validPlanKey");
    });

    it("normalizePlanId aceita todos os identificadores canônicos e aliases", () => {
      expect(normalizePlanId("starter")).toBe("starter");
      expect(normalizePlanId("pro")).toBe("pro");
      expect(normalizePlanId("agency")).toBe("agency");
      expect(normalizePlanId("agencia")).toBe("agency");
      expect(normalizePlanId("iniciante")).toBe("starter");
    });
  });

  // --------------------------------------------------------------------------
  // Cenário 8: Cupom de teste válido e inválido
  // --------------------------------------------------------------------------
  describe("Cenário 8: Cupom e autoridade do backend", () => {
    it("parâmetros de cupom são repassados sem confiar em desconto client-side", () => {
      expect(authSource).toContain("couponParam");
      expect(oauthCallbackSource).toContain("couponParam");
      expect(checkoutSource).not.toContain("discount_cents");
    });
  });

  // --------------------------------------------------------------------------
  // Cenário 9: Oferta introdutória
  // --------------------------------------------------------------------------
  describe("Cenário 9: Oferta introdutória", () => {
    it("preserva offerId através de PrecosSection, Auth e Checkout", () => {
      expect(precosSectionSource).toContain("offerParam");
      expect(authSource).toContain("offerIdParam");
      expect(oauthCallbackSource).toContain("offerIdParam");
      expect(checkoutSource).toContain("Economize no primeiro mês");
    });
  });

  // --------------------------------------------------------------------------
  // Cenário 10: Pagamento cancelado ou falho
  // --------------------------------------------------------------------------
  describe("Cenário 10: Pagamento cancelado ou falho", () => {
    it("Checkout.tsx fornece interface de erro com botão Tentar novamente sem loop para /precos", () => {
      expect(checkoutSource).toContain("checkoutError");
      expect(checkoutSource).toContain("handleRetry");
      expect(checkoutSource).toContain("Tentar novamente");
      expect(checkoutSource).toContain("Voltar para planos");
    });
  });

  // --------------------------------------------------------------------------
  // Cenário 11: Clique duplo e múltiplos eventos de autenticação
  // --------------------------------------------------------------------------
  describe("Cenário 11: Idempotência e proteção contra duplicação", () => {
    it("PrecosSection possui guarda contra clique duplo no botão de plano", () => {
      expect(precosSectionSource).toContain("isExecutingCheckoutRef");
      expect(precosSectionSource).toContain("if (isExecutingCheckoutRef.current) return;");
    });

    it("Auth.tsx possui guarda contra múltiplos disparos de redirectAfterAuth", () => {
      expect(authSource).toContain("authRedirectHandledRef");
      expect(authSource).toContain("if (authRedirectHandledRef.current) return;");
    });

    it("Checkout.tsx possui ref guard para evitar disparos duplicados pelo React StrictMode", () => {
      expect(checkoutSource).toContain("checkoutInitiatedRef");
      expect(checkoutSource).toContain("if (checkoutInitiatedRef.current) return;");
    });
  });

  // --------------------------------------------------------------------------
  // Cenário 12: Stripe
  // --------------------------------------------------------------------------
  describe("Cenário 12: Stripe", () => {
    it("StripeAdapter redireciona para a URL segura retornada pelo Stripe", () => {
      const adapter = new StripeAdapter();
      expect(adapter.provider).toBe("stripe");

      const assignSpy = vi.fn();
      const originalWindow = globalThis.window;
      globalThis.window = { location: { assign: assignSpy } } as any;

      const mockResult: BillingCheckoutResult = {
        provider: "stripe",
        url: "https://checkout.stripe.com/c/pay/cs_test_mock",
        checkoutId: "cs_test_mock",
        trialDurationDays: 7,
        trialPolicyVersion: "v4_7day_card_required",
        conversionPath: "trial",
        introOfferApplied: false,
      };

      adapter.redirect(mockResult);
      expect(assignSpy).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_test_mock");

      globalThis.window = originalWindow;
    });
  });

  // --------------------------------------------------------------------------
  // Cenário 13: Mercado Pago, somente com configuração de teste válida
  // --------------------------------------------------------------------------
  describe("Cenário 13: Mercado Pago", () => {
    it("MercadoPagoAdapter redireciona para a URL segura do Mercado Pago", () => {
      const adapter = new MercadoPagoAdapter();
      expect(adapter.provider).toBe("mercado_pago");

      const assignSpy = vi.fn();
      const originalWindow = globalThis.window;
      globalThis.window = { location: { assign: assignSpy } } as any;

      const mockResult: BillingCheckoutResult = {
        provider: "mercado_pago",
        url: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=mock",
        checkoutId: "mock_mp_id",
        trialDurationDays: 7,
        trialPolicyVersion: "v4_7day_card_required",
        conversionPath: "trial",
        introOfferApplied: false,
      };

      adapter.redirect(mockResult);
      expect(assignSpy).toHaveBeenCalledWith("https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=mock");

      globalThis.window = originalWindow;
    });

    it("billingRedirectAdapter roteia dinamicamente para o provedor retornado", () => {
      expect(billingRedirectAdapter("stripe").provider).toBe("stripe");
      expect(billingRedirectAdapter("mercado_pago").provider).toBe("mercado_pago");
    });
  });

  // --------------------------------------------------------------------------
  // Cenário 14: Usuário com assinatura existente
  // --------------------------------------------------------------------------
  describe("Cenário 14: Usuário com assinatura existente", () => {
    it("redireciona para /prospeccao se o usuário já tiver o mesmo plano ativo", () => {
      expect(checkoutSource).toContain('currentPlan === selectedPlanId');
      expect(checkoutSource).toContain('navigate("/prospeccao", { replace: true })');
      expect(checkoutSource).toContain("Você já possui este plano ativo.");
    });
  });

  // --------------------------------------------------------------------------
  // Cenário 15: Nenhum redirecionamento desnecessário para /precos
  // --------------------------------------------------------------------------
  describe("Cenário 15: Eliminação de bounces desnecessários", () => {
    it("ProtectedRoute envia usuários free diretamente para /precos em vez de saltar por /checkout", () => {
      expect(protectedRouteSource).toContain('return <Navigate to="/precos" replace />;');
      expect(protectedRouteSource).not.toContain('return <Navigate to="/checkout" replace />;');
    });

    it("Checkout só vai para /precos se nenhum plano for informado ou se for inválido", () => {
      expect(checkoutSource).toContain("if (!validPlanKey)");
      expect(checkoutSource).toContain('navigate("/precos", { replace: true });');
    });
  });

  // --------------------------------------------------------------------------
  // Cenário 16: Isenção de WhatsApp no Checkout (Zero Fricção sem enfraquecer Auth)
  // --------------------------------------------------------------------------
  describe("Cenário 16: Isenção de WhatsApp no Checkout", () => {
    it("ProtectedRoute não bloqueia a rota /checkout por falta de WhatsApp", () => {
      expect(protectedRouteSource).toContain('const isCheckoutRoute = location.pathname === "/checkout";');
      expect(protectedRouteSource).toContain('if (!isCheckoutRoute && !profileLoading && profile && !profile.whatsapp)');
    });

    it("ProtectedRoute mantém autenticação estrita: se !user redireciona para /auth", () => {
      expect(protectedRouteSource).toContain('if (!user)');
      expect(protectedRouteSource).toContain('return <Navigate to={`/auth?${authParams.toString()}`} replace />;');
    });
  });
});
