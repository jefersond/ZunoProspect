import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Megaphone, Palette, Building2, Search, ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export function CasosDeUsoSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const casos = [
    {
      persona: "Gestor de Tráfego",
      icone: TrendingUp,
      titulo: "Negócios Locais e Clínicas",
      descricao: "Mapeie clínicas estéticas, consultórios odontológicos e negócios locais por cidade que necessitam de anúncios patrocinados para atrair clientes.",
      exemplo: "Busca: 'Clínica estética' em 'Campinas - SP'",
      foco: "Anúncios, landing pages, pixel de conversão e campanhas locais no Google/Meta."
    },
    {
      persona: "Social Media",
      icone: Megaphone,
      titulo: "Restaurantes e Lojas Locais",
      descricao: "Localize restaurantes, confeitarias e comércios locais que possuem presença digital tímida e que precisam melhorar sua atração orgânica e posicionamento digital.",
      exemplo: "Busca: 'Restaurante' em 'Belo Horizonte - MG'",
      foco: "Produção de conteúdo, bio vitrine, engajamento orgânico e transformação de seguidores em contatos de WhatsApp."
    },
    {
      persona: "Designer",
      icone: Palette,
      titulo: "Empresas com Identidade Visual Fraca",
      descricao: "Encontre empresas consolidadas fisicamente, mas que possuem sites ou marcas visivelmente desatualizados e que necessitam de um impacto visual profissional.",
      exemplo: "Busca: 'Oficina mecânica' ou 'Contabilidade' em 'Curitiba - PR'",
      foco: "Redesenho de marcas, embalagens, layouts digitais, apresentações comerciais e impacto na decisão visual."
    },
    {
      persona: "Agência",
      icone: Building2,
      titulo: "Busca Estratégica Regional",
      descricao: "Mapeie segmentos inteiros em lote em qualquer região brasileira para alimentar o time de vendas (SDRs) com empresas validadas e contatos ativos.",
      exemplo: "Busca: 'Distribuidora' ou 'Construtora' em 'Ribeirão Preto - SP'",
      foco: "Diagnóstico integrado de canais digitais, estruturação de prospecção comercial recorrente e volume de abordagens."
    }
  ];

  return (
    <section id="casos-de-uso" className="relative overflow-hidden bg-[#0b0f0e] py-20 border-b border-[#1f2d29]/40">
      {/* Luz de fundo decorativa verde */}
      <div className="absolute -left-40 -bottom-40 h-96 w-96 rounded-full bg-[#10d98a]/5 blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <Badge variant="outline" className="mb-4 border-[#1f2d29] text-[#9ca3af] bg-[#111816]/50">
            Casos de Uso
          </Badge>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-[#f4f4f5] md:text-5xl">
            Escolha um foco e comece com mais clareza
          </h2>
          <p className="text-base text-[#9ca3af] md:text-lg">
            A Zuno adapta a inteligência conforme o segmento que você decide abordar. Veja exemplos práticos de buscas regionais:
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
          {casos.map((caso, index) => (
            <Card 
              key={index} 
              className="relative overflow-hidden rounded-xl border border-[#1f2d29] bg-[#111816] p-6 transition-all duration-300 hover:border-[#10d98a]/30 hover:shadow-[0_0_30px_rgba(16,217,138,0.02)] group"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#1f2d29] bg-[#0b0f0e] text-[#10d98a] group-hover:bg-[#10d98a]/10">
                  <caso.icone className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#10d98a]/80">
                    {caso.persona}
                  </span>
                  <h3 className="text-lg font-bold text-[#f4f4f5]">{caso.titulo}</h3>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-[#9ca3af] mb-4">
                {caso.descricao}
              </p>

              <div className="mt-4 rounded-lg bg-[#0b0f0e] p-3 border border-[#1f2d29]/60">
                <div className="flex items-center gap-2 text-xs text-[#9ca3af] mb-1.5 font-mono">
                  <Search className="h-3.5 w-3.5 text-[#10d98a]" />
                  <span>{caso.exemplo}</span>
                </div>
                <div className="flex items-start gap-1.5 text-xs text-[#f4f4f5]/90">
                  <ArrowRight className="h-3 w-3 mt-1 shrink-0 text-[#10d98a]" />
                  <span><strong>Foco:</strong> {caso.foco}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-14 text-center">
          <Button
            size="lg"
            className="h-14 rounded-lg bg-[#10d98a] text-[#0b0f0e] font-bold shadow-[0_0_30px_rgba(16,217,138,0.2)] hover:bg-[#10d98a]/90 transition-all px-8 text-base md:text-lg"
            onClick={() => {
              trackEvent("cta_clicked", { cta: "comecar_gratis", location: "casos_de_uso" });
              scrollToSection("precos");
            }}
          >
            Começar teste grátis de 7 dias
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="text-xs font-semibold text-[#9ca3af] mt-3 tracking-wide">
            Hoje R$0 • Cancele antes da cobrança
          </p>
        </div>
      </div>
    </section>
  );
}
