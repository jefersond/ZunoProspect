import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Building2,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  Info,
  Instagram,
  Lightbulb,
  Mail,
  MessageSquare,
  RefreshCw,
  Target,
} from "lucide-react";
import { buildStructuredDiagnosis, hasExplicitOptOut, type ExplorableCompatibility } from "@/services/intelligentSevenDayPlan";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { trackMetaCustomEvent } from "@/lib/metaPixel";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/utils/templateUtils";
import { formatRefinedAt, getAnalysisOrigin } from "@/utils/refineOutcome";
import {
  FACT_STATUS_LABEL,
  buildCompanyFacts,
  getRecommendedPlanDay,
  previewLocalCopyUpdate,
  splitAnalysisBullets,
  type CompanyFact,
  type FactStatus,
} from "@/utils/analysisPresentation";
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
  onUpdateCopiesLocally?: () => void;
  isUpdatingCopiesLocally?: boolean;
  /** O diálogo que hospeda a análise já mostra o nome da empresa em destaque; passe false para não repetir. */
  showCompanyName?: boolean;
}

const PLAN_ANCHOR_ID = "plano-7-dias";

const STATUS_STYLE: Record<FactStatus, string> = {
  confirmado: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  informado: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  nao_verificado: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  indisponivel: "border-border bg-muted/50 text-muted-foreground",
};

const StatusBadge = ({ status }: { status: FactStatus }) => (
  <span
    className={cn("inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4", STATUS_STYLE[status])}
    data-status={status}
  >
    {FACT_STATUS_LABEL[status]}
  </span>
);

const FactCard = ({ fact }: { fact: CompanyFact }) => (
  <div className="min-w-0 rounded-lg border border-border/60 bg-background/40 p-3" data-testid={`fact-${fact.key}`}>
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <p className="text-xs font-medium text-muted-foreground">{fact.label}</p>
      <div className="flex flex-wrap gap-1">
        <StatusBadge status={fact.status} />
        {fact.secondaryStatus && <StatusBadge status={fact.secondaryStatus} />}
      </div>
    </div>
    {fact.value ? (
      <p className="mt-1.5 break-words text-sm font-medium text-foreground">{fact.value}</p>
    ) : (
      <p className="mt-1.5 text-sm text-muted-foreground">—</p>
    )}
    {fact.note && <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{fact.note}</p>}
    {fact.secondaryNote && <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{fact.secondaryNote}</p>}
  </div>
);

const compatibilityBadgeClass = (level?: string) => {
  if (level === "alta") return "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  if (level === "media") return "text-blue-700 dark:text-blue-400 bg-blue-500/10 border-blue-500/30";
  if (level === "basica") return "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30";
  return "text-muted-foreground bg-muted/40 border-border/50";
};

