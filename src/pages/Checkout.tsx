import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, Loader2, ArrowLeft, Sparkles, Building2, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { getAttributionParams, trackInitiateCheckout, trackAddPaymentInfo, trackMetaCustomEvent } from "@/lib/metaPixel";
import { createBillingCheckout, billingRedirectAdapter } from "@/services/billingCheckout";
import { getFunnelContext } from "@/lib/funnelContext";
import { PLANS, normalizePlanId, resolveCheckoutPlan } from "@/config/plans";
import { useAuth } from "@/hooks/useAuth";
import { appendReferralToPath, getCurrentReferralCode } from "@/lib/referral";
import { trackEvent } from "@/lib/analytics";
import { useUsage } from "@/hooks/useUsage";
import { useBillingOfferConfig } from "@/hooks/useBillingOfferConfig";
import { useSubscription } from "@/hooks/useSubscription";

// Dados canônicos dos planos
const PLANOS = {
  starter: {
    nome: PLANS.starter.displayName,
    precoMensal: PLANS.starter.monthlyPrice,
    precoAnual: PLANS.starter.annualPrice,
    leadsLimit: PLANS.starter.leadsLimit,
    aiLimit: PLANS.starter.aiLimit,
    icon: Sparkles,
  },
  pro: {
    nome: PLANS.pro.displayName,
    precoMensal: PLANS.pro.monthlyPrice,
    precoAnual: PLANS.pro.annualPrice,
    leadsLimit: PLANS.pro.leadsLimit,
    aiLimit: PLANS.pro.aiLimit,
    icon: Sparkles,
  },
  agencia: {
    nome: PLANS.agency.displayName,
    precoMensal: PLANS.agency.monthlyPrice,
    precoAnual: PLANS.agency.annualPrice,
    leadsLimit: PLANS.agency.leadsLimit,
    aiLimit: PLANS.agency.aiLimit,
    icon: Building2,
  },
};

