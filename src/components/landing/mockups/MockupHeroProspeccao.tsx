import { Search, MapPin, Target, Megaphone, CheckCircle, Calendar, TrendingUp } from "lucide-react";

export function MockupHeroProspeccao() {
  const leads = [
    { nome: "Restaurante Sabor & Arte", prob: 85 },
    { nome: "Bistrô da Vila", prob: 75 },
    { nome: "Cantina Italiana", prob: 65 },
  ];

  return (
    <div className="bg-card rounded-xl border border-border/50 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-muted/50 px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground">Prospecção com IA</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Search Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/30 rounded-lg px-3 py-2 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">São Paulo</span>
          </div>
          <div className="bg-muted/30 rounded-lg px-3 py-2 flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">Restaurantes</span>
          </div>
          <div className="bg-muted/30 rounded-lg px-3 py-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">Tráfego Pago</span>
          </div>
          <div className="bg-muted/30 rounded-lg px-3 py-2 flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">Instagram</span>
          </div>
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Leads encontrados</span>
          <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full">
            3 resultados
          </span>
        </div>

        {/* Lead List */}
        <div className="space-y-2">
          {leads.map((lead, index) => (
            <div
              key={index}
              className="bg-muted/20 rounded-lg px-3 py-2.5 flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="text-sm text-foreground">{lead.nome}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${lead.prob}%`,
                      backgroundColor:
                        lead.prob >= 80
                          ? "hsl(var(--success))"
                          : lead.prob >= 60
                          ? "hsl(var(--warning))"
                          : "hsl(var(--muted-foreground))",
                    }}
                  />
                </div>
                <span
                  className="text-xs font-medium"
                  style={{
                    color:
                      lead.prob >= 80
                        ? "hsl(var(--success))"
                        : lead.prob >= 60
                        ? "hsl(var(--warning))"
                        : "hsl(var(--muted-foreground))",
                  }}
                >
                  {lead.prob}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Plan Generated */}
        <div className="bg-success/10 border border-success/20 rounded-lg px-3 py-2.5 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-success" />
          <span className="text-sm text-success font-medium">
            Plano de 7 dias gerado!
          </span>
        </div>
      </div>
    </div>
  );
}
