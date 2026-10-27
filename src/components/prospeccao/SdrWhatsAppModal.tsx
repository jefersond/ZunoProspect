import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  ExternalLink,
  Phone,
  Copy,
  Check,
  Building2,
  MapPin,
  Sparkles,
  Globe,
  Loader2,
  CalendarCheck,
  ThumbsUp,
  MessageCircle,
  XCircle,
  AlertTriangle,
  Mail,
  Instagram,
  Save,
  Pencil,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import type { LeadProspeccao, PlanoProspeccaoDia } from "@/types/lead";
import {
  sanitizeBrazilianPhoneNumber,
  updateSdrProspectingStatus,
  type SdrProspectingStatus,
} from "@/services/sdrProspectingService";
import {
  buildIntelligentPlan,
  hasExplicitOptOut,
  extractEmailSubjectAndBody,
} from "@/services/intelligentSevenDayPlan";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useUsage } from "@/hooks/useUsage";

interface SdrWhatsAppModalProps {
  lead: LeadProspeccao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdated?: (leadId: string, newStatus: string) => void;
  onRequestRefine?: (lead: LeadProspeccao) => void;
  initialDay?: number;
}

export const SdrWhatsAppModal: React.FC<SdrWhatsAppModalProps> = ({
  lead,
  open,
  onOpenChange,
  onStatusUpdated,
  onRequestRefine,
  initialDay = 1,
}) => {
  const { toast } = useToast();
  const { subscription, isAdmin: subscriptionIsAdmin } = useSubscription();
  const { usage, isAdmin: usageIsAdmin } = useUsage();
  const isAdmin = Boolean(subscriptionIsAdmin || usageIsAdmin);

  const [userService, setUserService] = useState<string>("gestão de tráfego e presença digital");
  const [selectedDay, setSelectedDay] = useState<number>(initialDay || 1);
  const [customPhone, setCustomPhone] = useState<string>("");
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(false);
  const [copiedSubject, setCopiedSubject] = useState<boolean>(false);
  const [copiedMessage, setCopiedMessage] = useState<boolean>(false);
  const [currentStepStatus, setCurrentStepStatus] = useState<SdrProspectingStatus>("preparado");
  const [isSavingStatus, setIsSavingStatus] = useState<boolean>(false);
  const [isSavingPlan, setIsSavingPlan] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");

  // Mensagens editadas em memória indexadas pelo número do dia (1 a 7)
  const [editedDaysMessage, setEditedDaysMessage] = useState<Record<number, string>>({});
  const [editedDaysSubject, setEditedDaysSubject] = useState<Record<number, string>>({});

  // Recupera o serviço do contexto salvo
  useEffect(() => {
    if (lead) {
      try {
        const savedCtx = localStorage.getItem("zuno_last_search_context");
        if (savedCtx) {
          const parsed = JSON.parse(savedCtx);
          if (parsed.focus && parsed.focus !== "zuno_internal_prospecting") {
            setUserService(parsed.focus);
          } else if (lead.foco && lead.foco !== "zuno_internal_prospecting") {
            setUserService(lead.foco);
          }
        } else if (lead.foco && lead.foco !== "zuno_internal_prospecting") {
          setUserService(lead.foco);
        }
      } catch {
        if (lead.foco && lead.foco !== "zuno_internal_prospecting") {
          setUserService(lead.foco);
        }
      }

      const initialPhone = lead.whatsapp_number || lead.telefone || "";
      setCustomPhone(initialPhone);
      setCurrentStepStatus(
        lead.status === "em_contato"
          ? "contato_realizado"
          : lead.status === "abertura_iniciada"
          ? "abertura_iniciada"
          : lead.status === "respondeu"
          ? "respondeu"
          : lead.status === "qualificacao"
          ? "interessado"
          : lead.status === "negociacao"
          ? "reuniao_marcada"
          : "preparado"
      );
      setNotes("");
      setIsEditingPhone(false);
      setEditedDaysMessage({});
      setEditedDaysSubject({});
    }
  }, [lead]);

  // Constrói ou recupera o plano de 7 dias com base na fonte única de verdade
  const planResult = useMemo(() => {
    if (!lead) return null;
    return buildIntelligentPlan({
      lead,
      userServiceName: userService,
      existingPlan: lead.plano_prospecao_7dias,
    });
  }, [lead, userService]);

  // Atualiza o dia selecionado quando abre o modal ou muda o lead
  useEffect(() => {
    if (open && planResult) {
      if (initialDay && initialDay >= 1 && initialDay <= 7) {
        setSelectedDay(initialDay);
      } else if (planResult.currentRecommendedDay) {
        setSelectedDay(planResult.currentRecommendedDay);
      } else {
        setSelectedDay(1);
      }
    }
  }, [open, lead?.id, initialDay, planResult?.currentRecommendedDay]);

  if (!isAdmin || !lead || !planResult) return null;

  const isOptedOut = hasExplicitOptOut(lead) || planResult.isOptedOutOrRefused;
  const currentDayData = planResult.days.find((d) => d.dia === selectedDay) || planResult.days[0];
  const phoneSanitized = sanitizeBrazilianPhoneNumber(customPhone);

  // Mensagem e assunto ativos (respeitando edições manuais salvas em memória)
  const parsedEmail = extractEmailSubjectAndBody(currentDayData?.mensagem || "");
  const currentSubject = editedDaysSubject[selectedDay] !== undefined
    ? editedDaysSubject[selectedDay]
    : (currentDayData?.assunto_email || parsedEmail.subject || `Contato comercial - ${lead.nome}`);

  const rawMessageFromPlan = currentDayData?.canal === "email"
    ? parsedEmail.body
    : currentDayData?.mensagem || "";

  const activeMessage = editedDaysMessage[selectedDay] !== undefined
    ? editedDaysMessage[selectedDay]
    : rawMessageFromPlan;

  const currentChannel = currentDayData?.canal || "whatsapp";

  const handleCopySubject = async () => {
    try {
      await navigator.clipboard.writeText(currentSubject);
      setCopiedSubject(true);
      toast({
        title: "Assunto copiado!",
        description: "Assunto do e-mail copiado para a área de transferência.",
      });
      setTimeout(() => setCopiedSubject(false), 2000);
    } catch {
      toast({
        variant: "destructive",
        title: "Erro ao copiar",
        description: "Não foi possível copiar para a área de transferência.",
      });
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(activeMessage);
      setCopiedMessage(true);
      toast({
        title: "Mensagem copiada!",
        description: `Mensagem do Dia ${selectedDay} copiada com sucesso.`,
      });
      setTimeout(() => setCopiedMessage(false), 2000);
    } catch {
      toast({
        variant: "destructive",
        title: "Erro ao copiar",
        description: "Não foi possível copiar para a área de transferência.",
      });
    }
  };

  const handleOpenWhatsApp = async () => {
    if (!isAdmin) {
      toast({
        variant: "destructive",
        title: "Acesso restrito",
        description: "O SDR está em fase de testes e restrito a administradores.",
      });
      return;
    }

    if (isOptedOut) {
      toast({
        variant: "destructive",
        title: "Contato bloqueado por Opt-out",
        description: "Esta empresa solicitou não receber contatos. Envio proibido.",
      });
      return;
    }

    if (!phoneSanitized.isValid) {
      toast({
        variant: "destructive",
        title: "Telefone inválido para WhatsApp",
        description: "Insira um número válido com DDD (ex: 27999998888) para abrir a conversa.",
      });
      setIsEditingPhone(true);
      return;
    }

    const encoded = encodeURIComponent(activeMessage);
    const waUrl = `https://wa.me/${phoneSanitized.cleanNumber}?text=${encoded}`;

    window.open(waUrl, "_blank", "noopener,noreferrer");

    setCurrentStepStatus("abertura_iniciada");

    try {
      await updateSdrProspectingStatus({
        leadId: lead.id,
        status: "abertura_iniciada",
        notes: `Abertura do Dia ${selectedDay} iniciada no WhatsApp para ${phoneSanitized.formattedDisplay}`,
      });
      onStatusUpdated?.(lead.id, "abertura_iniciada");
    } catch (err) {
      console.warn("Erro ao registrar abertura iniciada:", err);
    }

    toast({
      title: "Conversa aberta no seu WhatsApp!",
      description: "Abrir o WhatsApp não confirma o envio. Envie pelo aplicativo e confirme o resultado abaixo.",
    });
  };

  const handleOpenMailto = () => {
    if (!isAdmin || isOptedOut) return;
    const recipient = lead.email || "";
    const mailtoUrl = `mailto:${recipient}?subject=${encodeURIComponent(currentSubject)}&body=${encodeURIComponent(activeMessage)}`;
    window.location.href = mailtoUrl;

    toast({
      title: "Cliente de e-mail aberto!",
      description: "Revise e envie pelo seu provedor de e-mail.",
    });
  };

  const handleOpenInstagram = () => {
    if (!isAdmin || isOptedOut || !lead.instagram_url) return;
    window.open(lead.instagram_url, "_blank", "noopener,noreferrer");
    toast({
      title: "Perfil do Instagram aberto!",
      description: "Copie a mensagem e envie via Direct.",
    });
  };

  const handleResetDayToStandard = () => {
    if (!lead) return;
    const standardPlan = buildIntelligentPlan({
      lead,
      userServiceName: lead.foco,
      forceUpdateOldCopies: true,
    });
    const standardDay = standardPlan.days.find((d) => d.dia === selectedDay);
    if (standardDay) {
      setEditedDaysMessage((prev) => ({
        ...prev,
        [selectedDay]: standardDay.mensagem,
      }));
      if (standardDay.assunto_email) {
        setEditedDaysSubject((prev) => ({
          ...prev,
          [selectedDay]: standardDay.assunto_email!,
        }));
      }
      toast({
        title: "Padrão restaurado",
        description: `Mensagem do Dia ${selectedDay} redefinida para a copy padrão humana.`,
      });
    }
  };

  const handleSavePlanEdits = async () => {
    if (!isAdmin || !lead) return;
    setIsSavingPlan(true);
    try {
      const updatedDays: PlanoProspeccaoDia[] = planResult.days.map((d) => {
        if (d.dia === selectedDay) {
          const finalMsg = d.canal === "email" && currentSubject
            ? `Assunto: ${currentSubject}\n\n${activeMessage}`
            : activeMessage;
          return {
            ...d,
            mensagem: finalMsg,
            assunto_email: d.canal === "email" ? currentSubject : d.assunto_email,
          };
        }
        return d;
      });

      const { error } = await supabase
        .from("leads")
        .update({
          plano_prospeccao: updatedDays,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id);

      if (error) throw error;

      toast({
        title: "Mensagem salva no plano!",
        description: `As edições do Dia ${selectedDay} foram salvas com sucesso.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar alterações no plano.";
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: msg,
      });
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleConfirmResult = async (newResult: SdrProspectingStatus) => {
    if (!isAdmin) {
      toast({
        variant: "destructive",
        title: "Acesso restrito",
        description: "O SDR está em fase de testes e restrito a administradores.",
      });
      return;
    }
    setIsSavingStatus(true);
    try {
      const res = await updateSdrProspectingStatus({
        leadId: lead.id,
        status: newResult,
        notes: notes.trim() || undefined,
      });

      if (!res.success) {
        throw new Error(res.error || "Falha ao registrar resultado.");
      }

      setCurrentStepStatus(newResult);
      let mappedDbStatus = "em_contato";
      if (newResult === "respondeu") mappedDbStatus = "respondeu";
      else if (newResult === "interessado") mappedDbStatus = "qualificacao";
      else if (newResult === "reuniao_marcada") mappedDbStatus = "negociacao";
      else if (newResult === "sem_resposta") mappedDbStatus = "em_contato";
      else if (newResult === "descartado" || newResult === "recusou_optout") mappedDbStatus = "perdido";

      onStatusUpdated?.(lead.id, mappedDbStatus);

      toast({
        title: "Resultado registrado no CRM!",
        description: `Status atualizado para: ${getResultLabel(newResult)}`,
      });

      if (newResult !== "abertura_iniciada") {
        setTimeout(() => onOpenChange(false), 1200);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido ao salvar status.";
      toast({
        variant: "destructive",
        title: "Erro ao salvar resultado",
        description: msg,
      });
    } finally {
      setIsSavingStatus(false);
    }
  };

  const getResultLabel = (res: SdrProspectingStatus): string => {
    switch (res) {
      case "abertura_iniciada":
        return "Abertura iniciada";
      case "contato_realizado":
        return "Contato realizado";
      case "respondeu":
        return "Respondeu";
      case "interessado":
        return "Interessado";
      case "reuniao_marcada":
        return "Reunião marcada";
      case "sem_resposta":
        return "Sem resposta (aguardando)";
      case "descartado":
        return "Descartado (sem fit)";
      case "recusou_optout":
        return "Recusa / Opt-out";
      default:
        return res;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 bg-background border border-border">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  Execução do Plano SDR — 7 Dias
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Interface de execução conectada diretamente ao Plano de Prospecção do lead.
                </DialogDescription>
              </div>
            </div>

            <Badge
              variant="outline"
              className={`text-xs ${
                isOptedOut
                  ? "border-destructive/40 text-destructive bg-destructive/10"
                  : "border-emerald-500/30 text-emerald-500 bg-emerald-500/5"
              }`}
            >
              {isOptedOut ? "Opt-out Ativo" : planResult.historyStageLabel}
            </Badge>
          </div>
        </DialogHeader>

        {/* Resumo da Empresa e Sinais */}
        <div className="bg-muted/40 p-3 rounded-lg border border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="font-semibold text-foreground">{lead.nome}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">{lead.nicho}</span>
            {lead.cidade && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground flex items-center gap-0.5">
                  <MapPin className="h-3 w-3" />
                  {lead.cidade}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {lead.website && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Globe className="h-2.5 w-2.5" /> Site
              </Badge>
            )}
            {phoneSanitized.isValid && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Phone className="h-2.5 w-2.5" />
                {phoneSanitized.isCellPhone ? "WhatsApp" : "Fixo"}
              </Badge>
            )}
            {lead.email && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Mail className="h-2.5 w-2.5" /> E-mail
              </Badge>
            )}
            {lead.instagram_url && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Instagram className="h-2.5 w-2.5" /> Instagram
              </Badge>
            )}
          </div>
        </div>

        {/* Alerta de Opt-Out / Recusa */}
        {isOptedOut && (
          <div className="p-3.5 bg-destructive/10 border border-destructive/30 rounded-lg text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-destructive">
              <ShieldAlert className="h-4 w-4" />
              Bloqueio de Contato Comercial Ativo (Opt-out)
            </div>
            <p className="text-muted-foreground">
              Esta empresa solicitou não receber contatos ou registrou recusa explícita. Por respeito à decisão do lead e
              às boas práticas comerciais, novas abordagens estão desativadas.
            </p>
          </div>
        )}

        {/* Seletor dos 7 Dias do Plano (Uma Única Fonte de Verdade) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground">
              Etapa do Plano (7 Dias Progressivos)
            </Label>
            <span className="text-[11px] text-muted-foreground">
              {planResult.resumoContinuidade}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {planResult.days.map((d) => {
              const isSelected = d.dia === selectedDay;
              const isBlocked = isOptedOut || d.status_dia === "bloqueado_optout";
              return (
                <Button
                  key={d.dia}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDay(d.dia)}
                  className={`h-9 px-1 text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition-all ${
                    isSelected
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                      : isBlocked
                      ? "border-destructive/30 text-destructive/80"
                      : "border-border text-foreground hover:bg-muted"
                  }`}
                >
                  <span>Dia {d.dia}</span>
                  <span className="text-[9px] font-normal opacity-80">
                    {d.canal === "whatsapp" ? "Wpp" : d.canal === "email" ? "E-mail" : "Direct"}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Detalhes do Dia Selecionado */}
        <div className="bg-muted/30 p-3 rounded-lg border border-border/50 space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              {currentChannel === "whatsapp" && <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />}
              {currentChannel === "email" && <Mail className="h-3.5 w-3.5 text-blue-500" />}
              {currentChannel === "instagram" && <Instagram className="h-3.5 w-3.5 text-purple-500" />}
              <span>{currentDayData?.titulo_dia || `Dia ${selectedDay} do Plano`}</span>
            </div>

            <Badge variant="outline" className="text-[10px] uppercase font-mono">
              Canal: {currentChannel}
            </Badge>
          </div>

          {currentDayData?.objetivo && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Objetivo:</span> {currentDayData.objetivo}
            </p>
          )}

          {currentDayData?.acao_sugerida && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Ação sugerida:</span> {currentDayData.acao_sugerida}
            </p>
          )}
        </div>

        {/* Campo do Assunto de E-mail (quando canal = email) */}
        {currentChannel === "email" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1">
                <Mail className="h-3.5 w-3.5 text-blue-500" />
                Assunto do E-mail
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopySubject}
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {copiedSubject ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {copiedSubject ? "Copiado" : "Copiar Assunto"}
              </Button>
            </div>
            <Input
              value={currentSubject}
              onChange={(e) =>
                setEditedDaysSubject((prev) => ({
                  ...prev,
                  [selectedDay]: e.target.value,
                }))
              }
              placeholder="Assunto do e-mail..."
              className="text-xs h-8"
              disabled={isOptedOut}
            />
          </div>
        )}

        {/* Campo de Telefone (quando canal = whatsapp) */}
        {currentChannel === "whatsapp" && (
          <div className="flex items-center justify-between gap-2 p-2.5 bg-muted/20 border border-border/50 rounded-lg text-xs">
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="font-medium text-foreground">Telefone de Destino:</span>
              {isEditingPhone ? (
                <Input
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  placeholder="DDD + Número (ex: 27999998888)"
                  className="h-7 w-44 text-xs font-mono"
                  autoFocus
                />
              ) : (
                <span className="font-mono text-foreground">
                  {phoneSanitized.formattedDisplay || "Não cadastrado"}
                </span>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditingPhone(!isEditingPhone)}
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3 w-3 mr-1" />
              {isEditingPhone ? "Confirmar" : "Editar"}
            </Button>
          </div>
        )}

        {/* Editor da Mensagem do Dia */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              Mensagem do Dia {selectedDay} (Edite e revise antes do contato)
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyMessage}
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {copiedMessage ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {copiedMessage ? "Copiada" : "Copiar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSavePlanEdits}
                disabled={isSavingPlan || isOptedOut}
                className="h-6 px-2 text-[11px] text-emerald-500 hover:text-emerald-400 flex items-center gap-1"
                title="Salvar alterações de texto permanentemente no plano deste lead"
              >
                {isSavingPlan ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Salvar no Plano
              </Button>
            </div>
          </div>

          <Textarea
            value={activeMessage}
            onChange={(e) =>
              setEditedDaysMessage((prev) => ({
                ...prev,
                [selectedDay]: e.target.value,
              }))
            }
            rows={5}
            disabled={isOptedOut}
            className="text-xs leading-relaxed font-sans resize-y min-h-[110px]"
          />
        </div>

        {/* Previsão de Objeção e Resposta */}
        {currentDayData?.objecao_provavel && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-md">
              <span className="font-semibold text-amber-500 block mb-0.5">Possível Objeção:</span>
              <p className="text-muted-foreground">{currentDayData.objecao_provavel}</p>
            </div>
            <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-md">
              <span className="font-semibold text-emerald-500 block mb-0.5">Resposta Recomendada:</span>
              <p className="text-muted-foreground">{currentDayData.resposta_sugerida}</p>
            </div>
          </div>
        )}

        {/* Botões de Ação por Canal */}
        <div className="space-y-2 pt-1">
          {currentChannel === "whatsapp" && (
            <Button
              type="button"
              onClick={handleOpenWhatsApp}
              disabled={isOptedOut || !phoneSanitized.isValid}
              className={`w-full h-11 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                isOptedOut
                  ? "bg-muted text-muted-foreground cursor-not-allowed border border-border"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.99]"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              {isOptedOut
                ? "Contato Bloqueado (Opt-out Registrado)"
                : `Abrir no meu WhatsApp (${phoneSanitized.formattedDisplay || "número pendente"})`}
            </Button>
          )}

          {currentChannel === "email" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCopySubject}
                className="h-10 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar Assunto
              </Button>
              <Button
                type="button"
                onClick={handleOpenMailto}
                disabled={isOptedOut}
                className="h-10 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" />
                Abrir no Meu E-mail
              </Button>
            </div>
          )}

          {currentChannel === "instagram" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyMessage}
                className="h-10 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar para Direct
              </Button>
              <Button
                type="button"
                onClick={handleOpenInstagram}
                disabled={isOptedOut || !lead.instagram_url}
                className="h-10 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <Instagram className="h-3.5 w-3.5" />
                {lead.instagram_url ? "Abrir Perfil no Instagram" : "Instagram Não Informado"}
              </Button>
            </div>
          )}

          <p className="text-[11px] text-center text-muted-foreground">
            O Zuno não dispara mensagens automáticas. Você mantém o controle manual total do envio.
          </p>
        </div>

        {/* Painel de Registro do Resultado Real no CRM */}
        <div className="mt-2 pt-3 border-t border-border space-y-2.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground">
              Registrar Resultado Real no CRM
            </Label>
            <span className="text-[11px] text-muted-foreground">
              Atual: <span className="font-medium text-foreground">{getResultLabel(currentStepStatus)}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <Button
              type="button"
              variant={currentStepStatus === "contato_realizado" ? "default" : "outline"}
              size="sm"
              disabled={isSavingStatus}
              onClick={() => handleConfirmResult("contato_realizado")}
              className="h-8 text-xs justify-start px-2 font-medium"
            >
              <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" />
              Contato Feito
            </Button>

            <Button
              type="button"
              variant={currentStepStatus === "respondeu" ? "default" : "outline"}
              size="sm"
              disabled={isSavingStatus}
              onClick={() => handleConfirmResult("respondeu")}
              className="h-8 text-xs justify-start px-2 font-medium"
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1 text-blue-500" />
              Respondeu
            </Button>

            <Button
              type="button"
              variant={currentStepStatus === "interessado" ? "default" : "outline"}
              size="sm"
              disabled={isSavingStatus}
              onClick={() => handleConfirmResult("interessado")}
              className="h-8 text-xs justify-start px-2 font-medium"
            >
              <ThumbsUp className="h-3.5 w-3.5 mr-1 text-emerald-400" />
              Interessado
            </Button>

            <Button
              type="button"
              variant={currentStepStatus === "reuniao_marcada" ? "default" : "outline"}
              size="sm"
              disabled={isSavingStatus}
              onClick={() => handleConfirmResult("reuniao_marcada")}
              className="h-8 text-xs justify-start px-2 font-medium"
            >
              <CalendarCheck className="h-3.5 w-3.5 mr-1 text-amber-500" />
              Reunião
            </Button>

            <Button
              type="button"
              variant={currentStepStatus === "sem_resposta" ? "default" : "outline"}
              size="sm"
              disabled={isSavingStatus}
              onClick={() => handleConfirmResult("sem_resposta")}
              className="h-8 text-xs justify-start px-2 font-medium text-muted-foreground"
            >
              Sem Resposta
            </Button>

            <Button
              type="button"
              variant={currentStepStatus === "descartado" ? "default" : "outline"}
              size="sm"
              disabled={isSavingStatus}
              onClick={() => handleConfirmResult("descartado")}
              className="h-8 text-xs justify-start px-2 font-medium text-muted-foreground"
            >
              <XCircle className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              Descartado
            </Button>

            <Button
              type="button"
              variant={currentStepStatus === "recusou_optout" ? "destructive" : "outline"}
              size="sm"
              disabled={isSavingStatus}
              onClick={() => handleConfirmResult("recusou_optout")}
              className="h-8 text-xs justify-start px-2 font-medium col-span-2 text-destructive border-destructive/40 hover:bg-destructive/10"
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1 text-destructive" />
              Recusa / Opt-out
            </Button>
          </div>

          <div className="space-y-1">
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotação rápida opcional (ex: pediu retorno na terça às 14h)..."
              className="h-8 text-xs"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
