import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadAnalysis } from "./LeadAnalysis";
import { CopyableField } from "./CopyableField";
import { TemplateSelector } from "@/components/templates/TemplateSelector";
import { StatusSelector, PIPELINE_STATUSES } from "@/components/pipeline/StatusSelector";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Brain, FileText, ArrowRightLeft, Phone, MessageSquare, Mail, Globe } from "lucide-react";
import type { LeadProspeccao } from "@/types/lead";

// Função para formatar número de telefone brasileiro
const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

// Função para extrair número do link WhatsApp
const extractWhatsAppNumber = (link: string | null): string | null => {
  if (!link) return null;
  const match = link.match(/(\d{10,13})/);
  return match ? match[1] : null;
};

interface LeadPlanDialogProps {
  lead: LeadProspeccao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadUpdate?: () => void;
  onStatusChange?: (leadId: string, newStatus: string) => void;
}

export const LeadPlanDialog = ({ 
  lead, 
  open, 
  onOpenChange, 
  onLeadUpdate,
  onStatusChange 
}: LeadPlanDialogProps) => {
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [currentLead, setCurrentLead] = useState(lead);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const { toast } = useToast();

  // Sempre que o lead mudar ou o dialog for reaberto, sincroniza o estado interno
  useEffect(() => {
    if (open) {
      setCurrentLead(lead);
    }
  }, [lead, open]);

  if (!lead) return null;

  const handleStatusChange = async (newStatus: string) => {
    if (!currentLead || currentLead.status === newStatus) return;

    setIsUpdatingStatus(true);
    const oldStatus = currentLead.status;

    // Optimistic update
    setCurrentLead(prev => prev ? { ...prev, status: newStatus } : prev);

    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', currentLead.id);

      if (error) throw error;

      const statusLabel = PIPELINE_STATUSES.find(s => s.id === newStatus)?.label;
      toast({
        title: "Status atualizado",
        description: `Lead movido para "${statusLabel}"`,
      });

      onStatusChange?.(currentLead.id, newStatus);
      onLeadUpdate?.();
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      // Revert optimistic update
      setCurrentLead(prev => prev ? { ...prev, status: oldStatus } : prev);
      toast({
        title: "Erro ao atualizar status",
        description: error.message || "Não foi possível atualizar o status",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleReanalyze = async () => {
    if (!lead) return;

    setIsReanalyzing(true);
    try {
      // Obter user_id do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        'analisar-lead-ia',
        {
          body: {
            lead_id: lead.id,
            user_id: user?.id,
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

  const whatsappNumber = extractWhatsAppNumber(displayLead.whatsapp_link);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{displayLead.nome}</DialogTitle>
          <DialogDescription>
            {displayLead.nicho} • {displayLead.cidade} • Foco: {displayLead.foco}
          </DialogDescription>
        </DialogHeader>

        {/* Contatos com opção de copiar */}
        <div className="flex flex-wrap gap-3 text-sm py-2 px-3 bg-muted/20 rounded-lg border border-border/30">
          {displayLead.telefone && (
            <CopyableField value={displayLead.telefone} displayValue={formatPhoneNumber(displayLead.telefone)}>
              <a href={`tel:${displayLead.telefone}`} className="flex items-center gap-1 text-primary hover:underline">
                <Phone className="h-3 w-3" />
                {formatPhoneNumber(displayLead.telefone)}
              </a>
            </CopyableField>
          )}
          
          {displayLead.whatsapp_link && whatsappNumber && (
            <CopyableField value={whatsappNumber} displayValue={formatPhoneNumber(whatsappNumber)}>
              <a href={displayLead.whatsapp_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green-600 hover:underline">
                <MessageSquare className="h-3 w-3" />
                {formatPhoneNumber(whatsappNumber)}
              </a>
            </CopyableField>
          )}

          {displayLead.email && (
            <CopyableField value={displayLead.email}>
              <a href={`mailto:${displayLead.email}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                <Mail className="h-3 w-3" />
                {displayLead.email}
              </a>
            </CopyableField>
          )}

          {displayLead.website && (
            <a href={displayLead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
              <Globe className="h-3 w-3" />
              Website
            </a>
          )}
        </div>

        {/* Status Selector */}
        <div className="mt-2 mb-4 p-4 bg-muted/30 rounded-lg border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Alterar Status</span>
          </div>
          <StatusSelector
            currentStatus={displayLead.status || 'novo'}
            onStatusChange={handleStatusChange}
            disabled={isUpdatingStatus}
          />
        </div>

        <Tabs defaultValue="analise" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="analise" className="gap-2">
              <Brain className="h-4 w-4" />
              Análise IA
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="h-4 w-4" />
              Usar Template
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analise">
            <LeadAnalysis
              diagnostico={displayLead.diagnostico_bullets}
              probabilidade={displayLead.probabilidade_conversao}
              plano={displayLead.plano_prospecao_7dias}
              geradoEm={displayLead.ai_analise_gerada_em}
              onReanalyze={handleReanalyze}
              isReanalyzing={isReanalyzing}
            />
          </TabsContent>

          <TabsContent value="templates">
            <div className="mt-4">
              <TemplateSelector lead={displayLead} />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
