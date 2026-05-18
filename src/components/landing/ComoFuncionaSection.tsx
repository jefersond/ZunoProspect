import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Bot, Building2, MapPinned } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export function ComoFuncionaSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const passos = [
    {
      numero: "01",
      icone: MapPinned,
      titulo: "Escolha cidade e nicho",
      descricao: "Diga onde e qual tipo de empresa você quer prospectar.",
    },
    {
      numero: "02",
      icone: Building2,
      titulo: "Receba empresas com sinais de oportunidade",
      descricao: "Veja contatos, presença digital e contexto antes de abordar.",
    },
    {
      numero: "03",
      icone: Bot,
      titulo: "Gere abordagens com IA",
      descricao: "Crie mensagens para WhatsApp, Instagram e e-mail.",
    },
  ];

  return (
    <section id="como-funciona" className="bg-background py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
          <Badge variant="outline" className="mb-4">Como funciona</Badge>
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Como o Zuno transforma busca manual em prospecção com IA
          </h2>
          <p className="text-base text-muted-foreground md:text-lg">
            Em poucos passos, você sai de uma busca genérica para uma lista de oportunidades com contexto e mensagens prontas.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {passos.map((passo) => (
            <Card key={passo.numero} className="h-full rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm transition-all hover:border-primary/50 dark:border-white/10 dark:bg-zinc-900/60">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-4xl font-bold text-primary/70 dark:text-primary/35">{passo.numero}</span>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                  <passo.icone className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="mb-3 text-xl font-semibold">{passo.titulo}</h3>
              <p className="text-sm leading-6 text-muted-foreground md:text-base">{passo.descricao}</p>
            </Card>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Button
            size="lg"
            variant="success"
            onClick={() => {
              trackEvent("cta_clicked", { cta: "ver_planos", location: "como_funciona" });
              scrollToSection("precos");
            }}
          >
            Ver planos
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
