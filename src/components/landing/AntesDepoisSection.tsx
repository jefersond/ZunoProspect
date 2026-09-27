import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { XCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { LANDING_CTA_BASE, LANDING_CTA_ICON, LANDING_CTA_RESPONSIVE, LANDING_SECTION_CTA_WRAP } from "./ctaStyles";

export function AntesDepoisSection() {
  const itensManuais = [
    "Pesquisa empresas em uma ferramenta",
    "Salva contatos em planilhas ou abas",
    "Decide quem abordar sem contexto organizado",
    "Escreve cada mensagem do zero",
  ];

  const itensZuno = [
    "Busca empresas por cidade e nicho",
    "Organiza os dados públicos disponíveis",
    "Ajuda a priorizar oportunidades",
    "Sugere uma abordagem contextual",
  ];

  const goToPricing = () => {
    trackEvent("cta_clicked", {
      cta: "ver_oportunidades_para_meu_negocio",
      location: "problema",
      cta_location: "problema",
    });
    document.getElementById("precos")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="antes-depois" className="relative overflow-hidden border-b border-[#20312A]/40 bg-[#07100D] py-16 md:py-20">
      <div className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-[#12D98B]/5 blur-[120px]" />

      <div className="container relative z-10 mx-auto px-4">
        <div className="mx-auto mb-10 max-w-3xl text-center md:mb-12">
          <Badge variant="outline" className="mb-4 border-[#20312A] bg-[#0D1713]/50 text-[#A9B8B1]">
            O problema
          </Badge>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-[#F3F7F5] md:text-5xl">
            Pare de montar sua prospecção em pedaços
          </h2>
          <p className="text-base leading-relaxed text-[#A9B8B1] md:text-lg">
            Se hoje você pesquisa empresas em um lugar, anota em outro e escreve cada abordagem do zero, o processo fica mais difícil de repetir.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          <Card className="relative overflow-hidden rounded-xl border border-[#E55757]/30 bg-[#E55757]/[0.06] p-6 backdrop-blur md:p-8">
            <div className="absolute left-0 top-0 h-[3px] w-full bg-[#E55757]" />
            <h3 className="text-xl font-bold text-[#E55757]">Muitas etapas manuais</h3>
            <p className="mb-6 mt-2 text-sm leading-relaxed text-[#6F8179]">
              A informação fica espalhada e cada nova prospecção exige recomeçar parte do trabalho.
            </p>
            <ul className="space-y-4">
              {itensManuais.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[#A9B8B1]">
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#E55757]" />
                  <span className="text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-lg border border-[#E55757]/25 bg-[#E55757]/[0.06] p-4 text-center text-xs text-[#E55757]/80">
              Pesquisa, organização e abordagem ficam separadas.
            </div>
          </Card>

          <Card className="relative overflow-hidden rounded-xl border border-[#12D98B]/30 bg-[#111D18]/70 p-6 shadow-[0_0_50px_rgba(18,217,139,0.05)] backdrop-blur md:p-8">
            <div className="absolute left-0 top-0 h-[3px] w-full bg-[#12D98B]" />
            <h3 className="text-xl font-bold text-[#F3F7F5]">Um fluxo com a Zuno</h3>
            <p className="mb-6 mt-2 text-sm leading-relaxed text-[#A9B8B1]">
              O Zuno reúne as etapas principais da prospecção para você trabalhar com mais contexto antes de iniciar a conversa.
            </p>
            <ul className="space-y-4">
              {itensZuno.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[#F3F7F5]">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#12D98B]" />
                  <span className="text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-lg border border-[#12D98B]/20 bg-[#12D98B]/8 p-4 text-center text-xs text-[#12D98B]">
              Busca, contexto e abordagem no mesmo fluxo.
            </div>
          </Card>
        </div>

        <div className={LANDING_SECTION_CTA_WRAP}>
          <Button
            size="lg"
            className={`${LANDING_CTA_BASE} ${LANDING_CTA_RESPONSIVE} bg-[#12D98B] text-base text-[#07100D] shadow-[0_0_30px_rgba(18,217,139,0.2)] transition-all hover:bg-[#21E6A0] md:text-lg`}
            onClick={goToPricing}
          >
            Ver oportunidades para meu negócio
            <ArrowRight className={LANDING_CTA_ICON} />
          </Button>
        </div>
      </div>
    </section>
  );
}
