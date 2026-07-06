import { Button } from "@/components/ui/button";
import { ArrowRight, Play, ShieldCheck, Sparkles, MapPin } from "lucide-react";
import { MockupHeroProspeccao } from "./mockups/MockupHeroProspeccao";
import { trackEvent } from "@/lib/analytics";
import { trackMetaCustomEvent } from "@/lib/metaPixel";
import { useEffect, useState } from "react";

const ATIVIDADES = [
  { cidade: "São Paulo · SP", acao: "encontrou 47 leads em clínicas estéticas", tempo: "agora" },
  { cidade: "Belo Horizonte · MG", acao: "gerou 12 abordagens por WhatsApp", tempo: "1min atrás" },
  { cidade: "Curitiba · PR", acao: "iniciou o teste grátis", tempo: "2min atrás" },
  { cidade: "Campinas · SP", acao: "encontrou 31 leads em academias", tempo: "3min atrás" },
  { cidade: "Fortaleza · CE", acao: "gerou copy para 8 restaurantes", tempo: "4min atrás" },
];

export function HeroSection() {
  const headline = "Encontre, analise e aborde empresas sem improviso.";
  const [atividadeIndex, setAtividadeIndex] = useState(0);
  const [visivel, setVisivel] = useState(true);
  useEffect(() => {
    const intervalo = setInterval(() => {
      setVisivel(false);
      setTimeout(() => {
        setAtividadeIndex((i) => (i + 1) % ATIVIDADES.length);
        setVisivel(true);
      }, 400);
    }, 3500);
    return () => clearInterval(intervalo);
  }, []);

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
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
          <div className="relative">
            <div className="rounded-2xl border border-[#1f2d29] bg-[#111816]/80 p-6 shadow-[0_0_50px_rgba(16,217,138,0.02)] backdrop-blur-md md:p-8">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#10d98a]/30 bg-[#10d98a]/10 px-3 py-1 text-xs font-semibold text-[#10d98a] mb-4">
                <Sparkles className="h-3.5 w-3.5" />
                Máquina de prospecção inteligente
              </div>

              <h1 className="mt-2 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight text-[#f4f4f5] sm:text-5xl lg:text-6xl">
                {headline}
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-[#9ca3af] sm:text-lg">
                Encontre empresas por cidade e nicho, analise oportunidades com IA e gere abordagens personalizadas — em minutos, não horas.
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

              {/* Social Proof — atividade ao vivo */}
              <div className="mt-6">
                <div
                  className="inline-flex items-center gap-2.5 rounded-xl border border-[#1f2d29] bg-[#111816]/80 px-3 py-2.5 shadow-sm backdrop-blur transition-opacity duration-300"
                  style={{ opacity: visivel ? 1 : 0 }}
                >
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10d98a] opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#10d98a]" />
                  </span>
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[#10d98a]" />
                  <p className="text-xs text-[#9ca3af] leading-tight">
                    <span className="font-semibold text-[#f4f4f5]">{ATIVIDADES[atividadeIndex].cidade}</span>
                    {" "}
                    {ATIVIDADES[atividadeIndex].acao}
                    <span className="ml-1.5 text-[#9ca3af]/60">· {ATIVIDADES[atividadeIndex].tempo}</span>
                  </p>
                </div>
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
                    Sem cartão de crédito · Hoje R$0
                    <br className="sm:hidden" />
                    <span className="hidden sm:inline"> · </span>
                    Cancele antes dos 7 dias sem cobrança
                  </p>
                </div>
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

