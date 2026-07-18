import { BarChart3, MessageSquareX, Search } from "lucide-react";

const painPoints = [
  {
    icon: Search,
    title: "Horas pesquisando empresas manualmente",
    description: "Você perde tempo alternando entre buscas, mapas e redes sociais sem saber quem vale a abordagem.",
  },
  {
    icon: BarChart3,
    title: "Pouco contexto para priorizar leads",
    description: "Sem sinais digitais organizados, fica difícil decidir quem abordar primeiro.",
  },
  {
    icon: MessageSquareX,
    title: "Primeira mensagem genérica",
    description: "Quando falta contexto, a abordagem vira texto copiado e tem menos chance de abrir conversa.",
  },
];

export function PainPointsSection() {
  return (
    <section className="bg-background py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-2xl font-bold sm:text-3xl md:text-4xl">
            Você reconhece esse ciclo?{" "}
            <span className="relative inline-block">
              A maioria reconhece.
              <span className="absolute bottom-0 left-0 h-1 w-full rounded-full bg-destructive/50" />
            </span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Pesquisa manual, abordagem no chute e taxa de resposta baixa. Isso não é falta de esforço, é falta de sistema.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {painPoints.map((point) => (
            <div
              key={point.title}
              className="rounded-lg border border-border/50 bg-card p-6 transition-colors hover:border-destructive/30"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
                <point.icon className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{point.title}</h3>
              <p className="text-sm text-muted-foreground">{point.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
