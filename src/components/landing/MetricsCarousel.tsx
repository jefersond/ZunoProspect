import { Bot, CheckCircle, FileText, Search, Target, Users } from "lucide-react";

const metrics = [
  { icon: Search, value: "Cidade + nicho", label: "Busca direcionada" },
  { icon: Bot, value: "IA sob demanda", label: "Análise quando você pedir" },
  { icon: FileText, value: "3 canais", label: "WhatsApp, Instagram e e-mail" },
  { icon: Target, value: "Score", label: "Priorização de oportunidades" },
  { icon: Users, value: "Pipeline", label: "Acompanhamento de leads" },
  { icon: CheckCircle, value: "7 dias", label: "Plano de sequência" },
];

export function MetricsCarousel() {
  const duplicatedMetrics = [...metrics, ...metrics];

  return (
    <section className="overflow-hidden bg-secondary/30 py-10 dark:bg-secondary/10">
      <div className="relative">
        <div className="flex animate-marquee">
          {duplicatedMetrics.map((metric, index) => (
            <div
              key={`${metric.label}-${index}`}
              className="mx-3 flex-shrink-0 rounded-lg border border-border/50 bg-background px-5 py-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <metric.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-base font-bold">{metric.value}</div>
                  <div className="text-sm text-muted-foreground">{metric.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
