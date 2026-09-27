import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, MapPin, MessageSquareText, Search, Sparkles, Target } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { LANDING_CTA_BASE, LANDING_CTA_ICON, LANDING_CTA_RESPONSIVE } from "./ctaStyles";

const flow = [
  { label: "Busca", detail: "Cidade ou região + nicho", icon: Search },
  { label: "Empresas", detail: "Lista organizada", icon: Building2 },
  { label: "Prioridade", detail: "Sinais de oportunidade", icon: Target },
  { label: "Contexto", detail: "Dados públicos disponíveis", icon: Sparkles },
  { label: "Abordagem", detail: "Mensagem sugerida", icon: MessageSquareText },
];

export function ProductProofSection() {
  const goToPricing = () => {
    trackEvent("cta_clicked", {
      cta: "ver_oportunidades_para_meu_negocio",
      location: "product_proof",
      cta_location: "product_proof",
    });
    document.getElementById("precos")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="product-proof" className="border-b border-[#20312A]/40 bg-[#07100D] py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#12D98B]">Exemplo demonstrativo</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#F3F7F5] md:text-5xl">
            Veja o que o Zuno entrega em uma busca
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#A9B8B1] md:text-base">
            O exemplo abaixo mostra o formato do fluxo. Os dados variam conforme a região, o nicho e o que estiver publicamente disponível para cada empresa.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {flow.map((item) => (
            <div key={item.label} className="rounded-xl border border-[#20312A] bg-[#0D1713]/70 p-4">
              <item.icon className="h-5 w-5 text-[#12D98B]" />
              <p className="mt-3 text-sm font-bold text-[#F3F7F5]">{item.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#A9B8B1]">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-8 max-w-6xl overflow-hidden rounded-2xl border border-[#20312A] bg-[#0D1713] shadow-[0_0_50px_rgba(18,217,139,0.03)]">
          <div className="border-b border-[#20312A] px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#12D98B]">É isso que você recebe</p>
          </div>

          <div className="grid gap-0 lg:grid-cols-2">
            <div className="border-b border-[#20312A] p-5 lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-2 text-xs text-[#A9B8B1]">
                <MapPin className="h-4 w-4 text-[#12D98B]" />
                Ribeirão Preto, SP
              </div>
              <h3 className="mt-3 text-xl font-bold text-[#F3F7F5]">Empresa demonstrativa</h3>
              <p className="mt-1 text-sm text-[#A9B8B1]">Clínica odontológica</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[#20312A] bg-[#07100D] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6F8179]">Canais públicos</p>
                  <p className="mt-2 text-sm text-[#F3F7F5]">WhatsApp, Instagram e site</p>
                  <p className="mt-1 text-xs text-[#6F8179]">Quando disponíveis na fonte consultada</p>
                </div>
                <div className="rounded-lg border border-[#20312A] bg-[#07100D] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6F8179]">Oportunidade</p>
                  <p className="mt-2 text-sm text-[#F3F7F5]">Sinais de presença digital organizados para análise</p>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-[#12D98B]/20 bg-[#12D98B]/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#12D98B]">Diagnóstico</p>
                <p className="mt-2 text-sm leading-relaxed text-[#A9B8B1]">
                  O Zuno reúne o contexto disponível para ajudar você a decidir se vale abordar essa empresa e qual ponto usar para iniciar a conversa.
                </p>
              </div>
            </div>

            <div className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#12D98B]">Abordagem sugerida</p>
              <div className="mt-3 rounded-xl border border-[#20312A] bg-[#07100D] p-4">
                <p className="text-sm leading-7 text-[#A9B8B1]">
                  “Oi, tudo bem? Vi que vocês atendem em Ribeirão Preto e encontrei alguns pontos na presença digital que podem abrir espaço para melhorar a captação. Posso te mostrar o que observei?”
                </p>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[#6F8179]">
                A mensagem é uma sugestão. Você revisa, adapta e decide quando enviar.
              </p>

              <Button
                size="lg"
                className={`${LANDING_CTA_BASE} ${LANDING_CTA_RESPONSIVE} mt-6 bg-[#12D98B] text-[#07100D] hover:bg-[#21E6A0]`}
                onClick={goToPricing}
              >
                Ver oportunidades para meu negócio
                <ArrowRight className={LANDING_CTA_ICON} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
