import { Search, MapPin, Target, MessageCircle } from "lucide-react";

export function MockupBuscaLeads() {
  return (
    <div className="bg-card rounded-xl border border-border/50 p-6 shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Search className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Buscar Leads</h3>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Nicho */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground flex items-center gap-2">
            <Target className="h-4 w-4" />
            Nicho
          </label>
          <div className="bg-background border border-border rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-foreground">Restaurantes</span>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Cidade */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Cidade
          </label>
          <div className="bg-background border border-border rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-foreground">São Paulo, SP</span>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Foco */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground flex items-center gap-2">
            <Target className="h-4 w-4" />
            Foco
          </label>
          <div className="bg-background border border-border rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-foreground">Tráfego Pago</span>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Canal */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Canal
          </label>
          <div className="bg-background border border-border rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-foreground">Instagram</span>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Button */}
        <button className="w-full bg-success hover:bg-success/90 text-success-foreground font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors mt-6">
          <Search className="h-5 w-5" />
          Buscar Leads
        </button>
      </div>
    </div>
  );
}
