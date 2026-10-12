import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Play, ShieldCheck, Sparkles } from "lucide-react";
import { MockupHeroProspeccao } from "./mockups/MockupHeroProspeccao";
import { trackEvent } from "@/lib/analytics";
import { trackMetaCustomEvent } from "@/lib/metaPixel";
import { useBillingOfferConfig } from "@/hooks/useBillingOfferConfig";
import { LANDING_CTA_BASE, LANDING_CTA_ICON, LANDING_CTA_PAIR, LANDING_CTA_RESPONSIVE } from "./ctaStyles";

const heroSteps = [
  "Busque por cidade e nicho",
  "Compare sinais de oportunidade",
  "Revise a abordagem sugerida",
];

export function HeroSection() {
  const { trialDurationDays } = useBillingOfferConfig();

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const trackHeroMeta = (eventName: string, ctaText: string) => {
    trackMetaCustomEvent(eventName, {
      page: "landing",
      location: "hero",
      cta_text: ctaText,
    });
  };

  const handlePrimaryCta = () => {
    const ctaText = "Começar minha primeira busca";
    trackEvent("cta_clicked", { cta: "comecar_primeira_busca", location: "hero", cta_location: "hero" });
    trackEvent("hero_cta_clicked", { cta_location: "hero", cta_text: ctaText, trial_duration_days: trialDurationDays });
    trackEvent("trial_cta_clicked", { cta_location: "hero", cta_text: ctaText, trial_duration_days: trialDurationDays });
    trackHeroMeta("CTA_Hero_Click", ctaText);
    scrollToSection("precos");
  };

  const handleProofCta = () => {
    const ctaText = "Ver o que o Zuno entrega";
    trackEvent("cta_clicked", { cta: "ver_prova_produto", location: "hero", cta_location: "hero" });
    trackHeroMeta("CTA_Secondary_Click", ctaText);
    scrollToSection("product-proof");
  };

  return (
    <section className="relative overflow-hidden border-b border-[#0B8F60]/20 bg-[#DDF9E9] text-[#07100D] selection:bg-[#12D98B]/40">
      <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full border-[64px] border-[#12D98B]/20" />
      <div className="container relative mx-auto px-4">
        <div className="grid items-start gap-8 pb-8 pt-7 sm:pt-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12 lg:pb-10 lg:pt-10">
          <div className="max-w-2xl lg:pt-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0B8F60]/25 bg-white/70 px-3 py-1.5 text-xs font-bold text-[#0B8F60]">
              <Sparkles className="h-3.5 w-3.5" />
              Plataforma de prospecção B2B para agências e freelancers
            </div>

            <h1 className="mt-5 text-[2.4rem] font-extrabold leading-[1.02] tracking-[-0.055em] sm:text-5xl lg:text-[3.5rem]">
              Encontre empresas.<br />
              <span className="text-[#0B8F60]">Saiba como abordar.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#28443A] sm:text-lg">
              Escolha uma cidade e um nicho. O Zuno organiza dados públicos, mostra sinais de oportunidade e sugere a primeira mensagem para cada empresa.
            </p>

            <div className={LANDING_CTA_PAIR}>
              <Button
                size="lg"
                className={`${LANDING_CTA_BASE} ${LANDING_CTA_RESPONSIVE} bg-[#07100D] text-base text-[#F3F7F5] shadow-xl shadow-[#0B8F60]/20 transition-transform hover:scale-[1.02] hover:bg-[#0D1713] sm:px-8 sm:text-lg`}
                onClick={handlePrimaryCta}
              >
                Começar minha primeira busca
                <ArrowRight className={LANDING_CTA_ICON} />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className={`${LANDING_CTA_BASE} ${LANDING_CTA_RESPONSIVE} border-[#07100D]/25 bg-white/50 text-sm text-[#07100D] hover:border-[#0B8F60] hover:bg-white sm:px-8 sm:text-base`}
                onClick={handleProofCta}
              >
                <Play className={LANDING_CTA_ICON} />
                Ver o que o Zuno entrega
              </Button>
            </div>

            <div className="mt-5 flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0B8F60]" />
              <p className="text-xs font-medium leading-snug text-[#36564A]">
                {trialDurationDays
                  ? `Hoje R$0. Cartão necessário. Teste de ${trialDurationDays} dias. Cancele antes da primeira cobrança.`
                  : "Hoje R$0. Cartão necessário. A duração vigente será confirmada antes do checkout."}
              </p>
            </div>
          </div>

          <div className="relative mx-auto w-full min-w-0 max-w-[590px] lg:max-w-none">
            <div className="pointer-events-none absolute inset-8 rounded-[3rem] bg-[#12D98B]/40 blur-3xl" />
            <div className="relative -mx-4 sm:mx-0"><MockupHeroProspeccao /></div>
          </div>
        </div>

        <div className="grid gap-3 border-t border-[#0B8F60]/25 py-5 text-sm font-semibold sm:grid-cols-3 sm:gap-6">
          {heroSteps.map((step, index) => (
            <div key={step} className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0B8F60] text-xs text-white">{index + 1}</span>
              <span>{step}</span>
              <Check className="ml-auto h-4 w-4 shrink-0 text-[#0B8F60] sm:hidden" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
