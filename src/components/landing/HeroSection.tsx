import type { PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Check, MessageCircle, Play, ShieldCheck, Sparkles } from "lucide-react";
import { MockupHeroProspeccao } from "./mockups/MockupHeroProspeccao";
import { trackEvent } from "@/lib/analytics";
import { trackMetaCustomEvent } from "@/lib/metaPixel";
import { useBillingOfferConfig } from "@/hooks/useBillingOfferConfig";
import { LANDING_CTA_BASE, LANDING_CTA_ICON, LANDING_CTA_PAIR, LANDING_CTA_RESPONSIVE } from "./ctaStyles";
import { cardTrialCopy } from "./trialCopy";
import { buildWhatsAppUrl, WHATSAPP_LANDING_HELP_MESSAGE } from "@/config/whatsapp";

const heroSteps = [
  "Busque por cidade e segmento",
  "Analise dados públicos e sinais de oportunidade",
  "Aborde com mensagem contextual personalizada",
];

export function HeroSection() {
  const { trialDurationDays } = useBillingOfferConfig();

  const tiltPreview = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    event.currentTarget.style.setProperty("--zuno-tilt-x", String((-y * 4).toFixed(2)) + "deg");
    event.currentTarget.style.setProperty("--zuno-tilt-y", String((x * 5).toFixed(2)) + "deg");
    event.currentTarget.style.setProperty("--zuno-pointer-x", String(((x + 0.5) * 100).toFixed(1)) + "%");
    event.currentTarget.style.setProperty("--zuno-pointer-y", String(((y + 0.5) * 100).toFixed(1)) + "%");
  };

  const resetPreviewTilt = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.removeProperty("--zuno-tilt-x");
    event.currentTarget.style.removeProperty("--zuno-tilt-y");
    event.currentTarget.style.removeProperty("--zuno-pointer-x");
    event.currentTarget.style.removeProperty("--zuno-pointer-y");
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
    const ctaText = "Ver o Zuno funcionando";
    trackEvent("cta_clicked", { cta: "ver_zuno_funcionando", location: "hero", cta_location: "hero" });
    trackEvent("hero_cta_clicked", { cta_location: "hero", cta_text: ctaText, trial_duration_days: trialDurationDays });
    trackEvent("trial_cta_clicked", { cta_location: "hero", cta_text: ctaText, trial_duration_days: trialDurationDays });
    trackHeroMeta("CTA_Hero_Click", ctaText);
    scrollToSection("demo-interativa");
  };

  const handleWhatsAppCta = () => {
    const ctaText = "Tirar dúvidas no WhatsApp";
    trackEvent("cta_clicked", { cta: "tirar_duvidas_whatsapp", location: "hero", cta_location: "hero" });
    trackEvent("whatsapp_clicked", { location: "hero_secondary" });
    trackHeroMeta("CTA_WhatsApp_Hero_Click", ctaText);
    const url = buildWhatsAppUrl(WHATSAPP_LANDING_HELP_MESSAGE);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDemoCta = () => {
    trackEvent("landing_demo_cta_clicked", { location: "interactive_demo" });
    trackHeroMeta("CTA_Demo_Click", "Ver planos e começar");
    scrollToSection("precos");
  };

  return (
    <section className="zuno-hero-future relative isolate overflow-hidden border-b border-[#12D98B]/15 bg-[#07100D] text-[#F3F7F5] selection:bg-[#12D98B]/40">
      <div className="zuno-hero-halo pointer-events-none absolute -right-40 top-0 h-[650px] w-[650px] rounded-full" aria-hidden="true" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-px w-[75%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#12D98B]/45 to-transparent" aria-hidden="true" />
      <div className="container relative mx-auto px-4">
        <div className="grid items-center gap-10 pb-8 pt-10 sm:pt-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 lg:pb-12 lg:pt-16">
          <div className="relative z-10 max-w-2xl max-lg:min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0B8F60]/50 bg-[#12D98B]/10 px-3 py-1.5 text-xs font-bold text-[#8DF0BE] backdrop-blur-md max-lg:max-w-full">
              <Sparkles className="h-3.5 w-3.5 max-lg:shrink-0 text-[#12D98B]" />
              <span className="max-lg:min-w-0">Plataforma de prospecção B2B · Para gestores de tráfego, agências e freelancers</span>
            </div>

            <h1 className="mt-6 text-[2.5rem] font-extrabold leading-[1.04] tracking-[-0.05em] max-lg:break-words max-[319px]:text-[1.85rem] sm:text-5xl lg:text-[3.8rem]">
              Pare de procurar empresas no escuro.<br />
              <span className="zuno-hero-gradient-text text-[#12D98B]">Comece a prospectar com direção.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-[#A9B8B1] sm:text-lg">
              Pesquise negócios por cidade e segmento, encontre oportunidades comerciais e organize sua próxima abordagem com o Zuno Prospect.
            </p>

            <div className={LANDING_CTA_PAIR}>
              <Button
                size="lg"
                className={[LANDING_CTA_BASE, LANDING_CTA_RESPONSIVE, "bg-[#12D98B] text-base text-[#07100D] shadow-[0_14px_32px_rgba(18,217,139,0.18)] transition-transform hover:scale-[1.02] hover:bg-[#21E6A0] max-sm:h-auto max-sm:whitespace-normal max-sm:px-3 max-sm:py-3 max-sm:text-center max-sm:leading-tight sm:px-8 sm:text-lg"].join(" ")}
                onClick={handlePrimaryCta}
              >
                <Play className={LANDING_CTA_ICON} />
                Ver o Zuno funcionando
              </Button>
              <Button
                size="lg"
                variant="outline"
                className={[LANDING_CTA_BASE, LANDING_CTA_RESPONSIVE, "border-[#12D98B]/30 bg-[#0D1713]/70 text-sm text-[#F3F7F5] hover:border-[#12D98B] hover:bg-[#12D98B]/10 max-sm:h-auto max-sm:whitespace-normal max-sm:px-3 max-sm:py-3 max-sm:text-center max-sm:leading-tight sm:px-8 sm:text-base"].join(" ")}
                onClick={handleWhatsAppCta}
              >
                <MessageCircle className={LANDING_CTA_ICON} />
                Tirar dúvidas no WhatsApp
              </Button>
            </div>

            <div className="mt-5 flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#12D98B]" />
              <p className="text-xs font-medium leading-snug text-[#A9B8B1]">
                Hoje R$0. {cardTrialCopy(trialDurationDays)} Cancele antes da primeira cobrança.
              </p>
            </div>
          </div>

          <div id="demo-interativa" className="zuno-hero-stage relative mx-auto w-full min-w-0 max-w-[590px] lg:max-w-none" onPointerMove={tiltPreview} onPointerLeave={resetPreviewTilt}>
            <div className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-[#12D98B]/15 blur-[65px]" aria-hidden="true" />
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
