import { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { LeadProspeccao } from '@/types/lead';
import { PipelineColumn } from './PipelineColumn';
import { PipelineCard } from './PipelineCard';
import { PIPELINE_STATUSES } from './StatusSelector';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useSecureLeads } from '@/hooks/useSecureLeads';

interface LeadsPipelineProps {
  onViewDetails: (lead: LeadProspeccao) => void;
}

export function LeadsPipeline({ onViewDetails }: LeadsPipelineProps) {
  const { leads, loading, fetchLeads, setLeads } = useSecureLeads({ salvo: true });
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchLeads(true);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const newStatus = over.id as string;

    // Check if dropping on a column (status)
    if (!PIPELINE_STATUSES.find(s => s.id === newStatus)) return;

    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.status === newStatus) return;

    // Optimistic update
    setLeads(prev => 
      prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l)
    );

    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', leadId);

      if (error) throw error;

      const statusLabel = PIPELINE_STATUSES.find(s => s.id === newStatus)?.label;
      toast.success(`Lead movido para "${statusLabel}"`);
    } catch (error) {
      console.error('Error updating lead status:', error);
      toast.error('Erro ao atualizar status');
      // Revert optimistic update
      fetchLeads(true);
    }
  };

  const getLeadsByStatus = (statusId: string) => {
    return leads.filter(lead => (lead.status || 'novo') === statusId);
  };

  const activeLead = leads.find(l => l.id === activeId);

  if (loading) {
    return (
      <div className="flex gap-4 p-4 overflow-x-auto">
        {PIPELINE_STATUSES.map((status) => (
          <div key={status.id} className="min-w-[280px] w-[280px]">
            <Skeleton className="h-16 w-full mb-2 rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full mt-2 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-[calc(100vh-220px)] overflow-hidden">
        <ScrollArea className="w-full h-full">
          <div className="flex gap-4 p-4 h-full">
            {PIPELINE_STATUSES.map((status) => (
              <PipelineColumn
                key={status.id}
                status={status}
                leads={getLeadsByStatus(status.id)}
                onViewDetails={onViewDetails}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="h-3 bg-muted/50" />
        </ScrollArea>
      </div>

      <DragOverlay>
        {activeLead ? (
          <div className="opacity-80">
            <PipelineCard lead={activeLead} onViewDetails={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
