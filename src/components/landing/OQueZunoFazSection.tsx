import { Bot, CheckCircle2, Search, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const funcionalidades = [
  {
    titulo: "Encontre empresas certas",
    descricao: "Busque por cidade e nicho e monte sua base de prospecção em poucos cliques.",
    icone: Search,
  },
  {
    titulo: "Entenda a oportunidade",
    descricao: "Veja sinais digitais, score e contexto antes de abordar.",
    icone: Target,
  },
  {
    titulo: "Gere abordagens com IA",
    descricao: "Receba mensagens prontas para WhatsApp, Instagram e e-mail.",
    icone: Bot,
  },
  {
    titulo: "Mantenha o follow-up",
    descricao: "Salve leads, organize status e acompanhe próximos passos.",
    icone: CheckCircle2,
  },
];

export function OQueZunoFazSection() {
  return (
    <section id="funcionalidades" className="bg-background py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
          <Badge variant="outline" className="mb-4">Funcionalidades</Badge>
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            O que o Zuno faz por você
          </h2>
          <p className="text-base text-muted-foreground md:text-lg">
            Da busca ao primeiro contato, o Zuno organiza sua prospecção em um fluxo simples.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {funcionalidades.map((item) => (
            <Card key={item.titulo} className="rounded-lg border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/50 dark:border-white/10 dark:bg-zinc-900/60">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                <item.icone className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-3 text-xl font-semibold">{item.titulo}</h3>
              <p className="text-sm leading-6 text-muted-foreground md:text-base">{item.descricao}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
