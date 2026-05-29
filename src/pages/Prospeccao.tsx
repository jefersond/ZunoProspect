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
import { createStripeCheckout } from "@/services/stripeCheckout";
import { trackEvent } from "@/lib/analytics";
import { trackInitiateCheckout, trackMetaCustomEvent } from "@/lib/metaPixel";
import { PLANS, normalizePlanId } from "@/config/plans";
import { getFunnelContext } from "@/lib/funnelContext";
import { AppHeader } from "@/components/AppHeader";

const Prospeccao = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const { subscription, isAdmin } = useSubscription();
  const { user } = useAuth();

  // Handle checkout success/cancel and Google OAuth checkout
  useEffect(() => {
    const handleCheckoutRedirect = async () => {
      const checkoutStatus = searchParams.get("checkout");
      
      if (checkoutStatus === "success") {
        trackEvent("checkout_completed", { source: "checkout_return" });
        // Nao disparamos Purchase aqui: a URL de retorno nao valida pagamento.
        // Purchase deve ser enviado pelo webhook Stripe via Conversions API.
        sessionStorage.removeItem("checkout_in_progress");
        sessionStorage.removeItem("checkout_plano");
        sessionStorage.removeItem("checkout_isAnual");
        toast.success("Pagamento realizado com sucesso! Seu plano foi ativado.");
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
            const data = await createStripeCheckout({
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
                stripe_session_id: data.sessionId || null,
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
            window.location.href = data.url;
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
        <ProspeccaoForm />
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
