import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Building2,
  Calendar,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  GitBranch,
  HelpCircle,
  Info,
  Instagram,
  Lightbulb,
  ListChecks,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { buildStructuredDiagnosis, hasExplicitOptOut, type ExplorableCompatibility } from "@/services/intelligentSevenDayPlan";
import { useSellerProfileState, isSellerProfileComplete, openSellerProfileDialog } from "@/lib/sellerProfile";
import { buildCommercialContingencies } from "@/utils/commercialContingencies";
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
  getFunnelStageGuidance,
  getRecommendedPlanDay,
  previewLocalCopyUpdate,
  splitAnalysisBullets,
  validateLeadChannelForDay,
  type CompanyFact,
  type FactStatus,
} from "@/utils/analysisPresentation";
import { buildNextBestAction, type NextBestAction } from "@/services/nextBestAction";
import { COMMERCIAL_MATURITY_METAS, type CommercialMaturity } from "@/types/commercialMaturity";
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
  /** Data fictícia da simulação de tempo para recalcular a NBA */
  simulatedNow?: Date;
  /** Nível de maturidade comercial do assinante (equilibrado, iniciante, intermediario, avancado) */
  commercialMaturity?: CommercialMaturity;
}

const PLAN_ANCHOR_ID = "plano-7-dias";

const STATUS_STYLE: Record<FactStatus, string> = {
  confirmado: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400 font-semibold",
  informado: "border-sky-500/30 bg-sky-500/15 text-sky-300 font-semibold",
  nao_verificado: "border-amber-500/40 bg-amber-500/15 text-amber-300 font-semibold",
  indisponivel: "border-zinc-700 bg-zinc-800/60 text-zinc-400",
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
  <div className="min-w-0 rounded-lg border border-[#1f2d29] bg-[#111816] p-3 shadow-sm" data-testid={`fact-${fact.key}`}>
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <p className="text-xs font-medium text-zinc-400">{fact.label}</p>
      <div className="flex flex-wrap gap-1">
        <StatusBadge status={fact.status} />
        {fact.secondaryStatus && <StatusBadge status={fact.secondaryStatus} />}
      </div>
    </div>
    {fact.value ? (
      <p className="mt-1.5 break-words text-sm font-semibold text-white">{fact.value}</p>
    ) : (
      <p className="mt-1.5 text-sm text-zinc-500">—</p>
    )}
    {fact.note && <p className="mt-1 break-words text-xs leading-relaxed text-zinc-300">{fact.note}</p>}
    {fact.secondaryNote && <p className="mt-1 break-words text-xs leading-relaxed text-zinc-300">{fact.secondaryNote}</p>}
  </div>
);

