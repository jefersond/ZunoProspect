import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { ArrowLeft, Loader2, User, Search, BarChart3, History, FileText, LogOut, Bookmark, Crown, Zap, Calendar, Shield, CreditCard, ExternalLink } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { UpgradePlanDialog } from "@/components/profile/UpgradePlanDialog";
import { UsageIndicator } from "@/components/subscription/UsageIndicator";
import { Badge } from "@/components/ui/badge";

const Profile = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { subscription, loading: subscriptionLoading, isAdmin, getPlanDisplayName, refetch } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [profile, setProfile] = useState({
    nome_completo: "",
    empresa: "",
  });

  // Handle checkout result from URL params
  useEffect(() => {
    const checkoutResult = searchParams.get("checkout");
    if (checkoutResult === "success") {
      toast({
        title: "Pagamento realizado com sucesso!",
        description: "Seu plano foi atualizado. As mudanças podem levar alguns instantes para refletir.",
      });
      // Clear the search params
      setSearchParams({});
      // Refresh subscription data
      setTimeout(() => refetch?.(), 2000);
    } else if (checkoutResult === "canceled") {
      toast({
        variant: "destructive",
        title: "Checkout cancelado",
        description: "Você cancelou o processo de pagamento.",
      });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, toast, refetch]);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setProfile({
          nome_completo: data.nome_completo || "",
          empresa: data.empresa || "",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar perfil",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          nome_completo: profile.nome_completo,
          empresa: profile.empresa,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram salvas com sucesso.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar perfil",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleManageSubscription = async () => {
    setManagingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error("URL do portal não retornada");
      }
    } catch (error: any) {
      console.error("Erro ao abrir portal:", error);
      toast({
        variant: "destructive",
        title: "Erro ao abrir gerenciamento",
        description: error.message || "Tente novamente mais tarde.",
      });
    } finally {
      setManagingSubscription(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/10 to-primary/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-primary/5">
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo e Título */}
            <Logo />

            {/* Navegação e Ações */}
            <div className="flex items-center gap-1">
              {/* Navegação Principal */}
              <nav className="flex items-center gap-1 mr-2 pr-2 border-r border-border">
                <Button variant="ghost" size="sm" onClick={() => navigate("/prospeccao")} className="gap-2">
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">Prospecção</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/leads-salvos")} className="gap-2">
                  <Bookmark className="h-4 w-4" />
                  <span className="hidden sm:inline">Salvos</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/templates")} className="gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Templates</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/historico")} className="gap-2">
                  <History className="h-4 w-4" />
                  <span className="hidden sm:inline">Histórico</span>
                </Button>
              </nav>

              {/* Ações do Usuário */}
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setUpgradeDialogOpen(true)} 
                  className="gap-2 text-primary hover:text-primary"
                >
                  <Crown className="h-4 w-4" />
                  <span className="hidden sm:inline">Upgrade</span>
                </Button>
                <ThemeToggle />
                <Button variant="outline" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate("/auth"); }} className="gap-2 ml-1">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sair</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Informações do Perfil</CardTitle>
            <CardDescription>
              Atualize suas informações pessoais e da empresa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="nome_completo">Nome Completo</Label>
                <Input
                  id="nome_completo"
                  type="text"
                  placeholder="Seu nome completo"
                  value={profile.nome_completo}
                  onChange={(e) =>
                    setProfile({ ...profile, nome_completo: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="empresa">Empresa</Label>
                <Input
                  id="empresa"
                  type="text"
                  placeholder="Nome da sua empresa"
                  value={profile.empresa}
                  onChange={(e) =>
                    setProfile({ ...profile, empresa: e.target.value })
                  }
                />
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Alterações"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Card de Upgrade de Plano */}
        <Card className="shadow-lg mt-6 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Seu Plano
            </CardTitle>
            <CardDescription>
              Gerencie sua assinatura e veja seu uso
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Info do plano */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Plano atual</p>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold flex items-center gap-2">
                    {isAdmin ? (
                      <Shield className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Zap className="h-4 w-4 text-primary" />
                    )}
                    {subscriptionLoading ? "Carregando..." : getPlanDisplayName()}
                  </p>
                  {isAdmin && (
                    <Badge className="bg-amber-500 hover:bg-amber-600">Admin</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {!isAdmin && subscription?.plan_name !== 'agencia' && subscription?.plan_name !== 'starter' && (
                  <Button 
                    variant="outline" 
                    onClick={handleManageSubscription} 
                    className="gap-2"
                    disabled={managingSubscription}
                  >
                    {managingSubscription ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Gerenciar</span>
                  </Button>
                )}
                {!isAdmin && subscription?.plan_name === 'starter' && (
                  <Button onClick={() => setUpgradeDialogOpen(true)} className="gap-2">
                    <Crown className="h-4 w-4" />
                    Fazer Upgrade
                  </Button>
                )}
                {!isAdmin && subscription?.plan_name !== 'agencia' && subscription?.plan_name !== 'starter' && (
                  <Button onClick={() => setUpgradeDialogOpen(true)} className="gap-2">
                    <Crown className="h-4 w-4" />
                    Upgrade
                  </Button>
                )}
              </div>
            </div>

            {/* Indicador de uso */}
            <div className="pt-4 border-t">
              <UsageIndicator />
            </div>

            {/* Período de renovação */}
            {subscription && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-4 border-t">
                <Calendar className="h-4 w-4" />
                <span>
                  Renova em {new Date(subscription.billing_period_end).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <UpgradePlanDialog 
        open={upgradeDialogOpen} 
        onOpenChange={setUpgradeDialogOpen} 
      />
    </div>
  );
};

export default Profile;
