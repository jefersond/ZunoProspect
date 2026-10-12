import { useState, type PointerEvent as ReactPointerEvent } from "react";
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
  const [lightPulse, setLightPulse] = useState<{ id: number; x: number; y: number } | null>(null);

  const moveAmbientLight = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--zuno-light-x", String(event.clientX - bounds.left) + "px");
    event.currentTarget.style.setProperty("--zuno-light-y", String(event.clientY - bounds.top) + "px");
  };

  const pulseLight = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if ((event.target as Element).closest("button, a, select, input, textarea")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setLightPulse({ id: event.timeStamp, x: event.clientX - bounds.left, y: event.clientY - bounds.top });
  };

  const tiltPreview = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    event.currentTarget.style.setProperty("--zuno-tilt-x", String((-y * 7).toFixed(2)) + "deg");
    event.currentTarget.style.setProperty("--zuno-tilt-y", String((x * 9).toFixed(2)) + "deg");
  };

  const resetPreviewTilt = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.removeProperty("--zuno-tilt-x");
    event.currentTarget.style.removeProperty("--zuno-tilt-y");
  };

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

  const handleDemoCta = () => {
    trackEvent("landing_demo_cta_clicked", { location: "interactive_demo" });
    trackHeroMeta("CTA_Demo_Click", "Ver planos e começar");
    scrollToSection("precos");
  };

  return (
    <section className="zuno-hero-future relative isolate overflow-hidden border-b border-[#12D98B]/15 bg-[#07100D] text-[#F3F7F5] selection:bg-[#12D98B]/40" onPointerMove={moveAmbientLight} onPointerDown={pulseLight}>
      <div className="zuno-hero-atmosphere pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="zuno-hero-halo pointer-events-none absolute -right-40 top-0 h-[650px] w-[650px] rounded-full" aria-hidden="true" />
      {lightPulse && <span key={lightPulse.id} className="zuno-light-ripple pointer-events-none absolute z-10" style={{ left: lightPulse.x, top: lightPulse.y }} aria-hidden="true" />}
      <div className="pointer-events-none absolute left-1/2 top-0 h-px w-[75%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#12D98B]/45 to-transparent" aria-hidden="true" />
      <div className="container relative mx-auto px-4">
        <div className="grid items-center gap-10 pb-8 pt-10 sm:pt-14 lg:grid-cols-2 lg:gap-10 lg:pb-12 lg:pt-16">
          <div className="relative z-10 min-w-0 max-w-2xl">
            <div className="inline-flex max-w-full items-start gap-2 rounded-full border border-[#0B8F60]/50 bg-[#12D98B]/10 px-3 py-1.5 text-xs font-bold text-[#8DF0BE] backdrop-blur-md">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0">Plataforma de prospecção B2B para agências e freelancers</span>
            </div>

            <h1 className="mt-6 break-words text-[2.7rem] font-extrabold leading-[1.01] tracking-[-0.06em] max-[319px]:text-[2rem] sm:text-6xl lg:text-[3.45rem] xl:text-[3.6rem]">
              Encontre empresas.<br />
              <span className="zuno-hero-gradient-text text-[#12D98B]">Saiba como abordar.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-[#A9B8B1] sm:text-lg">
              Escolha uma cidade e um nicho. O Zuno organiza dados públicos, mostra sinais de oportunidade e sugere a primeira mensagem para cada empresa.
            </p>

            <div className={LANDING_CTA_PAIR}>
              <Button
                size="lg"
                className={[LANDING_CTA_BASE, LANDING_CTA_RESPONSIVE, "whitespace-normal px-3 text-center text-base leading-tight text-[#07100D] bg-[#12D98B] shadow-[0_14px_32px_rgba(18,217,139,0.18)] transition-transform hover:scale-[1.02] hover:bg-[#21E6A0] sm:px-5 sm:text-base"].join(" ")}
                onClick={handlePrimaryCta}
              >
                Começar minha primeira busca
                <ArrowRight className={LANDING_CTA_ICON} />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className={[LANDING_CTA_BASE, LANDING_CTA_RESPONSIVE, "whitespace-normal border-[#12D98B]/30 bg-[#0D1713]/70 px-3 text-center text-sm leading-tight text-[#F3F7F5] hover:border-[#12D98B] hover:bg-[#12D98B]/10 sm:px-5 sm:text-sm"].join(" ")}
                onClick={handleProofCta}
              >
                <Play className={LANDING_CTA_ICON} />
                Ver o que o Zuno entrega
              </Button>
            </div>

            <div className="mt-5 flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#12D98B]" />
              <p className="text-xs font-medium leading-snug text-[#A9B8B1]">
                {trialDurationDays
                  ? "Hoje R$0. Cartão necessário. Teste de " + trialDurationDays + " dias. Cancele antes da primeira cobrança."
                  : "Hoje R$0. Cartão necessário. A duração vigente será confirmada antes do checkout."}
              </p>
            </div>
          </div>

          <div className="zuno-hero-stage relative mx-auto w-full min-w-0 max-w-[590px]" onPointerMove={tiltPreview} onPointerLeave={resetPreviewTilt}>
            <div className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-[#12D98B]/15 blur-[65px]" aria-hidden="true" />
            <div className="zuno-hero-orbit pointer-events-none absolute -inset-3 hidden rounded-[2.5rem] border border-[#12D98B]/20 lg:block" aria-hidden="true" />
            <div className="zuno-hero-window relative"><MockupHeroProspeccao onStart={handleDemoCta} /></div>
          </div>
        </div>

        <div className="grid gap-3 border-t border-[#12D98B]/20 py-5 text-sm font-semibold text-[#D7E4DC] sm:grid-cols-3 sm:gap-6">
          {heroSteps.map((step, index) => (
            <div key={step} className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#12D98B]/40 bg-[#12D98B]/10 text-xs text-[#12D98B]">{index + 1}</span>
              <span>{step}</span>
              <Check className="ml-auto h-4 w-4 shrink-0 text-[#12D98B] sm:hidden" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
