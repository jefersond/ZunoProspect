import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ProspeccaoForm } from "@/components/prospeccao/ProspeccaoForm";
import { LeadsList } from "@/components/prospeccao/LeadsList";
import { LogOut, User, BarChart3, FileText, History, Bookmark, Kanban, Zap, Mail } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { FloatingWhatsAppButton } from "@/components/FloatingWhatsAppButton";
import { UpgradePlanDialog } from "@/components/profile/UpgradePlanDialog";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";

const Prospeccao = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const { subscription, isAdmin } = useSubscription();
  const isAtLimit = subscription && subscription.leads_limit !== -1 && subscription.leads_remaining <= 0;

  // Handle checkout success/cancel from Stripe redirect and Google OAuth checkout
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
        // User logged in via Google from checkout - redirect to Stripe
        const plano = searchParams.get("plano") || sessionStorage.getItem("checkout_plano");
        const isAnualParam = searchParams.get("isAnual") || sessionStorage.getItem("checkout_isAnual");
        const isAnual = isAnualParam === "true";
        
        if (plano) {
          toast.info("Conta criada com Google! Redirecionando para pagamento...");
          
          try {
            const { data, error } = await supabase.functions.invoke("create-checkout", {
              body: { plano, isAnual }
            });
            
            if (error) throw error;
            
            if (data?.url) {
              sessionStorage.setItem("checkout_in_progress", "true");
              window.location.href = data.url;
            } else {
              throw new Error("URL de checkout não retornada");
            }
          } catch (error: any) {
            toast.error("Erro ao processar pagamento", { description: error.message });
            sessionStorage.removeItem("checkout_in_progress");
            sessionStorage.removeItem("checkout_plano");
            sessionStorage.removeItem("checkout_isAnual");
          }
        }
        setSearchParams({});
      }
    };
    
    handleCheckoutRedirect();
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    supabase.auth.getUser().then(({
      data: {
        user
      }
    }) => {
      if (!user) {
        navigate("/auth");
      } else {
        setUser(user);
      }
    });
  }, [navigate]);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };
  if (!user) return null;
  return <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-primary/5">
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo e Título */}
            <Logo />

            {/* Navegação e Ações */}
            <div className="flex items-center gap-1">
              {/* Navegação Principal */}
              <nav className="flex items-center gap-1 mr-2 pr-2 border-r border-border">
                <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/leads-salvos")} className="gap-2">
                  <Bookmark className="h-4 w-4" />
                  <span className="hidden sm:inline">Salvos</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/pipeline")} className="gap-2">
                  <Kanban className="h-4 w-4" />
                  <span className="hidden sm:inline">Pipeline</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/templates")} className="gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Templates</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/historico")} className="gap-2">
                  <History className="h-4 w-4" />
                  <span className="hidden sm:inline">Histórico</span>
                </Button>
                {isAdmin && (
                  <Button variant="ghost" size="sm" onClick={() => navigate("/admin/email")} className="gap-2 text-amber-500 hover:text-amber-400">
                    <Mail className="h-4 w-4" />
                    <span className="hidden sm:inline">Email</span>
                  </Button>
                )}
              </nav>

              {/* Botão de Upgrade - sempre visível para usuários não-Agência */}
              {subscription?.plan_name !== "agencia" && !isAdmin && (
                <Button 
                  variant="default" 
                  size="default" 
                  onClick={() => setShowUpgradeDialog(true)} 
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-500/20 mr-2"
                >
                  <Zap className="h-4 w-4" />
                  <span className="hidden sm:inline">Fazer Upgrade</span>
                  <span className="sm:hidden">Upgrade</span>
                </Button>
              )}

              {/* Ações do Usuário */}
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <Button variant="ghost" size="sm" onClick={() => navigate("/profile")} className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Perfil</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 ml-1">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sair</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <ProspeccaoForm />
        <LeadsList />
      </main>
      <FloatingWhatsAppButton />
      <UpgradePlanDialog 
        open={showUpgradeDialog} 
        onOpenChange={setShowUpgradeDialog}
      />
    </div>;
};
export default Prospeccao;