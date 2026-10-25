import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FlaskConical,
  Target,
  ShieldCheck,
  Sparkles,
  MessageSquare,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Power,
  ArrowRight,
  Compass,
  FileText,
  Layers,
  RefreshCw,
  Building2,
  Play,
  ShieldAlert,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { LeadProspeccao } from "@/types/lead";
import {
  validateLabAccessSecurity,
  isZunoNextLabEnabled,
  setZunoNextLabEnabled,
  triggerLabKillSwitch,
  ZUNO_NEXT_ROADMAP_20,
  ZUNO_COPY_REVIEW_COMPARISON,
} from "@/services/zunoNextLab";
import {
  loadActiveMissionForUser,
  saveActiveMissionForUser,
  evaluateMissionQueue,
  getVilaVelhaDentalMissionDemoLeads,
  createDefaultVilaVelhaMission,
  type ZunoCommercialMission,
} from "@/services/zunoMissionService";
import {
  toggleSevenDayStepCompletion,
  type LeadHistoryStage,
} from "@/services/intelligentSevenDayPlan";
import {
  generateAllSdrStyleVariations,
  auditMessageNaturalness,
  type SdrApproachStyle,
} from "@/services/sdrProspectingService";
import { LeadCommercialDossier } from "@/components/prospeccao/LeadCommercialDossier";
import { SdrWhatsAppModal } from "@/components/prospeccao/SdrWhatsAppModal";

const SERVICE_PRESETS = [
  "Gestão de Tráfego para Clínicas",
  "Criação de Sites e Landing Pages",
  "Social Media e Conteúdo",
  "Automação Comercial e CRM",
];

