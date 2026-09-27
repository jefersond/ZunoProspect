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
import { createBillingCheckout, billingRedirectAdapter, type BillingConversionPath } from "@/services/billingCheckout";
import { useSubscription } from "@/hooks/useSubscription";
import { PLAN_LIST, getPlanPeriodLabel, getPlanPrice, resolveTrialDaysCopy, type BillingCycle, type PlanConfig } from "@/config/plans";
import { cn } from "@/lib/utils";
import { useBillingOfferConfig } from "@/hooks/useBillingOfferConfig";
import { appendReferralToPath } from "@/lib/referral";
import { trackEvent } from "@/lib/analytics";
import { getFunnelContext } from "@/lib/funnelContext";
import { LANDING_CTA_BASE, LANDING_CTA_RESPONSIVE, LANDING_PRICING_CTA_AREA } from "./ctaStyles";

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PrecosSection() {
  const navigate = useNavigate();
  const { trialDurationDays, defaultNewBillingProvider, introOffer } = useBillingOfferConfig();
  const { hasUsaAddon, isAdmin, subscription, loading: subscriptionLoading } = useSubscription();
  const subscriptionStatus = String(subscription?.subscription_status ?? subscription?.status ?? "").toLowerCase();
  const hasExistingSubscription = Boolean(
    !isAdmin
      && subscription
      && subscription.plan_name !== "free"
      && ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"].includes(subscriptionStatus),
  );
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
            trackEvent("pricing_viewed", { location: "landing", cta_location: "pricing" });
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


  const handleSelectPlano = async (plan: PlanConfig, conversionPath: BillingConversionPath = "trial") => {
    const price = getPlanPrice(plan.id, billingCycle);
    const trackingPrice = plan.monthlyPrice;
    const planIntroOffer = introOffer.plans[plan.id];
    const introOfferSelected = Boolean(
      conversionPath === "direct_purchase"
        && billingCycle === "monthly"
        && introOffer.enabled
        && introOffer.eligible
        && planIntroOffer?.introPrice
        && planIntroOffer?.regularPrice,
    );
    const commercialValue = introOfferSelected ? planIntroOffer.introPrice! : price;
    const introAnalytics = introOfferSelected ? {
      intro_offer: introOffer.key,
      intro_offer_price: planIntroOffer.introPrice,
      regular_price: planIntroOffer.regularPrice,
      plan: plan.id,
    } : {};

    trackEvent("cta_clicked", {
      cta: conversionPath === "trial" ? `ativar_teste_${plan.id}` : `assinar_agora_${plan.id}`,
      location: "pricing",
      cta_location: "pricing",
      plan: plan.id,
      plan_id: plan.id,
      conversion_path: conversionPath,
      ...introAnalytics,
    });
    trackEvent("plan_selected", {
      plan: plan.id,
      plan_id: plan.id,
      billing_cycle: billingCycle,
      cta_location: "pricing",
      conversion_path: conversionPath,
      ...introAnalytics,
    });
    if (conversionPath === "trial") {
      trackEvent("trial_cta_clicked", {
        plan: plan.id,
        plan_id: plan.id,
        billing_cycle: billingCycle,
        cta_location: "pricing",
        trial_duration_days: trialDurationDays,
        conversion_path: "trial",
      });
    }

    trackMetaCustomEvent("Pricing_Click", {
      page: "landing",
      plan_id: plan.id,
      plan_name: plan.displayName,
      value: commercialValue,
      currency: "BRL",
      conversion_path: conversionPath,
      ...introAnalytics,
    });
    trackMetaCustomEvent("Plan_Selected", {
      plan_id: plan.id,
      plan_name: plan.displayName,
      value: commercialValue,
      currency: "BRL",
      conversion_path: conversionPath,
      ...introAnalytics,
    });

    trackLead({
      content_name: `${plan.displayName} - ${plan.leadsLimit} leads`,
      content_category: "Paid Plan",
      value: commercialValue,
      currency: "BRL",
    });
    const funnelContext = await getFunnelContext(null, "pricing_page");
    const upgradeMetadata = {
      ...funnelContext,
      plan_id: plan.id,
      plan_name: plan.name,
      billing_cycle: billingCycle,
      location: "pricing",
      cta_text: conversionPath === "trial" ? plan.cta : "Prefiro assinar agora",
      conversion_path: conversionPath,
      ...introAnalytics,
    };
    trackEvent("plan_clicked", { plan_id: plan.id, location: "pricing", billing_cycle: billingCycle });
    trackEvent("upgrade_clicked", upgradeMetadata);
    trackEvent(funnelContext.has_done_first_ai_analysis ? "Upgrade_Click_After_AI" : "Upgrade_Click_Before_AI", upgradeMetadata);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate(appendReferralToPath(`/auth?tab=signup&plan=${encodeURIComponent(plan.id)}&leadsQty=${encodeURIComponent(String(plan.leadsLimit))}&anual=${billingCycle === "annual"}&conversion_path=${conversionPath}`));
      return;
    }

    setIsProcessing(plan.id);
    try {
      toast.loading("Gerando link de pagamento seguro...");

      const data = await createBillingCheckout({
        selectedPlan: { planKey: plan.id },
        billingCycle,
        conversionPath,
        source: "pricing_page",
        offerId: introOfferSelected ? introOffer.key : null,
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
        stripe_session_id: data.provider === "stripe" ? data.checkoutId || null : null,
        provider_checkout_id: data.checkoutId || null,
        billing_provider: data.provider,
        trial_duration_days: data.trialDurationDays,
        trial_policy_version: data.trialPolicyVersion,
        conversion_path: data.conversionPath,
        intro_offer: data.introOfferApplied ? data.introOfferKey : null,
        intro_price: data.introOfferApplied ? data.introPrice : null,
        regular_price: data.regularPrice ?? price,
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
      billingRedirectAdapter(data.provider).redirect(data);
    } catch (error: any) {
      toast.dismiss();
      if (error?.status === 401) {
        toast.error("Sessão expirada", {
          description: "Entre novamente para continuar com o pagamento.",
        });
        navigate(appendReferralToPath(`/auth?tab=login&plan=${encodeURIComponent(plan.id)}&leadsQty=${encodeURIComponent(String(plan.leadsLimit))}&anual=${billingCycle === "annual"}&conversion_path=${conversionPath}`));
        return;
      }
      trackMetaCustomEvent("Checkout_Failed", {
        plan_id: plan.id,
        error_message: error?.message || "checkout_error",
      });
      trackEvent("checkout_failed", { ...funnelContext, plan_id: plan.id, billing_cycle: billingCycle, location: "pricing", source: "pricing_page", conversion_path: conversionPath, error_message_safe: error?.message || "checkout_error", error: error?.message || "checkout_error" });
      toast.error("Não foi possível iniciar o pagamento", { description: "Tente novamente." });
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <section id="precos" ref={sectionRef} className="bg-[#07100D] py-20 border-b border-[#20312A]/40">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#12D98B]/30 bg-[#12D98B]/10 px-3 py-1 text-xs font-semibold text-[#12D98B]">
            <Sparkles className="h-3.5 w-3.5" />
            Teste disponível no plano escolhido
          </div>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-[#F3F7F5] md:text-5xl">
            {trialDurationDays ? `Teste o Zuno por ${trialDurationDays} dias no plano escolhido` : "Teste o Zuno no plano escolhido"}
          </h2>
          <p className="text-base text-[#A9B8B1] md:text-lg leading-relaxed max-w-2xl mx-auto font-medium mb-8">
            <span className="text-[#12D98B] font-bold">Hoje R$0.</span> Cartão necessário. {trialDurationDays ? `Teste de ${trialDurationDays} dias.` : "A duração vigente será confirmada antes do checkout."} A primeira cobrança acontece depois do teste, na data confirmada no checkout. <span className="text-[#F3F7F5] font-bold">Cancele antes e não será cobrado.</span>
          </p>

          <div className="flex flex-col items-center gap-2">
            <ToggleGroup
              type="single"
              value={billingCycle}
              onValueChange={(value) => value && setBillingCycle(value as BillingCycle)}
              className="rounded-lg border border-[#20312A] bg-[#0D1713] p-1 shadow-sm"
            >
              <ToggleGroupItem value="monthly" className="h-9 rounded-md px-4 text-[#A9B8B1] data-[state=on]:bg-[#07100D] data-[state=on]:text-[#F3F7F5] data-[state=on]:shadow-sm">
                Mensal
              </ToggleGroupItem>
              <ToggleGroupItem value="annual" className="h-9 rounded-md px-4 text-[#A9B8B1] data-[state=on]:bg-[#07100D] data-[state=on]:text-[#F3F7F5] data-[state=on]:shadow-sm">
                Anual
              </ToggleGroupItem>
            </ToggleGroup>
            {billingCycle === "annual" && (
              <p className="text-xs text-[#12D98B] font-mono">Cobrança anual com 2 meses de desconto incluso.</p>
            )}
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {PLAN_LIST.map((plan) => {
            const price = getPlanPrice(plan.id, billingCycle);
            const isCurrentProcessing = isProcessing === plan.id;
            const cardIntroOffer = introOffer.plans[plan.id];

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative flex h-full min-h-[540px] flex-col overflow-hidden rounded-xl border p-6 text-[#F3F7F5] shadow-lg bg-[#0D1713] transition-all duration-300",
                  plan.highlighted ? "border-[#12D98B] shadow-[0_0_35px_rgba(18,217,139,0.06)]" : "border-[#20312A]",
                )}
              >
                {plan.highlighted && <div className="absolute inset-x-0 top-0 h-[3px] bg-[#12D98B]" />}

                <div className="flex min-h-[120px] flex-col items-center text-center">
                  {plan.highlighted ? (
                    <div className="mb-3 inline-flex items-center gap-1 rounded-full border border-[#12D98B]/30 bg-[#12D98B]/10 px-3 py-0.5 text-[10px] font-bold uppercase text-[#12D98B]">
                      <Sparkles className="h-3 w-3" />
                      Melhor para uso recorrente
                    </div>
                  ) : (
                    <div className="mb-3 h-5" />
                  )}
                  <h3 className="text-2xl font-bold tracking-tight">{plan.displayName}</h3>
                  <p className="mt-2 min-h-10 text-xs text-[#A9B8B1] leading-relaxed">{plan.subtitle}</p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-[#20312A] bg-[#07100D] p-2.5 text-center">
                    <p className="text-base font-bold text-[#F3F7F5]">{plan.leadsLimit.toLocaleString("pt-BR")}</p>
                    <p className="text-[10px] text-[#A9B8B1] uppercase tracking-wider font-mono">leads/mês</p>
                  </div>
                  <div className="rounded-lg border border-[#20312A] bg-[#07100D] p-2.5 text-center">
                    <p className="text-base font-bold text-[#F3F7F5]">{plan.aiLimit.toLocaleString("pt-BR")}</p>
                    <p className="text-[10px] text-[#A9B8B1] uppercase tracking-wider font-mono">análises IA</p>
                  </div>
                </div>

                <div className="mt-6 text-center border-t border-[#20312A]/40 pt-5 pb-3">
                  <p className="text-[#12D98B] text-sm font-extrabold uppercase tracking-wider font-mono">
                    {trialDurationDays ? `Hoje R$0 por ${trialDurationDays} dias` : "Hoje R$0 durante o período de teste vigente"}
                  </p>
                  <p className="text-3xl font-black text-[#F3F7F5] mt-2">
                    Depois R$ {price.toLocaleString("pt-BR")}{getPlanPeriodLabel(billingCycle)}
                  </p>
                  <p className="mt-2 text-xs text-[#A9B8B1] font-medium font-sans">
                    {billingCycle === "annual"
                      ? `Cobrança automática após o teste de R$ ${price.toLocaleString("pt-BR")}/ano`
                      : `Cobrança automática após o teste de R$ ${price.toLocaleString("pt-BR")}/mês`}
                  </p>
                </div>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs leading-relaxed text-[#A9B8B1]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#12D98B]" />
                      <span>{resolveTrialDaysCopy(feature, trialDurationDays)}</span>
                    </li>
                  ))}
                </ul>

                <div className={LANDING_PRICING_CTA_AREA}>
                  {hasExistingSubscription ? (
                    <p className="text-center text-xs font-semibold leading-relaxed text-[#A9B8B1]">
                      Seu plano atual já está ativo.
                    </p>
                  ) : (
                    <>
                      <p className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-[#6F8179]">Testar</p>
                      <Button
                        className={cn(
                          LANDING_CTA_BASE,
                          "w-full transition-all duration-300", 
                          plan.highlighted 
                            ? "bg-[#12D98B] text-[#07100D] hover:bg-[#21E6A0] shadow-[0_0_20px_rgba(18,217,139,0.25)]" 
                            : "bg-transparent border border-[#20312A] text-[#F3F7F5] hover:border-[#21E6A0]/50 hover:bg-[#12D98B]/5"
                        )}
                        onClick={() => handleSelectPlano(plan, "trial")}
                        disabled={Boolean(isProcessing) || subscriptionLoading}
                      >
                        {isCurrentProcessing ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          "Começar meu teste"
                        )}
                      </Button>
                      <p className="text-center text-xs font-semibold leading-relaxed text-[#A9B8B1] mt-1">
                        Hoje R$0. Cartão necessário. {trialDurationDays ? `Teste grátis por ${trialDurationDays} dias. ` : ""}Depois R$ {price.toLocaleString("pt-BR")}{getPlanPeriodLabel(billingCycle)}. Cancele antes e não será cobrado.
                      </p>

                      {billingCycle === "monthly"
                        && introOffer.enabled
                        && introOffer.eligible
                        && cardIntroOffer?.introPrice
                        && cardIntroOffer?.regularPrice ? (
                        <div className="mt-3 rounded-lg border border-[#12D98B]/25 bg-[#07100D] p-3 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6F8179]">Assinar</p>
                          <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-[#12D98B]">
                            Economize no primeiro mês
                          </p>
                          <p className="mt-1 text-sm font-bold text-[#F3F7F5]">
                            R$ {formatBRL(cardIntroOffer.introPrice)} hoje
                          </p>
                          <p className="text-xs text-[#A9B8B1]">
                            Depois R$ {formatBRL(cardIntroOffer.regularPrice)}/mês
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              LANDING_CTA_BASE,
                              "mt-3 w-full border-[#12D98B]/40 bg-transparent text-[#F3F7F5] hover:border-[#21E6A0] hover:bg-[#12D98B]/5",
                            )}
                            onClick={() => handleSelectPlano(plan, "direct_purchase")}
                            disabled={Boolean(isProcessing) || subscriptionLoading}
                          >
                            {isCurrentProcessing ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              "Assinar agora"
                            )}
                          </Button>
                          <p className="mt-2 text-[11px] text-[#A9B8B1]">Cancele quando quiser.</p>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="mx-auto mt-2 text-xs font-semibold text-[#A9B8B1] underline decoration-[#20312A] underline-offset-4 transition-colors hover:text-[#F3F7F5] disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => handleSelectPlano(plan, "direct_purchase")}
                            disabled={Boolean(isProcessing) || subscriptionLoading}
                          >
                            Prefiro assinar agora
                          </button>
                          <p className="text-center text-xs leading-relaxed text-[#A9B8B1]">
                            Cobrança de R$ {price.toLocaleString("pt-BR")} hoje.
                          </p>
                        </>
                      )}
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Informações Obrigatórias e Transparência */}
        <div className="mx-auto mt-12 max-w-2xl text-center border-t border-[#20312A]/40 pt-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-xs text-[#A9B8B1] font-mono tracking-wide">
            <div className="p-3 bg-[#0D1713]/40 rounded-lg border border-[#20312A]/40">
              <p className="text-[#12D98B] font-bold">R$ 0</p>
              <p className="mt-0.5 text-[9px] uppercase">Hoje</p>
            </div>
            <div className="p-3 bg-[#0D1713]/40 rounded-lg border border-[#20312A]/40">
              <p className="text-[#F3F7F5] font-bold">Obrigatório</p>
              <p className="mt-0.5 text-[9px] uppercase">Cartão</p>
            </div>
            <div className="p-3 bg-[#0D1713]/40 rounded-lg border border-[#20312A]/40">
              <p className="text-[#12D98B] font-bold">1 Clique</p>
              <p className="mt-0.5 text-[9px] uppercase">Cancele Online</p>
            </div>
            <div className="p-3 bg-[#0D1713]/40 rounded-lg border border-[#20312A]/40">
              <p className="text-[#A9B8B1] font-bold">Sua execução</p>
              <p className="mt-0.5 text-[9px] uppercase">Resultado final</p>
            </div>
          </div>
          <p className="text-xs text-[#A9B8B1] leading-relaxed">
            <strong>Transparência:</strong> o cartão é necessário para ativar o teste. Você pode cancelar pela área de perfil {trialDurationDays ? `antes do fim dos ${trialDurationDays} dias` : "antes do fim do período de teste"} para evitar a primeira cobrança. O Zuno ajuda a encontrar, priorizar e abordar oportunidades. Não garante fechamento de clientes.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-6xl border-t border-[#20312A] pt-10">
          <Card className="flex flex-col gap-5 rounded-lg border border-[#20312A] bg-[#0D1713] p-6 text-[#F3F7F5] shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#12D98B]/25 bg-[#12D98B]/10">
                <Globe className="h-5 w-5 text-[#12D98B]" />
              </div>
              <div>
                <Badge variant="outline" className="mb-2 border-[#12D98B]/25 bg-[#12D98B]/10 text-[#12D98B]">Complemento opcional</Badge>
                <h3 className="text-xl font-semibold">Prospecção nos Estados Unidos</h3>
                <p className="mt-1 max-w-2xl text-sm text-[#A9B8B1]">
                  Adicione prospecção em todos os estados dos EUA aos planos pagos.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="text-left sm:text-right">
                <p className="text-2xl font-bold text-[#12D98B]">+ R$ 57</p>
                <p className="text-xs text-[#A9B8B1]">por mês</p>
              </div>
              {(hasUsaAddon || isAdmin) && (
                <Badge className="border-[#12D98B]/30 bg-[#12D98B]/10 text-[#12D98B]">
                  {isAdmin ? "Liberado para admin" : "Ativo"}
                </Badge>
              )}
              <Button variant="outline" className={`${LANDING_CTA_BASE} ${LANDING_CTA_RESPONSIVE}`} onClick={() => setUsaDialogOpen(true)}>
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
