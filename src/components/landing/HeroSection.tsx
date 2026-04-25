import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { SocialProofBar } from "./SocialProofBar";
import { MockupHeroProspeccao } from "./mockups/MockupHeroProspeccao";

export function HeroSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth"
    });
  };

  return (
    <section className="relative overflow-hidden bg-zinc-950 pt-24 pb-16 md:py-32 selection:bg-teal-500/30">
      {/* Background Orbs para dar o ar Premium/Dark */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          <div className="space-y-8 md:space-y-10 relative">
            
            {/* Efeito Glassmorphism atrás do conteúdo de texto */}
            <div className="absolute -inset-4 md:-inset-8 bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-3xl -z-10 shadow-2xl" />

            <div className="pt-4 md:pt-8 pl-2 md:pl-4">
              <SocialProofBar />

              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] text-white mt-6">
                Economize horas. <br className="hidden md:block" />
                <span className="relative inline-block mt-2">
                  <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 bg-clip-text text-transparent drop-shadow-sm">
                    O Plano de Prospecção de 7 Dias
                  </span>
                </span>{" "}
                em segundos.
              </h1>

              <p className="text-lg sm:text-xl text-zinc-400 max-w-xl font-light leading-relaxed mt-6">
                Feito para equipes B2B que não têm tempo a perder. Nossa IA audita a empresa, identifica falhas no marketing e te entrega o diagnóstico e o passo a passo exato do que enviar para fechar a venda.
              </p>

              <div className="flex flex-col gap-3 mt-10 pb-4 md:pb-8">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    size="lg" 
                    className="bg-gradient-to-r from-teal-400 to-emerald-500 hover:from-teal-300 hover:to-emerald-400 text-zinc-950 font-bold shadow-[0_0_30px_rgba(20,184,166,0.5)] hover:shadow-[0_0_40px_rgba(20,184,166,0.7)] text-lg px-8 py-6 rounded-xl transition-all hover:scale-105 border-0" 
                    onClick={() => scrollToSection("precos")}
                  >
                    Começar Plano Grátis
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="bg-white/5 hover:bg-white/10 border-white/10 text-white backdrop-blur-sm text-lg px-8 py-6 rounded-xl transition-all" 
                    onClick={() => scrollToSection("como-funciona")}
                  >
                    Ver como funciona
                  </Button>
                </div>

                {/* Micro-copy de quebra de objeção */}
                <p className="flex items-center gap-1.5 text-sm text-zinc-500 mt-1">
                  <ShieldCheck className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                  Sem compromisso. Não exigimos cartão de crédito agora.
                </p>
              </div>
            </div>
          </div>

          <div className="relative hidden lg:block lg:scale-110 xl:scale-115">
            <div className="animate-fade-in relative z-10">
              <MockupHeroProspeccao />
            </div>
            {/* Reflexo glass do mockup */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent rounded-3xl blur-2xl -z-10 transform translate-y-10 scale-95" />
          </div>
        </div>
      </div>
    </section>
  );
}
