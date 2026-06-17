import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CheckCircle2, Globe, Loader2, Sparkles } from "lucide-react";
import { UsaAddonDialog } from "./UsaAddonDialog";
import { getAttributionParams, trackInitiateCheckout, trackLead, trackMetaCustomEvent, trackViewContent } from "@/lib/metaPixel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createStripeCheckout } from "@/services/stripeCheckout";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { PLAN_LIST, getPlanPeriodLabel, getPlanPrice, type BillingCycle, type PlanConfig } from "@/config/plans";
import { cn } from "@/lib/utils";
import { appendReferralToPath } from "@/lib/referral";
import { trackEvent } from "@/lib/analytics";
import { getFunnelContext } from "@/lib/funnelContext";

const freePlan = {
  displayName: "Free",
  subtitle: "Para testar a plataforma e entender como o Zuno funciona.",
  leadsLimit: 20,
  aiLimit: 3,
  cta: "Começar a prospectar",
  features: [
    "20 leads por mês",
    "3 análises com IA por mês",
    "Busca por cidade e nicho",
    "Acesso direto pelo navegador",
  ],
};

export function PrecosSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasUsaAddon, isAdmin } = useSubscription();
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
            trackEvent("pricing_viewed", { location: "landing" });
            trackMetaCustomEvent("Pricing_View", {
              page: "landing",
              section: "pricing",
            });
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

  const handleFreeSignup = () => {
    trackMetaCustomEvent("Pricing_Click", {
      page: "landing",
      plan_id: "free",
      plan_name: "Free",
      value: 0,
      currency: "BRL",
    });
    trackLead({
      content_name: "Free Plan Signup",
      content_category: "Free Plan",
      value: 0,
      currency: "BRL",
    });
    trackEvent("cta_clicked", { cta: "comecar_gratis", location: "pricing" });
    trackEvent("plan_clicked", { plan_id: "free", location: "pricing" });
    navigate(appendReferralToPath("/auth?tab=signup"));
  };

  const handleSelectPlano = async (plan: PlanConfig) => {
    const price = getPlanPrice(plan.id, billingCycle);
    const trackingPrice = plan.monthlyPrice;

    trackEvent("cta_clicked", { cta: `ativar_teste_${plan.id}`, location: "pricing", plan_id: plan.id });

    trackMetaCustomEvent("Pricing_Click", {
      page: "landing",
      plan_id: plan.id,
      plan_name: plan.displayName,
      value: trackingPrice,
      currency: "BRL",
    });
    trackMetaCustomEvent("Plan_Selected", {
      plan_id: plan.id,
      plan_name: plan.displayName,
      value: trackingPrice,
      currency: "BRL",
    });

    trackLead({
      content_name: `${plan.displayName} - ${plan.leadsLimit} leads`,
      content_category: "Paid Plan",
      value: price,
      currency: "BRL",
    });
    const funnelContext = await getFunnelContext(null, "pricing_page");
    const upgradeMetadata = { ...funnelContext, plan_id: plan.id, plan_name: plan.name, billing_cycle: billingCycle, location: "pricing", cta_text: plan.cta };
    trackEvent("plan_clicked", { plan_id: plan.id, location: "pricing", billing_cycle: billingCycle });
    trackEvent("upgrade_clicked", upgradeMetadata);
    trackEvent(funnelContext.has_done_first_ai_analysis ? "Upgrade_Click_After_AI" : "Upgrade_Click_Before_AI", upgradeMetadata);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate(appendReferralToPath(`/auth?tab=signup&plan=${encodeURIComponent(plan.id)}&leadsQty=${encodeURIComponent(String(plan.leadsLimit))}&anual=${billingCycle === "annual"}`));
      return;
    }

    setIsProcessing(plan.id);
    try {
      toast.loading("Gerando link de pagamento seguro...");

      const data = await createStripeCheckout({
        selectedPlan: { planKey: plan.id },
        billingCycle,
        authUserFromHook: user,
      });

      trackEvent("checkout_started", {
        ...funnelContext,
        plan_id: plan.id,
        plan_name: plan.name,
        value: trackingPrice,
        currency: "BRL",
        billing_cycle: billingCycle,
        location: "pricing",
        source: "pricing_page",
        stripe_session_id: data.sessionId || null,
        content_name: `Zuno Propect ${plan.name}`,
      });
      trackInitiateCheckout({
        content_name: `Zuno Propect ${plan.name}`,
        content_category: "subscription",
        plan_id: plan.id,
        plan_name: plan.name,
        value: trackingPrice,
        currency: "BRL",
      });

      if ((getAttributionParams().offer === "founder_pro" || getAttributionParams().utm_campaign === "founder") && plan.id === "pro") {
        trackMetaCustomEvent("Founder_Offer_Checkout", {
          offer: "founder_pro",
          plan_id: "pro",
          value: 47,
          currency: "BRL",
        });
      }

      toast.dismiss();
      window.location.href = data.url;
    } catch (error: any) {
      toast.dismiss();
      if (error?.status === 401) {
        toast.error("Sessão expirada", {
          description: "Entre novamente para continuar com o pagamento.",
        });
        navigate(appendReferralToPath(`/auth?tab=login&plan=${encodeURIComponent(plan.id)}&leadsQty=${encodeURIComponent(String(plan.leadsLimit))}&anual=${billingCycle === "annual"}`));
        return;
      }
      trackMetaCustomEvent("Checkout_Failed", {
        plan_id: plan.id,
        error_message: error?.message || "checkout_error",
      });
      trackEvent("checkout_failed", { ...funnelContext, plan_id: plan.id, billing_cycle: billingCycle, location: "pricing", source: "pricing_page", error_message_safe: error?.message || "checkout_error", error: error?.message || "checkout_error" });
      toast.error("Não foi possível iniciar o pagamento", { description: "Tente novamente." });
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <section id="precos" ref={sectionRef} className="bg-[#0b0f0e] py-20 border-b border-[#1f2d29]/40">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <Badge variant="outline" className="mb-4 border-[#1f2d29] text-[#9ca3af] bg-[#111816]/50">
            Planos e Assinaturas
          </Badge>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-[#f4f4f5] md:text-5xl">
            Teste a Zuno grátis por 7 dias
          </h2>
          <p className="text-base text-[#9ca3af] md:text-lg leading-relaxed max-w-2xl mx-auto font-medium mb-8">
            <span className="text-[#10d98a] font-bold">Hoje você paga R$0.</span> Escolha um plano, ative o teste com cartão e use a Zuno por 7 dias. Depois do teste, sua assinatura começa automaticamente no plano escolhido. <span className="text-[#f4f4f5] font-bold">Cancele antes do fim do teste para não ser cobrado.</span>
          </p>

          <div className="flex flex-col items-center gap-2">
            <ToggleGroup
              type="single"
              value={billingCycle}
              onValueChange={(value) => value && setBillingCycle(value as BillingCycle)}
              className="rounded-lg border border-[#1f2d29] bg-[#111816] p-1 shadow-sm"
            >
              <ToggleGroupItem value="monthly" className="h-9 rounded-md px-4 text-[#9ca3af] data-[state=on]:bg-[#0b0f0e] data-[state=on]:text-[#f4f4f5] data-[state=on]:shadow-sm">
                Mensal
              </ToggleGroupItem>
              <ToggleGroupItem value="annual" className="h-9 rounded-md px-4 text-[#9ca3af] data-[state=on]:bg-[#0b0f0e] data-[state=on]:text-[#f4f4f5] data-[state=on]:shadow-sm">
                Anual
              </ToggleGroupItem>
            </ToggleGroup>
            {billingCycle === "annual" && (
              <p className="text-xs text-[#10d98a] font-mono">Cobrança anual com 2 meses de desconto incluso.</p>
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
                  "relative flex min-h-[540px] flex-col overflow-hidden rounded-xl border p-6 text-[#f4f4f5] shadow-lg bg-[#111816] transition-all duration-300",
                  plan.highlighted ? "border-[#10d98a] shadow-[0_0_35px_rgba(16,217,138,0.06)]" : "border-[#1f2d29]",
                )}
              >
                {plan.highlighted && <div className="absolute inset-x-0 top-0 h-[3px] bg-[#10d98a]" />}

                <div className="flex min-h-[120px] flex-col items-center text-center">
                  {plan.highlighted ? (
                    <div className="mb-3 inline-flex items-center gap-1 rounded-full border border-[#10d98a]/30 bg-[#10d98a]/10 px-3 py-0.5 text-[10px] font-bold uppercase text-[#10d98a]">
                      <Sparkles className="h-3 w-3" />
                      RECOMENDADO
                    </div>
                  ) : (
                    <div className="mb-3 h-5" />
                  )}
                  <h3 className="text-2xl font-bold tracking-tight">{plan.displayName}</h3>
                  <p className="mt-2 min-h-10 text-xs text-[#9ca3af] leading-relaxed">{plan.subtitle}</p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-[#1f2d29] bg-[#0b0f0e] p-2.5 text-center">
                    <p className="text-base font-bold text-[#f4f4f5]">{plan.leadsLimit.toLocaleString("pt-BR")}</p>
                    <p className="text-[10px] text-[#9ca3af] uppercase tracking-wider font-mono">leads/mês</p>
                  </div>
                  <div className="rounded-lg border border-[#1f2d29] bg-[#0b0f0e] p-2.5 text-center">
                    <p className="text-base font-bold text-[#f4f4f5]">{plan.aiLimit.toLocaleString("pt-BR")}</p>
                    <p className="text-[10px] text-[#9ca3af] uppercase tracking-wider font-mono">análises IA</p>
                  </div>
                </div>

                <div className="mt-6 text-center border-t border-[#1f2d29]/40 pt-5 pb-3">
                  <p className="text-[#10d98a] text-sm font-extrabold uppercase tracking-wider font-mono">
                    Hoje R$0 por 7 dias
                  </p>
                  <p className="text-3xl font-black text-[#f4f4f5] mt-2">
                    Depois R$ {price.toLocaleString("pt-BR")}{getPlanPeriodLabel(billingCycle)}
                  </p>
                  <p className="mt-2 text-xs text-[#9ca3af] font-medium font-sans">
                    {billingCycle === "annual"
                      ? `Cobrança automática após o teste de R$ ${price.toLocaleString("pt-BR")}/ano`
                      : `Cobrança automática após o teste de R$ ${price.toLocaleString("pt-BR")}/mês`}
                  </p>
                </div>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs leading-relaxed text-[#9ca3af]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#10d98a]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex flex-col gap-2">
                  <Button
                    className={cn(
                      "h-12 w-full font-bold transition-all duration-300", 
                      plan.highlighted 
                        ? "bg-[#10d98a] text-[#0b0f0e] hover:bg-[#10d98a]/90 shadow-[0_0_20px_rgba(16,217,138,0.25)]" 
                        : "bg-transparent border border-[#1f2d29] text-[#f4f4f5] hover:border-[#10d98a]/40 hover:bg-[#10d98a]/5"
                    )}
                    onClick={() => handleSelectPlano(plan)}
                    disabled={Boolean(isProcessing)}
                  >
                    {isCurrentProcessing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      "Ativar teste de 7 dias"
                    )}
                  </Button>
                  <p className="text-center text-xs font-semibold text-[#9ca3af] tracking-wide mt-1">
                    Cartão necessário • Cancele antes da cobrança
                  </p>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Informações Obrigatórias e Transparência */}
        <div className="mx-auto mt-12 max-w-2xl text-center border-t border-[#1f2d29]/40 pt-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-xs text-[#9ca3af] font-mono tracking-wide">
            <div className="p-3 bg-[#111816]/40 rounded-lg border border-[#1f2d29]/40">
              <p className="text-[#10d98a] font-bold">R$ 0</p>
              <p className="mt-0.5 text-[9px] uppercase">Hoje</p>
            </div>
            <div className="p-3 bg-[#111816]/40 rounded-lg border border-[#1f2d29]/40">
              <p className="text-[#10d98a] font-bold">Sim</p>
              <p className="mt-0.5 text-[9px] uppercase">Cartão Requerido</p>
            </div>
            <div className="p-3 bg-[#111816]/40 rounded-lg border border-[#1f2d29]/40">
              <p className="text-[#10d98a] font-bold">1 Clique</p>
              <p className="mt-0.5 text-[9px] uppercase">Cancele Online</p>
            </div>
            <div className="p-3 bg-[#111816]/40 rounded-lg border border-[#1f2d29]/40">
              <p className="text-red-400 font-bold">Não</p>
              <p className="mt-0.5 text-[9px] uppercase">Garantia de Clientes</p>
            </div>
          </div>
          <p className="text-xs text-[#9ca3af] leading-relaxed">
            * <strong>Segurança e Transparência</strong>: O cadastro do cartão é obrigatório para validação de identidade e prevenção contra abusos. Você pode cancelar sua assinatura síncronamente na área de perfil antes do encerramento dos 7 dias para evitar qualquer cobrança. A Zuno localiza oportunidades regionais de marketing e gera copies, mas a conversão e fechamento do cliente final são de sua responsabilidade comercial.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-6xl border-t border-border/60 pt-10">
          <Card className="flex flex-col gap-5 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm md:flex-row md:items-center md:justify-between dark:border-white/10 dark:bg-zinc-900/70">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-400/30 dark:bg-blue-400/10">
                <Globe className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <Badge variant="outline" className="mb-2 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/40 dark:bg-blue-400/10 dark:text-blue-300">Complemento opcional</Badge>
                <h3 className="text-xl font-semibold">Prospecção nos Estados Unidos</h3>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Adicione prospecção em todos os estados dos EUA aos planos pagos.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="text-left sm:text-right">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">+ R$ 57</p>
                <p className="text-xs text-muted-foreground">por mês</p>
              </div>
              {(hasUsaAddon || isAdmin) && (
                <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                  {isAdmin ? "Liberado para admin" : "Ativo"}
                </Badge>
              )}
              <Button variant="outline" onClick={() => setUsaDialogOpen(true)}>
                {hasUsaAddon || isAdmin ? "Complemento ativo" : "Ativar complemento"}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <UsaAddonDialog open={usaDialogOpen} onOpenChange={setUsaDialogOpen} isAnual={billingCycle === "annual"} />
    </section>
  );
}
