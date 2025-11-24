import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LeadAnalysis } from "./LeadAnalysis";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { LeadProspeccao } from "@/types/lead";

interface LeadPlanDialogProps {
  lead: LeadProspeccao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadUpdate?: () => void;
}

export const LeadPlanDialog = ({ lead, open, onOpenChange, onLeadUpdate }: LeadPlanDialogProps) => {
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [currentLead, setCurrentLead] = useState(lead);
  const { toast } = useToast();

  if (!lead) return null;

  const handleReanalyze = async () => {
    if (!lead) return;

    setIsReanalyzing(true);
    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        'analisar-lead-ia',
        {
          body: {
            lead_id: lead.id,
            nome: lead.nome,
            nicho: lead.nicho,
            cidade: lead.cidade,
            website: lead.website,
            foco: lead.foco,
            whatsapp_on_site: lead.sinais.has_whatsapp_on_site,
            has_meta_pixel: lead.sinais.has_meta_pixel,
            has_gtag: lead.sinais.has_gtag,
            has_gtm: lead.sinais.has_gtm,
            instagram_url: lead.instagram_url,
            instagram_context: lead.instagram_context,
          }
        }
      );

      if (functionError) throw functionError;

      // Buscar lead atualizado do banco
      const { data: updatedLead, error: fetchError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', lead.id)
        .single();

      if (fetchError) throw fetchError;

      // Transformar dados do banco para o formato LeadProspeccao
      const transformedLead: LeadProspeccao = {
        ...lead,
        diagnostico_bullets: updatedLead.diagnostico_bullets as string[],
        probabilidade_conversao: updatedLead.probabilidade_conversao || 0,
        plano_prospecao_7dias: updatedLead.plano_prospeccao as any,
        ai_analise_gerada_em: updatedLead.ai_analise_gerada_em,
      };

      setCurrentLead(transformedLead);
      onLeadUpdate?.();

      toast({
        title: "Análise concluída",
        description: "O lead foi reanalisado com sucesso pela IA",
      });
    } catch (error: any) {
      console.error('Erro ao reanalisar lead:', error);
      toast({
        title: "Erro ao reanalisar",
        description: error.message || "Não foi possível reanalisar o lead",
        variant: "destructive",
      });
    } finally {
      setIsReanalyzing(false);
    }
  };

  const displayLead = currentLead || lead;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{displayLead.nome}</DialogTitle>
          <DialogDescription>
            {displayLead.nicho} • {displayLead.cidade} • Foco: {displayLead.foco}
          </DialogDescription>
        </DialogHeader>

        <LeadAnalysis
          diagnostico={displayLead.diagnostico_bullets}
          probabilidade={displayLead.probabilidade_conversao}
          plano={displayLead.plano_prospecao_7dias}
          geradoEm={displayLead.ai_analise_gerada_em}
          onReanalyze={handleReanalyze}
          isReanalyzing={isReanalyzing}
        />
      </DialogContent>
    </Dialog>
  );
};
