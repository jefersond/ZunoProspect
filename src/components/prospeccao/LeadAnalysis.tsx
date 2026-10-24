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
  HelpCircle,
  Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { trackMetaCustomEvent } from "@/lib/metaPixel";
import { copyToClipboard } from "@/utils/templateUtils";
import type { LeadProspeccao, PlanoProspeccaoDia } from "@/types/lead";
import { calculateLeadCompatibilityScore } from "@/services/leadCompatibilityScore";

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
  probabilidade,
  plano,
  geradoEm,
  onReanalyze,
  isReanalyzing,
  canAnalyzeAI = true,
  lead,
}: LeadAnalysisProps) => {
  const [copiedDia, setCopiedDia] = useState<number | null>(null);
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
        <p>Você usou todas as análises IA grátis. Escolha um plano para continuar gerando abordagens.</p>
      </TooltipContent>
    ) : null
  );

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
                className={!canAnalyzeAI ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 font-semibold transition-all duration-200" : ""}
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

  // Calcula o Índice de Compatibilidade Comercial explicável (0 a 100)
  const compatibility = calculateLeadCompatibilityScore(lead || {}, {
    userServiceName: lead?.foco,
  });

  const getScoreColorClass = (score: number) => {
    if (score >= 70) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
    if (score >= 40) return "text-amber-500 bg-amber-500/10 border-amber-500/30";
    return "text-zinc-400 bg-zinc-500/10 border-zinc-500/30";
  };

  return (
    <div className="space-y-4 mt-4">
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
                          className={!canAnalyzeAI ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 font-semibold transition-all duration-200" : ""}
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
            <div className={`text-6xl font-extrabold ${compatibility.score >= 70 ? "text-emerald-500" : compatibility.score >= 40 ? "text-amber-500" : "text-zinc-400"}`}>
              {compatibility.score}<span className="text-2xl font-medium text-muted-foreground">/100</span>
            </div>
            <Badge className={`px-3 py-1 text-xs font-semibold ${getScoreColorClass(compatibility.score)}`} variant="outline">
              {compatibility.ratingLevel === "alta" ? "Alta Compatibilidade Comercial" : compatibility.ratingLevel === "media" ? "Compatibilidade Moderada" : "Dados Cadastrais Limitados"}
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
          {/* Motivos da Nota */}
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

          {/* Dados Utilizados */}
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

          {/* Informações Não Verificadas */}
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

      {/* Copies Prontas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-emerald-500" />
            Abordagens Comerciais Preparadas
          </CardTitle>
          <CardDescription>
            Mensagens contextuais para WhatsApp, Instagram e e-mail com ancoragem em fatos observáveis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {plano.map((dia) => (
              <div key={dia.dia} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-semibold">
                    Dia {dia.dia}
                  </Badge>
                  <Badge
                    variant={dia.canal === "whatsapp" ? "default" : dia.canal === "instagram" ? "outline" : "secondary"}
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
                </div>

                <div className="pl-4 space-y-2 text-sm">
                  {(dia.objetivo || dia.goal) && (
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-md border border-slate-200 dark:border-slate-800">
                      <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">
                        Objetivo do contato:
                      </p>
                      <p className="text-sm text-slate-900 dark:text-slate-200 font-medium">
                        {dia.objetivo || dia.goal}
                      </p>
                    </div>
                  )}

                  {dia.acao_sugerida && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-md border border-emerald-200 dark:border-emerald-800">
                      <p className="font-semibold text-emerald-700 dark:text-emerald-400 text-xs mb-1">
                        Ação sugerida:
                      </p>
                      <p className="text-sm text-emerald-900 dark:text-emerald-300 font-medium">
                        {dia.acao_sugerida}
                      </p>
                    </div>
                  )}

                  <div className="bg-primary/5 p-3 rounded-md border border-primary/10 relative">
                    <div className="flex items-start justify-between">
                      <p className="font-medium text-primary mb-1">Mensagem sugerida:</p>
                      <Button
                        variant="ghost"
                        size="sm"
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
                      <p className="text-xs text-amber-900 dark:text-amber-300">
                        {dia.objecao_provavel}
                      </p>
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded border border-emerald-200 dark:border-emerald-800">
                      <p className="font-medium text-emerald-700 dark:text-emerald-400 text-xs mb-1">
                        Resposta sugerida:
                      </p>
                      <p className="text-xs text-emerald-900 dark:text-emerald-300">
                        {dia.resposta_sugerida}
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/20 p-2 rounded border border-blue-200 dark:border-blue-800">
                    <p className="font-medium text-blue-700 dark:text-blue-400 text-xs mb-1">CTA:</p>
                    <p className="text-xs text-blue-900 dark:text-blue-300">{dia.cta}</p>
                  </div>
                </div>

                {dia.dia < 7 && <Separator className="my-4" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
