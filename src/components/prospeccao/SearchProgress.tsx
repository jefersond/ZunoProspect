import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface SearchProgressStep {
  id: number;
  label: string;
  sublabel?: string;
}

interface SearchProgressProps {
  currentStep: number;
  totalSteps: number;
  message: string;
  // Novos props para progresso real
  leadsFound?: number;
  leadsAnalyzed?: number;
  targetQuantity?: number;
  estimatedTimeSeconds?: number;
  error?: string | null;
  onRetry?: () => void;
}

const defaultSteps: SearchProgressStep[] = [
  { id: 1, label: "Iniciando busca..." },
  { id: 2, label: "Buscando empresas no Google Maps..." },
  { id: 3, label: "Coletando informações de contato..." },
  { id: 4, label: "Enriquecendo contatos..." },
  { id: 5, label: "Salvando leads..." },
  { id: 6, label: "Atualizando lista..." },
  { id: 7, label: "Finalizando..." },
];

export const SearchProgress = ({ 
  currentStep, 
  totalSteps, 
  message,
  leadsFound = 0,
  leadsAnalyzed = 0,
  targetQuantity = 0,
  estimatedTimeSeconds,
  error,
  onRetry
}: SearchProgressProps) => {
  const progress = (currentStep / totalSteps) * 100;

  // Formata o tempo estimado restante
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) {
      return `~${seconds}s restantes`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `~${minutes} min restantes`;
    }
    return `~${minutes}min ${remainingSeconds}s restantes`;
  };

  // Gera os steps dinâmicos com contadores reais
  const getSteps = (): SearchProgressStep[] => {
    return [
      { id: 1, label: "Iniciando busca..." },
      { 
        id: 2, 
        label: "Buscando empresas no Google Maps...",
        sublabel: leadsFound > 0 ? `${leadsFound}${targetQuantity > 0 ? `/${targetQuantity}` : ''} encontradas` : undefined
      },
      { id: 3, label: "Coletando informações de contato..." },
      { id: 4, label: "Enriquecendo contatos..." },
      { 
        id: 5, 
        label: "Salvando leads...",
      },
      { id: 6, label: "Atualizando lista..." },
      { id: 7, label: "Finalizando...", sublabel: leadsFound > 0 ? `${leadsFound} leads prontos!` : undefined },
    ];
  };

  const steps = getSteps();

  // Se houver erro, mostra estado de erro
  if (error) {
    return (
      <div className="space-y-4 p-6 bg-destructive/10 rounded-lg border border-destructive/30 animate-in fade-in duration-300">
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Erro na busca</span>
        </div>
        <p className="text-sm text-destructive/80 ml-8">{error}</p>
        {onRetry && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRetry}
            className="ml-8 gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar Novamente
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6 bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg border border-primary/20 animate-in fade-in duration-300">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">{message}</span>
          <div className="flex items-center gap-3">
            {estimatedTimeSeconds && estimatedTimeSeconds > 0 && currentStep < totalSteps && (
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {formatTimeRemaining(estimatedTimeSeconds)}
              </span>
            )}
            <span className="text-muted-foreground">
              {currentStep}/{totalSteps}
            </span>
          </div>
        </div>
        <Progress value={progress} className="h-2" />
        
        {/* Contador de leads em tempo real */}
        {(leadsFound > 0 || leadsAnalyzed > 0) && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
            {leadsFound > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                {leadsFound} empresas encontradas
              </span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {steps.map((step) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          
          return (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-3 text-sm transition-all duration-300",
                isCompleted && "text-primary",
                isCurrent && "text-foreground font-medium",
                !isCompleted && !isCurrent && "text-muted-foreground opacity-50"
              )}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-4 w-4 text-primary animate-in zoom-in duration-200" />
              ) : isCurrent ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-muted" />
              )}
              <div className="flex items-center gap-2">
                <span>{step.label}</span>
                {step.sublabel && (isCurrent || isCompleted) && (
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full",
                    isCompleted ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {step.sublabel}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
