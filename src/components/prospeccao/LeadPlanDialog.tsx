import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LeadAnalysis } from "./LeadAnalysis";
import { CopyableField } from "./CopyableField";
import { TemplateSelector } from "@/components/templates/TemplateSelector";
import { StatusSelector, PIPELINE_STATUSES } from "@/components/pipeline/StatusSelector";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { useUsage } from "@/hooks/useUsage";
import { UpgradePlanDialog } from "@/components/profile/UpgradePlanDialog";
import { canUsePaidFeatures } from "@/utils/subscriptionHelpers";
import { Textarea } from "@/components/ui/textarea";
import { Brain, FileText, ArrowRightLeft, Phone, MessageSquare, Mail, Globe, StickyNote, Loader2, Lock } from "lucide-react";
import type { LeadProspeccao } from "@/types/lead";
import { trackEvent } from "@/lib/analytics";
import { trackMetaCustomEvent } from "@/lib/metaPixel";
import { normalizeLeadForAI } from "@/utils/normalizeLead";

// Função para sanitizar e padronizar número de telefone brasileiro
const sanitizeBrazilianPhone = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('55') && cleaned.length >= 12 && cleaned.length <= 14) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.startsWith('0') && cleaned.length > 2) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
};

// Função para formatar número de telefone brasileiro
const formatPhoneNumber = (phone: string): string => {
  const cleaned = sanitizeBrazilianPhone(phone);
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
  onLeadRefined?: (lead: LeadProspeccao) => void;
  onStatusChange?: (leadId: string, newStatus: string) => void;
}

