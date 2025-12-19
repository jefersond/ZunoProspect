import { BarChart3, TrendingUp, Users, Target } from "lucide-react";

const kpis = [
  { titulo: "Leads", valor: "127", icone: Users, cor: "text-blue-500" },
  { titulo: "Taxa Conv.", valor: "23%", icone: Target, cor: "text-success" },
  { titulo: "Fechados", valor: "29", icone: TrendingUp, cor: "text-primary" },
];

const barras = [
  { mes: "Jan", valor: 45 },
  { mes: "Fev", valor: 62 },
  { mes: "Mar", valor: 78 },
  { mes: "Abr", valor: 85 },
  { mes: "Mai", valor: 92 },
  { mes: "Jun", valor: 100 },
];

export function MockupRelatorios() {
  return (
    <div className="bg-card rounded-xl border border-border/50 p-6 shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Dashboard de Performance</h3>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icone;
          return (
            <div key={kpi.titulo} className="bg-background border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${kpi.cor}`} />
                <span className="text-sm text-muted-foreground">{kpi.titulo}</span>
              </div>
              <span className="text-2xl font-bold text-foreground">{kpi.valor}</span>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="bg-background border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-foreground">Leads por Mês</span>
          <span className="text-xs text-muted-foreground">Últimos 6 meses</span>
        </div>
        
        {/* Bar Chart */}
        <div className="flex items-end justify-between gap-2 h-32">
          {barras.map((barra) => (
            <div key={barra.mes} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex flex-col items-center">
                <span className="text-xs text-muted-foreground mb-1">{barra.valor}</span>
                <div 
                  className="w-full bg-primary/80 rounded-t-sm transition-all hover:bg-primary"
                  style={{ height: `${barra.valor}px` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{barra.mes}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
