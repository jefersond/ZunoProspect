import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CheckCircle2, Globe, Loader2, Sparkles } from "lucide-react";
import { UsaAddonDialog } from "./UsaAddonDialog";
import { trackViewContent, trackLead } from "@/lib/metaPixel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createStripeCheckout } from "@/services/stripeCheckout";
import { PLAN_LIST, getPlanPeriodLabel, getPlanPrice, type BillingCycle, type PlanConfig } from "@/config/plans";
import { cn } from "@/lib/utils";

export function PrecosSection() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [usaDialogOpen, setUsaDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const hasTrackedView = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTrackedView.current) {
            hasTrackedView.current = true;
            trackViewContent({
              content_name: "Pricing Section",
              content_category: "Pricing",
              content_type: "product_group",
            });
          }
        });
      },
      { threshold: 0.3 },
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const handleSelectPlano = async (plan: PlanConfig) => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      navigate(`/auth?tab=signup&plan=${encodeURIComponent(plan.id)}&leadsQty=${encodeURIComponent(String(plan.leadsLimit))}&anual=${billingCycle === "annual"}`);
      return;
    }

    const price = getPlanPrice(plan.id, billingCycle);
    trackLead({
      content_name: `${plan.displayName} - ${plan.leadsLimit} leads`,
      content_category: "Paid Plan",
      value: price,
      currency: "BRL",
    });

    setIsProcessing(plan.id);
    try {
      toast.loading("Gerando link de pagamento seguro...");

      const data = await createStripeCheckout({
        selectedPlan: { planKey: plan.id },
        billingCycle,
      });

      toast.dismiss();
      window.location.href = data.url;
    } catch (error: any) {
      toast.dismiss();
      if (error?.status === 401) {
        navigate(`/auth?tab=login&plan=${encodeURIComponent(plan.id)}&leadsQty=${encodeURIComponent(String(plan.leadsLimit))}&anual=${billingCycle === "annual"}`);
        return;
      }
      toast.error("Não foi possível iniciar o pagamento", { description: error.message });
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <section id="precos" ref={sectionRef} className="bg-background py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">Planos</Badge>
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Escolha o plano ideal para você
          </h2>
          <p className="mb-7 text-lg text-muted-foreground">
            Três planos simples, com limites fixos e cobrança previsível.
          </p>

          <div className="flex flex-col items-center gap-2">
            <ToggleGroup
              type="single"
              value={billingCycle}
              onValueChange={(value) => value && setBillingCycle(value as BillingCycle)}
              className="rounded-lg border border-border/70 bg-zinc-900/70 p-1"
            >
              <ToggleGroupItem value="monthly" className="h-9 rounded-md px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                Mensal
              </ToggleGroupItem>
              <ToggleGroupItem value="annual" className="h-9 rounded-md px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                Anual
              </ToggleGroupItem>
            </ToggleGroup>
            {billingCycle === "annual" && (
              <p className="text-xs text-muted-foreground">Cobrança anual com dois meses de desconto.</p>
            )}
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {PLAN_LIST.map((plan) => {
            const price = getPlanPrice(plan.id, billingCycle);
            const isCurrentProcessing = isProcessing === plan.id;

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative flex min-h-[540px] flex-col overflow-hidden rounded-lg border bg-zinc-950/70 p-6 shadow-lg",
                  plan.highlighted ? "border-emerald-400/70 shadow-emerald-950/50" : "border-border/70",
                )}
              >
                {plan.highlighted && <div className="absolute inset-x-0 top-0 h-1 bg-emerald-400" />}

                <div className="flex min-h-[134px] flex-col items-center text-center">
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
                    <span className="text-sm text-muted-foreground">{getPlanPeriodLabel(billingCycle)}</span>
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
                  className={cn("mt-7 h-12 w-full font-semibold", plan.highlighted && "bg-emerald-500 text-white hover:bg-emerald-600")}
                  variant={plan.highlighted ? "default" : "outline"}
                  onClick={() => handleSelectPlano(plan)}
                  disabled={Boolean(isProcessing)}
                >
                  {isCurrentProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : plan.cta}
                </Button>
              </Card>
            );
          })}
        </div>

        <div className="mx-auto mt-14 max-w-6xl border-t border-border/60 pt-10">
          <Card className="flex flex-col gap-5 rounded-lg border-border/70 bg-zinc-950/70 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-blue-400/30 bg-blue-400/10">
                <Globe className="h-5 w-5 text-blue-300" />
              </div>
              <div>
                <Badge variant="outline" className="mb-2 border-blue-400/40 text-blue-300">Complemento opcional</Badge>
                <h3 className="text-xl font-semibold">Prospecção nos Estados Unidos</h3>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Adicione prospecção em todos os estados dos EUA aos planos pagos.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="text-left sm:text-right">
                <p className="text-2xl font-bold text-blue-300">+ R$ 57</p>
                <p className="text-xs text-muted-foreground">por mês</p>
              </div>
              <Button variant="outline" onClick={() => setUsaDialogOpen(true)}>
                Ativar complemento
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <UsaAddonDialog open={usaDialogOpen} onOpenChange={setUsaDialogOpen} isAnual={billingCycle === "annual"} />
    </section>
  );
}
