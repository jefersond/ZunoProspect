import { Building2 } from "lucide-react";

const colunas = [
  {
    titulo: "Novo",
    cor: "bg-blue-500",
    leads: [
      { nome: "Pizzaria Bella", prob: 78 },
      { nome: "Academia FitPro", prob: 65 },
      { nome: "Clínica Dental", prob: 72 },
    ]
  },
  {
    titulo: "Em Contato",
    cor: "bg-yellow-500",
    leads: [
      { nome: "Pet Shop Amigão", prob: 85 },
      { nome: "Barbearia Style", prob: 68 },
    ]
  },
  {
    titulo: "Proposta",
    cor: "bg-orange-500",
    leads: [
      { nome: "Restaurante Mar", prob: 92 },
    ]
  },
  {
    titulo: "Fechado",
    cor: "bg-success",
    leads: [
      { nome: "Ótica VisionPro", prob: 100 },
    ]
  }
];

export function MockupPipeline() {
  return (
    <div className="bg-card rounded-xl border border-border/50 p-4 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Pipeline de Vendas</h3>
        <span className="text-sm text-muted-foreground">7 leads ativos</span>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-4 gap-3">
        {colunas.map((coluna) => (
          <div key={coluna.titulo} className="space-y-2">
            {/* Column Header */}
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <div className={`w-2 h-2 rounded-full ${coluna.cor}`} />
              <span className="text-sm font-medium text-foreground">{coluna.titulo}</span>
              <span className="text-xs text-muted-foreground ml-auto">({coluna.leads.length})</span>
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {coluna.leads.map((lead, idx) => (
                <div 
                  key={idx} 
                  className="bg-background border border-border rounded-lg p-3 hover:border-primary/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-medium text-foreground line-clamp-1">{lead.nome}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${lead.prob >= 80 ? 'bg-success' : lead.prob >= 60 ? 'bg-yellow-500' : 'bg-orange-500'}`}
                        style={{ width: `${lead.prob}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{lead.prob}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
