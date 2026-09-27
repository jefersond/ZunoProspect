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
import { CheckCircle2, Globe, Loader2, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ADDONS } from "@/config/addons";
import { createStripeAddonCheckout } from "@/services/stripeAddonCheckout";
import { isAdminUser } from "@/config/admin";

interface UsaAddonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAnual: boolean;
}

type UserState =
  | { type: "loading" }
  | { type: "not_logged_in" }
  | { type: "admin" }
  | { type: "eligible"; planName: string }
  | { type: "not_eligible"; planName: string }
  | { type: "already_has_addon" };

const PAID_PLANS = new Set(["starter", "pro", "agency", "agencia", "iniciante"]);

function normalizePlanName(planName?: string | null) {
  const normalized = String(planName || "free").trim().toLowerCase();
  if (normalized === "iniciante") return "starter";
  if (normalized === "agência") return "agencia";
  return normalized;
}

function isPaidPlanActive(planName?: string | null, billingPeriodEnd?: string | null) {
  const normalized = normalizePlanName(planName);
  const periodActive = !billingPeriodEnd || new Date(billingPeriodEnd).getTime() > Date.now();
  return PAID_PLANS.has(normalized) && periodActive;
}

export function UsaAddonDialog({ open, onOpenChange }: UsaAddonDialogProps) {
  const [userState, setUserState] = useState<UserState>({ type: "loading" });
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();
  const addon = ADDONS.us_prospecting;

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

      const { data: adminCheck } = await supabase.rpc("is_admin", { _user_id: user.id });

      if (isAdminUser(user, { is_admin: adminCheck === true })) {
        setUserState({ type: "admin" });
        return;
      }

      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select("plan_name, billing_period_end")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: addonData } = await supabase
        .from("user_addons")
        .select("status")
        .eq("user_id", user.id)
        .eq("addon_id", addon.id)
        .maybeSingle();

      if (addonData?.status === "active") {
        setUserState({ type: "already_has_addon" });
        return;
      }

      if (isPaidPlanActive(sub?.plan_name, sub?.billing_period_end)) {
        setUserState({
          type: "eligible",
          planName: sub?.plan_name || "plano ativo",
        });
        return;
      }

      setUserState({
        type: "not_eligible",
        planName: sub?.plan_name || "free",
      });
    } catch (error) {
      console.error("Erro ao verificar status do add-on EUA:", error);
      setUserState({ type: "not_logged_in" });
    }
  };

  const handleAddonCheckout = async () => {
    setIsProcessing(true);
    try {
      toast.loading("Gerando checkout do complemento...");
      const data = await createStripeAddonCheckout({ addonId: addon.id });
      toast.dismiss();
      window.location.href = data.url;
      onOpenChange(false);
    } catch (error: any) {
      toast.dismiss();
      if (error?.status === 401) {
        toast.error("Sessão expirada", {
          description: "Entre novamente para continuar com o pagamento.",
        });
        navigate("/auth?tab=login");
        return;
      }
      if (error?.status === 403) {
        toast.error("Este complemento está disponível apenas para usuários com plano ativo.", {
          description: "Escolha um plano para ativar a prospecção nos EUA.",
        });
        return;
      }
      if (error?.status === 409) {
        toast.success("Complemento já ativo");
        setUserState({ type: "already_has_addon" });
        return;
      }
      toast.error("Não foi possível iniciar o pagamento", {
        description: "Tente novamente.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const choosePlan = () => {
    navigate("/precos");
    onOpenChange(false);
  };

  const goToProspeccao = () => {
    navigate("/prospeccao");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#20312A] bg-[#111D18] text-[#F3F7F5] sm:max-w-xl">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-lg bg-[#12D98B]/10 p-2">
              <Globe className="h-6 w-6 text-[#12D98B]" />
            </div>
            <span className="text-2xl">US</span>
          </div>
          <DialogTitle className="text-2xl">{addon.name}</DialogTitle>
          <DialogDescription>{addon.description}</DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {userState.type === "loading" && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#A9B8B1]" />
            </div>
          )}

          {(userState.type === "already_has_addon" || userState.type === "admin") && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#12D98B]/10">
                <CheckCircle2 className="h-8 w-8 text-[#12D98B]" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">
                {userState.type === "admin" ? "Liberado para admin" : "Complemento ativo"}
              </h3>
              <p className="mb-4 text-[#A9B8B1]">
                Você já pode prospectar em todos os estados dos EUA.
              </p>
              <Button onClick={goToProspeccao} className="bg-[#12D98B] text-[#07100D] hover:bg-[#21E6A0]">
                <Globe className="mr-2 h-4 w-4" />
                Ir para Prospecção
              </Button>
            </div>
          )}

          {userState.type === "eligible" && (
            <div className="py-6 text-center">
              <Badge className="mb-4 border-[#12D98B]/20 bg-[#12D98B]/10 text-[#12D98B]">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Plano ativo: {userState.planName}
              </Badge>

              <h3 className="mb-2 text-xl font-semibold">Ative o complemento EUA</h3>
              <p className="mb-6 text-[#A9B8B1]">
                Acesse leads em todos os 50 estados americanos + DC.
              </p>

              <div className="mb-6 rounded-lg border border-[#12D98B]/20 bg-[#12D98B]/5 p-6">
                <div className="mb-2 flex items-baseline justify-center gap-2">
                  <span className="text-3xl font-bold text-[#12D98B]">+ R$ {addon.monthlyPrice}</span>
                  <span className="text-[#A9B8B1]">/mês</span>
                </div>
                <p className="text-sm text-[#A9B8B1]">assinatura mensal via Stripe</p>
              </div>

              <Button
                size="lg"
                onClick={handleAddonCheckout}
                disabled={isProcessing}
                className="w-full bg-[#12D98B] text-[#07100D] hover:bg-[#21E6A0]"
              >
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Ativar complemento
              </Button>
            </div>
          )}

          {(userState.type === "not_logged_in" || userState.type === "not_eligible") && (
            <div className="py-6 text-center">
              <Badge variant="outline" className="mb-4 border-[#20312A] bg-[#0D1713] text-[#A9B8B1]">
                {userState.type === "not_eligible" ? `Plano atual: ${userState.planName}` : "Login necessário"}
              </Badge>
              <h3 className="mb-2 text-xl font-semibold">
                Este complemento está disponível apenas para usuários com plano ativo.
              </h3>
              <p className="mb-6 text-[#A9B8B1]">
                Escolha Starter, Pro ou Agency para ativar a prospecção nos EUA.
              </p>
              <Button onClick={choosePlan} className="w-full">
                Escolher plano
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
