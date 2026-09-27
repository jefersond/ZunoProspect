import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { XCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

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
    <section id="antes-depois" className="relative overflow-hidden border-b border-[#1f2d29]/40 bg-[#0b0f0e] py-16 md:py-20">
      <div className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-[#10d98a]/5 blur-[120px]" />

      <div className="container relative z-10 mx-auto px-4">
        <div className="mx-auto mb-10 max-w-3xl text-center md:mb-12">
          <Badge variant="outline" className="mb-4 border-[#1f2d29] bg-[#111816]/50 text-[#9ca3af]">
            O problema
          </Badge>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-[#f4f4f5] md:text-5xl">
            Pare de montar sua prospecção em pedaços
          </h2>
          <p className="text-base leading-relaxed text-[#9ca3af] md:text-lg">
            Se hoje você pesquisa empresas em um lugar, anota em outro e escreve cada abordagem do zero, o processo fica mais difícil de repetir.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          <Card className="relative overflow-hidden rounded-xl border border-red-900/40 bg-[#1a0e0e]/60 p-6 backdrop-blur md:p-8">
            <div className="absolute left-0 top-0 h-[3px] w-full bg-red-500/60" />
            <h3 className="text-xl font-bold text-red-300">Muitas etapas manuais</h3>
            <p className="mb-6 mt-2 text-sm leading-relaxed text-zinc-500">
              A informação fica espalhada e cada nova prospecção exige recomeçar parte do trabalho.
            </p>
            <ul className="space-y-4">
              {itensManuais.map((item) => (
                <li key={item} className="flex items-start gap-3 text-zinc-400">
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500/80" />
                  <span className="text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-lg border border-red-900/30 bg-red-900/20 p-4 text-center text-xs text-red-300/80">
              Pesquisa, organização e abordagem ficam separadas.
            </div>
          </Card>

          <Card className="relative overflow-hidden rounded-xl border border-[#10d98a]/30 bg-[#091a12]/70 p-6 shadow-[0_0_50px_rgba(16,217,138,0.05)] backdrop-blur md:p-8">
            <div className="absolute left-0 top-0 h-[3px] w-full bg-[#10d98a]" />
            <h3 className="text-xl font-bold text-[#f4f4f5]">Um fluxo com a Zuno</h3>
            <p className="mb-6 mt-2 text-sm leading-relaxed text-[#9ca3af]">
              O Zuno reúne as etapas principais da prospecção para você trabalhar com mais contexto antes de iniciar a conversa.
            </p>
            <ul className="space-y-4">
              {itensZuno.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[#f4f4f5]">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#10d98a]" />
                  <span className="text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-lg border border-[#10d98a]/20 bg-[#10d98a]/8 p-4 text-center text-xs text-[#10d98a]">
              Busca, contexto e abordagem no mesmo fluxo.
            </div>
          </Card>
        </div>

        <div className="mt-10 text-center">
          <Button
            size="lg"
            className="h-14 rounded-lg bg-[#10d98a] px-8 text-base font-bold text-[#0b0f0e] shadow-[0_0_30px_rgba(16,217,138,0.2)] transition-all hover:bg-[#10d98a]/90 md:text-lg"
            onClick={goToPricing}
          >
            Ver oportunidades para meu negócio
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
