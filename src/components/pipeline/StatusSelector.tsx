import { cn } from "@/lib/utils";

export interface PipelineStatus {
  id: string;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
}

export const PIPELINE_STATUSES: PipelineStatus[] = [
  {
    id: 'novo',
    label: 'Novo',
    description: 'Lead recém-capturado',
    color: 'bg-gray-400',
    bgColor: 'to-gray-500/10',
    borderColor: 'border-gray-500/30',
    badgeBg: 'bg-gray-500/20',
    badgeText: 'text-gray-300',
  },
  {
    id: 'em_contato',
    label: 'Em Contato',
    description: 'Primeiro contato realizado',
    color: 'bg-blue-400',
    bgColor: 'to-blue-500/10',
    borderColor: 'border-blue-500/30',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-300',
  },
  {
    id: 'qualificacao',
    label: 'Qualificação',
    description: 'Avaliando interesse/fit',
    color: 'bg-amber-400',
    bgColor: 'to-amber-500/10',
    borderColor: 'border-amber-500/30',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
  },
  {
    id: 'negociacao',
    label: 'Negociação',
    description: 'Proposta enviada',
    color: 'bg-orange-400',
    bgColor: 'to-orange-500/10',
    borderColor: 'border-orange-500/30',
    badgeBg: 'bg-orange-500/20',
    badgeText: 'text-orange-300',
  },
  {
    id: 'convertido',
    label: 'Convertido',
    description: 'Cliente fechado!',
    color: 'bg-emerald-400',
    bgColor: 'to-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
  },
  {
    id: 'perdido',
    label: 'Perdido',
    description: 'Lead descartado',
    color: 'bg-red-400',
    bgColor: 'to-red-500/10',
    borderColor: 'border-red-500/30',
    badgeBg: 'bg-red-500/20',
    badgeText: 'text-red-300',
  },
];

interface StatusSelectorProps {
  currentStatus: string;
  onStatusChange: (newStatus: string) => void;
  disabled?: boolean;
}

export function StatusSelector({ currentStatus, onStatusChange, disabled }: StatusSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PIPELINE_STATUSES.map((status) => {
        const isSelected = currentStatus === status.id;
        return (
          <button
            key={status.id}
            onClick={() => onStatusChange(status.id)}
            disabled={disabled || isSelected}
            className={cn(
              "px-3 py-2 rounded-lg text-sm font-medium transition-all border",
              "focus:outline-none focus:ring-2 focus:ring-primary/50",
              isSelected
                ? `${status.color} text-white border-transparent shadow-md`
                : `bg-card/50 text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground`,
              disabled && "opacity-50 cursor-not-allowed"
            )}
            title={status.description}
          >
            <div className="flex items-center gap-2">
              {!isSelected && (
                <div className={cn("w-2 h-2 rounded-full", status.color)} />
              )}
              <span>{status.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
