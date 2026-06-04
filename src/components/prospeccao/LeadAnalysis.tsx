import { useState } from "react";
import { Brain, Check, Copy, Instagram, Mail, MessageSquare, RefreshCw, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { trackMetaCustomEvent } from "@/lib/metaPixel";
import { copyToClipboard } from "@/utils/templateUtils";
import { SmartCopyCard } from "./SmartCopyCard";
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
}

const variationLabels: Record<keyof NonNullable<PlanoProspeccaoDia["variations"]>, string> = {
  direct: "Direta",
  consultative: "Consultiva",
  light_provocation: "Provocacao leve",
};

const commercialDiagnosisLabels = [
  "O que encontramos",
  "Sinais analisados",
  "Conclusao pelo foco",
  "Pontos fortes",
  "Pontos de atencao",
  "Oportunidade de melhoria",
  "Como apresentar ao lead",
  "Proximo passo",
];

const parseCommercialDiagnosis = (diagnostico: string[]) => {
  const blocks = commercialDiagnosisLabels
    .map((label) => {
      const item = diagnostico.find((bullet) => bullet.toLowerCase().startsWith(`${label.toLowerCase()}:`));
      return item ? { label, value: item.slice(label.length + 1).trim() } : null;
    })
    .filter((item): item is { label: string; value: string } => !!item && item.value.length > 0);

  return blocks.length >= 4 ? blocks : [];
};

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
        <p>Voce usou todas as analises IA gratis. Escolha um plano para continuar gerando abordagens.</p>
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
                {isReanalyzing ? "Refinando..." : canAnalyzeAI ? "Refinar com IA" : "Liberar analises IA"}
              </Button>
            </span>
          </TooltipTrigger>
          {renderAiLimitTooltip()}
        </Tooltip>
      </TooltipProvider>
    );
  };

  if (!diagnostico || !probabilidade || !plano) {
    return (
      <div className="space-y-4 mt-4">
        {lead && (
          <SmartCopyCard
            lead={lead}
            onRefineWithAI={onReanalyze}
            isRefining={isReanalyzing}
            canAnalyzeAI={canAnalyzeAI}
          />
        )}
        <Card>
          <CardContent className="py-6 text-center space-y-3">
            <p className="text-muted-foreground">Analise premium de IA ainda nao gerada para este lead</p>
            {renderFallbackRefineButton()}
          </CardContent>
        </Card>
      </div>
    );
  }

  const getProbabilidadeColor = (prob: number) => {
    if (prob >= 70) return "text-green-600 bg-green-50 border-green-200";
    if (prob >= 40) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const commercialDiagnosis = parseCommercialDiagnosis(diagnostico);

  return (
    <div className="space-y-4 mt-4">
      {lead && (
        <SmartCopyCard
          lead={lead}
          onRefineWithAI={onReanalyze}
          isRefining={isReanalyzing}
          canAnalyzeAI={canAnalyzeAI}
        />
      )}

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
                          {isReanalyzing ? "Refinando..." : canAnalyzeAI ? "Refinar com IA" : "Liberar analises IA"}
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
            {commercialDiagnosis.length > 0 ? (
              <div className="grid gap-3">
                {commercialDiagnosis.map((item) => (
                  <div key={item.label} className="rounded-md border bg-muted/20 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed">{item.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-2">
                {diagnostico.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-0.5">-</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Probabilidade de Conversao
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className={`text-6xl font-bold ${getProbabilidadeColor(probabilidade).split(" ")[0]}`}>
                {probabilidade}%
              </div>
              <Badge className={`mt-3 ${getProbabilidadeColor(probabilidade)}`} variant="outline">
                {probabilidade >= 70 ? "Alta Probabilidade" : probabilidade >= 40 ? "Probabilidade Media" : "Baixa Probabilidade"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Copies prontas
          </CardTitle>
          <CardDescription>
            WhatsApp, Instagram, e-mail, follow-up e resposta para objecao gerados na mesma chamada de IA
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
                  {dia.acao_sugerida && (
                    <div className="bg-purple-50 dark:bg-purple-950/30 p-3 rounded-md border border-purple-200 dark:border-purple-800">
                      <p className="font-semibold text-purple-700 dark:text-purple-400 text-xs mb-1">
                        Acao sugerida:
                      </p>
                      <p className="text-sm text-purple-900 dark:text-purple-300 font-medium">
                        {dia.acao_sugerida}
                      </p>
                    </div>
                  )}

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

                  {dia.variations && (
                    <div className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                      <p className="font-medium text-emerald-700 dark:text-emerald-300 text-xs mb-2">
                        Variacoes premium geradas na mesma chamada IA:
                      </p>
                      <div className="space-y-2">
                        {(Object.entries(dia.variations) as Array<[keyof NonNullable<PlanoProspeccaoDia["variations"]>, string | undefined]>)
                          .filter(([, text]) => !!text)
                          .map(([key, text]) => (
                            <div key={key}>
                              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                                {variationLabels[key]}
                              </p>
                              <p className="text-xs whitespace-pre-wrap">{text}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="bg-orange-50 dark:bg-orange-950/20 p-2 rounded border border-orange-200 dark:border-orange-800">
                      <p className="font-medium text-orange-700 dark:text-orange-400 text-xs mb-1">
                        Objecao provavel:
                      </p>
                      <p className="text-xs text-orange-900 dark:text-orange-300">
                        {dia.objecao_provavel}
                      </p>
                    </div>

                    <div className="bg-green-50 dark:bg-green-950/20 p-2 rounded border border-green-200 dark:border-green-800">
                      <p className="font-medium text-green-700 dark:text-green-400 text-xs mb-1">
                        Resposta sugerida:
                      </p>
                      <p className="text-xs text-green-900 dark:text-green-300">
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
