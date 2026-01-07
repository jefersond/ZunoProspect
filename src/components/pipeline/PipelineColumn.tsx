import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ScrollArea } from '@/components/ui/scroll-area';
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
            className="text-xs bg-background/50 text-muted-foreground"
          >
            {leads.length}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{status.description}</p>
      </div>

      {/* Cards Container with internal scroll */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2">
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
      </ScrollArea>
    </div>
  );
}
