/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bot,
  BrainCircuit,
  Check,
  ChevronDown,
  CircleDollarSign,
  Instagram,
  Loader2,
  Megaphone,
  MessageSquareText,
  Palette,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type MarketingSettings = {
  singleton: boolean;
  company_name: string;
  product_context: string;
  primary_offer: string;
  default_audience: string;
  brand_voice: string;
  approval_mode: "approval" | "automatic";
  monthly_paid_media_cap: number;
  daily_paid_media_cap: number;
  auto_daily_planning: boolean;
  daily_planning_time: string;
  timezone: string;
  guardrails: Record<string, unknown>;
};

type MarketingCampaign = {
  id: string;
  name: string;
  objective: string;
  offer: string;
  target_audience: string;
  channels: string[];
  paid_media_monthly_budget: number;
  paid_media_daily_budget: number;
  status: string;
  approval_status: string;
  next_action: string | null;
  created_at: string;
};

type MarketingTask = {
  id: string;
  campaign_id: string;
  agent_key: string;
  stage_order: number;
  title: string;
  brief: string;
  status: string;
  requires_approval: boolean;
  output: Record<string, unknown>;
  reviewer_notes: string | null;
  error_message: string | null;
  completed_at: string | null;
};

const defaultSettings: MarketingSettings = {
  singleton: true,
  company_name: "Zuno Propect",
  product_context: "Plataforma de prospecção B2B que encontra empresas por cidade e nicho, organiza leads e gera diagnósticos e abordagens contextualizadas com IA.",
  primary_offer: "Teste grátis de 7 dias da Zuno Propect no plano escolhido, com cartão obrigatório e R$0 cobrados hoje.",
  default_audience: "Prestadores de serviços B2B, agências e profissionais comerciais que precisam prospectar com mais consistência.",
  brand_voice: "Direta, humana, prática, confiável e sem promessas de resultado garantido.",
  approval_mode: "approval",
  monthly_paid_media_cap: 0,
  daily_paid_media_cap: 0,
  auto_daily_planning: false,
  daily_planning_time: "07:30:00",
  timezone: "America/Sao_Paulo",
  guardrails: {},
};

const agentMeta: Record<string, { name: string; icon: typeof Bot; color: string }> = {
  marketing_director: { name: "Diretor de Marketing", icon: BrainCircuit, color: "text-violet-400" },
  traffic_manager: { name: "Gestor de Tráfego", icon: Target, color: "text-sky-400" },
  copywriter: { name: "Copywriter", icon: MessageSquareText, color: "text-amber-400" },
  creative_director: { name: "Diretor de Arte", icon: Palette, color: "text-pink-400" },
  social_media: { name: "Social Media", icon: Instagram, color: "text-fuchsia-400" },
  sdr: { name: "SDR", icon: Users, color: "text-emerald-400" },
  closer: { name: "Closer", icon: CircleDollarSign, color: "text-lime-400" },
  performance_analyst: { name: "Analista de Performance", icon: BarChart3, color: "text-cyan-400" },
};

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  planning: "Planejando",
  generating: "Time trabalhando",
  pending_approval: "Aguardando aprovação",
  approved: "Aprovado",
  active: "Ativo",
  paused: "Pausado",
  completed: "Concluído",
  failed: "Falhou",
  queued: "Na fila",
  running: "Trabalhando",
  rejected: "Rejeitado",
};

const statusClass: Record<string, string> = {
  planning: "border-violet-500/30 bg-violet-500/10 text-violet-400",
  generating: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  running: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  pending_approval: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  active: "border-lime-500/30 bg-lime-500/10 text-lime-400",
  failed: "border-red-500/30 bg-red-500/10 text-red-400",
  rejected: "border-red-500/30 bg-red-500/10 text-red-400",
  queued: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
};