const compatibilityBadgeClass = (level?: string) => {
  if (level === "alta") return "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  if (level === "media") return "text-blue-700 dark:text-blue-400 bg-blue-500/10 border-blue-500/30";
  if (level === "basica") return "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30";
  return "text-muted-foreground bg-muted/40 border-border/50";
};

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  email: "Email",
  telefone: "Ligação",
  nenhum: "Sem envio",
};
const DAY_TYPE_LABEL: Record<string, string> = {
  acompanhamento: "Acompanhamento",
  tarefa: "Tarefa para você",
  sem_mensagem: "Sem mensagem",
};
const ChannelIcon = ({ channel }: { channel: string }) => {
  if (channel === "whatsapp") return <MessageSquare className="h-3 w-3" />;
  if (channel === "instagram") return <Instagram className="h-3 w-3" />;
  if (channel === "telefone") return <Phone className="h-3 w-3" />;
  if (channel === "nenhum") return <ListChecks className="h-3 w-3" />;
  return <Mail className="h-3 w-3" />;
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
  simulatedNow,
  commercialMaturity,
}: LeadAnalysisProps) => {
  const [copiedDia, setCopiedDia] = useState<number | null>(null);
  const [copiedContingency, setCopiedContingency] = useState<string | null>(null);
  const [confirmCopiesOpen, setConfirmCopiesOpen] = useState(false);
  const [confirmRefineOpen, setConfirmRefineOpen] = useState(false);
  const { toast } = useToast();
  const sellerProfileState = useSellerProfileState();
  const contingencies = useMemo(() => buildCommercialContingencies({ lead, sellerProfile: sellerProfileState?.profile, foco: lead?.foco }), [lead, sellerProfileState?.profile]);

  const sections = useMemo(() => splitAnalysisBullets(diagnostico), [diagnostico]);
  const facts = useMemo(() => (lead ? buildCompanyFacts(lead) : []), [lead]);
  // Recusa registrada (status ou anotações) bloqueia qualquer recomendação ou execução de contato, mesmo que o plano
  // salvo ainda tenha mensagens pendentes. É a mesma regra que o SDR usa.
  const contactBlocked = useMemo(() => (lead ? hasExplicitOptOut(lead) : false), [lead]);
  // Motor unificado da Próxima Melhor Ação (Next Best Action - NBA)
  const effectiveMaturity: CommercialMaturity =
    commercialMaturity || sellerProfileState?.profile?.commercial_maturity || "equilibrado";

  const nextBestAction = useMemo(
    () =>
      buildNextBestAction(lead, {
        diagnosisBullets: diagnostico,
        plano,
        sellerService: sellerProfileState?.profile?.foco_atuacao || lead?.foco,
        now: simulatedNow || new Date(),
        commercialMaturity: effectiveMaturity,
      }),
    [lead, diagnostico, plano, sellerProfileState?.profile?.foco_atuacao, simulatedNow, effectiveMaturity],
  );
  // Se o lead avançou para estágios posteriores (qualificação, negociação, etc.), a cadência fria é pausada.
  const funnelGuidance = useMemo(() => (lead ? getFunnelStageGuidance(lead.status) : null), [lead?.status]);
  const recommendedDay = useMemo(
    () => (contactBlocked || !nextBestAction.isColdCadenceActive ? null : getRecommendedPlanDay(plano, lead?.status)),
    [contactBlocked, nextBestAction.isColdCadenceActive, plano, lead?.status]
  );
  const copiesPreview = useMemo(
    () => (confirmCopiesOpen && plano ? previewLocalCopyUpdate(lead, plano) : null),
    [confirmCopiesOpen, lead, plano],
  );

  /** Guarda na própria ação: mesmo que o botão seja reativado por fora, nada é executado para lead bloqueado ou em funil avançado. */
  const executeInSdr = (dayNumber: number) => {
    if (contactBlocked || !nextBestAction.isColdCadenceActive) return;
    // Etapas de tarefa ou sem mensagem não têm texto: nada é aberto nem inventado.
    if (!String(plano?.find((d) => d.dia === dayNumber)?.mensagem || "").trim()) return;
    onExecuteInSdr?.(dayNumber);
  };

  const handleCopyContingency = async (id: string, text: string) => {
    if (contactBlocked) return;
    const success = await copyToClipboard(text);
    if (!success) return;
    setCopiedContingency(id);
    toast({
      title: "Copiado!",
      description: "Resposta de contingência copiada",
    });
    setTimeout(() => setCopiedContingency(null), 2000);
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

  /** Ação de IA no topo: só aparece APÓS a geração pelo Gemini ("Refinar novamente").
   * Antes da geração, o único CTA deve ser o card destacado "Gerar plano comercial completo com IA". */
  const renderRefineAction = (align: "start" | "end" = "end") => {
    if (!onReanalyze) return null;
    // Antes da geração pelo Gemini, não exibe botão concorrente no cabeçalho
    if (origin !== "gemini") return null;

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
                    "w-full gap-2 sm:w-auto border-[#1f2d29] bg-[#111816] text-zinc-200 hover:bg-[#1f2d29] hover:text-white transition-colors",
                    !canAnalyzeAI && "border-amber-500/50 bg-amber-500/10 text-amber-400 font-semibold hover:bg-amber-500/20",
                  )}
                >
                  <RefreshCw className={cn("h-4 w-4", isReanalyzing && "animate-spin text-emerald-400")} />
                  {isReanalyzing ? "Refinando..." : canAnalyzeAI ? "Refinar novamente" : "Liberar análises IA"}
                </Button>
              </span>
            </TooltipTrigger>
            {!canAnalyzeAI && (
              <TooltipContent>
                <p>Você usou todas as análises de IA grátis. Escolha um plano para continuar gerando abordagens.</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <p className="text-[11px] leading-tight text-zinc-400">
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
  const hasNextStep = !contactBlocked && nextBestAction.isColdCadenceActive && (sections.proximoPasso.length > 0 || Boolean(recommendedDay));

  return (
    <div id="tour-diagnostico-ia" className="mt-4 space-y-5 text-[#f4f4f5]" data-testid="analysis-panel">
      {/* 1. Cabeçalho */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" data-testid="analysis-header">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#10d98a]">
            <Brain className="h-4 w-4 shrink-0" />
            {origin === "gemini" ? "Diagnóstico Estratégico IA (Gemini)" : "Roteiro Comercial Base (Inicial)"}
          </p>
          {showCompanyName && lead?.nome && <h3 className="break-words text-2xl font-bold leading-tight text-white">{lead.nome}</h3>}
          {subtitle && <p className="break-words text-sm font-medium text-zinc-300">{subtitle}</p>}
          {geradoEm && origin !== "gemini" && <p className="text-xs text-zinc-400">Gerado em {new Date(geradoEm).toLocaleDateString("pt-BR")}</p>}
          {origin === "gemini" && (
            <div className="space-y-1" data-testid="analysis-origin">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/15 text-emerald-400 font-semibold">
                  Personalizado com IA
                </Badge>
                <span className="text-[11px] text-zinc-400">Gerado pelo Gemini</span>
              </div>
              <p className="text-xs text-zinc-400" data-testid="refined-at">
                Análise atualizada{formatRefinedAt(geradoEm) ? ` · último refinamento em ${formatRefinedAt(geradoEm)}` : ""}
              </p>
            </div>
          )}
          {origin === "not_generated" && (
            <div className="flex items-center gap-2 pt-0.5" data-testid="analysis-origin">
              <Badge variant="outline" className="border-zinc-700 bg-zinc-800/80 text-zinc-300 text-[11px] font-normal" data-testid="initial-suggestion-badge">
                Sugestão inicial
              </Badge>
              <span className="text-xs text-zinc-400">
                Roteiro determinístico base
              </span>
            </div>
          )}
          {origin === "fallback" && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-300" role="alert" data-testid="analysis-origin">
              <p className="font-semibold text-amber-200">Texto de reserva: não foi gerado pela IA</p>
              <p className="mt-0.5 text-amber-300/90">
                A IA não respondeu na última tentativa e este conteúdo é genérico. Use "Gerar plano comercial completo com IA" para tentar novamente.
              </p>
            </div>
          )}
        </div>
        {renderRefineAction("end")}
      </header>

      {/* 2. Resumo comercial */}
      <Card className="border-[#10d98a]/30 bg-[#10d98a]/5 shadow-sm" data-testid="analysis-summary">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
              <Target className="h-4 w-4 shrink-0 text-[#10d98a]" />
              Resumo comercial
            </CardTitle>
            {origin !== "gemini" ? (
              <Badge variant="outline" className="border-zinc-700 bg-zinc-800/80 text-zinc-300 text-[11px] font-normal" data-testid="summary-initial-badge">
                Sugestão inicial
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[11px] font-medium" data-testid="summary-gemini-badge">
                Personalizado com IA
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {headline.map((text, idx) => (
            <p key={idx} className="break-words text-sm leading-relaxed text-zinc-100 font-normal">
              {text}
            </p>
          ))}
          {moreSummary.length > 0 && (
            <details className="group text-sm">
              <summary className="cursor-pointer text-xs font-semibold text-[#10d98a] hover:underline">
                Ver mais detalhes da análise ({moreSummary.length})
              </summary>
              <div className="mt-2 space-y-2 border-l-2 border-[#10d98a]/30 pl-3">
                {moreSummary.map((text, idx) => (
                  <p key={idx} className="break-words text-sm leading-relaxed text-zinc-300">
                    {text}
                  </p>
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      {/* Bloco de Destaque da Personalização com IA (Identidade Zuno Dark / Neon) */}
      {origin !== "gemini" && onReanalyze && (
        <Card
          data-testid="refine-highlight-card"
          className="border-[#10d98a]/40 bg-gradient-to-br from-[#111816] via-[#111816] to-[#0d221a] shadow-[0_0_25px_rgba(16,217,138,0.08)]"
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#10d98a]/20 text-[#10d98a]">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="text-sm font-semibold text-white">
                    Deseja gerar o plano comercial completo para este lead?
                  </h4>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Receba uma análise aprofundada, mensagens personalizadas e uma estratégia de acompanhamento para esta empresa.
                </p>
                {sellerProfileState && !isSellerProfileComplete(sellerProfileState.profile) && (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5" data-testid="profile-incomplete-warning">
                    <span className="text-[11px] text-amber-400 font-medium">
                      Seu perfil comercial ainda não está completo.
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openSellerProfileDialog();
                      }}
                      className="text-[11px] font-semibold text-[#10d98a] underline underline-offset-2 hover:text-[#10d98a]/80"
                    >
                      Completar perfil agora
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5 sm:items-end shrink-0">
                <Button
                  onClick={requestRefine}
                  disabled={isReanalyzing}
                  data-testid="btn-refinar-abordagem-ia"
                  className={cn(
                    "h-10 px-5 text-xs font-semibold gap-2 shadow-md transition-all w-full sm:w-auto",
                    canAnalyzeAI
                      ? "bg-[#10d98a] text-[#0b0f0e] hover:bg-[#10d98a]/90 hover:shadow-[0_0_20px_rgba(16,217,138,0.4)]"
                      : "border-amber-500 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-950"
                  )}
                >
                  <Sparkles className={cn("h-3.5 w-3.5", isReanalyzing && "animate-spin")} />
                  {isReanalyzing
                    ? "Gerando plano comercial completo..."
                    : canAnalyzeAI
                    ? "Gerar plano comercial completo com IA"
                    : "Liberar análises IA"}
                </Button>
                <span className="text-[11px] text-zinc-400 font-medium">
                  {canAnalyzeAI
                    ? "Consome 1 análise de IA do seu plano."
                    : "Limite de análises IA atingido neste ciclo."}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bloco de Confirmação quando o refinamento foi concluído */}
      {origin === "gemini" && (
        <div
          data-testid="refined-success-block"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 sm:p-3.5 flex items-center gap-2.5"
        >
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/20 text-emerald-400 font-semibold gap-1 text-[11px] shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Personalizado com IA
          </Badge>
          <span className="text-xs text-zinc-300">
            Plano comercial completo e estratégia de acompanhamento gerados com inteligência artificial.
          </span>
        </div>
      )}

      {/* 3. Dados da empresa */}
      {(facts.length > 0 || effectiveCompat) && (
        <section className="space-y-3" aria-labelledby="dados-empresa" data-testid="company-data">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h4 id="dados-empresa" className="flex items-center gap-2 text-sm font-semibold text-white">
              <Building2 className="h-4 w-4 shrink-0 text-[#10d98a]" />
              Dados da empresa
            </h4>
            {effectiveCompat && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex max-w-full items-center gap-1.5 text-xs text-zinc-300">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#10d98a]" />
                      <span>Alinhamento cadastral para abordagem:</span>
                      <Badge variant="outline" className={cn("font-medium", compatibilityBadgeClass(effectiveCompat.level))}>
                        {effectiveCompat.label || "Compatibilidade não determinada"}
                      </Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs bg-[#111816] border-[#1f2d29] text-zinc-200">
                    <p>{effectiveCompat.description}</p>
                    <p className="mt-1 text-zinc-400">Critérios observáveis em dados públicos. Não é percentual de fechamento.</p>
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
          <p className="flex items-start gap-1.5 text-xs text-zinc-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              “Indisponível” quer dizer que o dado não está no cadastro, não que a empresa não o tenha. “Não verificado” é algo que o Zuno não testou.
            </span>
          </p>
        </section>
      )}

      {/* 4. Oportunidade comercial */}
      {sections.oportunidade.length > 0 && (
        <Card className="border-[#1f2d29] bg-[#111816]" data-testid="analysis-opportunity">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
              <Lightbulb className="h-4 w-4 shrink-0 text-[#10d98a]" />
              Oportunidade comercial
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">Hipótese ligada ao serviço que você oferece. Não é um fato confirmado sobre a empresa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {sections.oportunidade.map((text, idx) => (
              <p key={idx} className="break-words text-sm leading-relaxed text-zinc-200">
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
            <p className="break-words text-sm leading-relaxed text-zinc-200">
              Esta empresa pediu para não ser contatada (recusa registrada no status ou nas anotações). O plano abaixo fica apenas para consulta: não é possível executar novas abordagens por aqui.
            </p>
            <Button size="sm" variant="outline" className="mt-3 w-full sm:w-auto border-[#1f2d29] text-zinc-200 hover:bg-[#1f2d29]" onClick={scrollToPlan}>
              Consultar plano de 7 dias
            </Button>
          </CardContent>
        </Card>
      )}

      {!contactBlocked && !nextBestAction.isColdCadenceActive && (
        <Card className="border-amber-500/40 bg-amber-500/10 shadow-sm" data-testid="funnel-stage-guidance">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <Target className="h-4 w-4 shrink-0 text-amber-400" />
                {nextBestAction.title}
              </CardTitle>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className={cn("text-xs font-semibold", nextBestAction.badgeClass)}>
                  {nextBestAction.badgeLabel}
                </Badge>
                {nextBestAction.commercialMaturity && (
                  <Badge variant="outline" className={cn("text-[11px] font-medium", COMMERCIAL_MATURITY_METAS[nextBestAction.commercialMaturity]?.badgeClass)} data-testid="nba-maturity-badge">
                    Nível: {COMMERCIAL_MATURITY_METAS[nextBestAction.commercialMaturity]?.shortLabel}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="rounded-lg border border-amber-500/20 bg-black/30 p-2.5 text-xs">
              <span className="font-semibold text-amber-300">Por que agora: </span>
              <span className="text-zinc-200">{nextBestAction.reason}</span>
            </div>

            {nextBestAction.scheduledFollowUp && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
                <Calendar className="h-4 w-4 shrink-0 text-amber-400" />
                <span><strong>Follow-up agendado:</strong> {new Date(nextBestAction.scheduledFollowUp.date).toLocaleDateString("pt-BR")} — {nextBestAction.scheduledFollowUp.action}</span>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-xs font-semibold text-zinc-300">Como agir:</span>
              <p className="break-words text-sm leading-relaxed text-zinc-200">
                {nextBestAction.guidance}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row pt-1">
              <Button size="sm" variant="outline" className="w-full sm:w-auto border-[#1f2d29] text-zinc-200 hover:bg-[#1f2d29]" onClick={scrollToPlan}>
                Consultar histórico do plano de 7 dias
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {hasNextStep && (
        <Card className="border-[#10d98a]/40 bg-[#10d98a]/10 shadow-sm" data-testid="analysis-next-step">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <ArrowRight className="h-4 w-4 shrink-0 text-[#10d98a]" />
                {nextBestAction.title}
              </CardTitle>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className={cn("text-xs font-semibold", nextBestAction.badgeClass)}>
                  {nextBestAction.badgeLabel}
                </Badge>
                {nextBestAction.commercialMaturity && (
                  <Badge variant="outline" className={cn("text-[11px] font-medium", COMMERCIAL_MATURITY_METAS[nextBestAction.commercialMaturity]?.badgeClass)} data-testid="nba-maturity-badge">
                    Nível: {COMMERCIAL_MATURITY_METAS[nextBestAction.commercialMaturity]?.shortLabel}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="rounded-lg border border-[#10d98a]/20 bg-black/30 p-2.5 text-xs">
              <span className="font-semibold text-emerald-400">Por que agora: </span>
              <span className="text-zinc-200">{nextBestAction.reason}</span>
            </div>

            {nextBestAction.scheduledFollowUp && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
                <Calendar className="h-4 w-4 shrink-0 text-amber-400" />
                <span><strong>Follow-up agendado:</strong> {new Date(nextBestAction.scheduledFollowUp.date).toLocaleDateString("pt-BR")} — {nextBestAction.scheduledFollowUp.action}</span>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-xs font-semibold text-zinc-300">Como agir:</span>
              <p className="break-words text-sm leading-relaxed text-zinc-200">
                {nextBestAction.guidance}
              </p>
            </div>

            {sections.proximoPasso.map((text, idx) => (
              <p key={idx} className="break-words text-sm font-medium leading-relaxed text-zinc-100">
                {text}
              </p>
            ))}

            {recommendedDay && (
              <p className="break-words text-sm text-zinc-200" data-testid="next-step-day">
                <span className="font-semibold text-white">Dia {recommendedDay.dia}</span>
                {recommendedDay.acao_sugerida ? `: ${recommendedDay.acao_sugerida}` : recommendedDay.objetivo ? `: ${recommendedDay.objetivo}` : ""}
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row pt-1">
              {recommendedDay && onExecuteInSdr && (
                <Button size="sm" className="w-full gap-1.5 sm:w-auto bg-[#10d98a] text-[#0b0f0e] hover:bg-[#10d98a]/90 font-semibold" onClick={() => executeInSdr(recommendedDay.dia)}>
                  <MessageSquare className="h-3.5 w-3.5" />
                  Executar Dia {recommendedDay.dia} no SDR
                </Button>
              )}
              <Button size="sm" variant="outline" className="w-full sm:w-auto border-[#1f2d29] text-zinc-200 hover:bg-[#1f2d29]" onClick={scrollToPlan}>
                Ver plano de 7 dias
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 6. Plano de sete dias */}
      <div id="tour-plano-copies" className="contents">
        <Card id={PLAN_ANCHOR_ID} className="border-[#1f2d29] bg-[#111816]" data-testid="analysis-plan">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
            <MessageSquare className="h-4 w-4 shrink-0 text-[#10d98a]" />
            Plano de 7 dias
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            WhatsApp, Instagram, e-mail, follow-up e resposta para objeção gerados na mesma chamada de IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contactBlocked && (
            <p className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs leading-relaxed text-zinc-200" data-testid="plan-read-only">
              <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <span>Somente consulta: contato bloqueado por recusa registrada. As mensagens abaixo não foram alteradas nem apagadas, mas não podem ser executadas.</span>
            </p>
          )}

          {!nextBestAction.isColdCadenceActive && !contactBlocked && (
            <p className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-950/20 p-3 text-xs leading-relaxed text-zinc-200" data-testid="plan-funnel-paused">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>Cadência fria desativada: este lead está no estágio de <strong>{nextBestAction.badgeLabel}</strong>. O plano de 7 dias abaixo permanece disponível para histórico e consulta.</span>
            </p>
          )}
          {/* Guia operacional: Condução da cadência por tipo de resposta */}
          <div className="mb-4 rounded-xl border border-[#1f2d29] bg-[#0c1210] p-3.5 sm:p-4 text-xs" data-testid="response-branching-guide">
            <div className="flex items-center gap-2 mb-2">
              <GitBranch className="h-4 w-4 text-[#10d98a] shrink-0" />
              <h5 className="font-semibold text-white text-xs">
                Regras de Condução: como agir conforme a reação da empresa
              </h5>
            </div>
            <p className="text-zinc-400 leading-relaxed mb-3">
              Esta cadência de 7 dias representa uma jornada de trabalho semanal com no máximo 3 tentativas ativas de contato. Os outros dias são reservados para pesquisa, espera e CRM. Interrompa ou adapte o fluxo conforme o retorno:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-zinc-300">
              <div className="rounded-lg border border-[#1f2d29] bg-[#111816] p-2.5 space-y-1">
                <span className="font-semibold text-amber-300">1. Sem resposta (silêncio contínuo):</span>
                <p className="text-zinc-400">Respeite o intervalo de 48h a 72h. Nunca envie mensagens em dias seguidos. Se o silêncio persistir após a 3ª mensagem, encerre cordialmente.</p>
              </div>
              <div className="rounded-lg border border-[#10d98a]/30 bg-[#10d98a]/5 p-2.5 space-y-1">
                <span className="font-semibold text-[#10d98a]">2. Demonstrou interesse:</span>
                <p className="text-zinc-400">Interrompa a cadência fria imediatamente! Responda com prioridade no mesmo canal e conduza para qualificação objetiva ou conversa.</p>
              </div>
              <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 p-2.5 space-y-1">
                <span className="font-semibold text-blue-300">3. Pediu informações ou valores:</span>
                <p className="text-zinc-400">Responda de forma consultiva e objetiva com os dados solicitados antes de insistir em reuniões ou ligações.</p>
              </div>
              <div className="rounded-lg border border-purple-500/30 bg-purple-950/20 p-2.5 space-y-1">
                <span className="font-semibold text-purple-300">4. Já tem fornecedor ou equipe:</span>
                <p className="text-zinc-400">Elogie a maturidade da empresa, agradeça a atenção e deixe portas abertas para o futuro sem insistência incômoda.</p>
              </div>
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 space-y-1 md:col-span-2">
                <span className="font-semibold text-rose-300">5. Pediu para não contatar (opt-out):</span>
                <p className="text-zinc-400">Suspenda imediatamente todos os envios. Respeite sem contestar e registre a recusa no CRM para bloquear novas abordagens.</p>
              </div>
            </div>
          </div>

          {!plano.some((d) => String(d.mensagem || "").trim()) && (
            <div className="mb-4 rounded-xl border border-sky-500/40 bg-sky-950/20 p-3.5 sm:p-4 text-xs" data-testid="all-tasks-banner">
              <div className="flex items-center gap-2 mb-1">
                <Info className="h-4 w-4 text-sky-400 shrink-0" />
                <h5 className="font-semibold text-white text-xs">
                  Plano Tático Estruturado em Tarefas Internas
                </h5>
              </div>
              <p className="text-zinc-300 leading-relaxed">
                Nenhuma mensagem pronta para envio direto foi gerada para os canais cadastrados deste lead. O diagnóstico e as etapas abaixo foram estruturados como tarefas de pesquisa, planejamento e qualificação comercial.
              </p>
            </div>
          )}

          <ol className="space-y-4">
            {plano.map((dia) => {
              const hasMessage = Boolean(String(dia.mensagem || "").trim());
              const channelValidation = validateLeadChannelForDay(lead, dia.canal);
              return (
                <li
                  key={dia.dia}
                  className={cn(
                    "min-w-0 rounded-xl overflow-hidden transition-colors",
                    dia.dia === 1
                      ? "border border-[#10d98a]/40 bg-gradient-to-br from-[#111816] via-[#111816] to-[#0d221a] shadow-sm"
                      : "border border-[#1f2d29] bg-[#0d1311] hover:border-zinc-700/60"
                  )}
                  data-testid={`dia-${dia.dia}`}
                >
                  <details className="group" open={dia.dia === 1}>
                    <summary className="cursor-pointer list-none select-none p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-zinc-700 bg-zinc-800/80 text-zinc-200 font-semibold">
                          Dia {dia.dia}
                        </Badge>
                        {dia.dia === 1 && (
                          <Badge variant="default" className="bg-[#10d98a] text-[#0b0f0e] font-bold text-[11px] hover:bg-[#10d98a]">
                            Primeira Abordagem
                          </Badge>
                        )}
                        <Badge variant={dia.canal === "whatsapp" ? "default" : dia.canal === "instagram" ? "outline" : "secondary"} className="gap-1">
                          <ChannelIcon channel={dia.canal} />
                          {CHANNEL_LABEL[dia.canal] ?? "Email"}
                        </Badge>
                        {dia.tipo_dia && DAY_TYPE_LABEL[dia.tipo_dia] && (
                          <Badge variant="outline" className="text-zinc-400 border-zinc-800" data-testid={`dia-${dia.dia}-tipo`}>
                            {DAY_TYPE_LABEL[dia.tipo_dia]}
                          </Badge>
                        )}
                        {hasMessage ? (
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[11px] font-medium">
                            Mensagem pronta
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-zinc-700 bg-zinc-900/60 text-zinc-400 text-[11px]">
                            Tarefa / Pausa / CRM
                          </Badge>
                        )}
                        {!channelValidation.isAvailable && (
                          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300 gap-1 text-[11px]" data-testid={`dia-${dia.dia}-channel-warning-badge`}>
                            <AlertTriangle className="h-3 w-3" />
                            {channelValidation.warningBadge}
                          </Badge>
                        )}
                        {dia.is_custom_edited && (
                          <Badge variant="outline" className="border-[#10d98a]/40 text-[#10d98a]" data-testid={`dia-${dia.dia}-edited`}>
                            Editada por você · mantida em novas análises
                          </Badge>
                        )}
                        {dia.status_dia === "concluido" && (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
                            Concluída · mantida
                          </Badge>
                        )}
                        {contactBlocked && (
                          <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
                            <Ban className="h-3 w-3" />
                            Bloqueado
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-auto">
                        {onExecuteInSdr && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              executeInSdr(dia.dia);
                            }}
                            disabled={contactBlocked || !nextBestAction.isColdCadenceActive || !hasMessage}
                            aria-disabled={contactBlocked || !nextBestAction.isColdCadenceActive || !hasMessage}
                            title={
                              contactBlocked
                                ? "Contato bloqueado por recusa registrada"
                                : !nextBestAction.isColdCadenceActive
                                ? `Cadência fria pausada: lead em ${nextBestAction.badgeLabel}`
                                : !hasMessage
                                ? "Esta etapa não tem mensagem para enviar"
                                : !channelValidation.isAvailable
                                ? channelValidation.warningNote
                                : undefined
                            }
                            className="h-7 border-emerald-500/30 text-xs text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                          >
                            <MessageSquare className="mr-1 h-3 w-3" />
                            Executar no SDR
                          </Button>
                        )}
                        <div className="flex items-center text-zinc-400 group-open:text-zinc-200 transition-transform">
                          <ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" />
                        </div>
                      </div>
                    </summary>

                    <div className="space-y-3 px-3 pb-3 sm:px-4 sm:pb-4 pt-1 text-sm border-t border-[#1f2d29]/60">
                      {!channelValidation.isAvailable && (
                        <div className="rounded-md border border-amber-500/30 bg-amber-950/20 p-2.5 text-xs text-amber-200" data-testid={`dia-${dia.dia}-channel-warning`}>
                          <p className="font-semibold text-amber-300 mb-0.5">{channelValidation.warningBadge}:</p>
                          <p className="text-zinc-300 mb-1">{channelValidation.warningNote}</p>
                          {channelValidation.suggestedAlternative && (
                            <p className="text-amber-200/90 font-medium">Sugestão prática: {channelValidation.suggestedAlternative}</p>
                          )}
                        </div>
                      )}

                      {(dia.objetivo || dia.goal) && (
                        <div className="rounded-md border border-[#1f2d29] bg-[#16201c] p-3">
                          <p className="mb-1 text-xs font-semibold text-zinc-400">
                            Objetivo do dia:
                          </p>
                          <p className="break-words text-sm font-medium text-zinc-100">
                            {dia.objetivo || dia.goal}
                          </p>
                        </div>
                      )}

                      {dia.acao_sugerida && (
                        <div className="rounded-md border border-purple-500/30 bg-purple-950/20 p-3">
                          <p className="mb-1 text-xs font-semibold text-purple-300">
                            {contactBlocked ? "Ação registrada no plano (bloqueada):" : "Ação sugerida:"}
                          </p>
                          <p className="break-words text-sm font-medium text-purple-200">
                            {dia.acao_sugerida}
                          </p>
                        </div>
                      )}

                      {dia.assunto_email && (
                        <div className="rounded-md border border-[#1f2d29] bg-[#16201c] px-3 py-2 text-xs">
                          <span className="font-semibold text-zinc-400">Assunto sugerido: </span>
                          <span className="break-words font-medium text-zinc-100">{dia.assunto_email}</span>
                        </div>
                      )}

                      {dia.condicao && (
                        <div className="rounded-md border border-amber-500/30 bg-amber-950/20 p-3" data-testid={`dia-${dia.dia}-condicao`}>
                          <p className="mb-1 text-xs font-semibold text-amber-300">Quando fazer (condição de resposta):</p>
                          <p className="break-words text-sm text-amber-200">{dia.condicao}</p>
                        </div>
                      )}

                      {hasMessage ? (
                        <>
                          <div className="relative rounded-md border border-[#10d98a]/30 bg-[#10d98a]/5 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="mb-1 font-semibold text-[#10d98a] text-xs">Mensagem:</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyMessage(dia.dia, dia.mensagem, dia.canal);
                                }}
                                disabled={contactBlocked}
                                title={contactBlocked ? "Cópia desativada: contato bloqueado por recusa registrada" : undefined}
                                className="-mr-1 -mt-1 h-7 w-7 shrink-0 p-0 text-zinc-400 hover:text-white hover:bg-[#10d98a]/10"
                                aria-label={`Copiar mensagem do Dia ${dia.dia}`}
                              >
                                {copiedDia === dia.dia ? (
                                  <Check className="h-4 w-4 text-[#10d98a]" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <p className="whitespace-pre-wrap break-words text-zinc-100 font-sans leading-relaxed text-sm">{dia.mensagem}</p>
                          </div>

                          {(dia.objecao_provavel || dia.resposta_sugerida) && (
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                              {dia.objecao_provavel && (
                                <div className="rounded border border-orange-500/30 bg-orange-950/20 p-2.5">
                                  <p className="mb-1 text-xs font-semibold text-orange-400">
                                    Objeção provável:
                                  </p>
                                  <p className="break-words text-xs text-orange-200 leading-relaxed">
                                    {dia.objecao_provavel}
                                  </p>
                                </div>
                              )}

                              {dia.resposta_sugerida && (
                                <div className="rounded border border-emerald-500/30 bg-emerald-950/20 p-2.5">
                                  <p className="mb-1 text-xs font-semibold text-emerald-400">
                                    Resposta sugerida:
                                  </p>
                                  <p className="break-words text-xs text-emerald-200 leading-relaxed">
                                    {dia.resposta_sugerida}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="rounded-md border border-dashed border-[#1f2d29] bg-[#0b0f0e]/50 p-3 text-xs text-zinc-400" data-testid={`dia-${dia.dia}-sem-mensagem`}>
                          <p className="font-semibold text-zinc-300 mb-0.5">Dia de trabalho interno / Sem mensagem ativa:</p>
                          <p className="text-zinc-400 leading-relaxed">
                            {dia.acao_sugerida || "Nenhuma mensagem necessária nesta etapa. Reserve este período para avaliar o silêncio, analisar o contexto da empresa ou atualizar o CRM."}
                          </p>
                        </div>
                      )}

                      {dia.justificativa && (
                        <p className="break-words text-xs text-zinc-400">
                          <span className="font-semibold text-zinc-300">Por que: </span>{dia.justificativa}
                        </p>
                      )}

                      {dia.cta && (
                        <div className="rounded border border-blue-500/30 bg-blue-950/20 p-2">
                          <p className="mb-1 text-xs font-medium text-blue-400">CTA:</p>
                          <p className="break-words text-xs text-blue-200">{dia.cta}</p>
                        </div>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
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
      </div>

      {/* 5. Objeções e Respostas / Guia Tático de Contingências */}
      <Card data-testid="analysis-contingencies" className="border-[#1f2d29] bg-[#111816]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <HelpCircle className="h-4 w-4 shrink-0 text-[#10d98a]" />
                Objeções e Respostas Rápidas
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-1">
                Como responder com naturalidade aos 7 cenários comerciais mais frequentes de retorno e silêncio.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs border-zinc-700 bg-zinc-800/80 text-zinc-300 hidden sm:inline-flex">
              7 Cenários Táticos
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5 pt-0">
          <div className="grid grid-cols-1 gap-2.5">
            {contingencies.items.map((item) => (
              <details
                key={item.id}
                className="group rounded-lg border border-[#1f2d29] bg-[#0e1412] p-3 transition-colors hover:border-[#2a3c37]"
                data-testid={`contingency-${item.id}`}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-white">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-[#10d98a]/20 text-[11px] font-bold text-[#10d98a]">
                      ✓
                    </span>
                    <span>{item.cenario}</span>
                  </div>
                  <span className="text-xs font-normal text-zinc-400 group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <div className="mt-3 space-y-2.5 border-t border-[#1f2d29] pt-2.5 text-xs">
                  <p className="text-zinc-400">
                    <span className="font-semibold text-zinc-300">Quando ocorre: </span>
                    {item.situacao}
                  </p>
                  <div className="rounded-md border border-[#10d98a]/30 bg-[#10d98a]/5 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-[#10d98a]">Resposta sugerida:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          handleCopyContingency(item.id, item.respostaSugerida);
                        }}
                        disabled={contactBlocked}
                        className="-mr-1 -mt-1 h-6 w-6 shrink-0 p-0 hover:bg-[#10d98a]/10 text-zinc-400 hover:text-white"
                        aria-label={`Copiar resposta para ${item.cenario}`}
                      >
                        {copiedContingency === item.id ? (
                          <Check className="h-3.5 w-3.5 text-[#10d98a]" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-zinc-100 font-normal text-xs sm:text-sm leading-relaxed">
                      {item.respostaSugerida}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-zinc-400 pt-0.5">
                    <span><strong className="text-zinc-300">No CRM:</strong> {item.orientacaoCrm}</span>
                    <span className="text-[#10d98a] font-medium">{item.proximaAcao}</span>
                  </div>
                </div>
              </details>
            ))}
          </div>
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

