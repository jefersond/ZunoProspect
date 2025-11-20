import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LeadAnalysis } from "./LeadAnalysis";
import type { LeadProspeccao } from "@/types/lead";

interface LeadPlanDialogProps {
  lead: LeadProspeccao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const LeadPlanDialog = ({ lead, open, onOpenChange }: LeadPlanDialogProps) => {
  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{lead.nome}</DialogTitle>
          <DialogDescription>
            {lead.nicho} • {lead.cidade} • Foco: {lead.foco}
          </DialogDescription>
        </DialogHeader>

        <LeadAnalysis
          diagnostico={lead.diagnostico_bullets}
          probabilidade={lead.probabilidade_conversao}
          plano={lead.plano_prospecao_7dias}
          geradoEm={lead.ai_analise_gerada_em}
        />
      </DialogContent>
    </Dialog>
  );
};
