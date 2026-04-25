import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ProspeccaoForm } from "@/components/prospeccao/ProspeccaoForm";
import { LeadsList } from "@/components/prospeccao/LeadsList";
import { FloatingWhatsAppButton } from "@/components/FloatingWhatsAppButton";
import { UpgradePlanDialog } from "@/components/profile/UpgradePlanDialog";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";

const Prospeccao = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const { subscription, isAdmin } = useSubscription();

  // Handle checkout success/cancel and Google OAuth checkout
  useEffect(() => {
    const handleCheckoutRedirect = async () => {
      const checkoutStatus = searchParams.get("checkout");
      
      if (checkoutStatus === "success") {
        sessionStorage.removeItem("checkout_in_progress");
        sessionStorage.removeItem("checkout_plano");
        sessionStorage.removeItem("checkout_isAnual");
        toast.success("Pagamento realizado com sucesso! Seu plano foi ativado.");
        setSearchParams({});
      } else if (checkoutStatus === "canceled") {
        sessionStorage.removeItem("checkout_in_progress");
        sessionStorage.removeItem("checkout_plano");
        sessionStorage.removeItem("checkout_isAnual");
        toast.info("Checkout cancelado. Você pode tentar novamente quando quiser.");
        setSearchParams({});
      } else if (checkoutStatus === "google_success") {
        // User logged in via Google from checkout - redirect to Kiwify
        const plano = searchParams.get("plano") || sessionStorage.getItem("checkout_plano");
        const isAnualParam = searchParams.get("isAnual") || sessionStorage.getItem("checkout_isAnual");
        const isAnual = isAnualParam === "true";
        
        if (plano) {
          // Get user info for Kiwify checkout
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
          
          // Chamar Edge Function do Stripe
          const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
            body: { planKey: plano.toLowerCase(), leadsQty: 100, isAnual }
          });
          
          if (error || !data?.url) {
            toast.error("Erro ao gerar link de pagamento. Tente pelo checkout.");
            navigate(`/checkout?plano=${plano}&anual=${isAnual}`);
            return;
          }
          
          window.location.href = data.url;
        }
        setSearchParams({});
      }
    };
    
    handleCheckoutRedirect();
  }, [searchParams, setSearchParams, navigate]);

  useEffect(() => {
    // Set up auth state listener to ensure session is fully established
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user);
        } else if (event === 'SIGNED_OUT' || !session) {
          // Only redirect if explicitly signed out or no session after initial check
          setTimeout(() => {
            supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
              if (!currentSession) {
                navigate("/auth");
              }
            });
          }, 100);
        }
      }
    );

    // Also check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        navigate("/auth");
      }
    });

    return () => authSubscription.unsubscribe();
  }, [navigate]);
  
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
      />
    </div>
  );
};

export default Prospeccao;
