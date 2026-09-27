import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ProspeccaoForm } from "@/components/prospeccao/ProspeccaoForm";
import { LeadsList } from "@/components/prospeccao/LeadsList";
import { FloatingWhatsAppButton } from "@/components/FloatingWhatsAppButton";
import { UpgradePlanDialog } from "@/components/profile/UpgradePlanDialog";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { createBillingCheckout, billingRedirectAdapter } from "@/services/billingCheckout";
import { trackEvent } from "@/lib/analytics";
import { trackInitiateCheckout, trackMetaCustomEvent } from "@/lib/metaPixel";
import { PLANS, normalizePlanId } from "@/config/plans";
import { getFunnelContext } from "@/lib/funnelContext";
import { AppHeader } from "@/components/AppHeader";
import { PaymentRecoveryBanner } from "@/components/subscription/PaymentRecoveryBanner";
import { TrialActivationPanel } from "@/components/subscription/TrialActivationPanel";

const Prospeccao = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const { subscription, loading: subscriptionLoading, error: subscriptionError, isAdmin } = useSubscription();
  const { user } = useAuth();

  // Handle checkout success/cancel and Google OAuth checkout
  useEffect(() => {
    const handleCheckoutRedirect = async () => {
      const checkoutStatus = searchParams.get("checkout");
      
      if (checkoutStatus === "success") {
        // A URL de retorno sozinha nao prova pagamento. Primeiro sincronizamos
        // a assinatura diretamente com o Stripe e usamos o periodo real retornado.
        const { data: synced, error: syncError } = await supabase.functions.invoke("check-subscription");
        const realStatus = String(synced?.status || "").toLowerCase();
        const realPeriodEnd = synced?.billing_period_end ? new Date(synced.billing_period_end) : null;
        const realTrialEnd = synced?.trial_end ? new Date(synced.trial_end) : null;
        const formatBillingDate = (date: Date | null) =>
          date && !Number.isNaN(date.getTime())
            ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(date)
            : null;

        trackEvent("checkout_completed", {
          source: "checkout_return",
          provider_verified: !syncError && Boolean(synced?.synchronized),
          subscription_status: realStatus || null,
        });
        // Nunca disparamos Purchase no browser. O pagamento canonico continua no webhook Stripe.
        sessionStorage.removeItem("checkout_in_progress");
        sessionStorage.removeItem("checkout_plano");
        sessionStorage.removeItem("checkout_isAnual");

        if (!syncError && realStatus === "trialing") {
          const chargeDate = formatBillingDate(realTrialEnd || realPeriodEnd);
          toast.success(
            chargeDate
              ? `Teste grátis iniciado. Hoje R$0. Primeira cobrança na data real do Stripe: ${chargeDate}.`
              : "Teste grátis iniciado. Hoje R$0. A data da primeira cobrança está registrada no Stripe.",
          );
        } else if (!syncError && realStatus === "active") {
          const renewalDate = formatBillingDate(realPeriodEnd);
          toast.success(
            renewalDate
              ? `Assinatura ativa. Próxima cobrança na data real do Stripe: ${renewalDate}.`
              : "Assinatura ativa. A próxima cobrança está registrada no Stripe.",
          );
        } else {
          toast.info("Checkout concluído. O pagamento será confirmado pelo Stripe antes de ativar o status pago.");
        }
        setSearchParams({});
      } else if (checkoutStatus === "canceled" || checkoutStatus === "cancelled") {
        sessionStorage.removeItem("checkout_in_progress");
        sessionStorage.removeItem("checkout_plano");
        sessionStorage.removeItem("checkout_isAnual");
        toast.info("Checkout cancelado. Você pode tentar novamente quando quiser.");
        setSearchParams({});
      } else if (checkoutStatus === "google_success") {
        // User logged in via Google from checkout - create Stripe Checkout
        const plano = searchParams.get("plano") || sessionStorage.getItem("checkout_plano");
        const isAnualParam = searchParams.get("isAnual") || sessionStorage.getItem("checkout_isAnual");
        const isAnual = isAnualParam === "true";
        
        if (plano) {
          // Get user info for Stripe checkout
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          
          if (!currentUser?.email) {
            // No user logged in - redirect to checkout page with params
            navigate(`/checkout?plano=${plano}&anual=${isAnual}`);
            return;
          }
          
          toast.info("Conta criada com Google! Gerando link de pagamento...");
          
          // Clear session storage
          sessionStorage.removeItem("checkout_in_progress");
          sessionStorage.removeItem("checkout_plano");
          sessionStorage.removeItem("checkout_isAnual");
          
          try {
            const normalizedPlan = normalizePlanId(plano);
            const data = await createBillingCheckout({
              selectedPlan: { planKey: plano.toLowerCase() },
              billingCycle: "monthly",
            });
            if (normalizedPlan) {
              const plan = PLANS[normalizedPlan];
              const funnelContext = await getFunnelContext(subscription, "navbar");
              trackEvent("checkout_started", {
                ...funnelContext,
                plan_id: normalizedPlan,
                plan_name: plan.name,
                value: plan.monthlyPrice,
                currency: "BRL",
                billing_cycle: "monthly",
                location: "google_success_return",
                source: "navbar",
                stripe_session_id: data.provider === "stripe" ? data.checkoutId || null : null,
                provider_checkout_id: data.checkoutId || null,
                billing_provider: data.provider,
                trial_duration_days: data.trialDurationDays,
                trial_policy_version: data.trialPolicyVersion,
                content_name: `Zuno Propect ${plan.name}`,
              });
              trackInitiateCheckout({
                content_name: `Zuno Propect ${plan.name}`,
                content_category: "subscription",
                plan_id: normalizedPlan,
                plan_name: plan.name,
                value: plan.monthlyPrice,
                currency: "BRL",
              });
            }
            billingRedirectAdapter(data.provider).redirect(data);
          } catch (error) {
            trackMetaCustomEvent("Checkout_Failed", {
              plan_id: plano.toLowerCase(),
              error_message: "checkout_error",
            });
            trackEvent("checkout_failed", { plan_id: plano.toLowerCase(), billing_cycle: "monthly", location: "google_success_return", source: "navbar", error_message_safe: "checkout_error", error: "checkout_error" });
            console.error("Erro ao gerar checkout apos Google:", error);
            toast.error("Erro ao gerar link de pagamento. Tente pelo checkout.");
            navigate(`/checkout?plano=${plano}&anual=${isAnual}`);
            return;
          }
        }
        setSearchParams({});
      }
    };
    
    handleCheckoutRedirect();
  }, [searchParams, setSearchParams, navigate]);

  useEffect(() => {
    if (user) {
      trackEvent("app_entered", { page: "prospeccao" });
      trackEvent("prospection_page_viewed", {});
    }
  }, [user]);
  
  if (!user) return null;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-primary/5">
      <AppHeader
        isAdmin={isAdmin}
        showUpgradeButton={true}
        onUpgradeClick={() => setShowUpgradeDialog(true)}
        subscription={subscription}
      />

      <main className="container mx-auto px-4 py-8 space-y-8">
        <PaymentRecoveryBanner />
        <TrialActivationPanel subscription={subscription} loading={subscriptionLoading} error={subscriptionError} />
        <div id="primeira-busca">
          <ProspeccaoForm />
        </div>
        <LeadsList />
      </main>
      <FloatingWhatsAppButton />
      <UpgradePlanDialog 
        open={showUpgradeDialog} 
        onOpenChange={setShowUpgradeDialog}
        currentPlanName={subscription?.plan_name}
        source="navbar"
      />
    </div>
  );
};

export default Prospeccao;
