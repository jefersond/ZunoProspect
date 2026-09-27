import { useBillingOfferConfig } from "@/hooks/useBillingOfferConfig";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export function CTAFinalSection() {
  const { trialDurationDays } = useBillingOfferConfig();

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="bg-[#07100D] py-16 md:py-24 border-b border-[#20312A]/40 relative overflow-hidden">
      {/* Brilho decorativo no centro */}
      <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#12D98B]/5 blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-4 text-center relative z-10">
        <div className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-[#12D98B]/20 bg-[#12D98B]/5 px-3 py-1 text-xs font-semibold text-[#12D98B]">
          <Sparkles className="h-3.5 w-3.5" />
          {trialDurationDays ? `${trialDurationDays} dias grátis, acesso imediato` : "Teste grátis com duração confirmada pela oferta vigente"}
        </div>

        <h2 className="mx-auto mb-4 max-w-3xl text-3xl font-extrabold text-[#F3F7F5] md:text-5xl tracking-tight">
          Comece sua próxima prospecção com uma busca mais clara.
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-base text-[#A9B8B1] md:text-lg">
          Escolha um plano, ative o teste e use o Zuno para encontrar empresas, priorizar oportunidades e preparar sua primeira abordagem.
        </p>

        <div className="mx-auto flex max-w-md flex-col justify-center gap-3 sm:max-w-none sm:flex-row">
          <Button
            size="lg"
            className="h-14 w-full bg-[#12D98B] text-[#07100D] font-bold shadow-[0_0_30px_rgba(18,217,139,0.25)] hover:bg-[#21E6A0] sm:w-auto px-8"
            onClick={() => {
              trackEvent("cta_clicked", { cta: "comecar_primeira_busca", location: "final_cta", cta_location: "final" });
              trackEvent("trial_cta_clicked", { cta_location: "final", cta_text: "Começar minha primeira busca", trial_duration_days: trialDurationDays });
              scrollToSection("precos");
            }}
          >
            Começar minha primeira busca
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
        <p className="text-sm font-semibold text-[#F3F7F5] mt-4">
          Hoje R$0. Cartão necessário. Cancele antes da cobrança
        </p>
      </div>
    </section>
  );
}

