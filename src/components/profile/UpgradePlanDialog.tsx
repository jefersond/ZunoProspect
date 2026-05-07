import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Crown, ExternalLink, Sparkles } from "lucide-react";
import { PLAN_LIST, getPlanPeriodLabel, getPlanPrice, normalizePlanId, type BillingCycle, type PlanConfig } from "@/config/plans";
import { createStripeCheckout } from "@/services/stripeCheckout";
import { cn } from "@/lib/utils";

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanName?: string;
}

const PLAN_ORDER = {
  free: -1,
  starter: 0,
  pro: 1,
  agency: 2,
} as const;

function getCurrentPlanLevel(currentPlanName?: string) {
  const normalized = currentPlanName === "agencia" ? "agency" : normalizePlanId(currentPlanName) ?? "free";
  return PLAN_ORDER[normalized as keyof typeof PLAN_ORDER] ?? -1;
}

export const UpgradePlanDialog = ({ open, onOpenChange, currentPlanName }: UpgradePlanDialogProps) => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  const planosExibicao = useMemo(() => {
    const currentPlanLevel = getCurrentPlanLevel(currentPlanName);
    return PLAN_LIST.filter((plan) => PLAN_ORDER[plan.id] > currentPlanLevel);
  }, [currentPlanName]);

  const handleSelectPlano = async (plan: PlanConfig) => {
    setProcessingPlan(plan.id);
    try {
      toast.loading("Gerando link de pagamento seguro...");

      const data = await createStripeCheckout({
        selectedPlan: { planKey: plan.id },
        billingCycle,
      });

      toast.dismiss();
      toast.success("Redirecionando para o pagamento...");
      window.location.href = data.url;
      onOpenChange(false);
    } catch (error: any) {
      toast.dismiss();
      toast.error("Não foi possível iniciar o pagamento", { description: error.message });
    } finally {
      setProcessingPlan(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto border-border/70 bg-zinc-950 text-foreground">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Crown className="h-5 w-5 text-primary" />
            Fazer upgrade do plano
          </DialogTitle>
          <DialogDescription>
            Escolha um plano com limites fixos, cobrança previsível e checkout seguro.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 py-3">
          <ToggleGroup
            type="single"
            value={billingCycle}
            onValueChange={(value) => value && setBillingCycle(value as BillingCycle)}
            className="rounded-lg border border-border/70 bg-zinc-900/80 p-1"
          >
            <ToggleGroupItem value="monthly" className="h-9 rounded-md px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Mensal
            </ToggleGroupItem>
            <ToggleGroupItem value="annual" className="h-9 rounded-md px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Anual
            </ToggleGroupItem>
          </ToggleGroup>
          {billingCycle === "annual" && (
            <p className="text-xs text-muted-foreground">
              Cobrança anual ativa no checkout, com dois meses de desconto.
            </p>
          )}
        </div>

        <div className="grid gap-5 py-4 md:grid-cols-3">
          {planosExibicao.map((plan) => {
            const price = getPlanPrice(plan.id, billingCycle);
            const periodLabel = getPlanPeriodLabel(billingCycle);
            const isProcessing = processingPlan === plan.id;

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative flex h-full min-h-[520px] flex-col overflow-hidden rounded-lg border bg-zinc-900/80 p-6 shadow-lg",
                  plan.highlighted
                    ? "border-emerald-400/70 shadow-emerald-950/50"
                    : "border-border/70",
                )}
              >
                {plan.highlighted && (
                  <div className="absolute inset-x-0 top-0 h-1 bg-emerald-400" />
                )}

                <div className="flex min-h-[132px] flex-col items-center text-center">
                  {plan.badge ? (
                    <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                      <Sparkles className="h-3 w-3" />
                      {plan.badge}
                    </div>
                  ) : (
                    <div className="mb-4 h-7" />
                  )}

                  <h3 className="text-2xl font-semibold tracking-tight">{plan.displayName}</h3>
                  <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">{plan.subtitle}</p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/60 bg-background/30 p-3 text-center">
                    <p className="text-lg font-semibold">{plan.leadsLimit.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted-foreground">leads/mês</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/30 p-3 text-center">
                    <p className="text-lg font-semibold">{plan.aiLimit.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted-foreground">roteiros IA/mês</p>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold tracking-tight">R$ {price.toLocaleString("pt-BR")}</span>
                    <span className="text-sm text-muted-foreground">{periodLabel}</span>
                  </div>
                  <p className="mt-2 h-5 text-xs text-muted-foreground">
                    {billingCycle === "annual" ? `equivale a R$ ${plan.monthlyPrice}/mês` : "cobrança mensal recorrente"}
                  </p>
                </div>

                <ul className="mt-7 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm leading-5 text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={cn(
                    "mt-7 h-11 w-full",
                    plan.highlighted
                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                      : "border-border/70",
                  )}
                  variant={plan.highlighted ? "default" : "outline"}
                  onClick={() => handleSelectPlano(plan)}
                  disabled={Boolean(processingPlan)}
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  {plan.cta}
                </Button>
              </Card>
            );
          })}
        </div>

        <div className="border-t border-border/70 pt-4">
          <p className="text-center text-xs text-muted-foreground">
            Você será redirecionado para a página de pagamento segura. Aceita cartão de crédito.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
