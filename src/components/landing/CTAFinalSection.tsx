import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export function CTAFinalSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="bg-[#0b0f0e] py-16 md:py-24 border-b border-[#1f2d29]/40 relative overflow-hidden">
      {/* Brilho decorativo no centro */}
      <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#10d98a]/5 blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-4 text-center relative z-10">
        <div className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-[#10d98a]/20 bg-[#10d98a]/5 px-3 py-1 text-xs font-semibold text-[#10d98a]">
          <Sparkles className="h-3.5 w-3.5" />
          Acesso imediato e simplificado
        </div>

        <h2 className="mx-auto mb-4 max-w-3xl text-3xl font-extrabold text-[#f4f4f5] md:text-5xl tracking-tight">
          Comece sua prospecção com mais clareza.
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-base text-[#9ca3af] md:text-lg">
          Teste grátis por 7 dias com acesso completo às ferramentas de busca e IA, sem taxas de configuração.
        </p>

        <div className="mx-auto flex max-w-md flex-col justify-center gap-3 sm:max-w-none sm:flex-row">
          <Button
            size="lg"
            className="h-14 w-full bg-[#10d98a] text-[#0b0f0e] font-bold shadow-[0_0_30px_rgba(16,217,138,0.25)] hover:bg-[#10d98a]/90 sm:w-auto px-8"
            onClick={() => {
              trackEvent("cta_clicked", { cta: "comecar_gratis", location: "final_cta" });
              scrollToSection("precos");
            }}
          >
            Começar teste grátis de 7 dias
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
        <p className="text-sm font-semibold text-[#f4f4f5] mt-4">
          Hoje R$0 • Cartão necessário • Cancele antes da cobrança
        </p>
      </div>
    </section>
  );
}

