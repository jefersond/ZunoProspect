import { Building2, MapPin, CheckCircle, AlertCircle, XCircle, Sparkles } from "lucide-react";

export function MockupAnaliseIA() {
  return (
    <div className="bg-card rounded-xl border border-border/50 p-6 shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Pizzaria Bella Italia</h3>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            São Paulo, SP
          </div>
        </div>
        <div className="bg-success/10 text-success px-3 py-1 rounded-full text-sm font-medium">
          78%
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Probabilidade de Conversão</span>
          <span className="text-success font-medium">Alta</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-success rounded-full" style={{ width: "78%" }} />
        </div>
      </div>

      {/* Signals */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
          <span className="text-sm text-foreground">Site ativo e atualizado</span>
        </div>
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
          <span className="text-sm text-foreground">Instagram com 5.2k seguidores</span>
        </div>
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
          <span className="text-sm text-foreground">Google com 4.2 estrelas (127 avaliações)</span>
        </div>
        <div className="flex items-center gap-3">
          <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <span className="text-sm text-foreground">Sem anúncios ativos detectados</span>
        </div>
      </div>

      {/* AI Analysis */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">Análise da IA</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          "Empresa com boa presença digital orgânica, mas sem investimento em tráfego pago. 
          Potencial para campanhas de Meta Ads e Google Ads..."
        </p>
      </div>
    </div>
  );
}
