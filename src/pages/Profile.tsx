import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { Loader2, Crown, Zap, Calendar, Shield, CreditCard, ExternalLink, Mail } from "lucide-react";
import { FloatingWhatsAppButton } from "@/components/FloatingWhatsAppButton";
import { UpgradePlanDialog } from "@/components/profile/UpgradePlanDialog";
import { UsageIndicator } from "@/components/subscription/UsageIndicator";
import { Badge } from "@/components/ui/badge";
import { ApiKeysSection } from "@/components/profile/ApiKeysSection";
import { OnboardingEmailsDashboard } from "@/components/admin/OnboardingEmailsDashboard";
import ChangePasswordSection from "@/components/profile/ChangePasswordSection";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppHeader } from "@/components/AppHeader";

const Profile = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { subscription, loading: subscriptionLoading, isAdmin, getPlanDisplayName, refetch } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [profile, setProfile] = useState({
    nome_completo: "",
    empresa: "",
  });
  const [cancelingSub, setCancelingSub] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [managingSubLoading, setManagingSubLoading] = useState(false);

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
    setManagingSubLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          variant: "destructive",
          title: "Sessão expirada",
          description: "Faça login novamente.",
        });
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/customer-portal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "portal" }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao conectar ao Stripe.");
      }

      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("URL do portal não retornada.");
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro ao abrir gerenciador",
        description: err.message,
      });
    } finally {
      setManagingSubLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelingSub(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          variant: "destructive",
          title: "Sessão expirada",
          description: "Faça login novamente.",
        });
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/customer-portal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "cancel_subscription" }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao cancelar assinatura.");
      }

      toast({
        title: "Cancelamento concluído!",
        description: "Seu teste grátis foi cancelado. Você não será cobrado. Seu acesso aos recursos pagos foi encerrado.",
      });

      setCancelConfirmOpen(false);
      refetch?.();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro ao cancelar",
        description: err.message,
      });
    } finally {
      setCancelingSub(false);
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
      <AppHeader
        isAdmin={isAdmin}
        showUpgradeButton={true}
        onUpgradeClick={() => setUpgradeDialogOpen(true)}
        subscription={subscription}
      />

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

              <Button
                type="submit"
                className="w-full bg-emerald-600 text-white shadow-sm shadow-emerald-950/20 hover:bg-emerald-500"
                disabled={saving}
              >
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

        {/* Card de Alteração de Senha */}
        <ChangePasswordSection />

        {/* Card de Plano e Assinatura */}
        <Card className="shadow-lg mt-6 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Plano e assinatura
            </CardTitle>
            <CardDescription>
              Gerencie seus limites, renovação e faturamento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Info do plano */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Plano atual</p>
                <div className="flex items-center gap-2 mt-1">
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
                  {subscription && subscription.subscription_status === "trialing" && (
                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-emerald-950 font-bold border-none">
                      Teste grátis ativo
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {!isAdmin && subscription && subscription.plan_name !== "free" && (
                  <Button 
                    variant="outline" 
                    onClick={handleManageSubscription} 
                    className="gap-2"
                    disabled={managingSubLoading}
                  >
                    {managingSubLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    Gerenciar faturamento
                  </Button>
                )}
                {!isAdmin && subscription && subscription.subscription_status === "trialing" && (
                  <Button 
                    variant="destructive" 
                    onClick={() => setCancelConfirmOpen(true)}
                    className="gap-2"
                  >
                    Cancelar teste grátis
                  </Button>
                )}
                {!isAdmin && subscription && subscription.plan_name === "free" && (
                  <Button onClick={() => setUpgradeDialogOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
                    <Crown className="h-4 w-4" />
                    Ver planos
                  </Button>
                )}
              </div>
            </div>

            {/* Informações detalhadas do trial */}
            {!isAdmin && subscription && subscription.subscription_status === "trialing" && (
              <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-sm space-y-2">
                <p className="text-foreground">
                  ✓ Você está no teste grátis do plano <span className="font-bold capitalize">{subscription.plan_name}</span>.
                </p>
                {subscription.trial_days_remaining !== undefined && subscription.trial_days_remaining !== null && (
                  <p className="text-emerald-400 font-semibold">
                    Restam {subscription.trial_days_remaining} {subscription.trial_days_remaining === 1 ? 'dia' : 'dias'} de teste.
                  </p>
                )}
                <p className="text-muted-foreground text-xs leading-5">
                  Hoje você não foi cobrado. Ao fim do teste, sua assinatura será renovada automaticamente por{" "}
                  <span className="font-semibold text-foreground">
                    R$ {subscription.plan_name === "pro" ? "97" : subscription.plan_name === "agency" ? "247" : "47"}/mês
                  </span>. Você pode cancelar antes do fim do teste para não ser cobrado.
                </p>
              </div>
            )}

            {/* Indicador de uso */}
            <div className="pt-4 border-t border-border/40">
              <UsageIndicator />
            </div>

            {/* Período de renovação / Cobrança */}
            {!isAdmin && subscription && subscription.plan_name !== "free" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-4 border-t border-border/40">
                <Calendar className="h-4 w-4" />
                <span>
                  {subscription.subscription_status === "trialing" ? (
                    <>Cobrança em: {new Date(subscription.billing_period_end).toLocaleDateString('pt-BR')}</>
                  ) : (
                    <>Próxima cobrança: {new Date(subscription.billing_period_end).toLocaleDateString('pt-BR')}</>
                  )}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Integration Section - Agency plan only */}
        {(isAdmin || subscription?.plan_name === 'agencia') && (
          <ApiKeysSection />
        )}

        {/* Admin Email Onboarding Metrics - Admin only */}
        {isAdmin && (
          <Card className="shadow-lg mt-6 border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-amber-500" />
                    Métricas de Email (Admin)
                  </CardTitle>
                  <CardDescription>
                    Acompanhe o desempenho dos emails de onboarding
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/admin/email")} className="gap-2">
                  Ver Dashboard Completo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <OnboardingEmailsDashboard compact />
            </CardContent>
          </Card>
        )}
      </main>

      {/* Dialog de Confirmação de Cancelamento do Trial */}
      <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Shield className="h-5 w-5" />
              Cancelar Teste Grátis
            </DialogTitle>
            <DialogDescription>
              Confirme se deseja cancelar o seu teste grátis imediatamente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground leading-6">
              Se você cancelar agora, perderá o acesso aos recursos do teste grátis imediatamente. Você não será cobrado.
            </p>
            
            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="destructive"
                className="w-full h-11 text-base font-semibold"
                onClick={handleCancelSubscription}
                disabled={cancelingSub}
              >
                {cancelingSub ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelando teste...
                  </>
                ) : (
                  "Cancelar teste grátis agora"
                )}
              </Button>
              
              <Button
                variant="outline"
                className="w-full h-11 text-base"
                onClick={() => setCancelConfirmOpen(false)}
                disabled={cancelingSub}
              >
                Manter meu teste grátis
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UpgradePlanDialog 
        open={upgradeDialogOpen} 
        onOpenChange={setUpgradeDialogOpen}
        currentPlanName={subscription?.plan_name}
      />
      <FloatingWhatsAppButton />
    </div>
  );
};

export default Profile;
