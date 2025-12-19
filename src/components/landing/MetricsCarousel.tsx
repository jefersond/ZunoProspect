import { Users, Brain, FileText, TrendingUp, Target, CheckCircle } from "lucide-react";

const metrics = [
  { icon: Users, value: "+12.500", label: "Leads encontrados" },
  { icon: Brain, value: "+8.200", label: "Análises de IA" },
  { icon: FileText, value: "+5.800", label: "Planos gerados" },
  { icon: TrendingUp, value: "4.2x", label: "Taxa de resposta" },
  { icon: Target, value: "85%", label: "Precisão da IA" },
  { icon: CheckCircle, value: "+3.400", label: "Clientes fechados" },
];

export function MetricsCarousel() {
  // Duplicate for seamless loop
  const duplicatedMetrics = [...metrics, ...metrics];

  return (
    <section className="py-12 bg-secondary/30 dark:bg-secondary/10 overflow-hidden">
      <div className="relative">
        <div className="flex animate-marquee">
          {duplicatedMetrics.map((metric, index) => (
            <div
              key={index}
              className="flex-shrink-0 mx-4 px-6 py-4 bg-background rounded-xl border border-border/50 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <metric.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-bold text-lg">{metric.value}</div>
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
