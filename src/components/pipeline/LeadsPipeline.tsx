import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
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
// ScrollArea removed - using native overflow for page-level scrolling
import { Skeleton } from '@/components/ui/skeleton';
import { useSecureLeads } from '@/hooks/useSecureLeads';
import { useSessionManager } from '@/hooks/useSessionManager';

interface LeadsPipelineProps {
  onViewDetails: (lead: LeadProspeccao) => void;
}

export function LeadsPipeline({ onViewDetails }: LeadsPipelineProps) {
  // noPagination: true ensures ALL saved leads are loaded, not just the first 50
  const { leads, loading, fetchLeads, setLeads } = useSecureLeads({ salvo: true, noPagination: true });
  const [activeId, setActiveId] = useState<string | null>(null);

  // Auto-refresh session to prevent auth errors during prolonged use
  useSessionManager({
    checkInterval: 5,
    refreshThreshold: 10,
    onSessionExpired: () => {
      toast.error('Sessão expirada. Redirecionando para login...');
      window.location.href = '/auth';
    },
  });

  // Configure sensors with higher activation distance to prevent accidental drags
  // and separate touch handling to allow normal scrolling
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10, // Increased from 8 to reduce accidental drags
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // Must hold for 250ms before drag starts
        tolerance: 5, // Allow 5px movement during delay
      },
    })
  );

  // Memoize fetchLeads call to avoid lint warnings
  const loadLeads = useCallback(() => {
    fetchLeads(true);
  }, [fetchLeads]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

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
      // Check if session is still valid before updating
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sessão expirada. Faça login novamente.');
        loadLeads();
        return;
      }

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
      loadLeads();
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
      <div className="min-h-[400px] overflow-x-auto overflow-y-visible pb-4 custom-scrollbar">
        <div className="flex gap-4 p-4 min-w-max">
          {PIPELINE_STATUSES.map((status) => (
            <PipelineColumn
              key={status.id}
              status={status}
              leads={getLeadsByStatus(status.id)}
              onViewDetails={onViewDetails}
            />
          ))}
        </div>
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
