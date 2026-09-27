import { Button } from "@/components/ui/button";
import { ArrowRight, Play, ShieldCheck, Sparkles } from "lucide-react";
import { MockupHeroProspeccao } from "./mockups/MockupHeroProspeccao";
import { trackEvent } from "@/lib/analytics";
import { trackMetaCustomEvent } from "@/lib/metaPixel";
import { useBillingOfferConfig } from "@/hooks/useBillingOfferConfig";

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
    <section className="relative overflow-hidden border-b border-[#1f2d29]/40 bg-[#0b0f0e] pb-12 pt-10 selection:bg-[#10d98a]/30 md:pb-20 md:pt-20">
      <div className="pointer-events-none absolute left-1/3 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[#10d98a]/5 blur-[120px]" />

      <div className="container relative z-10 mx-auto px-4">
        <div className="grid min-w-0 items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
          <div className="relative min-w-0">
            <div className="rounded-2xl border border-[#1f2d29] bg-[#111816]/80 p-5 shadow-[0_0_50px_rgba(16,217,138,0.02)] backdrop-blur-md sm:p-6 md:p-8">
              <div className="mb-4 inline-flex max-w-full items-start gap-1.5 rounded-full border border-[#10d98a]/30 bg-[#10d98a]/10 px-3 py-1 text-left text-xs font-semibold leading-relaxed text-[#10d98a]">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                Plataforma de prospecção B2B para agências e freelancers
              </div>

              <h1 className="max-w-3xl text-3xl font-extrabold leading-[1.08] tracking-tight text-[#f4f4f5] sm:text-4xl lg:text-6xl">
                Encontre empresas com potencial para comprar de você e saiba como iniciar a conversa.
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#9ca3af] sm:text-base md:text-lg">
                Escolha uma cidade ou região e o perfil de empresa que procura. O Zuno encontra negócios, organiza os dados públicos disponíveis, destaca sinais de oportunidade e prepara uma abordagem contextual para você começar a conversa.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="h-14 rounded-lg bg-[#10d98a] px-6 text-base font-bold text-[#0b0f0e] shadow-[0_0_32px_rgba(16,217,138,0.3)] transition-all hover:scale-[1.02] hover:bg-[#10d98a]/90 sm:px-8 sm:text-lg"
                  onClick={handlePrimaryCta}
                >
                  Começar minha primeira busca
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-lg border-[#1f2d29] bg-transparent px-6 text-sm text-[#f4f4f5] hover:border-[#10d98a]/40 hover:bg-[#10d98a]/5 sm:h-14 sm:text-base"
                  onClick={handleProofCta}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Ver o que o Zuno entrega
                </Button>
              </div>

              <div className="mt-4 flex items-start gap-2 sm:items-center">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#10d98a] sm:mt-0" />
                <p className="text-xs font-medium leading-snug text-[#9ca3af]">
                  {trialDurationDays
                    ? `Hoje R$0. Cartão necessário. Teste de ${trialDurationDays} dias. Cancele antes da primeira cobrança.`
                    : "Hoje R$0. Cartão necessário. A duração vigente será confirmada antes do checkout."}
                </p>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full min-w-0 max-w-[560px] lg:max-w-none">
            <MockupHeroProspeccao />
          </div>
        </div>
      </div>
    </section>
  );
}
