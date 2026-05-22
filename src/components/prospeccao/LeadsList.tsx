import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, MapPin, Phone, Star, Trash2, Eye, MessageSquare, Instagram, Download, Save, Archive, Mail, Lock, Zap, RefreshCw, UserCheck, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { LeadProspeccao } from "@/types/lead";
import { LeadPlanDialog } from "./LeadPlanDialog";
import { Progress } from "@/components/ui/progress";
import { exportLeadsToExcel } from "@/utils/exportToExcel";
import { UpgradePlanDialog } from "@/components/profile/UpgradePlanDialog";
import { UpsellCard } from "./UpsellCard";
import { useSubscription } from "@/hooks/useSubscription";
import { useUsage } from "@/hooks/useUsage";
import { trackEvent } from "@/lib/analytics";
import { trackMetaCustomEvent } from "@/lib/metaPixel";
import type { UpgradeSource } from "@/lib/funnelContext";

export const LeadsList = () => {
  const { toast } = useToast();
  const { subscription, isAdmin: subscriptionIsAdmin } = useSubscription();
  const { usage, canAnalyzeAI, refetch: refetchUsage, isAdmin: usageIsAdmin } = useUsage();
  const isAdmin = subscriptionIsAdmin || usageIsAdmin;
  const [leads, setLeads] = useState<LeadProspeccao[]>([]);
  const [lockedLeads, setLockedLeads] = useState<LeadProspeccao[]>([]);
  const [totalLocked, setTotalLocked] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<LeadProspeccao | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgradeSource, setUpgradeSource] = useState<UpgradeSource>("unknown");
  const [reanalyzingLeads, setReanalyzingLeads] = useState<Set<string>>(new Set());
  const [currentSearchRunId, setCurrentSearchRunId] = useState<string | null>(null);
  
  const normalizedPlanName = String(subscription?.plan_name || usage.plan_name || "free").toLowerCase();
  const firstAnalyzableLead = useMemo(
    () => leads.find((lead) => lead.probabilidade_conversao <= 0 && lead.plano_prospecao_7dias.length === 0) || leads[0],
    [leads],
  );

  const isFree = normalizedPlanName === "free";
  const aiUsed = usage.ai_used || 0;
  const aiRemaining = usage.ai_remaining ?? Math.max(0, 3 - aiUsed);
  const aiLimit = usage.ai_limit ?? 3;
  
  // Estado 1: Onboarding Pós-Busca (Free, 0 IA usada, tem saldo, tem leads)
  const isEstado1Onboarding = isFree && aiUsed === 0 && aiRemaining > 0 && leads.length > 0 && !isAdmin;
  
  // Estado 2: Pós-Primeira IA (Free, 1 IA usada, tem saldo)
  const isEstado2PosPrimeiraIA = isFree && aiUsed === 1 && aiRemaining > 0 && !isAdmin;
  
  // Estado 3: Perto do Limite (Free, 2 IA usadas, 1 restante)
  const isEstado3PertoLimite = isFree && aiUsed === 2 && aiRemaining === 1 && !isAdmin;
  
  // Estado 4: Limite Esgotado (Free, 3+ IA usadas, 0 restantes)
  const isEstado4LimiteEsgotado = isFree && aiRemaining <= 0 && !isAdmin;

  // Função centralizada para acionar e trackear cliques de upgrade conforme a jornada
  const triggerUpgradeFlow = (source: UpgradeSource) => {
    const pLimit = usage.leads_limit || 20;
    const pUsed = usage.leads_used || 0;

    const eventMetadata = {
      source,
      user_plan: "free",
      ai_used: aiUsed,
      ai_limit: aiLimit,
      leads_used: pUsed,
      leads_limit: pLimit,
    };

    if (isFree) {
      if (aiUsed === 0) {
        trackEvent("Upgrade_Click_Before_AI", eventMetadata);
      } else if (aiUsed > 0 && aiUsed < 3) {
        trackEvent("Upgrade_Click_After_AI", eventMetadata);
      } else if (aiUsed >= 3) {
        trackEvent("Upgrade_Click_After_Limit", eventMetadata);
      }
    }

    trackEvent("Upgrade_Click", eventMetadata);
    trackEvent("upgrade_clicked", eventMetadata);

    setUpgradeSource(source);
    setShowUpgradeDialog(true);
  };

  // Função para validar se um número de telefone brasileiro é válido
  const isValidBrazilianPhone = (phone: string): boolean => {
    const cleanNumber = phone.replace(/\D/g, '');
    
    // Remove código do país se presente
    const numberWithoutCountry = cleanNumber.startsWith('55') 
      ? cleanNumber.slice(2) 
      : cleanNumber;
    
    // Deve ter 10 (fixo) ou 11 (celular) dígitos
    if (numberWithoutCountry.length < 10 || numberWithoutCountry.length > 11) {
      return false;
    }
    
    // Extrai DDD (primeiros 2 dígitos)
    const ddd = parseInt(numberWithoutCountry.slice(0, 2), 10);
    
    // DDDs válidos no Brasil (11-99, exceto alguns inválidos)
    const invalidDDDs = [20, 23, 25, 26, 29, 30, 36, 39, 40, 50, 52, 56, 57, 58, 59, 60, 70, 72, 76, 78, 80, 90];
    if (ddd < 11 || ddd > 99 || invalidDDDs.includes(ddd)) {
      return false;
    }
    
    // Para celulares (11 dígitos), o primeiro dígito após DDD deve ser 9
    if (numberWithoutCountry.length === 11) {
      const firstDigitAfterDDD = numberWithoutCountry.charAt(2);
      if (firstDigitAfterDDD !== '9') {
        return false;
      }
    }
    
    return true;
  };

  // Função para verificar se é número de celular
  const isMobileNumber = (phone: string): boolean => {
    if (!phone) return false;
    const cleaned = phone.replace(/\D/g, "");
    const number = cleaned.startsWith("55") ? cleaned.substring(2) : cleaned;
    // Celular brasileiro: DDD (2 dígitos) + 9 + 8 dígitos = 11 dígitos total
    return number.length === 11 && number.charAt(2) === '9';
  };

  // Função helper para gerar link do WhatsApp a partir de um número (apenas celulares)
  const generateWhatsAppLink = (whatsappNumber: string | null, telefone: string | null): string | null => {
    // Prioriza whatsapp_number encontrado no site
    if (whatsappNumber) {
      const cleanWhatsapp = whatsappNumber.replace(/\D/g, '');
      if (cleanWhatsapp.length >= 10) {
        // Adiciona código do país se não tiver
        const fullNumber = cleanWhatsapp.startsWith('55') ? cleanWhatsapp : `55${cleanWhatsapp}`;
        return `https://wa.me/${fullNumber}`;
      }
    }
    
    // Se não houver, usa o telefone como fallback (apenas se for celular)
    if (telefone && isValidBrazilianPhone(telefone) && isMobileNumber(telefone)) {
      const cleanNumber = telefone.replace(/\D/g, '');
      const numberWithoutCountry = cleanNumber.startsWith('55') ? cleanNumber.substring(2) : cleanNumber;
      // Sempre adiciona o código do Brasil +55
      return `https://wa.me/55${numberWithoutCountry}`;
    }
    
    return null;
  };

  // Função para verificar se uma URL é do Instagram
  const isInstagramUrl = (url: string | null): boolean => {
    if (!url) return false;
    return /instagram\.com/i.test(url);
  };

  // Função helper para transformar dados do banco
  const transformLeadFromDb = (lead: any): LeadProspeccao => {
    // Verifica se o website é na verdade um Instagram
    const websiteIsInstagram = isInstagramUrl(lead.website);
    
    // Se o website for Instagram, usa como instagram_url
    const finalInstagramUrl = lead.instagram_url || (websiteIsInstagram ? lead.website : null);
    
    // Website só é válido se não for Instagram
    const finalWebsite = websiteIsInstagram ? null : lead.website;
    
    return {
      id: lead.id,
      placeId: lead.google_place_id,
      nome: lead.nome,
      telefone: lead.telefone,
      whatsapp_link: generateWhatsAppLink(lead.whatsapp_number, lead.telefone),
      email: lead.email || null,
      website: finalWebsite,
      instagram_url: finalInstagramUrl,
      instagram_context: lead.instagram_context,
      endereco: lead.endereco,
      cidade: lead.cidade,
      nicho: lead.nicho,
      foco: lead.foco as any,
      proximidadeAtiva: lead.proximidade_ativa || false,
      raioKm: lead.raio_km,
      sinais: {
        has_whatsapp_on_site: lead.whatsapp_on_site || false,
        has_meta_pixel: lead.has_meta_pixel || false,
        has_gtag: lead.has_gtag || false,
        has_gtm: lead.has_gtm || false,
      },
      diagnostico_bullets: (lead.diagnostico_bullets as string[]) || [],
      probabilidade_conversao: lead.probabilidade_conversao || 0,
      plano_prospecao_7dias: (lead.plano_prospeccao as any[]) || [],
      rating: lead.rating,
      total_reviews: lead.total_reviews,
      status: lead.status || 'novo',
      created_at: lead.created_at,
      ai_analise_gerada_em: lead.ai_analise_gerada_em,
      salvo: lead.salvo || false,
      notas: lead.notas || null,
      // Campos CNPJ
      cnpj: lead.cnpj || null,
      razao_social: lead.razao_social || null,
      nome_responsavel: lead.nome_responsavel || null,
      cnpj_telefone: lead.cnpj_telefone || null,
      cnpj_email: lead.cnpj_email || null,
      situacao_cadastral: lead.situacao_cadastral || null,
      porte_empresa: lead.porte_empresa || null,
      cnae_principal: lead.cnae_principal || null,
    };
  };

  const loadLeads = async (searchRunId?: string) => {
    try {
      const functionName = 'get-leads-secure';
      const payload = {
        action: 'list',
        salvo: false,
        limit: 300,
        ...(searchRunId ? { searchRunId } : {}),
      };
      console.info(`[${functionName}] payload`, {
        ...payload,
        searchRunId: searchRunId ? 'presente' : null,
      });

      // Usa edge function segura com rate limiting e auditoria
      // Se temos um searchRunId, busca apenas leads dessa busca
      const { data, error } = await supabase.functions.invoke('get-leads-secure', {
        body: payload,
      });

      if (error) {
        let responsePayload: any = null;
        const contextResponse = (error as any)?.context;

        if (contextResponse instanceof Response) {
          try {
            const text = await contextResponse.clone().text();
            responsePayload = text ? JSON.parse(text) : null;
          } catch (parseError) {
            console.error(`[${functionName}] erro ao ler payload de erro`, parseError);
          }
        }

        console.error(`[${functionName}] erro ao chamar Edge Function`, {
          functionName,
          payload: {
            ...payload,
            searchRunId: searchRunId ? 'presente' : null,
          },
          status: contextResponse?.status ?? null,
          message: error.message,
          response: responsePayload,
        });

        throw new Error(responsePayload?.details || responsePayload?.error || error.message);
      }
      
      if (data.error) {
        // Handle rate limit
        if (data.rate_limit && data.rate_limit.remaining === 0) {
          toast({
            variant: "destructive",
            title: "Limite de requisições",
            description: `Aguarde ${data.rate_limit.reset_in_minutes} minuto(s) para continuar.`,
          });
          return;
        }
        throw new Error(data.error);
      }
      
      const leadsFormatted: LeadProspeccao[] = (data.data?.leads || []).map(transformLeadFromDb);
      
      setLeads(leadsFormatted);
      
      // Salva o searchRunId se foi passado
      if (searchRunId) {
        setCurrentSearchRunId(searchRunId);
      }
    } catch (error: any) {
      console.error("Erro ao carregar leads:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar leads",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Carrega leads ao montar o componente (sem filtro por searchRunId = pega todos não salvos)
    loadLeads();
    
    // Listener para recarregar quando novos leads são adicionados
    // Agora recebe searchRunId do evento para filtrar apenas leads da busca atual
    const handleReload = (event: CustomEvent<{ searchRunId?: string }>) => {
      const searchRunId = event.detail?.searchRunId;
      loadLeads(searchRunId);
    };
    window.addEventListener("reloadLeads", handleReload as EventListener);
    
    // Listener para limpar leads antes de nova busca
    const handleClear = () => {
      setLeads([]);
      setLockedLeads([]);
      setLoading(true);
    };
    window.addEventListener("clearLeads", handleClear);
    
    // Listener para receber leads bloqueados
    const handleSetLockedLeads = (event: CustomEvent<{ lockedLeads: any[], totalLocked: number }>) => {
      const { lockedLeads: locked, totalLocked: total } = event.detail;
      // Salva o número real de leads ocultos
      setTotalLocked(total || 0);
      
      if (locked && locked.length > 0) {
        // Transforma os leads bloqueados no formato correto
        const formattedLocked = locked.map((lead: any) => ({
          id: lead.id,
          placeId: null,
          nome: lead.nome,
          telefone: null,
          whatsapp_link: null,
          email: null,
          website: null,
          instagram_url: null,
          instagram_context: null,
          endereco: lead.endereco,
          cidade: lead.cidade,
          nicho: lead.nicho,
          foco: lead.foco as any,
          proximidadeAtiva: false,
          raioKm: null,
          sinais: {
            has_whatsapp_on_site: false,
            has_meta_pixel: false,
            has_gtag: false,
            has_gtm: false,
          },
          diagnostico_bullets: [],
          probabilidade_conversao: 0,
          plano_prospecao_7dias: [],
          rating: lead.rating,
          total_reviews: lead.total_reviews,
          status: 'novo',
          created_at: new Date().toISOString(),
          ai_analise_gerada_em: null,
          salvo: false,
          cnpj: null,
          razao_social: null,
          nome_responsavel: null,
          cnpj_telefone: null,
          cnpj_email: null,
          situacao_cadastral: null,
          porte_empresa: null,
          cnae_principal: null,
          isLocked: true,
        } as LeadProspeccao));
        setLockedLeads(formattedLocked);
      } else {
        setLockedLeads([]);
      }
    };
    window.addEventListener("setLockedLeads", handleSetLockedLeads as EventListener);
    
    // Configurar realtime para atualizar leads quando análise IA for concluída
    const channel = supabase
      .channel('leads-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads'
        },
        (payload) => {
          console.log('Lead atualizado via realtime:', payload.new);
          
          // IMPORTANTE: O payload do realtime contém dados brutos (não descriptografados)
          // Apenas atualizamos os campos da análise IA, preservando os dados descriptografados
          setLeads(prevLeads => 
            prevLeads.map(lead => {
              if (lead.id === payload.new.id) {
                // Atualiza apenas os campos de IA, mantendo os dados de contato existentes
                return {
                  ...lead,
                  diagnostico_bullets: (payload.new.diagnostico_bullets as string[]) || lead.diagnostico_bullets,
                  probabilidade_conversao: payload.new.probabilidade_conversao || lead.probabilidade_conversao,
                  plano_prospecao_7dias: (payload.new.plano_prospeccao as any[]) || lead.plano_prospecao_7dias,
                  ai_analise_gerada_em: payload.new.ai_analise_gerada_em || lead.ai_analise_gerada_em,
                  status: payload.new.status || lead.status,
                  salvo: payload.new.salvo ?? lead.salvo,
                };
              }
              return lead;
            })
          );
          
          // Se a análise foi concluída agora, mostrar toast
          if (payload.new.ai_analise_gerada_em && !payload.old?.ai_analise_gerada_em) {
            toast({
              title: "✨ Análise IA concluída",
              description: `Lead "${payload.new.nome}" foi analisado com sucesso`,
            });
          }
        }
      )
      .subscribe();
    
    return () => {
      window.removeEventListener("reloadLeads", handleReload as EventListener);
      window.removeEventListener("clearLeads", handleClear);
      window.removeEventListener("setLockedLeads", handleSetLockedLeads as EventListener);
      supabase.removeChannel(channel);
    };
  }, []);

  const shownEventsRef = useRef<Set<string>>(new Set());
  const firstLeadCtaShownRef = useRef<string | null>(null);

  // 1. Evento First_AI_CTA_Shown (Estado 1: Onboarding Pós-Busca)
  useEffect(() => {
    if (!isEstado1Onboarding) return;
    const key = `state1_${currentSearchRunId || "session"}`;
    if (shownEventsRef.current.has(key)) return;
    shownEventsRef.current.add(key);

    trackEvent("First_AI_CTA_Shown", {
      source: "after_search",
      location: "results_top_banner",
      user_plan: "free",
      ai_used: aiUsed,
      ai_available: aiRemaining,
      ai_limit: aiLimit,
      leads_available: usage.leads_available_total || 20,
      leads_used: usage.leads_used || 0,
      leads_limit: usage.leads_limit || 20,
      search_id: currentSearchRunId,
      leads_count: leads.length
    });
  }, [isEstado1Onboarding, currentSearchRunId, leads.length, aiUsed, aiRemaining, aiLimit, usage.leads_available_total, usage.leads_used, usage.leads_limit]);

  // 2. Evento AI_Limit_Near_Shown (Estado 3: Perto do Limite)
  useEffect(() => {
    if (!isEstado3PertoLimite) return;
    const key = `state3_${currentSearchRunId || "session"}`;
    if (shownEventsRef.current.has(key)) return;
    shownEventsRef.current.add(key);

    trackEvent("AI_Limit_Near_Shown", {
      user_plan: "free",
      ai_used: aiUsed,
      ai_limit: aiLimit,
      ai_available: aiRemaining
    });
  }, [isEstado3PertoLimite, currentSearchRunId, aiUsed, aiLimit, aiRemaining]);

  // 3. Evento AI_Limit_Reached_Shown (Estado 4: Limite Esgotado)
  useEffect(() => {
    if (!isEstado4LimiteEsgotado) return;
    const key = `state4_${currentSearchRunId || "session"}`;
    if (shownEventsRef.current.has(key)) return;
    shownEventsRef.current.add(key);

    trackEvent("AI_Limit_Reached_Shown", {
      user_plan: "free",
      ai_used: aiUsed,
      ai_limit: aiLimit,
      ai_available: aiRemaining
    });
  }, [isEstado4LimiteEsgotado, currentSearchRunId, aiUsed, aiLimit, aiRemaining]);

  // 4. Evento AI_Lead_CTA_Shown (Somente primeiro lead recomendado/visível)
  useEffect(() => {
    if (leads.length > 0 && firstAnalyzableLead) {
      const key = `${firstAnalyzableLead.id}_cta_shown`;
      if (firstLeadCtaShownRef.current === key) return;
      firstLeadCtaShownRef.current = key;
      
      const hasDoneFirstAi = aiUsed > 0;
      trackEvent("AI_Lead_CTA_Shown", {
        lead_id: firstAnalyzableLead.id,
        lead_name: firstAnalyzableLead.nome,
        position: 0,
        user_plan: "free",
        ai_used: aiUsed,
        ai_available: aiRemaining,
        has_done_first_ai_analysis: hasDoneFirstAi
      });
    }
  }, [leads, firstAnalyzableLead, aiUsed, aiRemaining]);

  const deleteLead = async (id: string) => {
    try {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
      
      toast({
        title: "Lead removido",
        description: "O lead foi removido com sucesso",
      });
      
      loadLeads();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao remover lead",
        description: error.message,
      });
    }
  };

  const openPlanDialog = (lead: LeadProspeccao) => {
    setSelectedLead(lead);
    setDialogOpen(true);
  };

  const getProbabilidadeColor = (prob: number) => {
    if (prob >= 70) return "text-green-600";
    if (prob >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  const handleExportExcel = () => {
    try {
      const fileName = exportLeadsToExcel(leads);
      toast({
        title: "Excel exportado!",
        description: `Arquivo ${fileName} foi baixado com sucesso`,
      });
      trackMetaCustomEvent("Lead_Exported", {
        export_type: "xlsx",
        leads_count: leads.length,
      });
    } catch (error: any) {
      console.error("Erro ao exportar Excel:", error);
      toast({
        variant: "destructive",
        title: "Erro na exportação",
        description: error.message || "Não foi possível exportar para Excel",
      });
    }
  };

  const handleFirstAiCtaClick = async () => {
    if (!firstAnalyzableLead) return;
    trackEvent("First_AI_CTA_Clicked", {
      location: "results_top_banner",
      selected_lead_id: firstAnalyzableLead.id,
      selected_lead_name: firstAnalyzableLead.nome,
      ai_available: usage.ai_remaining,
      ai_used: usage.ai_used,
      user_plan: normalizedPlanName,
    });
    await reanalyzeLead(firstAnalyzableLead, "results_top_banner");
  };

  const scrollToLeadsTable = () => {
    const element = document.getElementById("leads-table-container");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSaveLeads = async () => {
    try {
      const leadsNaoSalvos = leads.filter(lead => !lead.salvo);
      
      if (leadsNaoSalvos.length === 0) {
        toast({
          title: "Nenhum lead para salvar",
          description: "Todos os leads já estão salvos",
        });
        return;
      }

      // Marca todos os leads não salvos como salvos
      const { error } = await supabase
        .from("leads")
        .update({ salvo: true })
        .in("id", leadsNaoSalvos.map(l => l.id));

      if (error) throw error;

      toast({
        title: "Leads salvos com sucesso!",
        description: `${leadsNaoSalvos.length} leads foram salvos e não serão deletados em novas buscas`,
      });
      trackMetaCustomEvent("Lead_Saved", {
        lead_id: "bulk",
        lead_name: `${leadsNaoSalvos.length} leads`,
      });

      loadLeads();
    } catch (error: any) {
      console.error("Erro ao salvar leads:", error);
      toast({
        variant: "destructive",
        title: "Erro ao salvar leads",
        description: error.message,
      });
    }
  };

  const toggleSaveLead = async (lead: LeadProspeccao) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ salvo: !lead.salvo })
        .eq("id", lead.id);

      if (error) throw error;

      toast({
        title: lead.salvo ? "Lead desmarcado" : "Lead salvo",
        description: lead.salvo 
          ? "Lead será deletado na próxima busca" 
          : "Lead será preservado em novas buscas",
      });
      if (!lead.salvo) {
        trackMetaCustomEvent("Lead_Saved", {
          lead_id: lead.id,
          lead_name: lead.nome,
        });
      }

      loadLeads();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    }
  };

  const getFunctionErrorMessage = async (error: any) => {
    const contextResponse = error?.context;
    if (contextResponse instanceof Response) {
      try {
        const text = await contextResponse.clone().text();
        const payload = text ? JSON.parse(text) : null;
        return payload?.error || payload?.details || error.message;
      } catch {
        return error.message;
      }
    }
    return error?.message || "Não foi possível analisar o lead";
  };

  // Analisar ou reanalisar lead manualmente
  const reanalyzeLead = async (lead: LeadProspeccao, source = "leads_list") => {
    if (!canAnalyzeAI) {
      toast({
        variant: "destructive",
        title: "Limite de IA atingido",
        description: "Você atingiu seu limite de análises com IA.",
      });
      setUpgradeSource("limit_reached");
      setShowUpgradeDialog(true);
      return;
    }

    setReanalyzingLeads(prev => new Set(prev).add(lead.id));
    
    const pLimit = usage.leads_limit || 20;
    const pUsed = usage.leads_used || 0;
    const aiUsedBefore = usage.ai_used || 0;
    const aiAvailableBefore = usage.ai_remaining || 0;
    const aiLimitTotal = usage.ai_limit || 3;
    
    trackEvent("AI_Analysis_Started", {
      lead_id: lead.id,
      lead_name: lead.nome,
      user_plan: normalizedPlanName,
      ai_used_before: aiUsedBefore,
      ai_used_after: aiUsedBefore,
      ai_available_before: aiAvailableBefore,
      ai_available_after: aiAvailableBefore,
      source,
      path: window.location.pathname,
    });
    
    trackMetaCustomEvent("AI_Analysis_Started", {
      lead_id: lead.id,
      lead_name: lead.nome,
      source: "prospection_page",
    });
    
    const firstAnalysisKeyPrefix = "zuno_first_ai_analysis_completed_";
    const hasDoneFirstAi = aiUsedBefore > 0;
    trackEvent("ai_analysis_clicked", { lead_id: lead.id, lead_name: lead.nome, city: lead.cidade, niche: lead.nicho, source });
    
    if (!hasDoneFirstAi) {
      trackEvent("First_AI_Analysis_Started", {
        lead_id: lead.id,
        lead_name: lead.nome,
        source,
        ai_available: aiAvailableBefore,
        ai_used: aiUsedBefore,
        user_plan: normalizedPlanName,
      });
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");

      const { error } = await supabase.functions.invoke("analisar-lead-ia", {
        body: {
          leadId: lead.id,
          user_id: user.id,
          canaisProspeccao: ["email", "whatsapp", "instagram"],
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) throw new Error(await getFunctionErrorMessage(error));

      toast({
        title: "Análise concluída",
        description: `Lead "${lead.nome}" foi analisado com sucesso`,
      });

      const nextUsage = await refetchUsage();
      const newAiUsed = nextUsage?.data?.ai_used ?? (aiUsedBefore + 1);
      const newAiRemaining = nextUsage?.data?.ai_remaining ?? Math.max(0, aiAvailableBefore - 1);

      trackEvent("AI_Analysis_Completed", {
        lead_id: lead.id,
        lead_name: lead.nome,
        user_plan: normalizedPlanName,
        ai_used_before: aiUsedBefore,
        ai_used_after: newAiUsed,
        ai_available_before: aiAvailableBefore,
        ai_available_after: newAiRemaining,
        source,
        path: window.location.pathname,
      });

      trackMetaCustomEvent("AI_Analysis_Completed", {
        lead_id: lead.id,
        lead_name: lead.nome,
      });

      const firstAnalysisKey = `${firstAnalysisKeyPrefix}${user.id}`;
      if (!localStorage.getItem(firstAnalysisKey)) {
        localStorage.setItem(firstAnalysisKey, new Date().toISOString());
        
        trackMetaCustomEvent("First_AI_Analysis_Completed", {
          lead_id: lead.id,
        });

        trackEvent("First_AI_Analysis_Completed", {
          lead_id: lead.id,
          lead_name: lead.nome,
          user_plan: normalizedPlanName,
          ai_used: newAiUsed,
          ai_available: newAiRemaining,
          ai_limit: aiLimitTotal,
          leads_used: pUsed,
          leads_limit: pLimit
        });
      }
      
      trackEvent("ai_analysis_completed", { lead_id: lead.id, lead_name: lead.nome, city: lead.cidade, niche: lead.nicho, source });
      loadLeads();
    } catch (error: any) {
      console.error("Erro ao reanalisar:", error);
      
      trackEvent("AI_Analysis_Failed", {
        lead_id: lead.id,
        lead_name: lead.nome,
        user_plan: normalizedPlanName,
        ai_used_before: aiUsedBefore,
        ai_used_after: aiUsedBefore,
        ai_available_before: aiAvailableBefore,
        ai_available_after: aiAvailableBefore,
        source,
        path: window.location.pathname,
        error_message: error.message || "ai_analysis_error",
      });

      trackMetaCustomEvent("AI_Analysis_Failed", {
        lead_id: lead.id,
        error_message: error.message || "ai_analysis_error",
      });
      
      trackEvent("ai_analysis_failed", { lead_id: lead.id, lead_name: lead.nome, city: lead.cidade, niche: lead.nicho, error: error.message || "ai_analysis_error", source });
      
      toast({
        variant: "destructive",
        title: "Erro na análise",
        description: error.message || "Não foi possível analisar o lead",
      });
    } finally {
      setReanalyzingLeads(prev => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Carregando leads...</p>
        </CardContent>
      </Card>
    );
  }

  if (leads.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            Nenhum lead encontrado. Faça uma busca para começar!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card id="leads-table-container" className="w-full overflow-hidden shadow-lg">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-xl">Leads Encontrados ({leads.length})</CardTitle>
            {leads.length > 0 && (
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button onClick={handleSaveLeads} variant="default" size="sm" className="h-9">
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Leads
                </Button>
                <Button onClick={handleExportExcel} variant="outline" size="sm" className="h-9">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Excel
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        
        {/* Banner de Onboarding e Limites de IA - 4 Estados Discretos */}
        {isEstado1Onboarding && firstAnalyzableLead && (
          <div className="mx-4 mb-4 mt-4 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-teal-500/5 to-transparent p-5 shadow-sm transition-all duration-300">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 animate-pulse">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Você encontrou leads! E agora, como abordar?
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-3xl">
                    Gere sua primeira abordagem personalizada com inteligência artificial para WhatsApp, Instagram e e-mail em poucos segundos. O Zuno analisa os sinais digitais e monta o roteiro de vendas perfeito.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button
                  onClick={scrollToLeadsTable}
                  variant="outline"
                  className="h-10 text-xs font-medium"
                >
                  Ver Lista
                </Button>
                <Button
                  onClick={handleFirstAiCtaClick}
                  disabled={reanalyzingLeads.has(firstAnalyzableLead.id)}
                  className="h-10 bg-emerald-600 text-white hover:bg-emerald-500 shadow-md font-semibold text-xs transition-transform active:scale-95"
                >
                  {reanalyzingLeads.has(firstAnalyzableLead.id) ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="mr-2 h-4 w-4" />
                  )}
                  Gerar abordagem com IA
                </Button>
              </div>
            </div>
          </div>
        )}

        {isEstado2PosPrimeiraIA && (
          <div className="mx-4 mb-4 mt-4 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="h-6 w-6 text-yellow-500 fill-yellow-500 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    🏆 Sua primeira abordagem com IA foi gerada!
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-3xl">
                    O Zuno transformou os dados da empresa em um diagnóstico e mensagens prontas. Você ainda pode gerar abordagens personalizadas para mais leads com seu saldo grátis.
                  </p>
                  <div className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Você ainda tem {aiRemaining} análises de IA grátis.
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button
                  onClick={() => triggerUpgradeFlow("leads_list")}
                  variant="outline"
                  className="h-10 text-xs font-medium border-emerald-500/30 hover:bg-emerald-500/5"
                >
                  Conhecer Planos
                </Button>
                <Button
                  onClick={scrollToLeadsTable}
                  className="h-10 bg-emerald-600 text-white hover:bg-emerald-500 shadow-md font-semibold text-xs"
                >
                  Analisar outro lead
                </Button>
              </div>
            </div>
          </div>
        )}

        {isEstado3PertoLimite && (
          <div className="mx-4 mb-4 mt-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground text-amber-700 dark:text-amber-500">
                    Resta apenas {aiRemaining} análise IA grátis!
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-3xl">
                    Você está no fim do seu teste grátis. Continue testando em mais uma empresa ou mude para um plano profissional para gerar abordagens em massa!
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button
                  onClick={scrollToLeadsTable}
                  variant="outline"
                  className="h-10 text-xs font-medium"
                >
                  Usar última análise
                </Button>
                <Button
                  onClick={() => triggerUpgradeFlow("leads_list")}
                  className="h-10 bg-amber-600 text-white hover:bg-amber-500 shadow-md font-semibold text-xs border border-amber-700"
                >
                  Ver planos Pro
                </Button>
              </div>
            </div>
          </div>
        )}

        {isEstado4LimiteEsgotado && (
          <div className="mx-4 mb-4 mt-4 rounded-xl border border-emerald-500/40 bg-gradient-to-br from-slate-950 via-emerald-950/40 to-slate-950 p-6 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between relative z-10">
              <div className="flex items-start gap-4 flex-1">
                <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                      ✨ Suas análises IA grátis acabaram!
                    </h3>
                    <p className="text-sm text-slate-300 mt-1 leading-relaxed max-w-2xl">
                      Você comprovou o valor do Zuno Prospect analisando empresas e gerando abordagens. Escolha o plano ideal para continuar convertendo leads in clientes de forma automatizada.
                    </p>
                  </div>
                  
                  {/* Tabela Comparativa de Planos */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl">
                    <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-3 flex flex-col justify-between">
                      <div>
                        <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Free</div>
                        <div className="text-sm font-bold mt-1 text-slate-200">3 análises IA/mês</div>
                        <div className="text-[11px] text-slate-400">20 leads/mês</div>
                      </div>
                      <div className="text-xs font-semibold text-slate-400 mt-2">Grátis</div>
                    </div>
                    <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-3 flex flex-col justify-between">
                      <div>
                        <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Starter</div>
                        <div className="text-sm font-bold mt-1 text-slate-200">30 Análises IA/mês</div>
                        <div className="text-[11px] text-slate-400">300 leads/mês</div>
                      </div>
                      <div className="text-xs font-bold text-emerald-400 mt-2">R$ 47<span className="text-[10px] text-slate-400">/mês</span></div>
                    </div>
                    <div className="rounded-lg bg-slate-900/90 border border-emerald-500/40 p-3 flex flex-col justify-between relative shadow-lg">
                      <span className="absolute -top-2.5 right-2 px-1.5 py-0.5 rounded bg-emerald-500 text-[9px] font-bold text-slate-950 uppercase tracking-wide">
                        Popular
                      </span>
                      <div>
                        <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Pro</div>
                        <div className="text-sm font-bold mt-1 text-slate-100">100 Análises IA/mês</div>
                        <div className="text-[11px] text-slate-300">800 leads/mês</div>
                      </div>
                      <div className="text-xs font-bold text-emerald-400 mt-2">R$ 97<span className="text-[10px] text-slate-400">/mês</span></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto md:min-w-[200px] justify-center pt-2">
                <Button
                  onClick={() => triggerUpgradeFlow("ai_limit_reached")}
                  className="w-full h-11 bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold text-xs shadow-lg uppercase tracking-wide transition-all duration-200 shadow-emerald-500/10 hover:shadow-emerald-500/25 active:scale-95"
                >
                  <Zap className="mr-1.5 h-4 w-4 fill-slate-950" />
                  Liberar análises IA
                </Button>
                <Button
                  onClick={() => triggerUpgradeFlow("ai_limit_reached")}
                  variant="ghost"
                  className="w-full h-9 text-xs text-slate-400 hover:text-white hover:bg-white/5 font-medium"
                >
                  Ver todos os planos
                </Button>
              </div>
            </div>
          </div>
        )}
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <div className="min-w-[1120px] p-4">
              <Table className="table-fixed overflow-hidden rounded-md border">
                <colgroup>
                  <col className="w-[27%]" />
                  <col className="w-[15%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                  <col className="w-[20%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="px-3 text-xs font-semibold uppercase tracking-wide">Empresa</TableHead>
                  <TableHead className="px-3 text-xs font-semibold uppercase tracking-wide">Contato</TableHead>
                  <TableHead className="px-3 text-xs font-semibold uppercase tracking-wide">Sinais Digitais</TableHead>
                  <TableHead className="px-3 text-center text-xs font-semibold uppercase tracking-wide">Prob. Conversão</TableHead>
                  <TableHead className="px-3 text-xs font-semibold uppercase tracking-wide">Preview Plano</TableHead>
                  <TableHead className="px-3 text-center text-xs font-semibold uppercase tracking-wide">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id} className="align-top">
                    <TableCell className="px-3 py-3 align-top">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="min-w-0 truncate font-medium" title={lead.nome}>{lead.nome}</p>
                          {lead.salvo && (
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              <Archive className="h-3 w-3 mr-1" />
                              Salvo
                            </Badge>
                          )}
                          {lead.cnpj && (
                            <Badge 
                              variant="outline" 
                              className={
                                lead.situacao_cadastral === "ATIVA"
                                  ? "shrink-0 text-xs bg-green-500/10 text-green-700 border-green-500/20"
                                  : "shrink-0 text-xs bg-red-500/10 text-red-700 border-red-500/20"
                              }
                              title={`CNPJ: ${lead.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}${lead.razao_social ? ` - ${lead.razao_social}` : ""}`}
                            >
                              {lead.situacao_cadastral === "ATIVA" ? "✓ CNPJ" : "⚠ CNPJ"}
                            </Badge>
                          )}
                          {/* Indicador do nome do responsável via CNPJ */}
                          {lead.nome_responsavel && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge 
                                    variant="outline" 
                                    className="shrink-0 text-xs bg-amber-500/10 text-amber-700 border-amber-500/20 cursor-help"
                                  >
                                    <UserCheck className="h-3 w-3 mr-1" />
                                    {lead.nome_responsavel.split(' ')[0]}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Sócio/responsável via Receita Federal</p>
                                  <p className="text-xs text-muted-foreground">{lead.nome_responsavel}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        {lead.endereco && (
                          <div className="flex min-w-0 items-start gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="line-clamp-2">{lead.endereco}</span>
                          </div>
                        )}
                        {lead.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs font-medium">{lead.rating}</span>
                            <span className="text-xs text-muted-foreground">
                              ({lead.total_reviews})
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell className="px-3 py-3 align-top">
                      <div className="min-w-0 space-y-1.5">
                        {lead.telefone && (
                          <div className="flex min-w-0 items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{lead.telefone}</span>
                          </div>
                        )}
                        {lead.whatsapp_link && (
                          <a
                            href={lead.whatsapp_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackMetaCustomEvent("WhatsApp_Message_Click", { source: "lead_card" })}
                            className="flex items-center gap-1 text-sm text-green-600 hover:underline"
                          >
                            <MessageSquare className="h-3 w-3 flex-shrink-0" />
                            <span>WhatsApp</span>
                          </a>
                        )}
                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}`}
                            className="flex min-w-0 items-center gap-1 text-sm text-blue-600 hover:underline"
                          >
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">Email</span>
                          </a>
                        )}
                        {lead.website && (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-w-0 items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">Site</span>
                          </a>
                        )}
                        {lead.instagram_url && (
                          <a
                            href={lead.instagram_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-pink-600 hover:underline"
                          >
                            <Instagram className="h-3 w-3 flex-shrink-0" />
                            <span>Instagram</span>
                          </a>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell className="px-3 py-3 align-top">
                      <div className="flex min-w-0 flex-wrap gap-1.5">
                        {lead.sinais.has_whatsapp_on_site && (
                          <Badge variant="outline" className="px-2 py-0 text-xs bg-green-500/10 text-green-700 border-green-500/20">
                            WhatsApp
                          </Badge>
                        )}
                        {lead.sinais.has_meta_pixel && (
                          <Badge variant="outline" className="px-2 py-0 text-xs bg-blue-500/10 text-blue-700 border-blue-500/20">
                            Pixel
                          </Badge>
                        )}
                        {lead.sinais.has_gtag && (
                          <Badge variant="outline" className="px-2 py-0 text-xs bg-orange-500/10 text-orange-700 border-orange-500/20">
                            GA
                          </Badge>
                        )}
                        {lead.sinais.has_gtm && (
                          <Badge variant="outline" className="px-2 py-0 text-xs bg-purple-500/10 text-purple-700 border-purple-500/20">
                            GTM
                          </Badge>
                        )}
                        {!lead.sinais.has_whatsapp_on_site && 
                         !lead.sinais.has_meta_pixel && 
                         !lead.sinais.has_gtag && 
                         !lead.sinais.has_gtm && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell className="px-3 py-3 align-top">
                      <div className="flex min-w-0 flex-col items-center gap-2">
                        {lead.probabilidade_conversao > 0 ? (
                          <>
                            <div className={`text-xl font-bold ${getProbabilidadeColor(lead.probabilidade_conversao)}`}>
                              {lead.probabilidade_conversao}%
                            </div>
                            <Progress 
                              value={lead.probabilidade_conversao} 
                              className="h-2 w-24"
                            />
                          </>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex flex-col items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => reanalyzeLead(lead, "leads_list")}
                                    disabled={reanalyzingLeads.has(lead.id) || !canAnalyzeAI}
                                    className={`h-8 whitespace-nowrap text-xs ${
                                      isFree && aiUsed === 0 && lead.id === firstAnalyzableLead?.id
                                        ? "border-emerald-500 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 animate-pulse font-semibold"
                                        : ""
                                    }`}
                                  >
                                    {reanalyzingLeads.has(lead.id) ? (
                                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                      <Zap className="h-3 w-3 mr-1" />
                                    )}
                                    Gerar abordagem com IA
                                  </Button>
                                  {isFree && aiUsed === 0 && lead.id === firstAnalyzableLead?.id && (
                                    <span className="text-[10px] text-emerald-600 font-medium whitespace-nowrap bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 animate-pulse">
                                      Use 1 das suas 3 análises grátis
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              {!canAnalyzeAI && (
                                <TooltipContent>
                                  <p>Você atingiu seu limite de análises com IA.</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell className="px-3 py-3 align-top">
                      <div className="min-w-0 max-w-full">
                        {lead.plano_prospecao_7dias.length > 0 ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="shrink-0 text-xs">
                                Dia 1
                              </Badge>
                              <Badge 
                                variant={lead.plano_prospecao_7dias[0].canal === "whatsapp" ? "default" : "secondary"}
                                className="shrink-0 text-xs"
                              >
                                {lead.plano_prospecao_7dias[0].canal === "whatsapp" ? (
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                ) : (
                                  "📧"
                                )}
                                {lead.plano_prospecao_7dias[0].canal}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {lead.plano_prospecao_7dias[0].mensagem}
                            </p>
                          </div>
                        ) : (
                          <span className="line-clamp-2 text-xs text-muted-foreground">
                            Clique em Gerar abordagem com IA para gerar o plano.
                          </span>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell className="px-3 py-3 align-top">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPlanDialog(lead)}
                          disabled={lead.plano_prospecao_7dias.length === 0}
                          className="h-8 whitespace-nowrap px-2.5"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver Plano
                        </Button>
                        <Button
                          variant={lead.salvo ? "default" : "ghost"}
                          size="sm"
                          onClick={() => toggleSaveLead(lead)}
                          title={lead.salvo ? "Desmarcar lead" : "Salvar lead"}
                          className="h-8 w-8 p-0"
                        >
                          {lead.salvo ? (
                            <Archive className="h-4 w-4" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteLead(lead.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                
                {/* Leads bloqueados com blur */}
                {!isAdmin && lockedLeads.length > 0 && (
                  <>
                    {/* Linha separadora */}
                    <TableRow>
                      <TableCell colSpan={6} className="p-0 h-0 border-t-2 border-dashed border-primary/30" />
                    </TableRow>
                    
                    {/* Container dos leads bloqueados */}
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <div className="relative">
                          {/* Preview dos leads borrados */}
                          <div className="blur-sm opacity-40 pointer-events-none select-none">
                            <Table>
                              <TableBody>
                                {lockedLeads.slice(0, 3).map((lead) => (
                                  <TableRow key={lead.id} className="border-0">
                                    <TableCell>
                                      <div className="space-y-1 min-w-[200px]">
                                        <p className="font-medium">{lead.nome}</p>
                                        {lead.endereco && (
                                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <MapPin className="h-3 w-3" />
                                            <span className="line-clamp-1">{lead.endereco}</span>
                                          </div>
                                        )}
                                        {lead.rating && (
                                          <div className="flex items-center gap-1">
                                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                            <span className="text-xs">{lead.rating}</span>
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="space-y-1 min-w-[150px]">
                                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                          <Phone className="h-3 w-3" />
                                          <span>••••••••••</span>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-1">
                                        <Badge variant="outline" className="text-xs">•••</Badge>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-col items-center">
                                        <div className="text-2xl font-bold text-muted-foreground">??%</div>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <p className="text-xs text-muted-foreground">•••••••••••••</p>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-2 justify-center">
                                        <Button variant="outline" size="sm" disabled>
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          
                          {/* Overlay com botão de upgrade */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-[2px]">
                            <div className="text-center space-y-4 p-6 max-w-md">
                              <div className="flex justify-center">
                                <div className="p-3 rounded-full bg-emerald-500/10">
                                  <Lock className="h-8 w-8 text-emerald-500" />
                                </div>
                              </div>
                              <h3 className="text-lg font-semibold">
                                +{totalLocked || lockedLeads.length} leads disponíveis
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Encontramos mais empresas nesta busca! Faça upgrade para desbloquear todos os leads.
                              </p>
                              <Button 
                                onClick={() => {
                                  setUpgradeSource(isEstado1Onboarding ? "after_search" : "limit_reached");
                                  setShowUpgradeDialog(true);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                              >
                                <Zap className="h-4 w-4" />
                                Fazer Upgrade Agora
                              </Button>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  </>
                )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card de Upsell por Quantidade Real */}
      {!isAdmin && (
        <UpsellCard 
          leadsOcultos={totalLocked} 
          onUpgrade={() => {
            setUpgradeSource(isEstado1Onboarding ? "after_search" : "limit_reached");
            setShowUpgradeDialog(true);
          }} 
        />
      )}

      <LeadPlanDialog
        lead={selectedLead}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onLeadUpdate={() => {
          // Recarrega os leads após reanálise
          window.location.reload();
        }}
      />
      
      <UpgradePlanDialog 
        open={showUpgradeDialog} 
        onOpenChange={setShowUpgradeDialog}
        currentPlanName={subscription?.plan_name}
        source={upgradeSource}
      />
    </>
  );
};
