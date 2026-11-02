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
import { trackInitiateCheckout, trackMetaCustomEvent, trackStartTrial } from "@/lib/metaPixel";
import { PLANS, normalizePlanId } from "@/config/plans";
import { getFunnelContext } from "@/lib/funnelContext";
import { AppHeader } from "@/components/AppHeader";
import { PaymentRecoveryBanner } from "@/components/subscription/PaymentRecoveryBanner";
import { TrialActivationPanel } from "@/components/subscription/TrialActivationPanel";
import { CommercialMissionGuide } from "@/components/prospeccao/CommercialMissionGuide";
import { useCommercialMission } from "@/hooks/useCommercialMission";

const Prospeccao = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const { subscription, loading: subscriptionLoading, error: subscriptionError, isAdmin } = useSubscription();
  const { user } = useAuth();
  const commercialMission = useCommercialMission();

  // Handle checkout success/cancel and Google OAuth checkout
  useEffect(() => {
    const handleCheckoutRedirect = async () => {
      const checkoutStatus = searchParams.get("checkout");
      
      if (checkoutStatus === "success") {
        const sessionId = searchParams.get("session_id") || "";
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
          stripe_session_id: sessionId || null,
        });
        // Nunca disparamos Purchase no browser. O pagamento canonico continua no webhook Stripe.
        sessionStorage.removeItem("checkout_in_progress");
        sessionStorage.removeItem("checkout_plano");
        sessionStorage.removeItem("checkout_isAnual");

        if (!syncError && realStatus === "trialing") {
          // Disparo determinístico e idempotente do Meta Pixel StartTrial:
          // 1. Exige sessão real da Stripe (sessionId) e usuário autenticado
          // 2. Não dispara por status trialing antigo sem checkout novo
          // 3. Previne duplicação em F5, recarregamento ou re-login (localStorage + app_events)
          if (sessionId && user?.id) {
            const trackingKey = `zuno_meta_start_trial_${user.id}_${sessionId}`;
            const alreadyTrackedLocally = Boolean(localStorage.getItem(trackingKey));

            let alreadyTrackedRemotely = false;
            try {
              const { data: existingEvents } = await supabase
                .from("app_events")
                .select("id")
                .eq("user_id", user.id)
                .eq("event_name", "meta_start_trial_dispatched")
                .contains("metadata", { session_id: sessionId })
                .limit(1);
              if (existingEvents && existingEvents.length > 0) {
                alreadyTrackedRemotely = true;
              }
            } catch {
              // Silencioso em caso de indisponibilidade transitória
            }

            if (!alreadyTrackedLocally && !alreadyTrackedRemotely) {
              localStorage.setItem(trackingKey, Date.now().toString());

              trackEvent("meta_start_trial_dispatched", {
                session_id: sessionId,
                plan_name: synced?.plan_name || "starter",
                trial_end: synced?.trial_end || null,
              });

              trackStartTrial({
                plan_id: synced?.plan_name || "starter",
                plan_name: synced?.plan_name === "starter" ? "Starter" : synced?.plan_name === "pro" ? "Pro" : "Agency",
                content_name: `Zuno Prospect ${synced?.plan_name || "Starter"}`,
                content_category: "subscription",
                value: 0,
                currency: "BRL",
                event_id: sessionId,
                predicted_ltv: synced?.plan_name === "agency" ? 247 : synced?.plan_name === "pro" ? 97 : 47,
              });
            }
          }

          const chargeDate = formatBillingDate(realTrialEnd || realPeriodEnd);
          toast.success(
            chargeDate
              ? `Período gratuito iniciado. Hoje R$0. Primeira cobrança na data real do Stripe: ${chargeDate}.`
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
                content_name: `Zuno Prospect ${plan.name}`,
              });
              trackInitiateCheckout({
                content_name: `Zuno Prospect ${plan.name}`,
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

      <CommercialMissionGuide
        phase={commercialMission.phase}
        currentStep={commercialMission.step}
        onStartMission={commercialMission.startMission}
        onStepChange={(newStep) => {
          if (newStep > commercialMission.step) {
            commercialMission.nextStep();
          } else {
            commercialMission.prevStep();
          }
        }}
        onDismiss={commercialMission.dismissMission}
        onComplete={() => commercialMission.nextStep(7)}
      />
    </div>
  );
};

export default Prospeccao;
