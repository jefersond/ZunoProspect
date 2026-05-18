import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Bot, Building2, MessageSquareText, Search } from "lucide-react";

const cards = [
  {
    title: "Busca por cidade e nicho",
    description: "Encontre empresas locais para prospectar com mais direção.",
    icon: Search,
  },
  {
    title: "IA sob demanda",
    description: "Analise apenas os leads que fizerem sentido para sua estratégia.",
    icon: Bot,
  },
  {
    title: "Plano grátis para testar",
    description: "Comece com 20 leads e 3 análises com IA antes de escolher um plano.",
    icon: Building2,
  },
  {
    title: "Abordagens prontas",
    description: "Gere mensagens para WhatsApp, Instagram e e-mail em poucos cliques.",
    icon: MessageSquareText,
  },
];

export function ConfiancaOperacionalSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="por-que-testar" className="bg-secondary/20 py-16 dark:bg-secondary/10 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-3xl text-center md:mb-12">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">Por que testar o Zuno?</h2>
          <p className="text-base text-muted-foreground md:text-lg">
            Uma forma simples de sair da busca manual e começar a prospectar com mais clareza.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <Card key={card.title} className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm transition-all hover:border-primary/40 dark:border-white/10 dark:bg-zinc-900/60">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                <card.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-lg font-semibold">{card.title}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{card.description}</p>
            </Card>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Button size="lg" variant="success" onClick={() => scrollToSection("precos")}>
            Quero começar agora
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
