import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, MapPin, MessageSquareText, Search, Sparkles, Target } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

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
    <section id="product-proof" className="border-b border-[#1f2d29]/40 bg-[#0b0f0e] py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#10d98a]">Exemplo demonstrativo</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#f4f4f5] md:text-5xl">
            Veja o que o Zuno entrega em uma busca
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#9ca3af] md:text-base">
            O exemplo abaixo mostra o formato do fluxo. Os dados variam conforme a região, o nicho e o que estiver publicamente disponível para cada empresa.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {flow.map((item) => (
            <div key={item.label} className="rounded-xl border border-[#1f2d29] bg-[#111816]/70 p-4">
              <item.icon className="h-5 w-5 text-[#10d98a]" />
              <p className="mt-3 text-sm font-bold text-[#f4f4f5]">{item.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#9ca3af]">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-8 max-w-6xl overflow-hidden rounded-2xl border border-[#1f2d29] bg-[#111816] shadow-[0_0_50px_rgba(16,217,138,0.03)]">
          <div className="border-b border-[#1f2d29] px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#10d98a]">É isso que você recebe</p>
          </div>

          <div className="grid gap-0 lg:grid-cols-2">
            <div className="border-b border-[#1f2d29] p-5 lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-2 text-xs text-[#9ca3af]">
                <MapPin className="h-4 w-4 text-[#10d98a]" />
                Ribeirão Preto, SP
              </div>
              <h3 className="mt-3 text-xl font-bold text-[#f4f4f5]">Empresa demonstrativa</h3>
              <p className="mt-1 text-sm text-[#9ca3af]">Clínica odontológica</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[#1f2d29] bg-[#0b0f0e] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">Canais públicos</p>
                  <p className="mt-2 text-sm text-[#f4f4f5]">WhatsApp, Instagram e site</p>
                  <p className="mt-1 text-xs text-[#6b7280]">Quando disponíveis na fonte consultada</p>
                </div>
                <div className="rounded-lg border border-[#1f2d29] bg-[#0b0f0e] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">Oportunidade</p>
                  <p className="mt-2 text-sm text-[#f4f4f5]">Sinais de presença digital organizados para análise</p>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-[#10d98a]/20 bg-[#10d98a]/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#10d98a]">Diagnóstico</p>
                <p className="mt-2 text-sm leading-relaxed text-[#d1d5db]">
                  O Zuno reúne o contexto disponível para ajudar você a decidir se vale abordar essa empresa e qual ponto usar para iniciar a conversa.
                </p>
              </div>
            </div>

            <div className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#10d98a]">Abordagem sugerida</p>
              <div className="mt-3 rounded-xl border border-[#1f2d29] bg-[#0b0f0e] p-4">
                <p className="text-sm leading-7 text-[#d1d5db]">
                  “Oi, tudo bem? Vi que vocês atendem em Ribeirão Preto e encontrei alguns pontos na presença digital que podem abrir espaço para melhorar a captação. Posso te mostrar o que observei?”
                </p>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[#6b7280]">
                A mensagem é uma sugestão. Você revisa, adapta e decide quando enviar.
              </p>

              <Button
                size="lg"
                className="mt-6 h-12 w-full bg-[#10d98a] font-bold text-[#0b0f0e] hover:bg-[#10d98a]/90 sm:w-auto"
                onClick={goToPricing}
              >
                Ver oportunidades para meu negócio
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