export default function AdminZunoNextLab() {
  const { user, profile, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const userId = user?.id || "admin_default";

  // Estado de segurança e feature flag
  const [labEnabled, setLabEnabled] = useState<boolean>(() => isZunoNextLabEnabled(userId));
  const securityAudit = useMemo(
    () =>
      validateLabAccessSecurity({
        user,
        profile,
        urlSearch: location.search,
      }),
    [user, profile, location.search]
  );

  // Estado da Missão Comercial
  const [mission, setMission] = useState<ZunoCommercialMission>(() =>
    loadActiveMissionForUser(userId)
  );
  const [dataSourceMode, setDataSourceMode] = useState<"demo_vila_velha" | "supabase_real">(
    "demo_vila_velha"
  );
  const [realLeads, setRealLeads] = useState<LeadProspeccao[]>([]);
  const [isLoadingRealLeads, setIsLoadingRealLeads] = useState<boolean>(false);

  // Simulador de estágio por lead no Laboratório
  const [stageOverrides, setStageOverrides] = useState<Record<string, LeadHistoryStage>>({});
  const [selectedLeadId, setSelectedLeadId] = useState<string>("demo-vv-odonto-1");
  const [sdrModalLead, setSdrModalLead] = useState<LeadProspeccao | null>(null);
  const [planVersion, setPlanVersion] = useState<number>(0);

  // Comparador de serviço no Tab 3
  const [compareService, setCompareService] = useState<string>("Gestão de Tráfego para Clínicas");

  useEffect(() => {
    setLabEnabled(isZunoNextLabEnabled(userId));
    setMission(loadActiveMissionForUser(userId));
  }, [userId]);

  const loadMyRealLeads = async () => {
    if (!user?.id) return;
    setIsLoadingRealLeads(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;

      const mapped: LeadProspeccao[] = (data || []).map((row) => ({
        id: String(row.id),
        placeId: row.place_id ? String(row.place_id) : null,
        nome: String(row.nome || "Empresa"),
        telefone: row.telefone ? String(row.telefone) : null,
        whatsapp_number: row.telefone ? String(row.telefone) : null,
        whatsapp_link: row.whatsapp_link ? String(row.whatsapp_link) : null,
        email: row.email ? String(row.email) : null,
        website: row.website ? String(row.website) : null,
        instagram_url: row.instagram_url ? String(row.instagram_url) : null,
        instagram_context: null,
        endereco: row.endereco ? String(row.endereco) : null,
        cidade: String(row.cidade || "Não informada"),
        nicho: String(row.nicho || "Não informado"),
        foco: (row.foco as LeadProspeccao["foco"]) || "Tráfego",
        proximidadeAtiva: false,
        raioKm: null,
        sinais: {
          has_whatsapp_on_site: Boolean(row.has_whatsapp_on_site),
          has_meta_pixel: Boolean(row.has_meta_pixel),
          has_gtag: Boolean(row.has_gtag),
          has_gtm: Boolean(row.has_gtm),
        },
        diagnostico_bullets: Array.isArray(row.diagnostico_bullets)
          ? (row.diagnostico_bullets as string[])
          : [],
        probabilidade_conversao: Number(row.probabilidade_conversao || 75),
        plano_prospecao_7dias: [],
        rating: typeof row.rating === "number" ? row.rating : null,
        total_reviews: typeof row.total_reviews === "number" ? row.total_reviews : null,
        status: String(row.status || "novo"),
        created_at: String(row.created_at || new Date().toISOString()),
        ai_analise_gerada_em: row.ai_analise_gerada_em ? String(row.ai_analise_gerada_em) : null,
        salvo: Boolean(row.salvo),
        notas: row.notas ? String(row.notas) : null,
        cnpj: null,
        razao_social: null,
        nome_responsavel: null,
        cnpj_telefone: null,
        cnpj_email: null,
        situacao_cadastral: null,
        porte_empresa: null,
        cnae_principal: null,
      }));

      setRealLeads(mapped);
      if (mapped.length > 0) {
        setSelectedLeadId(mapped[0].id);
      }
      toast({
        title: "Leads reais carregados",
        description: `${mapped.length} leads da sua conta foram sincronizados na missão.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao buscar leads.";
      toast({
        variant: "destructive",
        title: "Falha ao carregar leads reais",
        description: msg,
      });
    } finally {
      setIsLoadingRealLeads(false);
    }
  };

  const activeLeads = useMemo(() => {
    if (dataSourceMode === "supabase_real" && realLeads.length > 0) {
      return realLeads;
    }
    return getVilaVelhaDentalMissionDemoLeads();
  }, [dataSourceMode, realLeads]);

  const evaluation = useMemo(
    () => {
      // Reference planVersion to re-evaluate when a day step is toggled
      void planVersion;
      return evaluateMissionQueue(mission, activeLeads, stageOverrides);
    },
    [mission, activeLeads, stageOverrides, planVersion]
  );

  const selectedEvaluatedLead = useMemo(() => {
    return (
      evaluation.allEvaluated.find((item) => item.lead.id === selectedLeadId) ||
      evaluation.prioritizedOpportunities[0] ||
      evaluation.allEvaluated[0] ||
      null
    );
  }, [evaluation, selectedLeadId]);

  // Bloqueio rígido se não for Admin verificado
  if (!isAdmin || !securityAudit.isAdminVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Acesso Restrito ao Administrador
            </CardTitle>
            <CardDescription>{securityAudit.reason}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/prospeccao")} className="w-full">
              Voltar para Prospecção
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleToggleLabFlag = () => {
    if (labEnabled) {
      triggerLabKillSwitch(userId);
      setLabEnabled(false);
      toast({
        title: "Kill-Switch Acionado",
        description:
          "As funcionalidades em teste foram desativadas nas telas padrão. Você pode reativá-las aqui a qualquer momento.",
      });
    } else {
      setZunoNextLabEnabled(userId, true);
      setLabEnabled(true);
      toast({
        title: "Laboratório Zuno Reativado",
        description: "Funcionalidades em teste visíveis novamente para sua conta Admin.",
      });
    }
  };

  const handleSaveMission = (partial: Partial<ZunoCommercialMission>) => {
    const saved = saveActiveMissionForUser(userId, partial);
    setMission(saved);
  };

  const handleResetVilaVelhaDemo = () => {
    const defaultMission = createDefaultVilaVelhaMission(userId);
    const saved = saveActiveMissionForUser(userId, defaultMission);
    setMission(saved);
    setDataSourceMode("demo_vila_velha");
    setStageOverrides({});
    setSelectedLeadId("demo-vv-odonto-1");
    toast({
      title: "Cenário Oficial Restaurado",
      description:
        "Missão 'Gestão de Tráfego para Clínicas Odontológicas em Vila Velha/ES' pronta para inspeção.",
    });
  };

  const handleSimulateStage = (leadId: string, stage: LeadHistoryStage) => {
    setStageOverrides((prev) => ({
      ...prev,
      [leadId]: stage,
    }));
    toast({
      title: "Estado da conversa simulado",
      description: `O Plano de 7 Dias foi adaptado em tempo real para: ${stage.replace(/_/g, " ")}.`,
    });
  };

  const handleToggleDay = (lead: LeadProspeccao, dayNum: number, currentlyCompleted: boolean) => {
    toggleSevenDayStepCompletion({
      userId,
      leadId: lead.id,
      dayNumber: dayNum,
      completed: !currentlyCompleted,
      lead,
    });
    setPlanVersion((v) => v + 1);
  };

  const comparedVariations = selectedEvaluatedLead
    ? generateAllSdrStyleVariations({
        lead: selectedEvaluatedLead.lead,
        userServiceName: compareService,
      })
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader isAdmin={isAdmin} />

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Banner Admin-First + Kill-Switch */}
        <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-amber-500 text-slate-950 font-extrabold uppercase tracking-wider">
                <FlaskConical className="h-3.5 w-3.5 mr-1" />
                LABORATÓRIO ZUNO — Funcionalidades em teste
              </Badge>
              <Badge
                variant="outline"
                className={
                  labEnabled
                    ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                    : "border-destructive/40 text-destructive bg-destructive/10"
                }
              >
                {labEnabled ? "Feature Flag Ativa (Exclusivo Admin)" : "Pausado pelo Kill-Switch"}
              </Badge>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground pt-1">
              Zuno Next V2 — Missões Comerciais, Plano Inteligente de 7 Dias & SDR Personalizado
            </h1>
            <p className="text-xs text-muted-foreground max-w-3xl">
              Ambiente isolado de homologação do proprietário ({user?.email}). Assinantes comuns não possuem acesso a esta rota nem visualizam recursos experimentais até sua aprovação explícita.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetVilaVelhaDemo}
              className="gap-1.5 text-xs"
            >
              <Play className="h-3.5 w-3.5 text-emerald-500" />
              Cenário Vila Velha/ES
            </Button>
            <Button
              type="button"
              variant={labEnabled ? "destructive" : "default"}
              size="sm"
              onClick={handleToggleLabFlag}
              className="gap-1.5 text-xs font-semibold"
            >
              <Power className="h-3.5 w-3.5" />
              {labEnabled ? "Kill-Switch: Pausar Lab" : "Ativar Laboratório"}
            </Button>
          </div>
        </div>

        {/* Navegação Principal do Laboratório */}
        <Tabs defaultValue="missoes" className="space-y-4">
          <TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full h-auto gap-1 p-1">
            <TabsTrigger value="missoes" className="text-xs py-2 gap-1.5">
              <Compass className="h-3.5 w-3.5" />
              1. Zuno Missões & Fila
            </TabsTrigger>
            <TabsTrigger value="plano7dias" className="text-xs py-2 gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              2. Plano Inteligente de 7 Dias
            </TabsTrigger>
            <TabsTrigger value="dossie_sdr" className="text-xs py-2 gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              3. Dossiê & SDR Personalizado
            </TabsTrigger>
            <TabsTrigger value="copies_roadmap" className="text-xs py-2 gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              4. Copies (Antes/Depois) & 20 Evoluções
            </TabsTrigger>
          </TabsList>

          {/* =============================================================== */}
          {/* TAB 1: ZUNO MISSÕES & FILA DIÁRIA DE EXECUÇÃO COMERCIAL          */}
          {/* =============================================================== */}
          <TabsContent value="missoes" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Configuração da Missão */}
              <Card className="lg:col-span-1 border-border/80">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Compass className="h-4 w-4 text-emerald-500" />
                    Configurar Missão Comercial
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Defina seu serviço, praça, segmento e nota mínima de compatibilidade
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Serviço oferecido pelo assinante</Label>
                    <Input
                      value={mission.serviceOffered}
                      onChange={(e) => handleSaveMission({ serviceOffered: e.target.value })}
                      className="h-8 text-xs"
                    />
                    <div className="flex flex-wrap gap-1 pt-1">
                      {SERVICE_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleSaveMission({ serviceOffered: preset })}
                          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                            mission.serviceOffered === preset
                              ? "border-emerald-500 bg-emerald-500/15 text-emerald-400 font-semibold"
                              : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Cidade-alvo</Label>
                      <Input
                        value={mission.targetCity}
                        onChange={(e) => handleSaveMission({ targetCity: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="col-span-1 space-y-1">
                      <Label className="text-xs">UF</Label>
                      <Input
                        value={mission.targetState}
                        onChange={(e) => handleSaveMission({ targetState: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Segmento / Nicho desejado</Label>
                    <Input
                      value={mission.targetSegment}
                      onChange={(e) => handleSaveMission({ targetSegment: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Objetivo comercial da missão</Label>
                    <Input
                      value={mission.commercialObjective}
                      onChange={(e) => handleSaveMission({ commercialObjective: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* Filtro Configurável de Compatibilidade Mínima */}
                  <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <Label className="font-semibold text-foreground">
                        Mostrar oportunidades com compatibilidade a partir de:
                      </Label>
                      <Badge className="bg-emerald-600 text-white font-bold">
                        {mission.minCompatibilityScore}/100
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={mission.minCompatibilityScore}
                        onChange={(e) =>
                          handleSaveMission({ minCompatibilityScore: Number(e.target.value) })
                        }
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={mission.minCompatibilityScore}
                        onChange={(e) =>
                          handleSaveMission({ minCompatibilityScore: Number(e.target.value) })
                        }
                        className="h-7 w-16 text-xs text-center font-bold"
                      />
                    </div>
                  </div>

                  {/* Fonte de leads da missão */}
                  <div className="pt-2 border-t border-border/50 space-y-2">
                    <Label className="text-xs">Fonte de empresas da missão</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={dataSourceMode === "demo_vila_velha" ? "default" : "outline"}
                        onClick={() => setDataSourceMode("demo_vila_velha")}
                        className="h-8 text-[11px]"
                      >
                        Demo Vila Velha/ES
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={dataSourceMode === "supabase_real" ? "default" : "outline"}
                        onClick={() => {
                          setDataSourceMode("supabase_real");
                          loadMyRealLeads();
                        }}
                        disabled={isLoadingRealLeads}
                        className="h-8 text-[11px]"
                      >
                        {isLoadingRealLeads ? (
                          <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                        ) : null}
                        Meus Leads Salvos
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Painel da Missão Atual, Próxima Ação e Oportunidades Priorizadas */}
              <div className="lg:col-span-2 space-y-4">
                {/* Resumo de Progresso Real da Missão */}
                <Card className="border-emerald-500/30">
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-base font-bold">{mission.title}</CardTitle>
                        <CardDescription className="text-xs">
                          {mission.commercialObjective}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-400">
                        Nota mínima ativa: {mission.minCompatibilityScore}/100
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                      <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20">
                        <div className="text-xl font-extrabold text-foreground">
                          {evaluation.progress.totalLeadsMapped}
                        </div>
                        <div className="text-[11px] text-muted-foreground">Empresas Mapeadas</div>
                      </div>
                      <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                        <div className="text-xl font-extrabold text-emerald-400">
                          {evaluation.progress.prioritizedCount}
                        </div>
                        <div className="text-[11px] text-emerald-300">
                          Prioritárias (≥{mission.minCompatibilityScore})
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20">
                        <div className="text-xl font-extrabold text-blue-400">
                          {evaluation.progress.contactsInitiatedCount}
                        </div>
                        <div className="text-[11px] text-muted-foreground">Contatos Iniciados</div>
                      </div>
                      <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20">
                        <div className="text-xl font-extrabold text-amber-400">
                          {evaluation.progress.repliedCount}
                        </div>
                        <div className="text-[11px] text-muted-foreground">Responderam</div>
                      </div>
                      <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20">
                        <div className="text-xl font-extrabold text-zinc-400">
                          {evaluation.progress.optedOutCount}
                        </div>
                        <div className="text-[11px] text-muted-foreground">Opt-out Bloqueado</div>
                      </div>
                    </div>

                    {/* Próxima Ação Recomendada da Missão */}
                    <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          <ArrowRight className="h-4 w-4" />
                          Próxima Ação Recomendada da Missão: {evaluation.nextRecommendedAction.headline}
                        </div>
                        <p className="text-xs text-foreground/90">
                          {evaluation.nextRecommendedAction.detail}
                        </p>
                      </div>
                      {evaluation.nextRecommendedAction.targetLeadId && (
                        <Button
                          size="sm"
                          onClick={() => {
                            if (evaluation.nextRecommendedAction.targetLeadId) {
                              setSelectedLeadId(evaluation.nextRecommendedAction.targetLeadId);
                            }
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs shrink-0"
                        >
                          Selecionar Oportunidade
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Lista de Oportunidades Prioritárias e Secundárias */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center justify-between">
                      <span>Fila de Execução da Missão ({evaluation.allEvaluated.length} empresas)</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        Clique em uma empresa para inspecionar o Dossiê e os 7 Dias
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    {evaluation.allEvaluated.map((item) => {
                      const isSelected = selectedEvaluatedLead?.lead.id === item.lead.id;
                      const isOptOut = item.intelligentPlan.isOptedOutOrRefused;

                      return (
                        <div
                          key={item.lead.id}
                          onClick={() => setSelectedLeadId(item.lead.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-500/10"
                              : "border-border/60 bg-muted/15 hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                  <Building2 className="h-3.5 w-3.5 text-emerald-500" />
                                  {item.lead.nome}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={
                                    item.compatibility.score >= mission.minCompatibilityScore
                                      ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[10px]"
                                      : "border-amber-500/40 text-amber-400 bg-amber-500/10 text-[10px]"
                                  }
                                >
                                  Compatibilidade: {item.compatibility.score}/100
                                </Badge>
                                {item.isAboveMinScore && !isOptOut && (
                                  <Badge className="bg-emerald-600 text-white text-[10px]">
                                    Prioridade SDR
                                  </Badge>
                                )}
                                {isOptOut && (
                                  <Badge variant="destructive" className="text-[10px]">
                                    Opt-out / Recusa (Bloqueado)
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {item.lead.cidade} • {item.lead.nicho} •{" "}
                                <strong className="text-foreground">
                                  {item.intelligentPlan.historyStageLabel}
                                </strong>
                              </p>
                              <p className="text-[11px] text-emerald-400 font-medium">
                                Próximo passo: {item.intelligentPlan.proximaAcaoGlobal}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isOptOut}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSdrModalLead(item.lead);
                                }}
                                className="h-8 text-xs gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                Preparar SDR WhatsApp
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* =============================================================== */}
          {/* TAB 2: PLANO INTELIGENTE DE 7 DIAS & SIMULADOR DE CONTINUIDADE  */}
          {/* =============================================================== */}
          <TabsContent value="plano7dias" className="space-y-4">
            {selectedEvaluatedLead && (
              <>
                <Card className="border-emerald-500/30">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-emerald-500" />
                          Simulador de Continuidade do Plano de 7 Dias —{" "}
                          {selectedEvaluatedLead.lead.nome}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Teste como os 7 dias reagem quando o lead responde, não responde, demonstra interesse, recusa ou quando você retoma no dia seguinte
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-400">
                        Estágio Ativo: {selectedEvaluatedLead.intelligentPlan.historyStageLabel}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: "nao_contatado", label: "1. Ainda não contatado" },
                          {
                            id: "contato_iniciado_sem_resposta",
                            label: "2. Não respondeu (Follow-up sem pressão)",
                          },
                          {
                            id: "empresa_respondeu",
                            label: "3. Empresa respondeu (Sem msg de 1º contato)",
                          },
                          {
                            id: "empresa_interessada",
                            label: "4. Demonstrou interesse (Preparar reunião/demo)",
                          },
                          { id: "reuniao_marcada", label: "5. Reunião marcada" },
                          {
                            id: "recusa_ou_optout",
                            label: "6. Recusou / Opt-out (Bloquear insistência)",
                          },
                        ] as Array<{ id: LeadHistoryStage; label: string }>
                      ).map((st) => (
                        <Button
                          key={st.id}
                          type="button"
                          size="sm"
                          variant={
                            selectedEvaluatedLead.intelligentPlan.historyStage === st.id
                              ? "default"
                              : "outline"
                          }
                          onClick={() => handleSimulateStage(selectedEvaluatedLead.lead.id, st.id)}
                          className="h-8 text-xs"
                        >
                          {st.label}
                        </Button>
                      ))}
                    </div>

                    <div className="p-3 rounded-lg border border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <strong className="text-foreground">Próxima Ação Recomendada: </strong>
                        <span className="text-emerald-400 font-medium">
                          {selectedEvaluatedLead.intelligentPlan.proximaAcaoGlobal}
                        </span>
                        <span className="block text-muted-foreground mt-0.5">
                          {selectedEvaluatedLead.intelligentPlan.resumoContinuidade}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        Dia Recomendado:{" "}
                        <strong>
                          {selectedEvaluatedLead.intelligentPlan.currentRecommendedDay
                            ? `Dia ${selectedEvaluatedLead.intelligentPlan.currentRecommendedDay} de 7`
                            : "Pausado / Finalizado"}
                        </strong>
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Os 7 Dias Detalhados */}
                <div className="grid grid-cols-1 gap-3">
                  {selectedEvaluatedLead.intelligentPlan.days.map((day) => {
                    const isCurrent =
                      selectedEvaluatedLead.intelligentPlan.currentRecommendedDay === day.dia;
                    const isDone = day.status_dia === "concluido";
                    const isBlocked = day.status_dia === "bloqueado_optout";
                    const isAdapted = day.status_dia === "adaptado";

                    return (
                      <Card
                        key={day.dia}
                        className={
                          isCurrent
                            ? "border-emerald-500 bg-emerald-500/5"
                            : isBlocked
                            ? "border-destructive/40 bg-destructive/5"
                            : "border-border/70"
                        }
                      >
                        <CardHeader className="py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="font-bold">
                                Dia {day.dia} de 7
                              </Badge>
                              <Badge variant="secondary" className="uppercase text-[10px]">
                                {day.canal}
                              </Badge>
                              <span className="font-bold text-sm text-foreground">
                                {day.titulo_dia}
                              </span>
                              {isCurrent && (
                                <Badge className="bg-emerald-600 text-white text-[10px]">
                                  Etapa Recomendada Hoje
                                </Badge>
                              )}
                              {isAdapted && (
                                <Badge
                                  variant="outline"
                                  className="border-blue-500/40 text-blue-400 text-[10px]"
                                >
                                  Adaptado pelo Histórico
                                </Badge>
                              )}
                              {isDone && (
                                <Badge
                                  variant="outline"
                                  className="border-emerald-500/40 text-emerald-400 text-[10px]"
                                >
                                  Concluído ✓
                                </Badge>
                              )}
                            </div>

                            {!isBlocked && (
                              <Button
                                type="button"
                                size="sm"
                                variant={isDone ? "secondary" : "outline"}
                                onClick={() =>
                                  handleToggleDay(selectedEvaluatedLead.lead, day.dia, isDone)
                                }
                                className="h-7 text-xs"
                              >
                                {isDone
                                  ? "Concluído (Clique para reabrir)"
                                  : "Marcar Dia Concluído"}
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3 text-xs pt-0">
                          {day.adaptation_reason && (
                            <div className="p-2.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-300">
                              <strong>Adaptação Inteligente:</strong> {day.adaptation_reason}
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                            <div className="p-2.5 rounded border border-border/60 bg-background/60">
                              <strong className="text-foreground block mb-1">
                                1. O que fazer (Objetivo & Ação):
                              </strong>
                              <p className="text-muted-foreground">{day.objetivo}</p>
                              <p className="text-emerald-400 font-medium mt-1">
                                Ação: {day.acao_sugerida}
                              </p>
                            </div>
                            <div className="p-2.5 rounded border border-border/60 bg-background/60">
                              <strong className="text-foreground block mb-1">
                                2. Como executar a tarefa:
                              </strong>
                              <p className="text-muted-foreground">{day.explicacao_tarefa}</p>
                              {day.informacoes_necessarias && (
                                <p className="text-[11px] text-muted-foreground/80 mt-1">
                                  Dados usados: {day.informacoes_necessarias.join(" • ")}
                                </p>
                              )}
                            </div>
                            <div className="p-2.5 rounded border border-border/60 bg-background/60">
                              <strong className="text-foreground block mb-1">
                                3. Critério de conclusão & Próximo passo:
                              </strong>
                              <p className="text-muted-foreground">
                                Concluído quando: {day.criterio_conclusao}
                              </p>
                              <p className="text-blue-400 mt-1">
                                Depois: {day.proxima_acao_sugerida}
                              </p>
                            </div>
                          </div>

                          <div className="p-3 rounded-md border border-primary/20 bg-primary/5 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <strong className="text-foreground">
                                Mensagem contextual recomendada para o Dia {day.dia}:
                              </strong>
                              <span className="text-[11px] text-muted-foreground">
                                CTA: {day.cta}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap text-foreground/95 leading-relaxed font-sans">
                              {day.mensagem}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          {/* =============================================================== */}
          {/* TAB 3: DOSSIÊ COMERCIAL & COMPARADOR SDR POR SERVIÇO            */}
          {/* =============================================================== */}
          <TabsContent value="dossie_sdr" className="space-y-4">
            {selectedEvaluatedLead && (
              <>
                <LeadCommercialDossier
                  lead={selectedEvaluatedLead.lead}
                  userServiceName={mission.serviceOffered}
                  commercialObjective={mission.commercialObjective}
                  minScoreThreshold={mission.minCompatibilityScore}
                />

                {/* Comparador de Personalização Real por Serviço e Estilo */}
                <Card className="border-border/80">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-emerald-500" />
                          Prova de Personalização Real — Mudança de Argumento por Serviço e Estilo
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Alterne o serviço abaixo para comprovar como o argumento comercial muda de verdade (e não apenas trocando uma palavra)
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {SERVICE_PRESETS.map((srv) => (
                          <Button
                            key={srv}
                            type="button"
                            size="sm"
                            variant={compareService === srv ? "default" : "outline"}
                            onClick={() => setCompareService(srv)}
                            className="h-7 text-[11px]"
                          >
                            {srv}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {comparedVariations && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {(["consultivo", "direto", "exemplo_pratico"] as SdrApproachStyle[]).map(
                          (stKey) => {
                            const msgObj = comparedVariations[stKey];
                            const audit = auditMessageNaturalness(msgObj.text);

                            return (
                              <div
                                key={stKey}
                                className="p-3.5 rounded-lg border border-border/70 bg-muted/20 flex flex-col justify-between space-y-3"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="uppercase text-[10px] font-bold">
                                      Estilo: {stKey.replace("_", " ")}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className="border-emerald-500/40 text-emerald-400 text-[10px]"
                                    >
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      {audit.isNatural
                                        ? `Natural (${audit.wordCount} palavras)`
                                        : "Revisar"}
                                    </Badge>
                                  </div>
                                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground font-sans">
                                    {msgObj.text}
                                  </p>
                                </div>
                                <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
                                  Categoria resolvida: <strong>{msgObj.serviceCategory}</strong> • Zero clichês robóticos
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* =============================================================== */}
          {/* TAB 4: REVISÃO DE COPIES (ANTES -> DEPOIS) & ROADMAP 20 ITENS   */}
          {/* =============================================================== */}
          <TabsContent value="copies_roadmap" className="space-y-6">
            {/* Revisão de Copies ANTES -> DEPOIS -> POR QUE MELHOROU */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-500" />
                  Revisão Completa das Copies Comerciais (ANTES → DEPOIS → POR QUE MELHOROU)
                </CardTitle>
                <CardDescription className="text-xs">
                  Comparativo auditável das melhorias textuais sem alterar preços, Stripe, Mercado Pago ou regras de assinatura
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {ZUNO_COPY_REVIEW_COMPARISON.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-lg border border-border/70 bg-muted/15 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-foreground">{item.sectionLabel}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {item.contextLabel}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                      <div className="p-2.5 rounded border border-destructive/30 bg-destructive/5">
                        <span className="font-bold text-destructive block mb-1">ANTES:</span>
                        <p className="text-muted-foreground">{item.beforeText}</p>
                      </div>
                      <div className="p-2.5 rounded border border-emerald-500/30 bg-emerald-500/5">
                        <span className="font-bold text-emerald-400 block mb-1">DEPOIS:</span>
                        <p className="text-foreground">{item.afterText}</p>
                      </div>
                      <div className="p-2.5 rounded border border-blue-500/30 bg-blue-500/5">
                        <span className="font-bold text-blue-400 block mb-1">
                          POR QUE MELHOROU:
                        </span>
                        <p className="text-muted-foreground">{item.whyImproved}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Roadmap das 20 Evoluções */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-500" />
                  Mapa das 20 Evoluções do Produto (Fase 1, Fase 2 e Fase 3)
                </CardTitle>
                <CardDescription className="text-xs">
                  Organização modular sem poluir a interface principal dos assinantes
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ZUNO_NEXT_ROADMAP_20.map((evo) => (
                  <div
                    key={evo.id}
                    className="p-3 rounded-lg border border-border/60 bg-muted/15 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-foreground">
                        #{evo.id}. {evo.title}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          evo.phase === "fase_1_laboratorio_admin"
                            ? "border-emerald-500/40 text-emerald-400 text-[10px]"
                            : evo.phase === "fase_2_addons_comerciais"
                            ? "border-blue-500/40 text-blue-400 text-[10px]"
                            : "border-amber-500/40 text-amber-400 text-[10px]"
                        }
                      >
                        {evo.phase === "fase_1_laboratorio_admin"
                          ? "Fase 1 — Ativo no Lab"
                          : evo.phase === "fase_2_addons_comerciais"
                          ? "Fase 2 — Add-on Comercial"
                          : "Fase 3 — Avançada"}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">{evo.summary}</p>
                    <p className="text-[11px] text-emerald-400/90">
                      Benefício: {evo.userBenefit}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Governança Futura: Envio Automático Oficial via WhatsApp Business API */}
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-500" />
                  Avaliação Técnica: Envio Automático Oficial Futuro (Fase 3 — Desativado)
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1.5">
                <p>
                  <strong className="text-foreground">Status atual:</strong> Nenhum disparo automático é realizado. Leads sem opt-in permanecem em "Abordagem preparada" com abertura manual no WhatsApp do assinante (`https://wa.me/`).
                </p>
                <p>
                  <strong className="text-foreground">Requisitos obrigatórios para futura ativação oficial:</strong> (1) WABA do próprio assinante via API oficial da Meta; (2) Opt-in verificável do destinatário; (3) Template aprovado pela Meta; (4) Nota mínima de compatibilidade atingida; (5) Bloqueio de duplicatas e opt-out; (6) Teto de orçamento e volume diário; (7) Kill-switch imediato e transferência humana ao responder. Proibido uso de QR Code não oficial.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <SdrWhatsAppModal
        lead={sdrModalLead}
        open={Boolean(sdrModalLead)}
        onOpenChange={(open) => {
          if (!open) setSdrModalLead(null);
        }}
        onStatusUpdated={(leadId, newStatus) => {
          if (newStatus === "respondeu") handleSimulateStage(leadId, "empresa_respondeu");
          else if (newStatus === "qualificacao") handleSimulateStage(leadId, "empresa_interessada");
          else if (newStatus === "negociacao") handleSimulateStage(leadId, "reuniao_marcada");
          else if (newStatus === "perdido") handleSimulateStage(leadId, "recusa_ou_optout");
          else handleSimulateStage(leadId, "contato_iniciado_sem_resposta");
        }}
      />
    </div>
  );
}
