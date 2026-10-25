import React, { useState, useEffect } from "react";
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
  Star,
  Globe,
  Loader2,
  CalendarCheck,
  ThumbsUp,
  MessageCircle,
  XCircle,
  HelpCircle,
  Pencil,
  AlertTriangle,
  Target,
} from "lucide-react";
import type { LeadProspeccao } from "@/types/lead";
import {
  generateSdrFirstApproachMessage,
  sanitizeBrazilianPhoneNumber,
  updateSdrProspectingStatus,
  checkSdrDuplicateApproach,
  type SdrApproachStyle,
  type SdrProspectingStatus,
} from "@/services/sdrProspectingService";
import { calculateLeadCompatibilityScore } from "@/services/leadCompatibilityScore";

interface SdrWhatsAppModalProps {
  lead: LeadProspeccao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdated?: (leadId: string, newStatus: string) => void;
  isSimulatedDemo?: boolean;
}

export const SdrWhatsAppModal: React.FC<SdrWhatsAppModalProps> = ({
  lead,
  open,
  onOpenChange,
  onStatusUpdated,
  isSimulatedDemo = false,
}) => {
  const { toast } = useToast();
  const isSimulated = Boolean(isSimulatedDemo || lead?.custom_fields?.is_simulated === "true");

  // Estados do formulário de abordagem
  const [userService, setUserService] = useState<string>("gestão de tráfego e presença digital");
  const [style, setStyle] = useState<SdrApproachStyle>("consultivo");
  const [customPhone, setCustomPhone] = useState<string>("");
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(false);
  const [editedMessage, setEditedMessage] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [hasOpenedWhatsApp, setHasOpenedWhatsApp] = useState<boolean>(false);
  const [currentStepStatus, setCurrentStepStatus] = useState<SdrProspectingStatus>("preparado");
  const [isSavingStatus, setIsSavingStatus] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");

  // Inicializa o serviço e o telefone a partir do lead selecionado
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
      setHasOpenedWhatsApp(lead.status === "abertura_iniciada");
      setCurrentStepStatus(
        lead.status === "em_contato"
          ? "contato_realizado"
          : lead.status === "abertura_iniciada"
          ? "abertura_iniciada"
          : "preparado"
      );
      setNotes("");
      setIsEditingPhone(false);
    }
  }, [lead]);

  // Regenera a mensagem quando o estilo, serviço ou telefone mudam
  useEffect(() => {
    if (lead) {
      const generated = generateSdrFirstApproachMessage({
        lead: {
          ...lead,
          whatsapp_number: customPhone,
          telefone: customPhone,
        },
        userServiceName: userService,
        style,
      });
      setEditedMessage(generated.text);
    }
  }, [lead, userService, style, customPhone]);

  if (!lead) return null;

  const phoneSanitized = sanitizeBrazilianPhoneNumber(customPhone);
  const duplicateCheck = checkSdrDuplicateApproach(lead);
  const compatibility = calculateLeadCompatibilityScore(lead, {
    userServiceName: userService,
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedMessage);
      setCopied(true);
      toast({
        title: "Mensagem copiada!",
        description: "Você pode colar diretamente no WhatsApp ou em outro canal.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        variant: "destructive",
        title: "Erro ao copiar",
        description: "Não foi possível copiar para a área de transferência.",
      });
    }
  };

  const handleOpenWhatsApp = async () => {
    if (isSimulated) {
      toast({
        variant: "destructive",
        title: "Modo Demonstração",
        description: "Abertura no WhatsApp bloqueada para dados de teste.",
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

    const encoded = encodeURIComponent(editedMessage);
    const waUrl = `https://wa.me/${phoneSanitized.cleanNumber}?text=${encoded}`;

    // Abre a conversa no WhatsApp do próprio assinante
    window.open(waUrl, "_blank", "noopener,noreferrer");

    // Registra imediatamente a abertura iniciada (NUNCA marca 'enviado' sem confirmação)
    setHasOpenedWhatsApp(true);
    setCurrentStepStatus("abertura_iniciada");

    try {
      await updateSdrProspectingStatus({
        leadId: lead.id,
        status: "abertura_iniciada",
        notes: `Abertura de WhatsApp iniciada para ${phoneSanitized.formattedDisplay}`,
        approachMessage: editedMessage,
      });
      onStatusUpdated?.(lead.id, "abertura_iniciada");
    } catch (err) {
      console.warn("Erro ao registrar abertura iniciada no banco:", err);
    }

    toast({
      title: "Conversa aberta no seu WhatsApp!",
      description: "Envie a mensagem por lá e confirme o resultado abaixo.",
    });
  };

  const handleConfirmResult = async (newResult: SdrProspectingStatus) => {
    setIsSavingStatus(true);
    try {
      // Se for modo demonstração, não escreve no banco
      if (isSimulated) {
        setCurrentStepStatus(newResult);
        let mappedStatus = "em_contato";
        if (newResult === "respondeu") mappedStatus = "respondeu";
        else if (newResult === "interessado") mappedStatus = "qualificacao";
        else if (newResult === "reuniao_marcada") mappedStatus = "negociacao";
        else if (newResult === "sem_resposta") mappedStatus = "em_contato";
        else if (newResult === "descartado" || newResult === "recusou_optout") mappedStatus = "perdido";

        onStatusUpdated?.(lead.id, mappedStatus);
        toast({
          title: "Resultado simulado no Laboratório",
          description: `Status atualizado para: ${getResultLabel(newResult)} (sem gravação remota)`,
        });

        if (newResult !== "abertura_iniciada") {
          setTimeout(() => onOpenChange(false), 1200);
        }
        return;
      }

      const res = await updateSdrProspectingStatus({
        leadId: lead.id,
        status: newResult,
        notes: notes.trim() || undefined,
        approachMessage: editedMessage,
      });

      if (!res.success) {
        throw new Error(res.error || "Falha ao registrar resultado.");
      }

      setCurrentStepStatus(newResult);
      let mappedDbStatus = "em_contato";
      if (newResult === "respondeu") mappedDbStatus = "respondeu";
      else if (newResult === "interessado") mappedDbStatus = "qualificacao";
      else if (newResult === "reuniao_marcada") mappedDbStatus = "negociacao";
      else if (newResult === "sem_resposta") mappedDbStatus = "em_contato"; // sem_resposta não é perdido nem opt-out!
      else if (newResult === "descartado" || newResult === "recusou_optout") mappedDbStatus = "perdido";

      onStatusUpdated?.(lead.id, mappedDbStatus);

      toast({
        title: "Resultado registrado com sucesso!",
        description: `Status atualizado para: ${getResultLabel(newResult)}`,
      });

      if (newResult !== "abertura_iniciada") {
        setTimeout(() => {
          onOpenChange(false);
        }, 1200);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Tente novamente.";
      toast({
        variant: "destructive",
        title: "Erro ao salvar resultado",
        description: message,
      });
    } finally {
      setIsSavingStatus(false);
    }
  };

  const getResultLabel = (status: SdrProspectingStatus): string => {
    switch (status) {
      case "preparado":
        return "Rascunho preparado";
      case "abertura_iniciada":
        return "Abertura iniciada no WhatsApp";
      case "contato_realizado":
        return "Contato realizado (mensagem enviada)";
      case "respondeu":
        return "Empresa respondeu";
      case "interessado":
        return "Interessado no serviço";
      case "reuniao_marcada":
        return "Reunião agendada";
      case "sem_resposta":
        return "Sem resposta (Aguardando)";
      case "descartado":
        return "Descartado (Fora de perfil)";
      case "recusou_optout":
        return "Recusa / Opt-out (Contatos interrompidos)";
      default:
        return status;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto scrollbar-zuno">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-500">
              <MessageSquare className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Prospecção Assistida SDR
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Primeira abordagem contextual no seu WhatsApp • Sem robôs • Você revisa e fecha
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Alerta de Modo Demonstração (Dados Fictícios) */}
          {isSimulated && (
            <div className="p-3 rounded-lg border border-amber-500/50 bg-amber-500/15 text-amber-300 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>SIMULAÇÃO — DADOS FICTÍCIOS, NÃO UTILIZAR PARA CONTATO.</span>
            </div>
          )}

          {/* Alerta de Abordagem Duplicada se Houver */}
          {duplicateCheck.isDuplicate && (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 text-xs flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
              <div className="space-y-0.5">
                <p className="font-semibold text-foreground">Atenção: Abordagem prévia identificada</p>
                <p className="text-muted-foreground">{duplicateCheck.reason}</p>
                <p className="text-[11px] text-muted-foreground/80">
                  Para evitar duplicidades comerciais, certifique-se de que um novo contato faz sentido para o lead.
                </p>
              </div>
            </div>
          )}

          {/* Card da Empresa Selecionada com Dados Auditados */}
          <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-base text-foreground flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-emerald-500" />
                  {lead.nome}
                </h4>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" />
                  {lead.cidade} • {lead.nicho}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-[11px] ${
                    compatibility.score >= 70
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Target className="h-3 w-3 mr-1 text-emerald-500" />
                  Compatibilidade: {compatibility.score}/100
                </Badge>
                {compatibility.isPrioritySDR && (
                  <Badge className="text-[10px] bg-emerald-600 text-white font-semibold">
                    Prioridade SDR
                  </Badge>
                )}
              </div>
            </div>

            {/* Sinais Observáveis Reais */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              {lead.rating && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                  {lead.rating}★ ({lead.total_reviews} avaliações)
                </span>
              )}

              {lead.website && (
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:underline"
                >
                  <Globe className="h-3 w-3" />
                  Site Ativo
                  <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                </a>
              )}

              {lead.sinais?.has_meta_pixel && (
                <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Pixel de Anúncios
                </span>
              )}

              {lead.sinais?.has_whatsapp_on_site && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  WhatsApp no site
                </span>
              )}
            </div>

            {/* Telefone / WhatsApp com Edição Rápida se Necessário */}
            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                {isEditingPhone ? (
                  <Input
                    type="text"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    placeholder="DDD + Número (ex: 27999998888)"
                    className="h-7 text-xs w-48"
                  />
                ) : (
                  <span className="font-mono text-foreground font-medium">
                    {phoneSanitized.formattedDisplay || "Telefone não informado"}
                  </span>
                )}
                {phoneSanitized.isValid && (
                  <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">
                    {phoneSanitized.isCellPhone ? "Celular/WhatsApp" : "Fixo Comercial"}
                  </Badge>
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
                {isEditingPhone ? "Confirmar" : "Corrigir número"}
              </Button>
            </div>
          </div>

          {/* Configuração da Primeira Abordagem */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Seu serviço oferecido</Label>
              <Input
                value={userService}
                onChange={(e) => setUserService(e.target.value)}
                placeholder="Ex: Gestão de tráfego, Criação de Sites..."
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Tom da abordagem</Label>
              <div className="grid grid-cols-3 gap-1">
                <Button
                  type="button"
                  variant={style === "consultivo" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStyle("consultivo")}
                  className="h-9 text-[11px] px-1"
                >
                  Consultivo
                </Button>
                <Button
                  type="button"
                  variant={style === "direto" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStyle("direto")}
                  className="h-9 text-[11px] px-1"
                >
                  Direto
                </Button>
                <Button
                  type="button"
                  variant={style === "exemplo_pratico" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStyle("exemplo_pratico")}
                  className="h-9 text-[11px] px-1"
                >
                  Exemplo
                </Button>
              </div>
            </div>
          </div>

          {/* Área de Edição e Aprovação da Mensagem */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                Mensagem inicial preparada pelo SDR (você pode editar livremente)
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {editedMessage.length} caracteres
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500 mr-1" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 mr-1" />
                  )}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>

            <Textarea
              value={editedMessage}
              onChange={(e) => setEditedMessage(e.target.value)}
              rows={6}
              className="font-sans text-xs sm:text-sm leading-relaxed resize-y bg-background border-border/80 focus-visible:ring-emerald-500/30"
              placeholder="Mensagem contextual gerada..."
            />

            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <HelpCircle className="h-3 w-3 shrink-0" />
              Você revisa e aprova o texto aqui. Ao clicar no botão abaixo, a conversa abre no seu WhatsApp com o texto já digitado para envio manual.
            </p>
          </div>

          {/* Botão de Disparo Humano (Abre no WhatsApp do Assinante) */}
          <div className="pt-2">
            <Button
              type="button"
              onClick={handleOpenWhatsApp}
              disabled={isSimulated || !phoneSanitized.isValid}
              className={`w-full h-11 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                isSimulated
                  ? "bg-muted text-muted-foreground cursor-not-allowed border border-border"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.99]"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              {isSimulated
                ? "Abertura no WhatsApp Bloqueada (Dados Fictícios da Simulação)"
                : `Abrir no meu WhatsApp (${phoneSanitized.formattedDisplay || "número pendente"})`}
            </Button>
          </div>

          {/* Painel de Registro do Resultado */}
          <div className="mt-4 pt-4 border-t border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">
                Registrar Resultado da Conversa
              </Label>
              <span className="text-[11px] text-muted-foreground">
                Status atual: <strong className="text-foreground">{getResultLabel(currentStepStatus)}</strong>
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Como o envio é feito manualmente pelo seu WhatsApp, selecione o que aconteceu para atualizar o CRM:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button
                type="button"
                variant={currentStepStatus === "contato_realizado" ? "default" : "outline"}
                size="sm"
                disabled={isSavingStatus}
                onClick={() => handleConfirmResult("contato_realizado")}
                className="h-8 text-xs justify-start px-2 font-medium"
              >
                <ThumbsUp className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
                Contato Realizado
              </Button>

              <Button
                type="button"
                variant={currentStepStatus === "respondeu" ? "default" : "outline"}
                size="sm"
                disabled={isSavingStatus}
                onClick={() => handleConfirmResult("respondeu")}
                className="h-8 text-xs justify-start px-2 font-medium"
              >
                <MessageCircle className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
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
                <Star className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
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
                <CalendarCheck className="h-3.5 w-3.5 mr-1.5 text-purple-500" />
                Reunião Marcada
              </Button>

              <Button
                type="button"
                variant={currentStepStatus === "sem_resposta" ? "default" : "outline"}
                size="sm"
                disabled={isSavingStatus}
                onClick={() => handleConfirmResult("sem_resposta")}
                className="h-8 text-xs justify-start px-2 font-medium"
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                Sem Resposta
              </Button>

              <Button
                type="button"
                variant={currentStepStatus === "descartado" ? "default" : "outline"}
                size="sm"
                disabled={isSavingStatus}
                onClick={() => handleConfirmResult("descartado")}
                className="h-8 text-xs justify-start px-2 font-medium text-muted-foreground hover:text-foreground"
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
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
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5 text-destructive" />
                Recusa / Opt-out
              </Button>
            </div>

            <div className="space-y-1.5 pt-1">
              <Label className="text-xs text-muted-foreground">Observação rápida (opcional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Pediu para ligar na terça às 14h..."
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
