import { Button } from "@/components/ui/button";
import { Clock, MessageSquare, Target, TrendingUp, ArrowRight } from "lucide-react";

export function BeneficiosSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const beneficios = [
    {
      icone: Clock,
      titulo: "Prospecte em minutos",
      descricao: "Encontre dezenas de leads qualificados em poucos cliques, não em horas de pesquisa."
    },
    {
      icone: MessageSquare,
      titulo: "Cadências prontas",
      descricao: "Planos de 7 dias com mensagens para WhatsApp, email e Instagram já escritas."
    },
    {
      icone: Target,
      titulo: "Diagnóstico com IA",
      descricao: "Cada lead vem com análise de presença digital e probabilidade de conversão."
    },
    {
      icone: TrendingUp,
      titulo: "Mais reuniões",
      descricao: "Abordagens personalizadas que geram até 5x mais respostas positivas."
    }
  ];

  return (
    <section className="py-16 bg-secondary/30 dark:bg-secondary/10">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {beneficios.map((beneficio, index) => (
            <div key={index} className="flex items-start gap-4 p-6 bg-background rounded-xl shadow-sm border border-border/50 dark:border-border/30">
              <div className="p-3 rounded-lg bg-primary/10 dark:bg-primary/20">
                <beneficio.icone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">{beneficio.titulo}</h3>
                <p className="text-sm text-muted-foreground">{beneficio.descricao}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Button size="lg" onClick={() => scrollToSection("precos")} className="shadow-lg">
            Ver planos disponíveis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