type PlanoKey = "starter" | "pro" | "agencia";

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { usage } = useUsage();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const { trialDurationDays, defaultNewBillingProvider, introOffer } = useBillingOfferConfig();

  // 1. Resolução estrita do plano selecionado (via URL query params com fallback seguro para intenção pendente)
  const resolvedPlan = resolveCheckoutPlan(searchParams);
  const pendingCheckoutRaw = typeof window !== "undefined" ? localStorage.getItem("checkout_pending") : null;
  const pendingCheckout = pendingCheckoutRaw ? (() => {
    try { return JSON.parse(pendingCheckoutRaw); } catch { return null; }
  })() : null;

  const validPlanKey: PlanoKey | null = resolvedPlan.status === "valid"
    ? resolvedPlan.planoKey
    : (pendingCheckout?.plano ? (normalizePlanId(pendingCheckout.plano) === "agency" ? "agencia" : normalizePlanId(pendingCheckout.plano) as PlanoKey) : null);

  const anualParam = searchParams.get("anual") || searchParams.get("isAnual") || (pendingCheckout?.isAnual ? "true" : "false");
  const isAnual = anualParam === "true";
  const conversionPath = (searchParams.get("conversion_path") || pendingCheckout?.conversionPath) === "direct_purchase"
    ? "direct_purchase"
    : "trial";
  const referralCode = getCurrentReferralCode(searchParams) || pendingCheckout?.referralCode;
  const offerIdParam = searchParams.get("offerId") || searchParams.get("offer") || pendingCheckout?.offerId || null;

  // Redireciona para /precos se nenhum plano for informado ou se for inválido
  useEffect(() => {
    if (!validPlanKey) {
      if (resolvedPlan.status === "invalid") {
        toast.error("Plano inválido ou conflitante. Escolha seu plano para continuar.");
      }
      navigate("/precos", { replace: true });
    }
  }, [validPlanKey, resolvedPlan.status, navigate]);

  const selectedPlano = validPlanKey || "starter";
  const plano = PLANOS[selectedPlano] || PLANOS.starter;
  const selectedPlanId = selectedPlano === "agencia" ? "agency" : selectedPlano;
  const preco = isAnual ? plano.precoAnual : plano.precoMensal;
  const periodo = isAnual ? "/ano" : "/mês";

  const selectedIntroOffer = introOffer.plans[selectedPlanId];
  const introOfferSelected = Boolean(
    conversionPath === "direct_purchase"
      && !isAnual
      && introOffer.enabled
      && introOffer.eligible
      && selectedIntroOffer?.introPrice
      && selectedIntroOffer?.regularPrice,
  );

  const [isAutoProcessing, setIsAutoProcessing] = useState(true);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const checkoutInitiatedRef = useRef(false);

  // 2. Execução segura e atômica da criação da sessão de checkout
  const initiateCheckout = useCallback(async () => {
    if (!user) return;
    setIsAutoProcessing(true);
    setCheckoutError(null);

    try {
      const trackingPlanId = selectedPlanId;
      trackMetaCustomEvent("Plan_Selected", {
        plan_id: trackingPlanId,
        plan_name: plano.nome,
        value: introOfferSelected ? selectedIntroOffer?.introPrice : plano.precoMensal,
        currency: "BRL",
        conversion_path: conversionPath,
        intro_offer: introOfferSelected ? introOffer.key : null,
        intro_offer_price: introOfferSelected ? selectedIntroOffer?.introPrice : null,
        regular_price: introOfferSelected ? selectedIntroOffer?.regularPrice : plano.precoMensal,
      });

      trackAddPaymentInfo({
        content_category: defaultNewBillingProvider === "mercado_pago" ? "Mercado Pago" : "Stripe",
        currency: "BRL",
        value: introOfferSelected ? selectedIntroOffer?.introPrice ?? preco : preco,
      });

      const data = await createBillingCheckout({
        selectedPlan: { planKey: selectedPlanId },
        billingCycle: isAnual ? "annual" : "monthly",
        conversionPath,
        source: "checkout_page",
        offerId: introOfferSelected ? introOffer.key : (offerIdParam || null),
      });

      const funnelContext = await getFunnelContext(null, "checkout_page");
      const usageMetadata = {
        plan_id: trackingPlanId,
        plan_name: plano.nome,
        value: data.introOfferApplied ? data.introPrice ?? preco : preco,
        currency: "BRL",
        source: "checkout_page",
        checkout_source: "checkout_page",
        stripe_session_id: data.provider === "stripe" ? data.checkoutId || null : null,
        provider_checkout_id: data.checkoutId || null,
        billing_provider: data.provider,
        trial_duration_days: data.trialDurationDays,
        trial_policy_version: data.trialPolicyVersion,
        conversion_path: data.conversionPath,
        intro_offer: data.introOfferApplied ? data.introOfferKey : null,
        intro_offer_price: data.introOfferApplied ? data.introPrice : null,
        regular_price: data.regularPrice ?? preco,
        user_plan_before_checkout: usage?.plan_name || "free",
      };

      trackEvent("checkout_started", {
        ...funnelContext,
        ...usageMetadata,
        billing_cycle: isAnual ? "annual" : "monthly",
        content_name: `Zuno Prospect ${plano.nome}`,
      });

      trackEvent("InitiateCheckout", {
        ...funnelContext,
        ...usageMetadata,
        billing_cycle: isAnual ? "annual" : "monthly",
        content_name: `Zuno Prospect ${plano.nome}`,
      });

      trackInitiateCheckout({
        content_name: `Zuno Prospect ${plano.nome}`,
        content_category: "subscription",
        plan_id: trackingPlanId,
        plan_name: plano.nome,
        value: preco,
        currency: "BRL",
      });

      const attribution = getAttributionParams();
      if ((attribution.offer === "founder_pro" || attribution.utm_campaign === "founder") && trackingPlanId === "pro") {
        trackMetaCustomEvent("Founder_Offer_Checkout", {
          offer: "founder_pro",
          plan_id: "pro",
          value: 47,
          currency: "BRL",
        });
      }

      toast.success("Redirecionando para o pagamento seguro...");
      billingRedirectAdapter(data.provider).redirect(data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      const status = typeof error === "object" && error !== null && "status" in error
        ? (error as { status?: number }).status
        : undefined;

      if (status === 409 || errorMessage.includes("subscription_already_active")) {
        toast.info("Você já possui uma assinatura ativa.");
        navigate("/prospeccao", { replace: true });
        return;
      }

      if (status === 401) {
        toast.error("Sessão expirada. Faça login novamente.", { description: errorMessage });
        navigate(appendReferralToPath(
          `/auth?tab=login&plan=${encodeURIComponent(selectedPlanId)}&anual=${isAnual}&conversion_path=${conversionPath}`,
          referralCode
        ));
        return;
      }

      toast.error("Não foi possível iniciar o pagamento", { description: errorMessage || "Tente novamente." });
      trackMetaCustomEvent("Checkout_Failed", {
        plan_id: selectedPlanId,
        error_message: errorMessage,
      });
      getFunnelContext(null, "checkout_page").then((funnelContext) => {
        trackEvent("checkout_failed", {
          ...funnelContext,
          plan_id: selectedPlanId,
          source: "checkout_page",
          conversion_path: conversionPath,
          error_message_safe: errorMessage,
          error: errorMessage,
        });
      });

      setCheckoutError(errorMessage);
      setIsAutoProcessing(false);
    }
  }, [
    user,
    selectedPlanId,
    plano,
    isAnual,
    conversionPath,
    introOfferSelected,
    introOffer.key,
    offerIdParam,
    preco,
    defaultNewBillingProvider,
    usage?.plan_name,
    referralCode,
    navigate,
  ]);

  // 3. Efeito de auto-início: dispara automaticamente para usuário autenticado com guard de idempotência
  useEffect(() => {
    if (!validPlanKey) return;
    if (!user) {
      setIsAutoProcessing(false);
      return;
    }
    if (subscriptionLoading) return;

    // Verificar se usuário já possui o plano ativo
    const status = String(subscription?.subscription_status ?? subscription?.status ?? "").toLowerCase();
    const currentPlan = normalizePlanId(subscription?.plan_name);
    if (
      currentPlan === selectedPlanId
      && ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"].includes(status)
    ) {
      toast.info("Você já possui este plano ativo.");
      navigate("/prospeccao", { replace: true });
      return;
    }

    if (checkoutInitiatedRef.current) return;
    checkoutInitiatedRef.current = true;
    initiateCheckout();
  }, [user, validPlanKey, subscription, subscriptionLoading, selectedPlanId, initiateCheckout, navigate]);

  const handleRetry = () => {
    checkoutInitiatedRef.current = false;
    initiateCheckout();
  };

  if (!validPlanKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Redirecionando para seleção de planos...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header simples e transparente */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link to="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/precos" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Voltar para planos
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content: tela limpa, direta e sem seletores redundantes */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <Card className="w-full max-w-md border-border/80 shadow-xl bg-card">
          <CardHeader className="text-center pb-3">
            <div className="mx-auto mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
              Plano {plano.nome} {isAnual ? "Anual" : "Mensal"}
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {checkoutError ? "Falha ao iniciar pagamento" : "Finalizando sua assinatura"}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {checkoutError
                ? "Ocorreu um erro ao conectar com o provedor. Tente novamente."
                : (conversionPath === "direct_purchase"
                  ? "Assinatura imediata · Redirecionando para o pagamento seguro..."
                  : trialDurationDays
                    ? `Redirecionando para ativação do teste de ${trialDurationDays} dias no pagamento seguro...`
                    : "Redirecionando para ativação do teste no pagamento seguro...")}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Estado de Processamento e Transição */}
            {isAutoProcessing && (
              <div className="flex flex-col items-center justify-center py-6 space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
                <p className="text-xs text-muted-foreground animate-pulse text-center">
                  Conectando com segurança ao ambiente de pagamento...
                </p>
              </div>
            )}

            {/* Estado de Erro com Ação de Retentativa */}
            {checkoutError && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2.5">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="leading-snug">{checkoutError}</p>
                </div>
                <Button
                  onClick={handleRetry}
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Tentar novamente
                </Button>
              </div>
            )}

            {/* Estado Sem Usuário Autenticado (Fallback Seguro) */}
            {!user && !isAutoProcessing && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Para continuar com sua assinatura no Plano {plano.nome}, entre ou crie sua conta.
                </p>
                <Button asChild className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                  <Link to={appendReferralToPath(
                    `/auth?tab=signup&plan=${encodeURIComponent(selectedPlanId)}&anual=${isAnual}&conversion_path=${conversionPath}`,
                    referralCode
                  )}>
                    Criar conta ou Entrar
                  </Link>
                </Button>
              </div>
            )}

            {/* Resumo Transparente de Valores */}
            <div className="p-4 bg-muted/40 border border-border/60 rounded-xl space-y-3 text-xs text-muted-foreground">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="font-semibold text-foreground">Plano {plano.nome}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
                  {conversionPath === "direct_purchase"
                    ? "Assinatura imediata"
                    : trialDurationDays
                      ? `${trialDurationDays} dias grátis`
                      : "Teste confirmado no checkout"}
                </span>
              </div>

              {conversionPath === "direct_purchase" ? (
                introOfferSelected ? (
                  <div className="space-y-1.5">
                    <p className="font-semibold text-emerald-400">Economize no primeiro mês</p>
                    <div className="flex justify-between">
                      <span>Primeiro período:</span>
                      <span className="font-bold text-foreground">
                        R$ {selectedIntroOffer?.introPrice?.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} hoje
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Renovação regular:</span>
                      <span>
                        R$ {selectedIntroOffer?.regularPrice?.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground pt-1">
                      Não há período de teste neste caminho. A cobrança inicial é realizada imediatamente após a confirmação no provedor.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span>Valor:</span>
                      <span className="font-bold text-foreground">
                        R$ {preco.toLocaleString("pt-BR")}{periodo}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Não há período de teste neste caminho. A cobrança inicial é realizada imediatamente após a confirmação no provedor.
                    </p>
                  </div>
                )
              ) : (
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span>Hoje:</span>
                    <span className="font-bold text-emerald-400">R$ 0</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Depois do teste:</span>
                    <span className="font-semibold text-foreground">R$ {preco.toLocaleString("pt-BR")}{periodo}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground pt-1">
                    Cartão obrigatório para validação. Cancele antes do término do teste e não será cobrado.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
