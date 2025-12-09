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

interface LeadsPipelineProps {
  onViewDetails: (lead: LeadProspeccao) => void;
}

export function LeadsPipeline({ onViewDetails }: LeadsPipelineProps) {
  const [leads, setLeads] = useState<LeadProspeccao[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      const { data, error } = await supabase.rpc('get_leads_decrypted_filtered', {
        p_salvo: true,
      });

      if (error) throw error;

      const transformedLeads: LeadProspeccao[] = (data || []).map((lead: any) => ({
        id: lead.id,
        placeId: lead.google_place_id,
        nome: lead.nome,
        telefone: lead.telefone,
        whatsapp_link: lead.whatsapp_number 
          ? `https://wa.me/55${lead.whatsapp_number.replace(/\D/g, '')}` 
          : null,
        email: lead.email,
        website: lead.website,
        instagram_url: lead.instagram_url,
        instagram_context: lead.instagram_context,
        endereco: lead.endereco,
        cidade: lead.cidade,
        nicho: lead.nicho,
        foco: lead.foco as any,
        proximidadeAtiva: lead.proximidade_ativa,
        raioKm: lead.raio_km,
        sinais: {
          has_whatsapp_on_site: lead.whatsapp_on_site,
          has_meta_pixel: lead.has_meta_pixel,
          has_gtag: lead.has_gtag,
          has_gtm: lead.has_gtm,
        },
        diagnostico_bullets: lead.diagnostico_bullets || [],
        probabilidade_conversao: lead.probabilidade_conversao,
        plano_prospecao_7dias: lead.plano_prospeccao || [],
        rating: lead.rating,
        total_reviews: lead.total_reviews,
        status: lead.status || 'novo',
        created_at: lead.created_at,
        ai_analise_gerada_em: lead.ai_analise_gerada_em,
        salvo: lead.salvo,
        cnpj: lead.cnpj,
        razao_social: lead.razao_social,
        nome_responsavel: lead.nome_responsavel,
        cnpj_telefone: lead.cnpj_telefone,
        cnpj_email: lead.cnpj_email,
        situacao_cadastral: lead.situacao_cadastral,
        porte_empresa: lead.porte_empresa,
        cnae_principal: lead.cnae_principal,
      }));

      setLeads(transformedLeads);
    } catch (error) {
      console.error('Error loading leads:', error);
      toast.error('Erro ao carregar leads');
    } finally {
      setLoading(false);
    }
  };

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
      <ScrollArea className="w-full">
        <div className="flex gap-4 p-4 min-h-[calc(100vh-200px)]">
          {PIPELINE_STATUSES.map((status) => (
            <PipelineColumn
              key={status.id}
              status={status}
              leads={getLeadsByStatus(status.id)}
              onViewDetails={onViewDetails}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

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