export const LeadAnalysis = ({
  diagnostico,
  plano,
  geradoEm,
  onReanalyze,
  isReanalyzing,
  canAnalyzeAI = true,
  lead,
  compatibilidade,
  onExecuteInSdr,
  onUpdateCopiesLocally,
  isUpdatingCopiesLocally = false,
  showCompanyName = true,
}: LeadAnalysisProps) => {
  const [copiedDia, setCopiedDia] = useState<number | null>(null);
  const [confirmCopiesOpen, setConfirmCopiesOpen] = useState(false);
  const [confirmRefineOpen, setConfirmRefineOpen] = useState(false);
  const { toast } = useToast();

  const sections = useMemo(() => splitAnalysisBullets(diagnostico), [diagnostico]);
  const facts = useMemo(() => (lead ? buildCompanyFacts(lead) : []), [lead]);
  // Recusa registrada (status ou anotações) bloqueia qualquer recomendação ou execução de contato, mesmo que o plano
  // salvo ainda tenha mensagens pendentes. É a mesma regra que o SDR usa.
  const contactBlocked = useMemo(() => (lead ? hasExplicitOptOut(lead) : false), [lead]);
  const recommendedDay = useMemo(() => (contactBlocked ? null : getRecommendedPlanDay(plano)), [contactBlocked, plano]);
  const copiesPreview = useMemo(
    () => (confirmCopiesOpen && plano ? previewLocalCopyUpdate(lead, plano) : null),
    [confirmCopiesOpen, lead, plano],
  );

  /** Guarda na própria ação: mesmo que o botão seja reativado por fora, nada é executado para lead bloqueado. */
  const executeInSdr = (dayNumber: number) => {
    if (contactBlocked) return;
    onExecuteInSdr?.(dayNumber);
  };

  const handleCopyMessage = async (dia: number, mensagem: string, channel: PlanoProspeccaoDia["canal"]) => {
    if (contactBlocked) return;
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

  const scrollToPlan = () => {
    document.getElementById(PLAN_ANCHOR_ID)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  /** Ação de IA: deixa claro que pode consumir crédito e não se sobrepõe ao conteúdo. */
  const renderRefineAction = (align: "start" | "end" = "end") => {
    if (!onReanalyze) return null;
    return (
      <div className={cn("flex flex-col gap-1", align === "end" ? "sm:items-end" : "items-start")} data-testid="refine-action">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex w-full sm:w-auto">
                <Button
                  onClick={requestRefine}
                  disabled={isReanalyzing}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full gap-2 sm:w-auto",
                    !canAnalyzeAI && "border-emerald-500 bg-emerald-500/10 font-semibold text-emerald-600 hover:bg-emerald-500 hover:text-slate-950 dark:text-emerald-400",
                  )}
                >
                  <RefreshCw className={cn("h-4 w-4", isReanalyzing && "animate-spin")} />
                  {isReanalyzing ? "Refinando..." : canAnalyzeAI ? (needsRefineConfirmation ? "Refinar novamente" : "Refinar com IA") : "Liberar analises IA"}
                </Button>
              </span>
            </TooltipTrigger>
            {!canAnalyzeAI && (
              <TooltipContent>
                <p>Voce usou todas as analises IA gratis. Escolha um plano para continuar gerando abordagens.</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <p className="text-[11px] leading-tight text-muted-foreground">
          {canAnalyzeAI ? "Pode consumir 1 análise de IA do seu plano." : "Seu limite de análises de IA foi atingido."}
        </p>
      </div>
    );
  };

  if (!diagnostico || diagnostico.length === 0 || !plano || plano.length === 0) {
    return (
      <div className="mt-4 space-y-4">
        <Card>
          <CardContent className="space-y-3 py-6 text-center">
            <p className="text-muted-foreground">Analise premium de IA ainda nao gerada para este lead</p>
            {!lead && renderRefineAction("start")}
          </CardContent>
        </Card>
      </div>
    );
  }

  const effectiveCompat = compatibilidade || (lead ? buildStructuredDiagnosis(lead, lead.foco || undefined).compatibilidade : null);
  const headline = sections.resumo.slice(0, 3);
  const moreSummary = sections.resumo.slice(3);
  const subtitle = lead ? [lead.nicho, lead.cidade].filter(Boolean).join(" · ") : "";
  const origin = getAnalysisOrigin({ ai_analise_gerada_em: geradoEm, ai_used_fallback: lead?.ai_used_fallback });
  // Já existe uma análise do Gemini salva: gerar outra é uma ação explícita, com aviso de consumo e confirmação.
  const needsRefineConfirmation = origin === "gemini";
  const requestRefine = () => {
    if (needsRefineConfirmation) setConfirmRefineOpen(true);
    else onReanalyze?.();
  };
  const hasNextStep = !contactBlocked && (sections.proximoPasso.length > 0 || Boolean(recommendedDay));

  return (
    <div className="mt-4 space-y-5" data-testid="analysis-panel">
      {/* 1. Cabeçalho */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" data-testid="analysis-header">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <Brain className="h-4 w-4 shrink-0" />
            Diagnostico Comercial IA
          </p>
          {showCompanyName && lead?.nome && <h3 className="break-words text-xl font-semibold leading-tight text-foreground">{lead.nome}</h3>}
          {subtitle && <p className="break-words text-sm text-muted-foreground">{subtitle}</p>}
          {geradoEm && origin !== "gemini" && <p className="text-xs text-muted-foreground">Gerado em {new Date(geradoEm).toLocaleDateString("pt-BR")}</p>}
          {origin === "gemini" && (
            <div className="space-y-1" data-testid="analysis-origin">
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                Gerado pelo Gemini
              </Badge>
              <p className="text-xs text-muted-foreground" data-testid="refined-at">
                Análise atualizada{formatRefinedAt(geradoEm) ? ` · último refinamento em ${formatRefinedAt(geradoEm)}` : ""}
              </p>
            </div>
          )}
          {origin === "not_generated" && (
            <Badge variant="outline" className="text-muted-foreground" data-testid="analysis-origin">
              Análise com IA não gerada
            </Badge>
          )}
          {origin === "fallback" && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300" role="alert" data-testid="analysis-origin">
              <p className="font-semibold">Texto de reserva: não foi gerado pela IA</p>
              <p className="mt-0.5">
                A IA não respondeu na última tentativa e este conteúdo é genérico. Use "Refinar com IA" para tentar novamente.
              </p>
            </div>
          )}
        </div>
        {renderRefineAction("end")}
      </header>

      {/* 2. Resumo comercial */}
      <Card className="border-primary/30 bg-primary/5" data-testid="analysis-summary">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 shrink-0 text-primary" />
            Resumo comercial
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {headline.map((text, idx) => (
            <p key={idx} className="break-words text-sm leading-relaxed text-foreground/90">
              {text}
            </p>
          ))}
          {moreSummary.length > 0 && (
            <details className="group text-sm">
              <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">
                Ver mais detalhes da análise ({moreSummary.length})
              </summary>
              <div className="mt-2 space-y-2 border-l-2 border-primary/20 pl-3">
                {moreSummary.map((text, idx) => (
                  <p key={idx} className="break-words text-sm leading-relaxed text-muted-foreground">
                    {text}
                  </p>
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      {/* 3. Dados da empresa */}
      {(facts.length > 0 || effectiveCompat) && (
        <section className="space-y-3" aria-labelledby="dados-empresa" data-testid="company-data">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h4 id="dados-empresa" className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Building2 className="h-4 w-4 shrink-0 text-primary" />
              Dados da empresa
            </h4>
            {effectiveCompat && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>Alinhamento cadastral para abordagem:</span>
                      <Badge variant="outline" className={cn("font-medium", compatibilityBadgeClass(effectiveCompat.level))}>
                        {effectiveCompat.label || "Compatibilidade não determinada"}
                      </Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>{effectiveCompat.description}</p>
                    <p className="mt-1 text-muted-foreground">Critérios observáveis em dados públicos. Não é percentual de fechamento.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {facts.map((fact) => (
              <FactCard key={fact.key} fact={fact} />
            ))}
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              “Indisponível” quer dizer que o dado não está no cadastro, não que a empresa não o tenha. “Não verificado” é algo que o Zuno não testou.
            </span>
          </p>
        </section>
      )}

      {/* 4. Oportunidade comercial */}
      {sections.oportunidade.length > 0 && (
        <Card data-testid="analysis-opportunity">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 shrink-0 text-primary" />
              Oportunidade comercial
            </CardTitle>
            <CardDescription className="text-xs">Hipótese ligada ao serviço que você oferece. Não é um fato confirmado sobre a empresa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {sections.oportunidade.map((text, idx) => (
              <p key={idx} className="break-words text-sm leading-relaxed text-foreground/90">
                {text}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 5. Próximo passo (ou aviso de contato bloqueado) */}
      {contactBlocked && (
        <Card className="border-destructive/50 bg-destructive/10" role="alert" data-testid="contact-blocked">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <Ban className="h-4 w-4 shrink-0" />
              Contato bloqueado por recusa registrada
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="break-words text-sm leading-relaxed text-foreground/90">
              Esta empresa pediu para não ser contatada (recusa registrada no status ou nas anotações). O plano abaixo fica apenas para consulta: não é possível executar novas abordagens por aqui.
            </p>
            <Button size="sm" variant="outline" className="mt-3 w-full sm:w-auto" onClick={scrollToPlan}>
              Consultar plano de 7 dias
            </Button>
          </CardContent>
        </Card>
      )}

      {hasNextStep && (
        <Card className="border-primary/50 bg-primary/10" data-testid="analysis-next-step">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
              Próximo passo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {sections.proximoPasso.map((text, idx) => (
              <p key={idx} className="break-words text-sm font-medium leading-relaxed text-foreground">
                {text}
              </p>
            ))}
            {recommendedDay && (
              <p className="break-words text-sm text-foreground/90" data-testid="next-step-day">
                <span className="font-semibold">Dia {recommendedDay.dia}</span>
                {recommendedDay.acao_sugerida ? `: ${recommendedDay.acao_sugerida}` : recommendedDay.objetivo ? `: ${recommendedDay.objetivo}` : ""}
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              {recommendedDay && onExecuteInSdr && (
                <Button size="sm" className="w-full gap-1.5 sm:w-auto" onClick={() => executeInSdr(recommendedDay.dia)}>
                  <MessageSquare className="h-3.5 w-3.5" />
                  Executar Dia {recommendedDay.dia} no SDR
                </Button>
              )}
              <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={scrollToPlan}>
                Ver plano de 7 dias
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 6. Plano de sete dias */}
      <Card id={PLAN_ANCHOR_ID} data-testid="analysis-plan">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
            Plano de 7 dias
          </CardTitle>
          <CardDescription>
            WhatsApp, Instagram, e-mail, follow-up e resposta para objecao gerados na mesma chamada de IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contactBlocked && (
            <p className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs leading-relaxed text-foreground/90" data-testid="plan-read-only">
              <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <span>Somente consulta: contato bloqueado por recusa registrada. As mensagens abaixo não foram alteradas nem apagadas, mas não podem ser executadas.</span>
            </p>
          )}
          <ol className="space-y-4">
            {plano.map((dia) => (
              <li
                key={dia.dia}
                className="min-w-0 space-y-3 rounded-xl border border-border/60 bg-background/30 p-3 sm:p-4"
                data-testid={`dia-${dia.dia}`}
              >
                <div className="flex flex-wrap items-center gap-2">
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
                  {dia.is_custom_edited && (
                    <Badge variant="outline" className="border-primary/40 text-primary" data-testid={`dia-${dia.dia}-edited`}>
                      Editada por você · mantida em novas análises
                    </Badge>
                  )}
                  {dia.status_dia === "concluido" && (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                      Concluída · mantida
                    </Badge>
                  )}
                  {contactBlocked && (
                    <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
                      <Ban className="h-3 w-3" />
                      Bloqueado
                    </Badge>
                  )}
                  {onExecuteInSdr && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => executeInSdr(dia.dia)}
                      disabled={contactBlocked}
                      aria-disabled={contactBlocked}
                      title={contactBlocked ? "Contato bloqueado por recusa registrada" : undefined}
                      className="h-7 w-full border-emerald-500/30 text-xs text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-500 dark:text-emerald-400 sm:ml-auto sm:w-auto"
                    >
                      <MessageSquare className="mr-1 h-3 w-3" />
                      Executar no SDR
                    </Button>
                  )}
                </div>

                <div className="space-y-2 text-sm sm:pl-2">
                  {(dia.objetivo || dia.goal) && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="mb-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Objetivo do dia:
                      </p>
                      <p className="break-words text-sm font-medium text-slate-900 dark:text-slate-200">
                        {dia.objetivo || dia.goal}
                      </p>
                    </div>
                  )}

                  {dia.acao_sugerida && (
                    <div className="rounded-md border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-950/30">
                      <p className="mb-1 text-xs font-semibold text-purple-700 dark:text-purple-400">
                        {contactBlocked ? "Ação registrada no plano (bloqueada):" : "Acao sugerida:"}
                      </p>
                      <p className="break-words text-sm font-medium text-purple-900 dark:text-purple-300">
                        {dia.acao_sugerida}
                      </p>
                    </div>
                  )}

                  {dia.assunto_email && (
                    <div className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Assunto sugerido: </span>
                      <span className="break-words font-medium text-slate-900 dark:text-slate-200">{dia.assunto_email}</span>
                    </div>
                  )}

                  <div className="relative rounded-md border border-primary/10 bg-primary/5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="mb-1 font-medium text-primary">Mensagem:</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyMessage(dia.dia, dia.mensagem, dia.canal)}
                        disabled={contactBlocked}
                        title={contactBlocked ? "Cópia desativada: contato bloqueado por recusa registrada" : undefined}
                        className="-mr-1 -mt-1 h-7 w-7 shrink-0 p-0"
                        aria-label={`Copiar mensagem do Dia ${dia.dia}`}
                      >
                        {copiedDia === dia.dia ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="whitespace-pre-wrap break-words">{dia.mensagem}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div className="rounded border border-orange-200 bg-orange-50 p-2 dark:border-orange-800 dark:bg-orange-950/20">
                      <p className="mb-1 text-xs font-medium text-orange-700 dark:text-orange-400">
                        Objecao provavel:
                      </p>
                      <p className="break-words text-xs text-orange-900 dark:text-orange-300">
                        {dia.objecao_provavel}
                      </p>
                    </div>

                    <div className="rounded border border-green-200 bg-green-50 p-2 dark:border-green-800 dark:bg-green-950/20">
                      <p className="mb-1 text-xs font-medium text-green-700 dark:text-green-400">
                        Resposta sugerida:
                      </p>
                      <p className="break-words text-xs text-green-900 dark:text-green-300">
                        {dia.resposta_sugerida}
                      </p>
                    </div>
                  </div>

                  <div className="rounded border border-blue-200 bg-blue-50 p-2 dark:border-blue-800 dark:bg-blue-950/20">
                    <p className="mb-1 text-xs font-medium text-blue-700 dark:text-blue-400">CTA:</p>
                    <p className="break-words text-xs text-blue-900 dark:text-blue-300">{dia.cta}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {/* Ação avançada: desativada temporariamente na interface para proteger as cópias de IA contra sobrescrita acidental. O PR #60 removerá definitivamente este recurso. */}
          {onUpdateCopiesLocally && (
            <div
              className="mt-5 flex flex-col gap-3 rounded-lg border border-dashed border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between opacity-75"
              data-testid="advanced-copy-action"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs font-medium text-foreground">Ferramenta avançada · modelo padrão (sem IA)</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Atualização em lote temporariamente desativada na interface para proteger as mensagens geradas por IA contra sobrescrita. Suas mensagens salvas estão seguras.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full shrink-0 gap-1.5 text-xs text-muted-foreground sm:w-auto cursor-not-allowed opacity-60"
                disabled={true}
                aria-disabled="true"
                title="Desativado temporariamente para proteger copies de IA contra sobrescrita."
                tabIndex={-1}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Atualizar Cópias (desativado)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmRefineOpen} onOpenChange={setConfirmRefineOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar uma nova análise com IA?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Esta análise já foi gerada pelo Gemini. Uma nova geração <strong>consome 1 análise de IA</strong> do seu plano e
                  atualiza o diagnóstico e as mensagens do plano de 7 dias.
                </p>
                <p>
                  <strong>Seu trabalho é mantido:</strong> mensagens que você editou, etapas já concluídas e dias bloqueados
                  continuam exatamente como estão; só os demais dias recebem texto novo.
                </p>
                <p className="text-xs text-muted-foreground">
                  Atualizar a página não consome créditos. Se a IA falhar, a análise atual é mantida e nada é cobrado.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmRefineOpen(false);
                onReanalyze?.();
              }}
            >
              Gerar nova análise (1 crédito)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCopiesOpen} onOpenChange={setConfirmCopiesOpen}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir mensagens pelo modelo padrão?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Isto <strong>não usa IA</strong> e não gasta crédito, mas <strong>sobrescreve texto</strong>: o que for trocado não pode ser recuperado por aqui.
                </p>
                {copiesPreview && (
                  <ul className="list-disc space-y-1 pl-5" data-testid="copies-preview-summary">
                    <li>
                      {copiesPreview.replaced} de {copiesPreview.total} mensagens seriam substituídas.
                    </li>
                    <li>{copiesPreview.keptEdited} mensagens editadas por você seriam mantidas.</li>
                  </ul>
                )}
                {copiesPreview?.example && (
                  <div className="space-y-2" data-testid="copies-preview-example">
                    <p className="text-xs font-semibold text-foreground">Exemplo, Dia {copiesPreview.example.dia}</p>
                    <div className="rounded-md border border-border/60 p-2">
                      <p className="mb-1 text-[11px] font-medium text-muted-foreground">Hoje</p>
                      <p className="whitespace-pre-wrap break-words text-xs">{copiesPreview.example.before}</p>
                    </div>
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2">
                      <p className="mb-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">Depois</p>
                      <p className="whitespace-pre-wrap break-words text-xs">{copiesPreview.example.after}</p>
                    </div>
                  </div>
                )}
                {copiesPreview && copiesPreview.replaced === 0 && <p>Nenhuma mensagem mudaria agora.</p>}
                <p className="text-xs text-muted-foreground">Quer guardar algum texto? Copie antes de continuar.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmCopiesOpen(false);
                onUpdateCopiesLocally?.();
              }}
            >
              Substituir mensagens
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

