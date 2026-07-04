import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  TrendingUp,
  Palette,
  MessageSquare,
  BriefcaseBusiness,
  Building2
} from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export function ParaQuemSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const categorias = [
    {
      titulo: "Gestores de Tráfego",
      icone: TrendingUp,
      descricao: "Encontre clínicas, escolas, estéticas e negócios locais que precisam de anúncios e campanhas. Monte listas segmentadas por nicho e cidade para alimentar seu pipeline.",
    },
    {
      titulo: "Social Medias",
      icone: MessageSquare,
      descricao: "Busque restaurantes, lojas e negócios locais com presença digital fraca. Aborde com contexto sobre o Instagram, site e canais da empresa — não com mensagem genérica.",
    },
    {
      titulo: "Designers",
      icone: Palette,
      descricao: "Identifique empresas consolidadas com marcas desatualizadas. A Zuno mostra dados de presença digital que revelam oportunidades de identidade visual e comunicação.",
    },
    {
      titulo: "Freelancers",
      icone: BriefcaseBusiness,
      descricao: "Prospecte ativamente sem depender de indicação. Monte listas por nicho e cidade, gere abordagens personalizadas e mantenha o pipeline cheio todo mês.",
    },
    {
      titulo: "Agências",
      icone: Building2,
      descricao: "Mapeie segmentos inteiros em qualquer região para alimentar seu time de vendas com leads validados, contatos ativos e diagnóstico de presença digital.",
    },
  ];

  return (
    <section id="para-quem" className="bg-[#0b0f0e] py-20 border-b border-[#1f2d29]/40">
      <div className="container mx-auto px-4">
        {/* Cabeçalho */}
        <div className="mx-auto mb-16 max-w-4xl text-center">
          <Badge variant="outline" className="mb-4 border-[#1f2d29] text-[#9ca3af] bg-[#111816]/50">
            Focos de Atuação
          </Badge>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-[#f4f4f5] md:text-5xl">
            Feita para quem precisa prospectar empresas
          </h2>
          <p className="text-base text-[#9ca3af] md:text-lg max-w-3xl mx-auto">
            A Zuno se adapta ao seu tipo de oferta para ajudar você a encontrar empresas, entender oportunidades e gerar abordagens com IA.
          </p>
        </div>

        {/* Linha 1: 3 cards */}
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-3 max-w-5xl mx-auto">
          {categorias.slice(0, 3).map((cat) => (
            <Card
              key={cat.titulo}
              className="rounded-xl border border-[#1f2d29] bg-[#111816] p-6 transition-all duration-300 hover:border-[#10d98a]/30 hover:shadow-[0_0_20px_rgba(16,217,138,0.015)] hover:-translate-y-0.5 group flex flex-col justify-between"
            >
              <div>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-[#1f2d29] bg-[#0b0f0e] text-[#10d98a] group-hover:bg-[#10d98a]/10 transition-colors">
                  <cat.icone className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-[#f4f4f5]">{cat.titulo}</h3>
                <p className="text-xs leading-relaxed text-[#9ca3af]">{cat.descricao}</p>
              </div>
            </Card>
          ))}
        </div>
        {/* Linha 2: 2 cards centralizados */}
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 max-w-[672px] mx-auto mt-6">
          {categorias.slice(3).map((cat) => (
            <Card
              key={cat.titulo}
              className="rounded-xl border border-[#1f2d29] bg-[#111816] p-6 transition-all duration-300 hover:border-[#10d98a]/30 hover:shadow-[0_0_20px_rgba(16,217,138,0.015)] hover:-translate-y-0.5 group flex flex-col justify-between"
            >
              <div>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-[#1f2d29] bg-[#0b0f0e] text-[#10d98a] group-hover:bg-[#10d98a]/10 transition-colors">
                  <cat.icone className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-[#f4f4f5]">{cat.titulo}</h3>
                <p className="text-xs leading-relaxed text-[#9ca3af]">{cat.descricao}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-14 text-center">
          <Button 
            size="lg" 
            className="h-14 rounded-lg bg-[#10d98a] text-[#0b0f0e] font-bold shadow-[0_0_30px_rgba(16,217,138,0.2)] hover:bg-[#10d98a]/90 transition-all px-8 text-base md:text-lg"
            onClick={() => {
              trackEvent("cta_clicked", { cta: "escolher_foco", location: "para_quem" });
              scrollToSection("precos");
            }}
          >
            Escolher meu foco de prospecção
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="text-xs font-semibold text-[#9ca3af] mt-3 tracking-wide">
            Hoje R$0 • Cartão necessário • Cancele antes da cobrança
          </p>
        </div>
      </div>
    </section>
  );
}
