import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingUp, Palette, MessageSquare, BriefcaseBusiness, Building2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export function ParaQuemSection() {
  const categorias = [
    {
      titulo: "Gestores de Tráfego",
      icone: TrendingUp,
      descricao: "Encontre empresas por cidade e nicho e use sinais públicos para preparar uma abordagem mais contextual.",
    },
    {
      titulo: "Social Medias",
      icone: MessageSquare,
      descricao: "Busque negócios locais e organize Instagram, site e outros canais públicos disponíveis antes de iniciar a conversa.",
    },
    {
      titulo: "Designers",
      icone: Palette,
      descricao: "Mapeie empresas por região e use o contexto disponível para identificar onde seu serviço pode fazer sentido.",
    },
    {
      titulo: "Freelancers",
      icone: BriefcaseBusiness,
      descricao: "Crie uma rotina de prospecção por nicho e cidade sem depender apenas de indicação.",
    },
    {
      titulo: "Agências",
      icone: Building2,
      descricao: "Organize buscas por segmentos e regiões para dar mais contexto ao trabalho comercial da equipe.",
    },
  ];

  const goToPricing = () => {
    trackEvent("cta_clicked", {
      cta: "encontrar_empresas_para_prospectar",
      location: "para_quem",
      cta_location: "para_quem",
    });
    document.getElementById("precos")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="para-quem" className="border-b border-[#1f2d29]/40 bg-[#0b0f0e] py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-4xl text-center">
          <Badge variant="outline" className="mb-4 border-[#1f2d29] bg-[#111816]/50 text-[#9ca3af]">
            Para quem é
          </Badge>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-[#f4f4f5] md:text-5xl">
            Para quem vende serviços para outras empresas
          </h2>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-[#9ca3af] md:text-lg">
            O Zuno ajuda profissionais e equipes B2B a encontrar empresas, organizar contexto e preparar o início da abordagem.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {categorias.map((cat) => (
            <Card
              key={cat.titulo}
              className="group flex flex-col rounded-xl border border-[#1f2d29] bg-[#111816] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#10d98a]/30"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-[#1f2d29] bg-[#0b0f0e] text-[#10d98a] transition-colors group-hover:bg-[#10d98a]/10">
                <cat.icone className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-base font-bold text-[#f4f4f5]">{cat.titulo}</h3>
              <p className="text-xs leading-relaxed text-[#9ca3af]">{cat.descricao}</p>
            </Card>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Button
            size="lg"
            className="h-14 rounded-lg bg-[#10d98a] px-8 text-base font-bold text-[#0b0f0e] shadow-[0_0_30px_rgba(16,217,138,0.2)] transition-all hover:bg-[#10d98a]/90 md:text-lg"
            onClick={goToPricing}
          >
            Encontrar empresas para prospectar
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