export const LeadPlanDialog = ({ 
  lead, 
  open, 
  onOpenChange, 
  onLeadUpdate,
  onLeadRefined,
  onStatusChange 
}: LeadPlanDialogProps) => {
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const activeRequestRef = useRef(false);
  const recentlyTrackedLimitBlockRef = useRef<Record<string, number>>({});
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [currentLead, setCurrentLead] = useState(lead);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [notes, setNotes] = useState(lead?.notas || "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const { toast } = useToast();
  const { subscription, loading: subscriptionLoading, isAdmin: subscriptionIsAdmin } = useSubscription();
  const { usage, canAnalyzeAI, refetch: refetchUsage, isAdmin: usageIsAdmin } = useUsage();

  const handleUpdatePayment = async () => {
    trackEvent("Payment_Update_Clicked", {
      plan_name: subscription?.plan_name,
      subscription_status: subscription?.status || subscription?.subscription_status,
      hosted_invoice_url_exists: !!subscription?.hosted_invoice_url,
      source: "lead_dialog_block_toast",
    });

    if (subscription?.hosted_invoice_url) {
      window.open(subscription.hosted_invoice_url, "_blank");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-customer-portal-session");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("URL do portal não encontrada.");
      }
    } catch (err: any) {
      console.error("Erro ao abrir portal do Stripe:", err);
      toast({
        title: "Erro ao abrir o portal",
        description: err.message || "Tente novamente ou contate o suporte.",
        variant: "destructive",
      });
    }
  };

  const isAdmin = subscriptionIsAdmin || usageIsAdmin;
  const normalizedPlanName = String(subscription?.plan_name || usage.plan_name || "free").toLowerCase();
  
  // Planos que têm acesso às anotações
  const hasNotesAccess = isAdmin || (subscription && 
    ['starter', 'iniciante', 'pro', 'agencia', 'admin'].includes(subscription.plan_name));
  const canAnalyzeLead = isAdmin || canAnalyzeAI;

  const [pendingAnalysis, setPendingAnalysis] = useState<any | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);

  const loadPendingAnalysis = useCallback(async (leadId: string) => {
    setIsLoadingAnalysis(true);
    try {
      const { data, error } = await supabase
        .from('lead_analyses')
        .select('*')
        .eq('lead_id', leadId)
        .eq('status', 'awaiting_review')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setPendingAnalysis(data);
    } catch (e) {
      console.error("Erro ao carregar análise pendente:", e);
    } finally {
      setIsLoadingAnalysis(false);
    }
  }, []);

  // Sempre que o lead mudar ou o dialog for reaberto, sincroniza o estado interno
  useEffect(() => {
    if (open && lead) {
      setCurrentLead(lead);
      setNotes(lead.notas || "");
      if (lead.processing_status === 'awaiting_review') {
        loadPendingAnalysis(lead.id);
      } else {
        setPendingAnalysis(null);
      }
    } else {
      setPendingAnalysis(null);
    }
  }, [lead, open, loadPendingAnalysis]);

  const handleApproveAnalysis = async () => {
    if (!currentLead || !pendingAnalysis) return;
    setIsProcessingApproval(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-leads/${currentLead.id}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ analysis_id: pendingAnalysis.id })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error?.message || "Erro ao aprovar análise.");

      toast({
        title: "Análise Aprovada!",
        description: "As copies e diagnóstico foram copiados para o lead com sucesso.",
      });

      setPendingAnalysis(null);
      onLeadUpdate?.();

      // Recarregar lead do banco
      const { data: updatedLead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', currentLead.id)
        .single();
      
      if (updatedLead) {
        setCurrentLead({
          ...lead,
          diagnostico_bullets: updatedLead.diagnostico_bullets as string[],
          probabilidade_conversao: updatedLead.probabilidade_conversao || 0,
          plano_prospecao_7dias: Array.isArray(updatedLead.plano_prospeccao)
            ? updatedLead.plano_prospeccao
            : (updatedLead.plano_prospeccao?.plano_prospeccao_7dias || []),
          processing_status: updatedLead.processing_status,
          ai_analise_gerada_em: updatedLead.ai_analise_gerada_em,
          status: updatedLead.status,
          notas: updatedLead.notas
        } as any);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao aprovar análise",
        description: error.message,
      });
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleRejectAnalysis = async () => {
    if (!currentLead || !pendingAnalysis) return;
    setIsProcessingApproval(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-leads/${currentLead.id}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ analysis_id: pendingAnalysis.id })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error?.message || "Erro ao rejeitar análise.");

      toast({
        title: "Análise Rejeitada",
        description: "O status do lead foi marcado como rejeitado.",
      });

      setPendingAnalysis(null);
      onLeadUpdate?.();
      setCurrentLead(prev => prev ? { ...prev, processing_status: 'rejected' } as any : null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao rejeitar análise",
        description: error.message,
      });
    } finally {
      setIsProcessingApproval(false);
    }
  };

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
    
    if (!canUsePaidFeatures(null, subscription)) {
      toast({
        variant: "destructive",
        title: "Pagamento pendente",
        description: "Atualize o pagamento da sua assinatura para continuar usando as análises com IA.",
        action: (
          <button 
            onClick={handleUpdatePayment}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 px-3 text-xs font-bold text-zinc-200 transition-all hover:bg-zinc-700 focus:outline-none"
          >
            Atualizar
          </button>
        )
      });
      return;
    }
    
    if (activeRequestRef.current || isReanalyzing) {
      console.log("Clique duplo detectado e prevenido para o lead no dialog:", lead.id);
      trackEvent("AI_Analysis_Duplicate_Click_Prevented", {
        lead_id: lead.id,
        lead_name: lead.nome,
        source: "lead_dialog",
        timestamp: new Date().toISOString()
      });
      return;
    }

    const pLimit = usage.leads_limit || 20;
    const pUsed = usage.leads_used || 0;
    const aiUsedBefore = usage.ai_used || 0;
    const aiAvailableBefore = usage.ai_remaining ?? Math.max(0, 3 - aiUsedBefore);
    const aiLimitTotal = usage.ai_limit || 3;
    const hasDoneFirstAi = aiUsedBefore > 0;

    if (!canAnalyzeLead) {
      // Debounce de 5 segundos para o mesmo lead
      const lastTrackedTime = recentlyTrackedLimitBlockRef.current[lead.id] || 0;
      if (Date.now() - lastTrackedTime < 5000) {
        setShowUpgradeDialog(true);
        return;
      }
      recentlyTrackedLimitBlockRef.current[lead.id] = Date.now();

      // Rastrear evento de bloqueio por limite
      trackEvent("AI_Analysis_Blocked_By_Limit", {
        lead_id: lead.id,
        lead_name: lead.nome,
        source: "lead_dialog",
        path: window.location.pathname,
        user_plan: normalizedPlanName,
        ai_used: aiUsedBefore,
        ai_limit: aiLimitTotal,
        ai_available: aiAvailableBefore,
        leads_used: pUsed,
        leads_limit: pLimit,
        has_done_first_ai_analysis: hasDoneFirstAi,
        reason: "ai_limit_reached",
        blocked_before_ai_call: true
      });

      toast({
        title: "Limite de IA atingido",
        description: "Você atingiu seu limite de análises com IA.",
        variant: "destructive",
      });
      setShowUpgradeDialog(true);
      return;
    }

    activeRequestRef.current = true;
    setIsReanalyzing(true);
    trackMetaCustomEvent("AI_Analysis_Started", {
      lead_id: lead.id,
      lead_name: lead.nome,
      source: "prospection_page",
    });
    trackEvent("ai_analysis_clicked", { lead_id: lead.id, lead_name: lead.nome, city: lead.cidade, niche: lead.nicho, source: "lead_dialog" });
    if (!hasDoneFirstAi) {
      trackEvent("First_AI_Analysis_Started", {
        lead_id: lead.id,
        lead_name: lead.nome,
        source: "lead_dialog",
        ai_available: aiAvailableBefore,
        ai_used: aiUsedBefore,
        user_plan: normalizedPlanName,
      });
    }
    let searchContext = {};
    try {
      const storedContext = localStorage.getItem("zuno_last_search_context");
      if (storedContext) {
        searchContext = JSON.parse(storedContext);
      }
    } catch (e) {
      console.error("Erro ao ler search_context do localStorage:", e);
    }

    console.log("[AI Lead Payload]", lead);
    const normalizedLead = normalizeLeadForAI(lead, searchContext);

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
            leadId: lead.id,
            user_id: user?.id,
            lead: normalizedLead,
            search_context: searchContext,
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
        plano_prospecao_7dias: Array.isArray(updatedLead.plano_prospeccao)
          ? updatedLead.plano_prospeccao
          : (updatedLead.plano_prospeccao?.plano_prospeccao_7dias || []),
        ai_analise_gerada_em: updatedLead.ai_analise_gerada_em,
      };

      setCurrentLead(transformedLead);
      await refetchUsage();
      onLeadRefined?.(transformedLead);
      trackMetaCustomEvent("AI_Analysis_Completed", {
        lead_id: lead.id,
        lead_name: lead.nome,
      });
      const firstAnalysisKey = `zuno_first_ai_analysis_completed_${user.id}`;
      if (!localStorage.getItem(firstAnalysisKey)) {
        localStorage.setItem(firstAnalysisKey, new Date().toISOString());
        trackMetaCustomEvent("First_AI_Analysis_Completed", {
          lead_id: lead.id,
        });
        trackEvent("First_AI_Analysis_Completed", {
          lead_id: lead.id,
          lead_name: lead.nome,
          source: "lead_dialog",
          ai_available_before: aiAvailableBefore,
          ai_used_before: aiUsedBefore,
          user_plan: normalizedPlanName,
        });
      }
      trackEvent("ai_analysis_completed", { lead_id: lead.id, lead_name: lead.nome, city: lead.cidade, niche: lead.nicho, source: "lead_dialog" });

      toast({
        title: "Análise concluída",
        description: "O lead foi reanalisado com sucesso pela IA",
      });
    } catch (error: any) {
      console.error('Erro ao reanalisar lead:', error);
      
      let errorMsg = error?.message || "ai_analysis_error";
      let errorPayload: any = null;
      
      const contextResponse = error?.context;
      if (contextResponse instanceof Response) {
        try {
          const text = await contextResponse.clone().text();
          errorPayload = text ? JSON.parse(text) : null;
          errorMsg = errorPayload?.error_message || errorPayload?.details || errorPayload?.error || errorMsg;
        } catch (e) {
          console.error("Erro ao parsear resposta de erro da Edge Function:", e);
        }
      }

      const isBalanceError = (errorPayload?.error_code === "AI_CREDITS_EXHAUSTED") ||
                             (errorPayload?.error_code === "AI_LIMIT_REACHED") ||
                             (errorPayload?.blocked === true) ||
                             errorMsg.toLowerCase().includes("limite de análises atingido") ||
                             errorMsg.toLowerCase().includes("sem análises disponíveis") ||
                             errorMsg.toLowerCase().includes("crédito esgotado") ||
                             errorMsg.toLowerCase().includes("saldo esgotado") ||
                             errorMsg.toLowerCase().includes("excedeu o limite") ||
                             errorMsg.toLowerCase().includes("sem saldo") ||
                             errorMsg.toLowerCase().includes("402");

      const isPayloadError = errorPayload?.error_code === "INVALID_LEAD_PAYLOAD" || 
                             errorMsg.toLowerCase().includes("suficientes") ||
                             errorMsg.toLowerCase().includes("payload");

      if (isPayloadError) {
        trackEvent("AI_Analysis_Blocked_Insufficient_Data", {
          lead_id: lead.id,
          lead_name: lead.nome,
          available_fields: Object.keys(lead || {}),
          missing_required_fields: ["nome", "cidade/nicho/contato"],
          search_context_available: !!searchContext && Object.keys(searchContext).length > 0,
          normalized_lead_preview: {
            nome: lead.nome || null,
            cidade: lead.cidade || null,
            nicho: lead.nicho || null,
            telefone: lead.telefone || null,
            website: lead.website || null,
          }
        });
      } else {
        trackMetaCustomEvent("AI_Analysis_Failed", {
          lead_id: lead.id,
          error_message: errorMsg,
        });
        trackEvent("ai_analysis_failed", { lead_id: lead.id, lead_name: lead.nome, city: lead.cidade, niche: lead.nicho, error: errorMsg, source: "lead_dialog" });
      }

      toast({
        title: "Nao foi possivel refinar essa copy agora.",
        description: isBalanceError 
          ? "Você não tem análises IA disponíveis." 
          : isPayloadError
          ? "Não conseguimos analisar este lead porque ele veio sem nome da empresa ou contexto suficiente. Tente outro lead ou refaça a busca com cidade e nicho."
          : "Não conseguimos concluir a análise agora. Seu crédito de IA não foi consumido. Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      activeRequestRef.current = false;
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
              <a
                href={displayLead.whatsapp_link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackMetaCustomEvent("WhatsApp_Message_Click", { source: "lead_card" })}
                className="flex items-center gap-1 text-green-600 hover:underline"
              >
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
              className="min-h-[100px] resize-none bg-[#0b0f0e] border-[#1f2d29] focus-visible:border-[#10d98a]/50 focus-visible:ring-[#10d98a]/20"
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
            {isLoadingAnalysis ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                Carregando análise pendente...
              </div>
            ) : pendingAnalysis ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-amber-500 flex items-center gap-1.5">
                      <Brain className="h-4 w-4" />
                      Análise Externa Pendente
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Gerada via integração por <span className="font-semibold text-foreground">{pendingAnalysis.agent_name}</span> ({pendingAnalysis.model_used})
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={handleApproveAnalysis} 
                      disabled={isProcessingApproval}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                    >
                      {isProcessingApproval && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                      Aprovar
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      onClick={handleRejectAnalysis}
                      disabled={isProcessingApproval}
                    >
                      {isProcessingApproval && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                      Rejeitar
                    </Button>
                  </div>
                </div>
                <LeadAnalysis
                  lead={displayLead}
                  diagnostico={[
                    pendingAnalysis.opportunity_summary,
                    pendingAnalysis.possible_pain,
                    pendingAnalysis.approach_angle
                  ].filter(Boolean)}
                  probabilidade={pendingAnalysis.priority === 'high' ? 85 : pendingAnalysis.priority === 'medium' ? 60 : 35}
                  plano={[
                    pendingAnalysis.whatsapp_message && { dia: 1, canal: 'whatsapp' as const, titulo: 'Abordagem WhatsApp', mensagem: pendingAnalysis.whatsapp_message },
                    pendingAnalysis.instagram_message && { dia: 2, canal: 'instagram' as const, titulo: 'Abordagem Instagram', mensagem: pendingAnalysis.instagram_message },
                    pendingAnalysis.email_body && { dia: 3, canal: 'email' as const, titulo: pendingAnalysis.email_subject || 'Abordagem E-mail', mensagem: pendingAnalysis.email_body },
                    pendingAnalysis.follow_up_message && { dia: 4, canal: 'whatsapp' as const, titulo: 'Follow-up WhatsApp', mensagem: pendingAnalysis.follow_up_message }
                  ].filter(Boolean) as any[]}
                  geradoEm={pendingAnalysis.created_at}
                  canAnalyzeAI={false}
                />
              </div>
            ) : (
              <LeadAnalysis
                lead={displayLead}
                diagnostico={displayLead.diagnostico_bullets}
                probabilidade={displayLead.probabilidade_conversao}
                plano={displayLead.plano_prospecao_7dias}
                geradoEm={displayLead.ai_analise_gerada_em}
                onReanalyze={handleReanalyze}
                isReanalyzing={isReanalyzing}
                canAnalyzeAI={canAnalyzeLead}
              />
            )}
          </TabsContent>

          <TabsContent value="templates">
            <div className="mt-4">
              <TemplateSelector lead={displayLead} />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
      <UpgradePlanDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        currentPlanName={subscription?.plan_name || usage?.plan_name}
        source="ai_limit_reached"
      />
    </Dialog>
  );
};
