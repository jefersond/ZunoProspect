import { useState } from "react";
import {
  Brain,
  Check,
  Copy,
  Instagram,
  Mail,
  MessageSquare,
  RefreshCw,
  Target,
  CheckCircle2,
  AlertCircle,
  Eye,
  FlaskConical,
  ArrowRight,
  ShieldAlert,
  ListChecks,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { trackMetaCustomEvent } from "@/lib/metaPixel";
import { copyToClipboard } from "@/utils/templateUtils";
import type { LeadProspeccao, PlanoProspeccaoDia } from "@/types/lead";
import { calculateLeadCompatibilityScore } from "@/services/leadCompatibilityScore";
import { isZunoNextLabActiveForUser } from "@/services/zunoNextLab";
import {
  buildIntelligentSevenDayPlan,
  loadSevenDayExecutionState,
  toggleSevenDayStepCompletion,
} from "@/services/intelligentSevenDayPlan";
import type { SdrApproachStyle } from "@/services/sdrProspectingService";
import { LeadCommercialDossier } from "./LeadCommercialDossier";

interface LeadAnalysisProps {
  diagnostico: string[] | null;
  probabilidade: number | null;
  plano: PlanoProspeccaoDia[] | null;
  geradoEm: string | null;
  onReanalyze?: () => void;
  isReanalyzing?: boolean;
  canAnalyzeAI?: boolean;
  lead?: LeadProspeccao | null;
}

export const LeadAnalysis = ({
  diagnostico,
  plano,
  geradoEm,
  onReanalyze,
  isReanalyzing,
  canAnalyzeAI = true,
  lead,
}: LeadAnalysisProps) => {
  const [copiedDia, setCopiedDia] = useState<number | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<SdrApproachStyle>("consultivo");
  const [completedVersion, setCompletedVersion] = useState<number>(0);
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const isLabActive = isZunoNextLabActiveForUser(user, profile);

  const handleCopyMessage = async (dia: number, mensagem: string, channel: PlanoProspeccaoDia["canal"]) => {
    const success = await copyToClipboard(mensagem);
    if (!success) return;

    setCopiedDia(dia);
    trackMetaCustomEvent("AI_Message_Copied", { channel });
    toast({
      title: "Copiado!",
      description: `Mensagem do Dia ${dia} copiada`,
    });
    setTimeout(() => setCopiedDia(null), 2000);
  };

  const renderAiLimitTooltip = () =>
    !canAnalyzeAI ? (
      <TooltipContent>
        <p>Você usou todas as análises IA grátis. Escolha um plano para continuar gerando abordagens.</p>
      </TooltipContent>
    ) : null;

  const renderFallbackRefineButton = () => {
    if (!onReanalyze || lead) return null;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                onClick={onReanalyze}
                disabled={isReanalyzing}
                variant="outline"
                size="sm"
                className={
                  !canAnalyzeAI
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 font-semibold transition-all duration-200"
                    : ""
                }
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isReanalyzing ? "animate-spin" : ""}`} />
                {isReanalyzing ? "Refinando..." : canAnalyzeAI ? "Refinar com IA" : "Liberar análises IA"}
              </Button>
            </span>
          </TooltipTrigger>
          {renderAiLimitTooltip()}
        </Tooltip>
      </TooltipProvider>
    );
  };

  if (!diagnostico || !plano) {
    return (
      <div className="space-y-4 mt-4">
        <Card>
          <CardContent className="py-6 text-center space-y-3">
            <p className="text-muted-foreground">Análise de oportunidade ainda não gerada para este lead</p>
            {renderFallbackRefineButton()}
          </CardContent>
        </Card>
      </div>
    );
  }

  const compatibility = calculateLeadCompatibilityScore(lead || {}, {
    userServiceName: lead?.foco,
  });

  // Se o Laboratório Admin estiver ativo, usa o motor inteligente de 7 dias com continuidade real
  const userId = user?.id || "admin_default";
  const leadId = lead?.id || lead?.nome || "lead_default";
  const execState = isLabActive && completedVersion >= 0
    ? loadSevenDayExecutionState(userId, leadId, lead || {})
    : null;

  const intelligentPlan = isLabActive && lead
    ? buildIntelligentSevenDayPlan({
        lead,
        userServiceName: lead.foco && lead.foco !== "zuno_internal_prospecting" ? lead.foco : undefined,
        preferredStyle: selectedStyle,
        existingPlan: plano,
        executionState: execState,
      })
    : null;

  const displayDays: PlanoProspeccaoDia[] = intelligentPlan ? intelligentPlan.days : plano;

  const handleToggleDayComplete = (dayNum: number, currentlyDone: boolean) => {
    if (!isLabActive) return;
    toggleSevenDayStepCompletion({
      userId,
      leadId,
      dayNumber: dayNum,
      completed: !currentlyDone,
      lead: lead || {},
    });
    setCompletedVersion((v) => v + 1);
    toast({
      title: !currentlyDone ? `Dia ${dayNum} marcado como concluído` : `Dia ${dayNum} reaberto`,
      description: "Progresso do Plano Inteligente de 7 Dias atualizado.",
    });
  };

  const getScoreColorClass = (score: number) => {
    if (score >= 70) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
    if (score >= 40) return "text-amber-500 bg-amber-500/10 border-amber-500/30";
    return "text-zinc-400 bg-zinc-500/10 border-zinc-500/30";
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Selo do Laboratório Zuno (Exclusivo Admin) */}
      {isLabActive && lead && (
        <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-xs font-bold text-amber-500 uppercase tracking-wide">
              LABORATÓRIO ZUNO — Funcionalidades em teste
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Dossiê Comercial + Plano Inteligente de 7 Dias ativos apenas para Admin
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Painel de Análise e Diagnóstico */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Brain className="h-5 w-5 text-emerald-500" />
                  Análise Comercial de Oportunidade
                </CardTitle>
                {geradoEm && (
                  <CardDescription className="text-xs mt-1">
                    Gerado em {new Date(geradoEm).toLocaleDateString("pt-BR")}
                  </CardDescription>
                )}
              </div>
              {onReanalyze && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          onClick={onReanalyze}
                          disabled={isReanalyzing}
                          variant="outline"
                          size="sm"
                          className={
                            !canAnalyzeAI
                              ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 font-semibold transition-all duration-200"
                              : ""
                          }
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${isReanalyzing ? "animate-spin" : ""}`} />
                          {isReanalyzing ? "Refinando..." : canAnalyzeAI ? "Refinar com IA" : "Liberar análises IA"}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {renderAiLimitTooltip()}
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <CardDescription className="text-xs">
              Sinais e recomendações práticas ancoradas na presença pública da empresa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {diagnostico.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm leading-relaxed">
                  <span className="text-emerald-500 font-bold mt-0.5">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Painel do Índice de Compatibilidade Comercial (Explicável 0-100) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-emerald-500" />
              Índice de Compatibilidade Comercial
            </CardTitle>
            <CardDescription className="text-xs">
              Mapeamento de 0 a 100 baseado em dados comerciais observáveis
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6 text-center space-y-3">
            <div
              className={`text-6xl font-extrabold ${
                compatibility.score >= 70
                  ? "text-emerald-500"
                  : compatibility.score >= 40
                  ? "text-amber-500"
                  : "text-zinc-400"
              }`}
            >
              {compatibility.score}
              <span className="text-2xl font-medium text-muted-foreground">/100</span>
            </div>
            <Badge
              className={`px-3 py-1 text-xs font-semibold ${getScoreColorClass(compatibility.score)}`}
              variant="outline"
            >
              {compatibility.ratingLevel === "alta"
                ? "Alta Compatibilidade Comercial"
                : compatibility.ratingLevel === "media"
                ? "Compatibilidade Moderada"
                : "Dados Cadastrais Limitados"}
            </Badge>
            <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">
              Calculado a partir de canais de contato, presença web e nicho. Não representa probabilidade estatística de fechamento.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detalhamento Explicável: Motivos, Dados Utilizados e Não Verificados */}
      <Card className="border border-border/70 bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Eye className="h-4 w-4 text-emerald-500" />
            Transparência da Nota — Como este índice foi calculado
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="space-y-2 p-3 rounded-md border border-border/50 bg-background/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>Principais Motivos da Nota</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-muted-foreground">
              {compatibility.motivos.slice(0, 4).map((m, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2 p-3 rounded-md border border-border/50 bg-background/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Check className="h-3.5 w-3.5 text-blue-500" />
              <span>Dados Reais Utilizados</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-muted-foreground">
              {compatibility.dadosUtilizados.slice(0, 4).map((d, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2 p-3 rounded-md border border-border/50 bg-background/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              <span>Informações Não Verificadas</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-muted-foreground">
              {compatibility.dadosNaoVerificados.slice(0, 4).map((nv, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>{nv}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Dossiê Comercial por Empresa (Ativo no Laboratório Admin) */}
      {isLabActive && lead && (
        <LeadCommercialDossier
          lead={lead}
          userServiceName={lead.foco && lead.foco !== "zuno_internal_prospecting" ? lead.foco : undefined}
        />
      )}

      {/* Plano Inteligente de 7 Dias / Copies Prontas */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-emerald-500" />
                {isLabActive
                  ? "Plano Inteligente de 7 Dias (Adaptativo por Histórico)"
                  : "Abordagens Comerciais Preparadas (Plano de 7 Dias)"}
              </CardTitle>
              <CardDescription>
                {intelligentPlan
                  ? `${intelligentPlan.historyStageLabel} • ${intelligentPlan.resumoContinuidade}`
                  : "Mensagens contextuais para WhatsApp, Instagram e e-mail com ancoragem em fatos observáveis"}
              </CardDescription>
            </div>

            {isLabActive && (
              <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-md border border-border/60">
                <Button
                  type="button"
                  size="sm"
                  variant={selectedStyle === "consultivo" ? "default" : "ghost"}
                  onClick={() => setSelectedStyle("consultivo")}
                  className="h-7 text-[11px] px-2"
                >
                  Consultivo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={selectedStyle === "direto" ? "default" : "ghost"}
                  onClick={() => setSelectedStyle("direto")}
                  className="h-7 text-[11px] px-2"
                >
                  Direto
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={selectedStyle === "exemplo_pratico" ? "default" : "ghost"}
                  onClick={() => setSelectedStyle("exemplo_pratico")}
                  className="h-7 text-[11px] px-2"
                >
                  Exemplo Prático
                </Button>
              </div>
            )}
          </div>

          {intelligentPlan && (
            <div
              className={`mt-2 p-3 rounded-md border text-xs flex items-start gap-2 ${
                intelligentPlan.isOptedOutOrRefused
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-emerald-500/30 bg-emerald-500/10 text-foreground"
              }`}
            >
              {intelligentPlan.isOptedOutOrRefused ? (
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <ArrowRight className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-bold">Próxima Ação Recomendada: </span>
                <span>{intelligentPlan.proximaAcaoGlobal}</span>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {displayDays.map((dia) => {
              const isDone = dia.status_dia === "concluido";
              const isAdapted = dia.status_dia === "adaptado";
              const isBlocked = dia.status_dia === "bloqueado_optout";
              const isCurrent = intelligentPlan?.currentRecommendedDay === dia.dia;

              return (
                <div
                  key={dia.dia}
                  className={`space-y-3 p-3 rounded-lg border transition-all ${
                    isCurrent
                      ? "border-emerald-500/50 bg-emerald-500/5"
                      : isBlocked
                      ? "border-destructive/30 bg-destructive/5 opacity-80"
                      : "border-transparent"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-semibold">
                        Dia {dia.dia}
                      </Badge>
                      <Badge
                        variant={
                          dia.canal === "whatsapp"
                            ? "default"
                            : dia.canal === "instagram"
                            ? "outline"
                            : "secondary"
                        }
                        className="gap-1"
                      >
                        {dia.canal === "whatsapp" ? (
                          <MessageSquare className="h-3 w-3" />
                        ) : dia.canal === "instagram" ? (
                          <Instagram className="h-3 w-3" />
                        ) : (
                          <Mail className="h-3 w-3" />
                        )}
                        {dia.canal === "whatsapp" ? "WhatsApp" : dia.canal === "instagram" ? "Instagram" : "Email"}
                      </Badge>

                      {dia.titulo_dia && (
                        <span className="text-xs font-bold text-foreground">{dia.titulo_dia}</span>
                      )}

                      {isCurrent && !isBlocked && (
                        <Badge className="bg-emerald-600 text-white text-[10px]">Etapa Atual</Badge>
                      )}
                      {isAdapted && (
                        <Badge variant="outline" className="border-blue-500/40 text-blue-400 text-[10px]">
                          Adaptado pelo Histórico
                        </Badge>
                      )}
                      {isDone && (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 text-[10px]">
                          Concluído
                        </Badge>
                      )}
                    </div>

                    {isLabActive && !isBlocked && (
                      <Button
                        type="button"
                        variant={isDone ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => handleToggleDayComplete(dia.dia, isDone)}
                        className="h-7 text-[11px] gap-1"
                      >
                        <ListChecks className="h-3.5 w-3.5" />
                        {isDone ? "Concluído ✓" : "Marcar dia concluído"}
                      </Button>
                    )}
                  </div>

                  <div className="pl-2 sm:pl-4 space-y-2.5 text-sm">
                    {dia.adaptation_reason && (
                      <div className="p-2.5 rounded-md border border-blue-500/30 bg-blue-500/10 text-xs text-blue-300">
                        <strong>Por que esta etapa foi adaptada:</strong> {dia.adaptation_reason}
                      </div>
                    )}

                    {(dia.objetivo || dia.goal) && (
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-md border border-slate-200 dark:border-slate-800">
                        <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">
                          Objetivo comercial:
                        </p>
                        <p className="text-sm text-slate-900 dark:text-slate-200 font-medium">
                          {dia.objetivo || dia.goal}
                        </p>
                      </div>
                    )}

                    {dia.acao_sugerida && (
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-md border border-emerald-200 dark:border-emerald-800 space-y-1.5">
                        <div>
                          <p className="font-semibold text-emerald-700 dark:text-emerald-400 text-xs">
                            Ação recomendada:
                          </p>
                          <p className="text-sm text-emerald-900 dark:text-emerald-300 font-medium">
                            {dia.acao_sugerida}
                          </p>
                        </div>
                        {dia.explicacao_tarefa && (
                          <p className="text-xs text-muted-foreground pt-1 border-t border-emerald-500/20">
                            <strong>Como executar:</strong> {dia.explicacao_tarefa}
                          </p>
                        )}
                      </div>
                    )}

                    {isLabActive && dia.informacoes_necessarias && dia.informacoes_necessarias.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded border border-border/60 bg-muted/20">
                          <span className="font-semibold text-foreground block mb-1">
                            Informações utilizadas nesta etapa:
                          </span>
                          <ul className="space-y-0.5 text-muted-foreground">
                            {dia.informacoes_necessarias.map((info, i) => (
                              <li key={i}>• {info}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-2.5 rounded border border-border/60 bg-muted/20 space-y-1">
                          {dia.criterio_conclusao && (
                            <p className="text-muted-foreground">
                              <strong className="text-foreground">Critério de conclusão:</strong>{" "}
                              {dia.criterio_conclusao}
                            </p>
                          )}
                          {dia.proxima_acao_sugerida && (
                            <p className="text-muted-foreground">
                              <strong className="text-foreground">Próxima ação:</strong>{" "}
                              {dia.proxima_acao_sugerida}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="bg-primary/5 p-3 rounded-md border border-primary/10 relative">
                      <div className="flex items-start justify-between">
                        <p className="font-medium text-primary mb-1">
                          Mensagem personalizada ({selectedStyle.replace("_", " ")}):
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isBlocked}
                          onClick={() => handleCopyMessage(dia.dia, dia.mensagem, dia.canal)}
                          className="h-7 w-7 p-0 -mt-1 -mr-1"
                        >
                          {copiedDia === dia.dia ? (
                            <Check className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="whitespace-pre-wrap pr-6">{dia.mensagem}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="bg-amber-50 dark:bg-amber-950/20 p-2 rounded border border-amber-200 dark:border-amber-800">
                        <p className="font-medium text-amber-700 dark:text-amber-400 text-xs mb-1">
                          Possível objeção:
                        </p>
                        <p className="text-xs text-amber-900 dark:text-amber-300">{dia.objecao_provavel}</p>
                      </div>

                      <div className="bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded border border-emerald-200 dark:border-emerald-800">
                        <p className="font-medium text-emerald-700 dark:text-emerald-400 text-xs mb-1">
                          Resposta sugerida:
                        </p>
                        <p className="text-xs text-emerald-900 dark:text-emerald-300">{dia.resposta_sugerida}</p>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-950/20 p-2 rounded border border-blue-200 dark:border-blue-800">
                      <p className="font-medium text-blue-700 dark:text-blue-400 text-xs mb-1">CTA:</p>
                      <p className="text-xs text-blue-900 dark:text-blue-300">{dia.cta}</p>
                    </div>
                  </div>

                  {dia.dia < 7 && <Separator className="my-4" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
