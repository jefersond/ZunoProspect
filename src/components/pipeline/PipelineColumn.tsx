import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Badge } from '@/components/ui/badge';
import { PipelineCard } from './PipelineCard';
import { LeadProspeccao } from '@/types/lead';
import type { PipelineStatus } from './StatusSelector';

interface PipelineColumnProps {
  status: PipelineStatus;
  leads: LeadProspeccao[];
  onViewDetails: (lead: LeadProspeccao) => void;
}

export function PipelineColumn({ status, leads, onViewDetails }: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[280px] w-[280px] max-h-[70vh] bg-muted/30 rounded-lg border transition-colors ${
        isOver 
          ? 'border-primary/50 bg-primary/5' 
          : 'border-border/50'
      }`}
    >
      {/* Column Header */}
      <div className={`p-3 border-b shrink-0 ${status.borderColor} bg-gradient-to-r from-transparent ${status.bgColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status.color}`} />
            <h3 className="font-semibold text-sm text-foreground">{status.label}</h3>
          </div>
          <Badge 
            variant="secondary" 
            className={`text-xs font-semibold ${status.badgeBg} ${status.badgeText} border-0`}
          >
            {leads.length}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{status.description}</p>
      </div>

      {/* Cards Container with native scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2">
        <SortableContext 
          items={leads.map(l => l.id)} 
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 min-h-[100px]">
            {leads.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-muted-foreground text-xs border-2 border-dashed border-border/30 rounded-lg">
                Arraste leads aqui
              </div>
            ) : (
              leads.map((lead) => (
                <PipelineCard 
                  key={lead.id} 
                  lead={lead} 
                  onViewDetails={onViewDetails}
                />
              ))
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