function formatKey(key: string) {
  const labels: Record<string, string> = {
    executive_summary: "Resumo executivo",
    positioning: "Posicionamento",
    primary_goal: "Meta principal",
    offer_strategy: "Estratégia da oferta",
    audience_hypotheses: "Hipóteses de público",
    priorities_next_7_days: "Prioridades dos próximos 7 dias",
    success_criteria: "Critérios de sucesso",
    handoffs: "Direcionamento para o time",
    budget: "Orçamento de mídia paga",
    campaign_structure: "Estrutura da campanha",
    audiences: "Públicos",
    tests: "Testes",
    launch_checklist: "Checklist de lançamento",
    stop_rules: "Regras para pausar",
    scale_rules: "Regras para escalar",
    message_strategy: "Estratégia da mensagem",
    ads: "Copies de anúncios",
    landing_page: "Copy da página",
    visual_direction: "Direção visual",
    creatives: "Criativos",
    weekly_strategy: "Estratégia semanal",
    posts: "Posts",
    icp: "Perfil de cliente ideal",
    sourcing_filters: "Filtros de busca",
    sequence: "Cadência",
    discovery_questions: "Perguntas de diagnóstico",
    demo_flow: "Roteiro de demonstração",
    objection_handling: "Tratamento de objeções",
    funnel_metrics: "Métricas do funil",
    decision_rules: "Regras de decisão",
  };
  return labels[key] || key.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function ArtifactValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) {
    if (!value.length) return null;
    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={index} className={typeof item === "object" ? "rounded-lg border border-border/60 bg-background/50 p-3" : "flex gap-2 text-sm leading-6"}>
            {typeof item !== "object" && <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
            <ArtifactValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    return (
      <div className="space-y-3">
        {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
          <div key={key}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{formatKey(key)}</p>
            <ArtifactValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  return <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">{String(value)}</p>;
}

function functionError(error: any, data: any) {
  return data?.error || error?.message || "Não foi possível concluir a operação.";
}

export default function AdminMarketing() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<MarketingSettings>(defaultSettings);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [tasks, setTasks] = useState<MarketingTask[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "Piloto — primeiros clientes da Zuno",
    objective: "Gerar testes grátis qualificados e transformar os primeiros usuários em assinantes.",
    offer: defaultSettings.primary_offer,
    target_audience: defaultSettings.default_audience,
    paid_media_monthly_budget: "0",
  });

  const loadData = async (preferredId?: string) => {
    try {
      const client = supabase as any;
      const [settingsResult, campaignsResult] = await Promise.all([
        client.from("marketing_settings").select("*").eq("singleton", true).single(),
        client.from("marketing_campaigns").select("*").order("created_at", { ascending: false }).limit(30),
      ]);
      if (settingsResult.error) throw settingsResult.error;
      if (campaignsResult.error) throw campaignsResult.error;
      const nextSettings = settingsResult.data || defaultSettings;
      const nextCampaigns = campaignsResult.data || [];
      setSettings(nextSettings);
      setCampaigns(nextCampaigns);
      const campaignId = preferredId || selectedId || nextCampaigns[0]?.id || null;
      setSelectedId(campaignId);
      if (campaignId) {
        const tasksResult = await client.from("marketing_tasks").select("*")
          .eq("campaign_id", campaignId).order("stage_order", { ascending: true });
        if (tasksResult.error) throw tasksResult.error;
        setTasks(tasksResult.data || []);
      } else {
        setTasks([]);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Central de Marketing indisponível",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (selectedId && campaigns.length) void loadData(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (settings.primary_offer && form.offer === defaultSettings.primary_offer) {
      setForm((current) => ({
        ...current,
        offer: settings.primary_offer,
        target_audience: settings.default_audience,
        paid_media_monthly_budget: String(settings.monthly_paid_media_cap),
      }));
    }
  }, [settings.primary_offer]);

  const selected = campaigns.find((campaign) => campaign.id === selectedId) || null;
  const finishedCount = tasks.filter((task) => !["queued", "running", "failed"].includes(task.status)).length;
  const progress = tasks.length ? (finishedCount / tasks.length) * 100 : 0;
  const pendingApprovals = tasks.filter((task) => task.status === "pending_approval").length;

  const currentAgentName = useMemo(() => {
    if (activeAgent) return agentMeta[activeAgent]?.name || activeAgent;
    const activeTask = tasks.find((task) => task.status === "running") || tasks.find((task) => task.status === "queued");
    return activeTask ? agentMeta[activeTask.agent_key]?.name || activeTask.title : null;
  }, [activeAgent, tasks]);

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("marketing-orchestrator", { body });
    if (error || !data?.success) throw new Error(functionError(error, data));
    return data;
  };

  const runTeam = async (campaignId: string) => {
    setRunning(true);
    try {
      for (let step = 0; step < 10; step += 1) {
        const data = await invoke({ action: "run_next", campaign_id: campaignId });
        setActiveAgent(data.next_agent || null);
        await loadData(campaignId);
        if (data.done) break;
      }
      toast({
        title: "Time de marketing concluiu o trabalho",
        description: "As entregas estão salvas e aguardam sua revisão antes de qualquer execução.",
      });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Um agente não conseguiu concluir", description: error.message });
      await loadData(campaignId);
    } finally {
      setRunning(false);
      setActiveAgent(null);
    }
  };

  const createCampaign = async () => {
    setCreating(true);
    try {
      const data = await invoke({
        action: "create_campaign",
        ...form,
        paid_media_monthly_budget: Number(form.paid_media_monthly_budget),
        channels: ["instagram", "whatsapp"],
      });
      const campaignId = data.campaign.id as string;
      setSelectedId(campaignId);
      await loadData(campaignId);
      toast({ title: "Campanha criada", description: "O Diretor de Marketing começou a distribuir o trabalho." });
      await runTeam(campaignId);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Não foi possível criar a campanha", description: error.message });
    } finally {
      setCreating(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("marketing_settings").upsert({
        ...settings,
        singleton: true,
        monthly_paid_media_cap: Number(settings.monthly_paid_media_cap),
        daily_paid_media_cap: Number(settings.daily_paid_media_cap),
      });
      if (error) throw error;
      toast({ title: "Limites salvos", description: "O time deve respeitar esses tetos em todas as campanhas." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao salvar limites", description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const approveCampaign = async () => {
    if (!selected) return;
    setBusyTask("campaign");
    try {
      await invoke({ action: "approve_campaign", campaign_id: selected.id });
      toast({
        title: "Campanha aprovada",
        description: "As entregas estão liberadas para produção. Nenhuma verba de mídia paga foi gasta automaticamente.",
      });
      await loadData(selected.id);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Falha na aprovação", description: error.message });
    } finally {
      setBusyTask(null);
    }
  };

  const taskAction = async (task: MarketingTask, action: "approve_task" | "retry_task" | "send_social_to_instagram") => {
    setBusyTask(task.id + action);
    try {
      const data = await invoke({ action, task_id: task.id });
      const message = action === "approve_task"
        ? "Entrega aprovada."
        : action === "retry_task"
        ? "Tarefa recolocada na fila."
        : data.already_sent
        ? "Este lote já estava na fila do Instagram."
        : `${data.posts?.length || 0} post(s) enviados para revisão no Instagram.`;
      toast({ title: "Operação concluída", description: message });
      await loadData(task.campaign_id);
      if (action === "retry_task") await runTeam(task.campaign_id);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Não foi possível concluir", description: error.message });
    } finally {
      setBusyTask(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader isAdmin={isAdmin} />
        <div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader isAdmin={isAdmin} />
      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <section className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-violet-500/10 p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <Badge className="mb-3 border-primary/30 bg-primary/10 text-primary" variant="outline">
                <BrainCircuit className="mr-1 h-3.5 w-3.5" /> Marketing OS
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight">Seu time de marketing dentro da Zuno</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Um diretor central coordena estratégia, tráfego, copy, design, conteúdo, SDR, closer e performance. Você revisa os pontos críticos; o histórico fica salvo.
              </p>
            </div>
            <div className="grid shrink-0 grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border bg-background/70 p-3"><p className="text-2xl font-bold">8</p><p className="text-[10px] uppercase text-muted-foreground">agentes</p></div>
              <div className="rounded-xl border bg-background/70 p-3"><p className="text-2xl font-bold text-primary">R$ {Number(settings.monthly_paid_media_cap).toFixed(0)}</p><p className="text-[10px] uppercase text-muted-foreground">Meta/mês</p></div>
              <div className="rounded-xl border bg-background/70 p-3"><ShieldCheck className="mx-auto h-7 w-7 text-emerald-400" /><p className="text-[10px] uppercase text-muted-foreground">aprovação</p></div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Acionar o time</CardTitle>
              <CardDescription>Crie um único piloto comercial. O time trabalha em sequência e entrega tudo para sua aprovação.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2"><Label>Nome da campanha</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Objetivo de negócio</Label><Textarea rows={2} value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} /></div>
              <div className="space-y-2"><Label>Oferta</Label><Textarea rows={3} value={form.offer} onChange={(event) => setForm({ ...form, offer: event.target.value })} /></div>
              <div className="space-y-2"><Label>Público inicial</Label><Textarea rows={3} value={form.target_audience} onChange={(event) => setForm({ ...form, target_audience: event.target.value })} /></div>
              <div className="space-y-2"><Label>Verba máxima para anúncios pagos (R$/mês)</Label><Input type="number" min="0" max={settings.monthly_paid_media_cap} step="10" value={form.paid_media_monthly_budget} onChange={(event) => setForm({ ...form, paid_media_monthly_budget: event.target.value })} /><p className="text-xs text-muted-foreground">Este valor limita apenas Meta Ads e outras mídias pagas.</p></div>
              <div className="flex items-end"><Button className="w-full gap-2" onClick={createCampaign} disabled={creating || running || !form.name.trim()}>{creating || running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{running ? `Trabalhando: ${currentAgentName || "time"}` : "Criar campanha e acionar time"}</Button></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-400" /> Limites de mídia paga</CardTitle>
              <CardDescription>Esses controles valem somente para dinheiro investido em anúncios.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Teto mensal de anúncios</Label><Input type="number" min="0" value={settings.monthly_paid_media_cap} onChange={(event) => setSettings({ ...settings, monthly_paid_media_cap: Number(event.target.value) })} /></div>
                <div className="space-y-2"><Label>Teto diário de anúncios</Label><Input type="number" min="0" value={settings.daily_paid_media_cap} onChange={(event) => setSettings({ ...settings, daily_paid_media_cap: Number(event.target.value) })} /></div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div><p className="text-sm font-medium">Planejamento diário às 7h30</p><p className="text-xs text-muted-foreground">Fica preparado para o agendador; mantenha desligado durante o piloto.</p></div>
                <Switch checked={settings.auto_daily_planning} onCheckedChange={(checked) => setSettings({ ...settings, auto_daily_planning: checked })} />
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-muted-foreground">
                Mídia paga está pausada em R$ 0. Os agentes continuam trabalhando com conteúdo orgânico, SDR, closer e melhorias da Zuno. Publicação e WhatsApp continuam exigindo aprovação por segurança.
              </div>
              <Button variant="outline" className="w-full gap-2" onClick={saveSettings} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar limites</Button>
            </CardContent>
          </Card>
        </div>

        {campaigns.length > 0 && (
          <Card>
            <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <Label className="text-xs text-muted-foreground">Campanha em análise</Label>
                <div className="relative mt-1">
                  <select className="h-10 w-full appearance-none rounded-md border border-input bg-background px-3 pr-9 text-sm" value={selectedId || ""} onChange={(event) => setSelectedId(event.target.value)}>
                    {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name} — {statusLabel[campaign.status] || campaign.status}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => loadData(selectedId || undefined)}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
            </CardContent>
          </Card>
        )}

        {selected && (
          <section className="space-y-5">
            <Card>
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{selected.name}</h2><Badge variant="outline" className={statusClass[selected.status]}>{statusLabel[selected.status] || selected.status}</Badge></div>
                    <p className="text-sm leading-6 text-muted-foreground">{selected.objective}</p>
                    <div className="mt-3 flex flex-wrap gap-2">{selected.channels.map((channel) => <Badge key={channel} variant="secondary">{channel.replace("meta_ads", "Meta Ads")}</Badge>)}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg border p-3"><p className="text-lg font-bold">R$ {Number(selected.paid_media_monthly_budget).toFixed(0)}</p><p className="text-muted-foreground">anúncios/mês</p></div>
                    <div className="rounded-lg border p-3"><p className="text-lg font-bold">R$ {Number(selected.paid_media_daily_budget).toFixed(2)}</p><p className="text-muted-foreground">anúncios/dia</p></div>
                    <div className="rounded-lg border p-3"><p className="text-lg font-bold">{finishedCount}/{tasks.length}</p><p className="text-muted-foreground">entregas</p></div>
                  </div>
                </div>
                <div className="mt-5 space-y-2"><div className="flex justify-between text-xs text-muted-foreground"><span>{running ? `Em execução: ${currentAgentName}` : selected.next_action}</span><span>{Math.round(progress)}%</span></div><Progress value={progress} /></div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {tasks.some((task) => task.status === "queued") && <Button className="gap-2" onClick={() => runTeam(selected.id)} disabled={running}><Play className="h-4 w-4" /> Continuar o time</Button>}
                  {selected.status === "pending_approval" && <Button className="gap-2" onClick={approveCampaign} disabled={busyTask === "campaign"}>{busyTask === "campaign" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Aprovar campanha completa ({pendingApprovals})</Button>}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {tasks.map((task) => {
                const meta = agentMeta[task.agent_key] || { name: task.agent_key, icon: Bot, color: "text-muted-foreground" };
                const Icon = meta.icon;
                const hasOutput = task.output && Object.keys(task.output).length > 0;
                return (
                  <Card key={task.id} className={task.status === "running" ? "border-sky-500/40" : ""}>
                    <CardHeader className="pb-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex gap-3"><div className="rounded-xl border bg-muted/40 p-2.5"><Icon className={`h-5 w-5 ${meta.color}`} /></div><div><CardTitle className="text-base">{meta.name}</CardTitle><CardDescription className="mt-1">{task.brief}</CardDescription></div></div>
                        <Badge variant="outline" className={statusClass[task.status]}>{task.status === "running" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}{statusLabel[task.status] || task.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {task.error_message && <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-400">{task.error_message}</div>}
                      {hasOutput && <details open={task.agent_key === "marketing_director"} className="group rounded-xl border bg-muted/20"><summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">Ver entrega completa</summary><div className="border-t px-4 py-4"><ArtifactValue value={task.output} /></div></details>}
                      <div className="flex flex-wrap gap-2">
                        {task.status === "pending_approval" && <Button size="sm" variant="outline" className="gap-2" onClick={() => taskAction(task, "approve_task")} disabled={busyTask === task.id + "approve_task"}><Check className="h-4 w-4" /> Aprovar entrega</Button>}
                        {["failed", "rejected"].includes(task.status) && <Button size="sm" variant="outline" className="gap-2" onClick={() => taskAction(task, "retry_task")} disabled={busyTask === task.id + "retry_task"}><RotateCcw className="h-4 w-4" /> Refazer</Button>}
                        {task.agent_key === "social_media" && task.status === "approved" && <Button size="sm" className="gap-2" onClick={() => taskAction(task, "send_social_to_instagram")} disabled={busyTask === task.id + "send_social_to_instagram"}>{busyTask === task.id + "send_social_to_instagram" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar para fila do Instagram</Button>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {!selected && (
          <Card className="border-dashed"><CardContent className="flex flex-col items-center py-14 text-center"><Megaphone className="mb-4 h-10 w-10 text-muted-foreground" /><h2 className="font-semibold">Nenhuma campanha ainda</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">Use o formulário acima para montar o primeiro piloto da Zuno com o time completo.</p></CardContent></Card>
        )}
      </main>
    </div>
  );
}
