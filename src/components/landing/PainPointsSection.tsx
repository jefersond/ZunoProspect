import { Search, BarChart3, MessageSquareX } from "lucide-react";

const painPoints = [
  {
    icon: Search,
    title: "Horas pesquisando empresas manualmente",
    description: "Você gasta tempo demais no Google e LinkedIn buscando empresas que talvez nem precisem dos seus serviços."
  },
  {
    icon: BarChart3,
    title: "Sem dados para priorizar os melhores leads",
    description: "Sem saber quem tem mais chance de fechar, você acaba perdendo tempo com leads frios."
  },
  {
    icon: MessageSquareX,
    title: "Abordagens genéricas que não convertem",
    description: "Mensagens copiadas e coladas que não geram resposta porque não são personalizadas."
  }
];

export function PainPointsSection() {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
            Prospectar clientes não precisa ser{" "}
            <span className="relative inline-block">
              difícil
              <span className="absolute bottom-0 left-0 w-full h-1 bg-destructive/50 rounded-full" />
            </span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            A ferramenta que vai te ajudar a encontrar e converter mais clientes
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {painPoints.map((point, index) => (
            <div 
              key={index} 
              className="p-6 rounded-xl border border-border/50 bg-card hover:border-destructive/30 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center mb-4">
                <point.icon className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{point.title}</h3>
              <p className="text-muted-foreground text-sm">{point.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
