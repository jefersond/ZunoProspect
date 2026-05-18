import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { SocialProofBar } from "./SocialProofBar";
import { MockupHeroProspeccao } from "./mockups/MockupHeroProspeccao";
import { appendReferralToPath } from "@/lib/referral";
import { trackEvent } from "@/lib/analytics";
import { trackMetaCustomEvent } from "@/lib/metaPixel";

export function HeroSection() {
  const headline = "Pare de prospectar no escuro.";

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const trackCta = (cta: string, location: string) => {
    trackEvent("cta_clicked", { cta, location });
  };

  const trackHeroCta = (eventName: string, ctaText: string) => {
    trackMetaCustomEvent(eventName, {
      page: "landing",
      location: "hero",
      cta_text: ctaText,
    });
  };

  return (
    <section className="relative overflow-hidden border-b border-border/40 bg-background pt-20 pb-12 selection:bg-primary/30 md:pt-28 md:pb-20">
      <div className="container relative z-10 mx-auto px-4">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.92fr] lg:gap-12">
          <div className="relative">
            <div className="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-xl backdrop-blur md:p-8">
              <h1 className="mt-2 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {headline}
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
                Encontre empresas por cidade e nicho, analise oportunidades com IA e receba abordagens prontas para WhatsApp, Instagram e e-mail.
              </p>

              <div className="mt-8 flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    size="lg"
                    className="h-14 rounded-xl border-2 border-primary/50 bg-primary px-8 text-base font-bold text-primary-foreground shadow-[0_0_32px_hsl(162_72%_41%/0.45)] transition-all hover:scale-[1.02] hover:bg-primary/90 sm:text-lg"
                    asChild
                  >
                    <Link
                      to={appendReferralToPath("/auth?tab=signup")}
                      onClick={() => {
                        trackCta("comecar_gratis", "hero");
                        trackHeroCta("CTA_Hero_Click", "Comecar gratis");
                      }}
                    >
                      Começar grátis
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-14 rounded-xl border-primary/30 px-8 text-base text-primary hover:border-primary/60 hover:bg-primary/10 sm:text-lg"
                    onClick={() => {
                      trackCta("ver_como_funciona", "hero");
                      trackHeroCta("CTA_Secondary_Click", "Ver como funciona");
                      scrollToSection("como-funciona");
                    }}
                  >
                    Ver como funciona
                  </Button>
                </div>

                <p className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                  Teste com 20 leads grátis + 3 análises IA.
                </p>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[560px] lg:max-w-none">
            <MockupHeroProspeccao />
          </div>
        </div>
      </div>
    </section>
  );
}
