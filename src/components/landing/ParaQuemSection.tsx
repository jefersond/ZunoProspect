import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingUp, Palette, MessageSquare, BriefcaseBusiness, Building2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { LANDING_CTA_BASE, LANDING_CTA_ICON, LANDING_CTA_RESPONSIVE, LANDING_SECTION_CTA_WRAP } from "./ctaStyles";

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
    <section id="para-quem" className="border-b border-[#20312A]/40 bg-[#07100D] py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-4xl text-center">
          <Badge variant="outline" className="mb-4 border-[#20312A] bg-[#0D1713]/50 text-[#A9B8B1]">
            Para quem é
          </Badge>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-[#F3F7F5] md:text-5xl">
            Para quem vende serviços para outras empresas
          </h2>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-[#A9B8B1] md:text-lg">
            O Zuno ajuda profissionais e equipes B2B a encontrar empresas, organizar contexto e preparar o início da abordagem.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {categorias.map((cat) => (
            <Card
              key={cat.titulo}
              className="group flex flex-col rounded-xl border border-[#20312A] bg-[#0D1713] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#21E6A0]/40"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-[#20312A] bg-[#07100D] text-[#12D98B] transition-colors group-hover:bg-[#12D98B]/10">
                <cat.icone className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-base font-bold text-[#F3F7F5]">{cat.titulo}</h3>
              <p className="text-xs leading-relaxed text-[#A9B8B1]">{cat.descricao}</p>
            </Card>
          ))}
        </div>

        <div className={LANDING_SECTION_CTA_WRAP}>
          <Button
            size="lg"
            className={`${LANDING_CTA_BASE} ${LANDING_CTA_RESPONSIVE} bg-[#12D98B] text-base text-[#07100D] shadow-[0_0_30px_rgba(18,217,139,0.2)] transition-all hover:bg-[#21E6A0] md:text-lg`}
            onClick={goToPricing}
          >
            Encontrar empresas para prospectar
            <ArrowRight className={LANDING_CTA_ICON} />
          </Button>
        </div>
      </div>
    </section>
  );
}
