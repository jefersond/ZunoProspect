import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Play, ShieldCheck, Sparkles } from "lucide-react";
import { MockupHeroProspeccao } from "./mockups/MockupHeroProspeccao";
import { trackEvent } from "@/lib/analytics";
import { trackMetaCustomEvent } from "@/lib/metaPixel";

export function HeroSection() {
  const headline = "Encontre negócios locais que precisam do seu serviço — e saiba como abordar cada um.";

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
    <section className="relative overflow-hidden border-b border-[#1f2d29]/40 bg-[#0b0f0e] pt-16 pb-16 selection:bg-[#10d98a]/30 md:pt-24 md:pb-24">
      {/* Brilho neon de fundo */}
      <div className="absolute left-1/3 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[#10d98a]/5 blur-[120px] pointer-events-none" />

      <div className="container relative z-10 mx-auto px-4">
        <div className="grid min-w-0 items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
          <div className="relative min-w-0">
            <div className="rounded-2xl border border-[#1f2d29] bg-[#111816]/80 p-6 shadow-[0_0_50px_rgba(16,217,138,0.02)] backdrop-blur-md md:p-8">
              <div className="mb-4 inline-flex max-w-full items-start gap-1.5 rounded-full border border-[#10d98a]/30 bg-[#10d98a]/10 px-3 py-1 text-left text-xs font-semibold leading-relaxed text-[#10d98a]">
                <Sparkles className="h-3.5 w-3.5" />
                Prospecção B2B com IA para agências e freelancers
              </div>

              <h1 className="mt-2 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight text-[#f4f4f5] sm:text-5xl lg:text-6xl">
                {headline}
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-[#9ca3af] sm:text-lg">
                Escolha uma cidade e um nicho. A Zuno organiza empresas e contatos públicos, analisa oportunidades com IA e gera uma abordagem contextual para WhatsApp, Instagram ou e-mail.
              </p>

              {/* Chips de Públicos Alvo */}
              <div className="mt-4 flex flex-wrap gap-2">
                {["Gestores de tráfego", "Social medias", "Designers", "Freelancers", "Agências"].map((publico) => (
                  <span
                    key={publico}
                    className="inline-flex items-center rounded-full border border-[#1f2d29] bg-[#0b0f0e]/50 px-3 py-1 text-xs font-semibold text-[#10d98a] hover:border-[#10d98a]/30 transition-all cursor-default"
                  >
                    {publico}
                  </span>
                ))}
              </div>

              <div className="mt-6 grid gap-2 text-xs text-[#9ca3af] sm:grid-cols-3">
                {["Busca por região", "Diagnóstico com IA", "Mensagem pronta"].map((beneficio) => (
                  <div key={beneficio} className="flex items-center gap-2 rounded-lg border border-[#1f2d29] bg-[#0b0f0e]/50 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10d98a]" />
                    <span>{beneficio}</span>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    size="lg"
                    className="h-14 rounded-lg bg-[#10d98a] px-8 text-base font-bold text-[#0b0f0e] shadow-[0_0_32px_rgba(16,217,138,0.3)] transition-all hover:scale-[1.02] hover:bg-[#10d98a]/90 sm:text-lg"
                    onClick={() => {
                      trackCta("comecar_gratis", "hero");
                      trackHeroCta("CTA_Hero_Click", "Começar teste grátis de 7 dias");
                      scrollToSection("precos");
                    }}
                  >
                    Começar teste grátis de 7 dias
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-14 rounded-lg border-[#1f2d29] bg-transparent px-8 text-base text-[#f4f4f5] hover:border-[#10d98a]/40 hover:bg-[#10d98a]/5 sm:text-lg"
                    onClick={() => {
                      trackCta("ver_como_funciona", "hero");
                      trackHeroCta("CTA_Secondary_Click", "Ver como buscar leads");
                      scrollToSection("como-funciona");
                    }}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Ver como buscar leads
                  </Button>
                </div>

                {/* Trust — duas linhas no mobile para não cortar */}
                <div className="flex items-start gap-2 sm:items-center">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-[#10d98a] mt-0.5 sm:mt-0" />
                  <p className="text-xs text-[#9ca3af] font-medium leading-snug">
                    Hoje R$0 · Cartão necessário · Cancele antes dos 7 dias sem cobrança
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative mx-auto min-w-0 w-full max-w-[560px] lg:max-w-none">
            <MockupHeroProspeccao />
          </div>
        </div>
      </div>
    </section>
  );
}

