import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchProgressProps {
  currentStep: number;
  totalSteps: number;
  message: string;
}

const steps = [
  { id: 1, label: "Iniciando busca..." },
  { id: 2, label: "Buscando empresas no Google Maps..." },
  { id: 3, label: "Coletando informações de contato..." },
  { id: 4, label: "Analisando presença digital..." },
  { id: 5, label: "Processando com IA..." },
  { id: 6, label: "Gerando planos de prospecção..." },
  { id: 7, label: "Finalizando..." },
];

export const SearchProgress = ({ currentStep, totalSteps, message }: SearchProgressProps) => {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="space-y-4 p-6 bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg border border-primary/20 animate-in fade-in duration-300">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">{message}</span>
          <span className="text-muted-foreground">
            {currentStep}/{totalSteps}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
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
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
