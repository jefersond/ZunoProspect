import { Star, Search, Building2, CheckCircle, Clock } from "lucide-react";

const leads = [
  { nome: "Pizzaria Bella Italia", cidade: "São Paulo, SP", prob: 78, status: "contactado", favorito: true },
  { nome: "Academia FitPro", cidade: "Rio de Janeiro, RJ", prob: 85, status: "contactado", favorito: true },
  { nome: "Clínica Dental Care", cidade: "Belo Horizonte, MG", prob: 72, status: "pendente", favorito: false },
  { nome: "Pet Shop Amigão", cidade: "Curitiba, PR", prob: 68, status: "pendente", favorito: false },
];

export function MockupLeadsSalvos() {
  return (
    <div className="bg-card rounded-xl border border-border/50 p-6 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
          <h3 className="font-semibold text-foreground">Leads Salvos</h3>
        </div>
        <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Buscar...</span>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {leads.map((lead, idx) => (
          <div 
            key={idx}
            className="flex items-center gap-4 p-4 bg-background border border-border rounded-lg hover:border-primary/50 transition-colors cursor-pointer"
          >
            {/* Favorito */}
            <Star className={`h-5 w-5 flex-shrink-0 ${lead.favorito ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
            
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{lead.nome}</span>
              </div>
              <span className="text-sm text-muted-foreground">{lead.cidade}</span>
            </div>

            {/* Probabilidade */}
            <div className="text-center">
              <span className={`text-lg font-bold ${lead.prob >= 75 ? 'text-success' : 'text-yellow-500'}`}>
                {lead.prob}%
              </span>
            </div>

            {/* Status */}
            <div className="flex items-center gap-1">
              {lead.status === "contactado" ? (
                <CheckCircle className="h-5 w-5 text-success" />
              ) : (
                <Clock className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <span className="text-sm text-muted-foreground">Mostrando 4 de 23 leads</span>
        <button className="text-sm text-primary hover:underline">Ver todos</button>
      </div>
    </div>
  );
}
