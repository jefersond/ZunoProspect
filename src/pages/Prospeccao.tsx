import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ProspeccaoForm } from "@/components/prospeccao/ProspeccaoForm";
import { LeadsList } from "@/components/prospeccao/LeadsList";
import { FloatingWhatsAppButton } from "@/components/FloatingWhatsAppButton";
import { UpgradePlanDialog } from "@/components/profile/UpgradePlanDialog";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { getKiwifyCheckoutUrl } from "@/config/kiwifyLinks";
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
          
          toast.info("Conta criada com Google! Redirecionando para pagamento...");
          
          // Clear session storage
          sessionStorage.removeItem("checkout_in_progress");
          sessionStorage.removeItem("checkout_plano");
          sessionStorage.removeItem("checkout_isAnual");
          
          // Get user name from metadata if available
          const userName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name;
          
          // Redirect to Kiwify checkout
          const kiwifyUrl = getKiwifyCheckoutUrl(plano, isAnual, currentUser.email, userName);
          window.location.href = kiwifyUrl;
        }
        setSearchParams({});
      }
    };
    
    handleCheckoutRedirect();
  }, [searchParams, setSearchParams, navigate]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate("/auth");
      } else {
        setUser(user);
      }
    });
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
