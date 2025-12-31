import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Globe, Loader2, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getKiwifyCheckoutUrl, KIWIFY_CHECKOUT_LINKS } from "@/config/kiwifyLinks";

interface UsaAddonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAnual: boolean;
}

type UserState = 
  | { type: "loading" }
  | { type: "not_logged_in" }
  | { type: "eligible"; planName: string; email?: string }
  | { type: "not_eligible"; planName: string }
  | { type: "already_has_addon"; expiresAt: string };

export function UsaAddonDialog({ open, onOpenChange, isAnual }: UsaAddonDialogProps) {
  const [userState, setUserState] = useState<UserState>({ type: "loading" });
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      checkUserStatus();
    }
  }, [open]);

  const checkUserStatus = async () => {
    setUserState({ type: "loading" });
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setUserState({ type: "not_logged_in" });
        return;
      }

      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select("plan_name, usa_addon, usa_addon_active_until")
        .eq("user_id", user.id)
        .single();

      if (!sub) {
        setUserState({ type: "not_logged_in" });
        return;
      }

      // Check if already has active USA addon
      if (sub.usa_addon && sub.usa_addon_active_until) {
        const expiresAt = new Date(sub.usa_addon_active_until);
        if (expiresAt > new Date()) {
          setUserState({ 
            type: "already_has_addon", 
            expiresAt: expiresAt.toLocaleDateString("pt-BR") 
          });
          return;
        }
      }

      // Check if eligible plan (pro or agencia)
      const planNormalized = sub.plan_name.toLowerCase();
      const isEligible = planNormalized === "pro" || planNormalized === "agencia" || planNormalized === "agência";

      if (isEligible) {
        setUserState({ 
          type: "eligible", 
          planName: sub.plan_name,
          email: user.email 
        });
      } else {
        setUserState({ 
          type: "not_eligible", 
          planName: sub.plan_name 
        });
      }
    } catch (error) {
      console.error("Error checking user status:", error);
      setUserState({ type: "not_logged_in" });
    }
  };

  const handleAddonCheckout = (email?: string) => {
    const url = isAnual 
      ? KIWIFY_CHECKOUT_LINKS.usa_addon_anual 
      : KIWIFY_CHECKOUT_LINKS.usa_addon_mensal;
    
    if (email) {
      window.open(`${url}?email=${encodeURIComponent(email)}`, "_blank");
    } else {
      window.open(url, "_blank");
    }
    onOpenChange(false);
  };

  const handlePlanCheckout = (plan: "pro" | "agencia") => {
    const url = getKiwifyCheckoutUrl(plan, isAnual);
    window.open(url, "_blank");
    onOpenChange(false);
  };

  const goToProspeccao = () => {
    navigate("/prospeccao");
    onOpenChange(false);
  };

  const goToLogin = () => {
    navigate("/auth");
    onOpenChange(false);
  };

  const PRO_PRICE = isAnual ? 970 : 97;
  const AGENCIA_PRICE = isAnual ? 2470 : 247;
  const ADDON_PRICE = isAnual ? 570 : 57;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Globe className="h-6 w-6 text-blue-500" />
            </div>
            <span className="text-2xl">🇺🇸</span>
          </div>
          <DialogTitle className="text-2xl">
            Prospecção nos Estados Unidos
          </DialogTitle>
          <DialogDescription>
            Expanda seu alcance para o mercado americano
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {userState.type === "loading" && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {userState.type === "already_has_addon" && (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Você já tem o USA Add-on ativo!
              </h3>
              <p className="text-muted-foreground mb-2">
                Válido até: <span className="font-medium">{userState.expiresAt}</span>
              </p>
              <Button 
                onClick={goToProspeccao}
                className="mt-4 bg-blue-600 hover:bg-blue-700"
              >
                <Globe className="mr-2 h-4 w-4" />
                Ir para Prospecção
              </Button>
            </div>
          )}

          {userState.type === "eligible" && (
            <div className="text-center py-6">
              <Badge className="mb-4 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Você tem o plano {userState.planName}
              </Badge>
              
              <h3 className="text-xl font-semibold mb-2">
                Adicione o complemento USA agora!
              </h3>
              <p className="text-muted-foreground mb-6">
                Acesse leads em todos os 50 estados americanos + DC
              </p>

              <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-6 mb-6">
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-3xl font-bold text-blue-600">
                    + R$ {isAnual ? Math.round(ADDON_PRICE / 12) : ADDON_PRICE}
                  </span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                {isAnual && (
                  <p className="text-sm text-muted-foreground">
                    cobrado R$ {ADDON_PRICE} por ano
                  </p>
                )}
              </div>

              <Button 
                size="lg"
                onClick={() => handleAddonCheckout(userState.email)}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Ativar USA Add-on
              </Button>
            </div>
          )}

          {(userState.type === "not_logged_in" || userState.type === "not_eligible") && (
            <div className="py-4">
              {userState.type === "not_eligible" && (
                <div className="text-center mb-6">
                  <Badge variant="outline" className="mb-3">
                    Seu plano atual: {userState.planName}
                  </Badge>
                  <p className="text-muted-foreground">
                    Este complemento está disponível apenas para os planos <strong>Pro</strong> e <strong>Agência</strong>
                  </p>
                </div>
              )}

              {userState.type === "not_logged_in" && (
                <p className="text-center text-muted-foreground mb-6">
                  Este complemento está disponível para os planos <strong>Pro</strong> e <strong>Agência</strong>
                </p>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {/* Pro Card */}
                <Card className="p-6 border-2 hover:border-primary/50 transition-colors">
                  <div className="text-center">
                    <h4 className="font-bold text-lg mb-1">Plano Pro</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Ideal para freelancers
                    </p>
                    
                    <div className="space-y-1 mb-4">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-2xl font-bold">
                          R$ {isAnual ? Math.round(PRO_PRICE / 12) : PRO_PRICE}
                        </span>
                        <span className="text-muted-foreground text-sm">/mês</span>
                      </div>
                      <div className="text-sm text-blue-600">
                        + R$ {isAnual ? Math.round(ADDON_PRICE / 12) : ADDON_PRICE}/mês add-on USA
                      </div>
                      <div className="text-xs text-muted-foreground pt-1 border-t">
                        = <span className="font-semibold">R$ {isAnual ? Math.round((PRO_PRICE + ADDON_PRICE) / 12) : PRO_PRICE + ADDON_PRICE}</span>/mês total
                      </div>
                    </div>

                    <Button 
                      className="w-full"
                      variant="outline"
                      onClick={() => handlePlanCheckout("pro")}
                    >
                      Escolher Pro
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </Card>

                {/* Agência Card */}
                <Card className="p-6 border-2 border-primary/30 bg-primary/5">
                  <div className="text-center">
                    <Badge className="mb-2">Recomendado</Badge>
                    <h4 className="font-bold text-lg mb-1">Plano Agência</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Para equipes e agências
                    </p>
                    
                    <div className="space-y-1 mb-4">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-2xl font-bold">
                          R$ {isAnual ? Math.round(AGENCIA_PRICE / 12) : AGENCIA_PRICE}
                        </span>
                        <span className="text-muted-foreground text-sm">/mês</span>
                      </div>
                      <div className="text-sm text-blue-600">
                        + R$ {isAnual ? Math.round(ADDON_PRICE / 12) : ADDON_PRICE}/mês add-on USA
                      </div>
                      <div className="text-xs text-muted-foreground pt-1 border-t">
                        = <span className="font-semibold">R$ {isAnual ? Math.round((AGENCIA_PRICE + ADDON_PRICE) / 12) : AGENCIA_PRICE + ADDON_PRICE}</span>/mês total
                      </div>
                    </div>

                    <Button 
                      className="w-full"
                      onClick={() => handlePlanCheckout("agencia")}
                    >
                      Escolher Agência
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              </div>

              {userState.type === "not_logged_in" && (
                <div className="text-center mt-6 pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">
                    Já tem Pro ou Agência?
                  </p>
                  <Button variant="link" onClick={goToLogin}>
                    Faça login para adicionar o add-on
                  </Button>
                </div>
              )}

              {userState.type === "not_eligible" && (
                <div className="text-center mt-6 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Após fazer upgrade, você poderá adicionar o USA Add-on
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
