import { Button } from "@/components/ui/button";
import { ArrowRight, Bot, Clock, MessageSquare, Shield, Target } from "lucide-react";

const beneficios = [
  {
    icone: Clock,
    titulo: "Menos busca manual",
    descricao: "Encontre empresas por cidade e nicho sem começar do zero toda vez.",
  },
  {
    icone: MessageSquare,
    titulo: "Abordagens prontas",
    descricao: "Receba mensagens para WhatsApp, Instagram e e-mail com contexto do lead.",
  },
  {
    icone: Bot,
    titulo: "IA sob demanda",
    descricao: "Use a análise somente quando quiser aprofundar uma oportunidade.",
  },
  {
    icone: Target,
    titulo: "Prioridade mais clara",
    descricao: "Veja sinais digitais e score para decidir quem abordar primeiro.",
  },
  {
    icone: Shield,
    titulo: "Rotina organizada",
    descricao: "Salve leads, acompanhe status e mantenha o follow-up em ordem.",
  },
];

const duplicatedBeneficios = [...beneficios, ...beneficios];

export function BeneficiosSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="overflow-hidden bg-secondary/30 py-16 dark:bg-secondary/10">
      <div className="container mx-auto mb-8 px-4">
        <h2 className="mb-2 text-center text-2xl font-bold sm:text-3xl">
          Encontre, priorize e aborde sem sair da plataforma
        </h2>
        <p className="text-center text-muted-foreground">
          Cada recurso foi pensado para eliminar uma etapa manual da sua rotina de prospecção.
        </p>
      </div>

      <div className="relative">
        <div className="flex animate-marquee-slow">
          {duplicatedBeneficios.map((beneficio, index) => (
            <div
              key={`${beneficio.titulo}-${index}`}
              className="mx-3 w-72 flex-shrink-0 rounded-lg border border-border/50 bg-background p-6 shadow-sm dark:border-border/30"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-3 dark:bg-primary/20">
                  <beneficio.icone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">{beneficio.titulo}</h3>
                  <p className="text-sm text-muted-foreground">{beneficio.descricao}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 text-center">
        <Button size="lg" variant="success" onClick={() => scrollToSection("precos")}>
          Ver planos disponíveis
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
