import { useState, useEffect, useCallback } from "react";
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
import { useSubscription } from "@/hooks/useSubscription";
import { useUsage } from "@/hooks/useUsage";
import { Textarea } from "@/components/ui/textarea";
import { Brain, FileText, ArrowRightLeft, Phone, MessageSquare, Mail, Globe, StickyNote, Loader2, Lock } from "lucide-react";
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
  const [notes, setNotes] = useState(lead?.notas || "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const { toast } = useToast();
  const { subscription, loading: subscriptionLoading, isAdmin: subscriptionIsAdmin } = useSubscription();
  const { canAnalyzeAI, refetch: refetchUsage, isAdmin: usageIsAdmin } = useUsage();
  const isAdmin = subscriptionIsAdmin || usageIsAdmin;
  
  // Planos que têm acesso às anotações
  const hasNotesAccess = isAdmin || (subscription && 
    ['starter', 'iniciante', 'pro', 'agencia', 'admin'].includes(subscription.plan_name));
  const canAnalyzeLead = isAdmin || canAnalyzeAI;

  // Sempre que o lead mudar ou o dialog for reaberto, sincroniza o estado interno
  useEffect(() => {
    if (open) {
      setCurrentLead(lead);
      setNotes(lead?.notas || "");
    }
  }, [lead, open]);

  // Debounced save para anotações
  const saveNotes = useCallback(async (notesValue: string) => {
    if (!currentLead) return;
    
    setIsSavingNotes(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ notas: notesValue })
        .eq('id', currentLead.id);

      if (error) throw error;
      
      // Atualiza o lead local
      setCurrentLead(prev => prev ? { ...prev, notas: notesValue } : prev);
      onLeadUpdate?.();
    } catch (error: any) {
      console.error('Erro ao salvar anotações:', error);
      toast({
        title: "Erro ao salvar anotações",
        description: error.message || "Não foi possível salvar as anotações",
        variant: "destructive",
      });
    } finally {
      setIsSavingNotes(false);
    }
  }, [currentLead, onLeadUpdate, toast]);

  // Debounce para salvar automaticamente após 1.5s de inatividade
  useEffect(() => {
    if (!hasNotesAccess || !currentLead) return;
    if (notes === (currentLead.notas || "")) return;
    
    const timer = setTimeout(() => {
      saveNotes(notes);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [notes, currentLead, hasNotesAccess, saveNotes]);

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
    if (!canAnalyzeLead) {
      toast({
        title: "Limite de IA atingido",
        description: "Você atingiu seu limite de análises com IA.",
        variant: "destructive",
      });
      return;
    }

    setIsReanalyzing(true);
    try {
      // Obter user_id do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");
      
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
          },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (functionError) {
        let message = functionError.message;
        const contextResponse = (functionError as any)?.context;
        if (contextResponse instanceof Response) {
          try {
            const text = await contextResponse.clone().text();
            const payload = text ? JSON.parse(text) : null;
            message = payload?.error || payload?.details || message;
          } catch {
            // keep original message
          }
        }
        throw new Error(message);
      }

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
      await refetchUsage();
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto scrollbar-zuno">
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

        {/* Seção de Anotações - apenas para planos Iniciante+ */}
        <div className="mt-2 p-4 bg-muted/30 rounded-lg border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <StickyNote className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Anotações</span>
            {isSavingNotes && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Salvando...
              </div>
            )}
          </div>
          
          {subscriptionLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : hasNotesAccess ? (
            <Textarea
              placeholder="Adicione notas sobre este lead... (salva automaticamente)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px] resize-none bg-background/50"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-4 text-center bg-muted/50 rounded-lg border border-dashed border-border">
              <Lock className="h-5 w-5 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Anotações disponíveis nos planos Iniciante, Pro e Agência
              </p>
              <a 
                href="/precos" 
                className="text-xs text-primary hover:underline mt-1"
              >
                Fazer upgrade
              </a>
            </div>
          )}
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
              canAnalyzeAI={canAnalyzeLead}
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
