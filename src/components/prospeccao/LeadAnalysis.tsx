import { useState } from "react";
import { Brain, Check, CheckCircle2, ClipboardList, Copy, Info, Instagram, Mail, MessageSquare, Phone, RefreshCw, UserCog } from "lucide-react";
import { buildAlignmentCompatibility, dayHasMessage, resolveDayType, type ExplorableCompatibility } from "@/services/intelligentSevenDayPlan";
import { NO_MESSAGE_LABEL } from "../../../supabase/functions/_shared/lead-analysis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { trackMetaCustomEvent } from "@/lib/metaPixel";
import { copyToClipboard } from "@/utils/templateUtils";
import type { LeadProspeccao, PlanoProspeccaoDia } from "@/types/lead";

interface LeadAnalysisProps {
  diagnostico: string[] | null;
  probabilidade: number | null;
  plano: PlanoProspeccaoDia[] | null;
  geradoEm: string | null;
  onReanalyze?: () => void;
  isReanalyzing?: boolean;
  canAnalyzeAI?: boolean;
  lead?: LeadProspeccao | null;
  compatibilidade?: ExplorableCompatibility | null;
  onExecuteInSdr?: (dayNumber: number) => void;
  onEditSellerProfile?: () => void;
}

export const LeadAnalysis = ({
  diagnostico,
  probabilidade,
  plano,
  geradoEm,
  onReanalyze,
  isReanalyzing,
  canAnalyzeAI = true,
  lead,
  compatibilidade,
  onExecuteInSdr,
  onEditSellerProfile,
}: LeadAnalysisProps) => {
  const [copiedDia, setCopiedDia] = useState<number | null>(null);
  const hasSavedPlan = Boolean(plano && plano.length > 0);
  const { toast } = useToast();

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

  const renderAiLimitTooltip = () => (
    !canAnalyzeAI ? (
      <TooltipContent>
        <p>Voce usou todas as analises IA gratis. Escolha um plano para continuar gerando abordagens.</p>
      </TooltipContent>
    ) : null
  );

  const renderFallbackRefineButton = () => {
    if (!onReanalyze) return null;

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
                className={!canAnalyzeAI ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 font-semibold transition-all duration-200" : ""}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isReanalyzing ? "animate-spin" : ""}`} />
                {isReanalyzing ? "Gerando..." : canAnalyzeAI ? (hasSavedPlan ? "Gerar nova versão com IA" : "Gerar análise com IA") : "Liberar analises IA"}
              </Button>
            </span>
          </TooltipTrigger>
          {renderAiLimitTooltip()}
        </Tooltip>
      </TooltipProvider>
    );
  };

  if (!diagnostico || diagnostico.length === 0 || !plano || plano.length === 0) {
    return (
      <div className="space-y-4 mt-4">
        <Card>
          <CardContent className="py-6 text-center space-y-3">
            <p className="text-muted-foreground">Analise premium de IA ainda nao gerada para este lead</p>
            {onEditSellerProfile && (
              <Button variant="ghost" size="sm" onClick={onEditSellerProfile} className="gap-1.5 text-xs">
                <UserCog className="h-3.5 w-3.5" />
                Meu perfil comercial
              </Button>
            )}
            {renderFallbackRefineButton()}
          </CardContent>
        </Card>
      </div>
    );
  }

  const getCompatibilityBadgeClass = (level?: string) => {
    if (level === "alta") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30 font-medium";
    if (level === "media") return "text-blue-400 bg-blue-500/10 border-blue-500/30 font-medium";
    if (level === "basica") return "text-amber-400 bg-amber-500/10 border-amber-500/30 font-medium";
    return "text-muted-foreground bg-muted/40 border-border/50 font-medium";
  };

  const effectiveCompat = compatibilidade || (lead ? buildAlignmentCompatibility(lead) : null);

  const getProbabilidadeColor = (prob: number) => {
    if (prob >= 70) return "text-green-600 bg-green-50 border-green-200";
    if (prob >= 40) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Brain className="h-5 w-5 text-primary" />
                  Diagnostico Comercial IA
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
                          className={!canAnalyzeAI ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 font-semibold transition-all duration-200" : ""}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${isReanalyzing ? "animate-spin" : ""}`} />
                          {isReanalyzing ? "Gerando..." : canAnalyzeAI ? (hasSavedPlan ? "Gerar nova versão com IA" : "Gerar análise com IA") : "Liberar analises IA"}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {renderAiLimitTooltip()}
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {diagnostico.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm leading-relaxed">
                  <span className="text-primary mt-0.5">-</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Alinhamento Cadastral para Abordagem
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Critérios observáveis em dados públicos (não constitui percentual estatístico de fechamento)
                </CardDescription>
              </div>
              <Badge variant="outline" className={getCompatibilityBadgeClass(effectiveCompat?.level)}>
                {effectiveCompat?.label || "Compatibilidade não determinada"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {effectiveCompat?.description || "Dados públicos insuficientes para estimar a prontidão da abordagem cadastral."}
            </p>

            <div className="space-y-2 pt-1 border-t border-border/40">
              {effectiveCompat?.criteria.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  {c.status === "atendido" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : c.status === "parcial" ? (
                    <Info className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  ) : (
                    <span className="text-muted-foreground/60 shrink-0 font-bold mt-0.5">•</span>
                  )}
                  <div className="leading-snug">
                    <span className="font-medium text-foreground">{c.label}: </span>
                    <span className="text-muted-foreground">{c.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Plano de 7 dias
          </CardTitle>
          <CardDescription>
            Plano de 7 dias gerado em uma única chamada de IA com o seu perfil comercial e os dados verificados da empresa. Nem todo dia tem mensagem: alguns são tarefas ou pausas.
            {onEditSellerProfile && (
              <button type="button" onClick={onEditSellerProfile} className="ml-1 underline underline-offset-2 hover:text-foreground">
                Editar meu perfil comercial
              </button>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {plano.map((dia) => {
              const tipo = resolveDayType(dia);
              const hasMessage = dayHasMessage(dia);
              const isFollowUp = tipo === "acompanhamento";
              return (
              <div key={dia.dia} className="space-y-3" data-testid={`dia-${dia.dia}`} data-tipo={tipo}>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="font-semibold">
                    Dia {dia.dia}
                  </Badge>
                  {dia.canal !== "nenhum" && (
                    <Badge
                      variant={dia.canal === "whatsapp" ? "default" : dia.canal === "instagram" ? "outline" : "secondary"}
                      className="gap-1"
                    >
                      {dia.canal === "whatsapp" ? (
                        <MessageSquare className="h-3 w-3" />
                      ) : dia.canal === "instagram" ? (
                        <Instagram className="h-3 w-3" />
                      ) : dia.canal === "telefone" ? (
                        <Phone className="h-3 w-3" />
                      ) : (
                        <Mail className="h-3 w-3" />
                      )}
                      {dia.canal === "whatsapp" ? "WhatsApp" : dia.canal === "instagram" ? "Instagram" : dia.canal === "telefone" ? "Ligação" : "Email"}
                    </Badge>
                  )}
                  {isFollowUp && <Badge variant="secondary">Acompanhamento</Badge>}
                  {tipo === "tarefa" && (
                    <Badge variant="secondary" className="gap-1">
                      <ClipboardList className="h-3 w-3" />
                      Tarefa
                    </Badge>
                  )}
                  {dia.is_custom_edited && <Badge variant="outline" className="text-xs">Editado por você</Badge>}
                  {hasMessage && onExecuteInSdr && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onExecuteInSdr(dia.dia)}
                      className="ml-auto h-7 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                    >
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Executar no SDR
                    </Button>
                  )}
                </div>

                <div className="pl-4 space-y-2 text-sm">
                  {(dia.objetivo || dia.goal) && (
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-md border border-slate-200 dark:border-slate-800">
                      <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">
                        Objetivo do dia:
                      </p>
                      <p className="text-sm text-slate-900 dark:text-slate-200 font-medium">
                        {dia.objetivo || dia.goal}
                      </p>
                    </div>
                  )}

                  {dia.acao_sugerida && (
                    <div className="bg-purple-50 dark:bg-purple-950/30 p-3 rounded-md border border-purple-200 dark:border-purple-800">
                      <p className="font-semibold text-purple-700 dark:text-purple-400 text-xs mb-1">
                        {hasMessage ? "Acao sugerida:" : tipo === "tarefa" ? "O que fazer:" : "Nesta etapa:"}
                      </p>
                      <p className="text-sm text-purple-900 dark:text-purple-300 font-medium whitespace-pre-wrap">
                        {dia.acao_sugerida}
                      </p>
                    </div>
                  )}

                  {dia.condicao && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 p-2 rounded border border-amber-200 dark:border-amber-800 text-xs">
                      <span className="font-semibold text-amber-700 dark:text-amber-400">Quando enviar: </span>
                      <span className="text-amber-900 dark:text-amber-300">{dia.condicao}</span>
                    </div>
                  )}

                  {!hasMessage && (
                    <div className="bg-muted/40 p-3 rounded-md border border-border/50 text-muted-foreground text-sm">
                      {NO_MESSAGE_LABEL}
                    </div>
                  )}

                  {hasMessage && dia.assunto_email && (
                    <div className="bg-slate-100 dark:bg-slate-900 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Assunto sugerido: </span>
                      <span className="text-slate-900 dark:text-slate-200 font-medium">{dia.assunto_email}</span>
                    </div>
                  )}

                  {hasMessage && (
                    <div className="bg-primary/5 p-3 rounded-md border border-primary/10 relative">
                      <div className="flex items-start justify-between">
                        <p className="font-medium text-primary mb-1">Mensagem:</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyMessage(dia.dia, dia.mensagem, dia.canal)}
                          className="h-7 w-7 p-0 -mt-1 -mr-1"
                        >
                          {copiedDia === dia.dia ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="whitespace-pre-wrap pr-6">{dia.mensagem}</p>
                    </div>
                  )}

                  {dia.justificativa && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Por que: </span>
                      {dia.justificativa}
                    </p>
                  )}

                  {hasMessage && (dia.objecao_provavel || dia.resposta_sugerida) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {dia.objecao_provavel && (
                        <div className="bg-orange-50 dark:bg-orange-950/20 p-2 rounded border border-orange-200 dark:border-orange-800">
                          <p className="font-medium text-orange-700 dark:text-orange-400 text-xs mb-1">
                            Objecao provavel:
                          </p>
                          <p className="text-xs text-orange-900 dark:text-orange-300">
                            {dia.objecao_provavel}
                          </p>
                        </div>
                      )}
                      {dia.resposta_sugerida && (
                        <div className="bg-green-50 dark:bg-green-950/20 p-2 rounded border border-green-200 dark:border-green-800">
                          <p className="font-medium text-green-700 dark:text-green-400 text-xs mb-1">
                            Resposta sugerida:
                          </p>
                          <p className="text-xs text-green-900 dark:text-green-300">
                            {dia.resposta_sugerida}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {hasMessage && dia.cta && (
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-2 rounded border border-blue-200 dark:border-blue-800">
                      <p className="font-medium text-blue-700 dark:text-blue-400 text-xs mb-1">CTA:</p>
                      <p className="text-xs text-blue-900 dark:text-blue-300">{dia.cta}</p>
                    </div>
                  )}
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
