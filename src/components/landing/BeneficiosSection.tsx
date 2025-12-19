import { Button } from "@/components/ui/button";
import { Clock, MessageSquare, Target, TrendingUp, ArrowRight, Zap, Shield } from "lucide-react";

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
  },
  {
    icone: Zap,
    titulo: "Automação inteligente",
    descricao: "A IA faz o trabalho pesado enquanto você foca em fechar negócios."
  },
  {
    icone: Shield,
    titulo: "Dados atualizados",
    descricao: "Informações verificadas e atualizadas para garantir contatos válidos."
  }
];

// Duplicate for seamless loop
const duplicatedBeneficios = [...beneficios, ...beneficios];

export function BeneficiosSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="py-16 bg-secondary/30 dark:bg-secondary/10 overflow-hidden">
      <div className="container mx-auto px-4 mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2">
          Tudo que você precisa para prospectar melhor
        </h2>
        <p className="text-muted-foreground text-center">
          Recursos que vão transformar sua forma de encontrar clientes
        </p>
      </div>
      
      {/* Carousel */}
      <div className="relative">
        <div className="flex animate-marquee-slow">
          {duplicatedBeneficios.map((beneficio, index) => (
            <div 
              key={index} 
              className="flex-shrink-0 mx-3 w-72 p-6 bg-background rounded-xl shadow-sm border border-border/50 dark:border-border/30"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10 dark:bg-primary/20">
                  <beneficio.icone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{beneficio.titulo}</h3>
                  <p className="text-sm text-muted-foreground">{beneficio.descricao}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center mt-10">
        <Button size="lg" variant="success" onClick={() => scrollToSection("precos")}>
          Ver planos disponíveis
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
