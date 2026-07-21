import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Activity,
  Bell,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Instagram,
  Loader2,
  Mail,
  Megaphone,
  MessageSquareText,
  Palette,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Target,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type ContentPost = {
  id: string;
  status: string;
  objective: string;
  format: "single" | "carousel";
  theme: string;
  hook: string;
  caption: string;
  media_url: string | null;
  media_urls: string[];
  scheduled_at: string | null;
  created_at: string;
};

type MarketingTask = {
  id: string;
  campaign_id: string;
  agent_key: string;
  title: string;
  brief: string;
  status: string;
  requires_approval: boolean;
  output: Record<string, unknown>;
  reviewer_notes: string | null;
  created_at: string;
  marketing_campaigns?: { name?: string } | null;
};

type AgentMeta = {
  key: string;
  name: string;
  role: string;
  icon: typeof BrainCircuit;
  color: string;
};

const agents: AgentMeta[] = [
  { key: "marketing_director", name: "Diretor", role: "Organiza estratégia, prioridades e os repasses para todo o time.", icon: BrainCircuit, color: "text-violet-400" },
  { key: "traffic_manager", name: "Tráfego", role: "Planeja campanhas, públicos, testes e orçamento de mídia paga.", icon: Target, color: "text-sky-400" },
  { key: "copywriter", name: "Copy", role: "Produz headlines, anúncios, páginas, nutrição e mensagens de venda.", icon: MessageSquareText, color: "text-amber-400" },
  { key: "creative_director", name: "Design", role: "Define os criativos, a direção visual e os materiais de campanha.", icon: Palette, color: "text-pink-400" },
  { key: "social_media", name: "Social", role: "Cuida do calendário, posts, Stories, legendas e comunidade.", icon: Instagram, color: "text-fuchsia-400" },
  { key: "sdr", name: "SDR", role: "Pesquisa, prioriza e qualifica oportunidades de prospecção.", icon: Users, color: "text-emerald-400" },
  { key: "closer", name: "Closer", role: "Trata objeções, recomenda o plano e conduz o fechamento.", icon: CircleDollarSign, color: "text-lime-400" },
  { key: "performance_analyst", name: "Performance", role: "Acompanha o funil, os indicadores e as próximas decisões.", icon: BarChart3, color: "text-cyan-400" },
];

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  pending_review: "Revisar",
  approved: "Aprovado",
  scheduled: "Agendado",
  publishing: "Publicando",
  published: "Publicado",
  rejected: "Rejeitado",
  failed: "Falhou",
  queued: "Na fila",
  running: "Trabalhando",
  pending_approval: "Aprovar",
  completed: "Concluído",
};

const statusClass: Record<string, string> = {
  pending_review: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  pending_approval: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  approved: "border-sky-500/30 bg-sky-500/10 text-sky-500",
  scheduled: "border-violet-500/30 bg-violet-500/10 text-violet-500",
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  running: "border-cyan-500/30 bg-cyan-500/10 text-cyan-500",
  failed: "border-red-500/30 bg-red-500/10 text-red-500",
  rejected: "border-zinc-500/30 bg-zinc-500/10 text-zinc-500",
};

function dayKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function postImage(post: ContentPost) {
  return post.media_urls?.[0] || post.media_url || null;
}

function PostRow({ post, busy, onAction }: {
  post: ContentPost;
  busy: boolean;
  onAction: (post: ContentPost, action: "approve" | "reject") => void;
}) {
  const scheduled = post.scheduled_at ? new Date(post.scheduled_at) : null;
  const image = postImage(post);
  return (
    <div className="grid gap-3 rounded-xl border bg-card/60 p-3 sm:grid-cols-[72px_1fr_auto] sm:items-center">
      {image ? (
        <img src={image} alt={post.hook} className="aspect-[4/5] h-[88px] w-[70px] rounded-lg border object-cover" />
      ) : (
        <div className="flex h-[88px] w-[70px] items-center justify-center rounded-lg border bg-muted/40">
          <Palette className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          {scheduled && <span className="text-xs font-semibold text-primary">{scheduled.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })} às {scheduled.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
          <Badge variant="outline" className={statusClass[post.status] || ""}>{statusLabel[post.status] || post.status}</Badge>
          <Badge variant="secondary">{post.format === "carousel" ? "Carrossel" : "Post"}</Badge>
        </div>
        <p className="line-clamp-2 text-sm font-semibold leading-5">{post.hook}</p>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{post.theme}</p>
      </div>
      {post.status === "pending_review" && (
        <div className="flex flex-wrap gap-2 sm:flex-col">
          <Button size="sm" className="gap-1.5" onClick={() => onAction(post, "approve")} disabled={busy || !image}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Aprovar
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => onAction(post, "reject")} disabled={busy}>
            <X className="h-4 w-4" /> Rejeitar
          </Button>
        </div>
      )}
    </div>
  );
}

export function CommandCenterOperations({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { toast } = useToast();
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [tasks, setTasks] = useState<MarketingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const today = dayKey(new Date());

  const loadOperations = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const client = supabase as any;
      const [postResult, taskResult] = await Promise.all([
        client.from("instagram_content_posts").select("id,status,objective,format,theme,hook,caption,media_url,media_urls,scheduled_at,created_at").order("scheduled_at", { ascending: true, nullsFirst: false }).limit(100),
        client.from("marketing_tasks").select("id,campaign_id,agent_key,title,brief,status,requires_approval,output,reviewer_notes,created_at,marketing_campaigns(name)").order("created_at", { ascending: false }).limit(120),
      ]);
      if (postResult.error) throw postResult.error;
      if (taskResult.error) throw taskResult.error;
      setPosts(postResult.data || []);
      setTasks(taskResult.data || []);
      setLastUpdated(new Date());
    } catch (error: any) {
      if (!quiet) toast({ variant: "destructive", title: "Central operacional indisponível", description: error.message });
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    void loadOperations();
    const timer = window.setInterval(() => void loadOperations(true), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const calendarPosts = useMemo(() => posts.filter((post) => post.scheduled_at).sort((a, b) => new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime()), [posts]);
  const todayPosts = useMemo(() => calendarPosts.filter((post) => dayKey(post.scheduled_at || "") === today), [calendarPosts, today]);
  const pendingPosts = useMemo(() => posts.filter((post) => post.status === "pending_review"), [posts]);
  const pendingTasks = useMemo(() => tasks.filter((task) => task.status === "pending_approval"), [tasks]);
  const nextPost = useMemo(() => calendarPosts.find((post) => new Date(post.scheduled_at || 0).getTime() >= Date.now() && !["rejected", "published"].includes(post.status)) || null, [calendarPosts]);
  const actionCount = pendingPosts.length + pendingTasks.length;

  useEffect(() => {
    if (loading) return;
    document.title = actionCount ? `(${actionCount}) Central da Zuno` : "Central da Zuno";
    const alertKey = `zuno-central-alert-${today}`;
    if (todayPosts.length && !sessionStorage.getItem(alertKey)) {
      toast({ title: todayPosts.length === 1 ? "Tem post programado para hoje" : `Há ${todayPosts.length} posts para hoje`, description: "Abra a aba Hoje para revisar a pauta e aprovar o que estiver pendente." });
      sessionStorage.setItem(alertKey, "shown");
    }
    return () => { document.title = "Zuno Prospect"; };
  }, [actionCount, loading, today, todayPosts.length]);

  const updatePost = async (post: ContentPost, action: "approve" | "reject") => {
    setBusy(post.id);
    try {
      const values = action === "approve"
        ? { status: post.scheduled_at ? "scheduled" : "approved", approved_at: new Date().toISOString(), last_error: null }
        : { status: "rejected" };
      const { error } = await (supabase as any).from("instagram_content_posts").update(values).eq("id", post.id);
      if (error) throw error;
      toast({ title: action === "approve" ? "Post aprovado" : "Post rejeitado", description: action === "approve" ? "O calendário foi atualizado em toda a Zuno." : "O post saiu da fila de aprovação." });
      await loadOperations(true);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Não foi possível atualizar o post", description: error.message });
    } finally {
      setBusy(null);
    }
  };

  const updateTask = async (task: MarketingTask, action: "approve" | "reject") => {
    setBusy(task.id);
    try {
      if (action === "approve") {
        const { data, error } = await supabase.functions.invoke("marketing-orchestrator", { body: { action: "approve_task", task_id: task.id } });
        if (error || !data?.success) throw new Error(data?.error || error?.message || "Não foi possível aprovar a entrega.");
      } else {
        const client = supabase as any;
        const { error } = await client.from("marketing_tasks").update({ status: "rejected", reviewer_notes: "Rejeitado pela Central da Zuno." }).eq("id", task.id).eq("status", "pending_approval");
        if (error) throw error;
        await client.from("marketing_approvals").update({ status: "rejected", resolved_at: new Date().toISOString(), notes: "Rejeitado pela Central da Zuno." }).eq("task_id", task.id).eq("status", "pending");
      }
      toast({ title: action === "approve" ? "Entrega aprovada" : "Entrega rejeitada", description: `${agents.find((agent) => agent.key === task.agent_key)?.name || "Agente"}: ${task.title}` });
      await loadOperations(true);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Não foi possível atualizar a entrega", description: error.message });
    } finally {
      setBusy(null);
    }
  };

  const latestTaskFor = (key: string) => tasks.find((task) => task.agent_key === key) || null;

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="border-b bg-gradient-to-r from-primary/10 via-background to-violet-500/10 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> Operação do dia</CardTitle>
            <CardDescription className="mt-1">Calendário, aprovações e trabalho de cada especialista em um só painel.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {actionCount > 0 && <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/10">{actionCount} pendência(s)</Badge>}
            <Button size="sm" variant="outline" className="gap-2" onClick={() => loadOperations()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-5">
        {loading ? (
          <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : (
          <Tabs defaultValue="today" className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/50 p-1 sm:grid-cols-5 [&>button:nth-child(2)]:hidden">
              <TabsTrigger value="today" className="gap-2"><Clock3 className="h-4 w-4" /> Hoje {todayPosts.length > 0 && <Badge className="h-5 min-w-5 px-1.5">{todayPosts.length}</Badge>}</TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2"><CalendarDays className="h-4 w-4" /> Calendário</TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2"><Instagram className="h-4 w-4" /> Instagram</TabsTrigger>
              <TabsTrigger value="approvals" className="gap-2"><Check className="h-4 w-4" /> Aprovações {actionCount > 0 && <Badge variant="destructive" className="h-5 min-w-5 px-1.5">{actionCount}</Badge>}</TabsTrigger>
              <TabsTrigger value="team" className="gap-2"><Users className="h-4 w-4" /> Equipe</TabsTrigger>
              <TabsTrigger value="system" className="gap-2"><ShieldCheck className="h-4 w-4" /> Sistema</TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-emerald-500/5 p-4"><p className="text-2xl font-bold text-emerald-500">{todayPosts.length}</p><p className="text-xs text-muted-foreground">post(s) programados hoje</p></div>
                <div className="rounded-xl border bg-amber-500/5 p-4"><p className="text-2xl font-bold text-amber-500">{pendingPosts.length}</p><p className="text-xs text-muted-foreground">posts aguardando você</p></div>
                <div className="rounded-xl border bg-violet-500/5 p-4"><p className="text-2xl font-bold text-violet-500">{pendingTasks.length}</p><p className="text-xs text-muted-foreground">entregas da equipe para aprovar</p></div>
              </div>
              {todayPosts.length ? todayPosts.map((post) => <PostRow key={post.id} post={post} busy={busy === post.id} onAction={updatePost} />) : (
                <div className="rounded-xl border border-dashed p-6 text-center"><CalendarDays className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-2 font-medium">Nenhum post marcado para hoje</p>{nextPost && <p className="mt-1 text-sm text-muted-foreground">Próximo: {new Date(nextPost.scheduled_at || "").toLocaleDateString("pt-BR")} — {nextPost.hook}</p>}</div>
              )}
              <div className="flex justify-end"><Button variant="outline" className="gap-2" onClick={() => onNavigate("/admin/instagram")}>Abrir estúdio do Instagram <ChevronRight className="h-4 w-4" /></Button></div>
            </TabsContent>

            <TabsContent value="calendar" className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold">Agenda de conteúdo</h3><p className="text-xs text-muted-foreground">Datas, horários, artes e situação real de cada post.</p></div><Button size="sm" className="gap-2" onClick={() => onNavigate("/admin/instagram")}><Megaphone className="h-4 w-4" /> Criar ou editar calendário</Button></div>
              {calendarPosts.length ? calendarPosts.map((post) => <PostRow key={post.id} post={post} busy={busy === post.id} onAction={updatePost} />) : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">O calendário ainda está vazio. Crie o primeiro mês no estúdio do Instagram.</div>}
            </TabsContent>

            <TabsContent value="approvals" className="space-y-5">
              <section className="space-y-3"><div><h3 className="font-semibold">Posts</h3><p className="text-xs text-muted-foreground">Conteúdo e arte precisam estar prontos antes da aprovação.</p></div>{pendingPosts.length ? pendingPosts.map((post) => <PostRow key={post.id} post={post} busy={busy === post.id} onAction={updatePost} />) : <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Nenhum post esperando aprovação.</p>}</section>
              <section className="space-y-3"><div><h3 className="font-semibold">Entregas da equipe</h3><p className="text-xs text-muted-foreground">Planos de tráfego, copy, design, social, SDR e fechamento.</p></div>{pendingTasks.length ? pendingTasks.map((task) => { const agent = agents.find((item) => item.key === task.agent_key); const Icon = agent?.icon || BrainCircuit; return <div key={task.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"><Icon className={`h-5 w-5 shrink-0 ${agent?.color || "text-primary"}`} /><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-muted-foreground">{agent?.name || task.agent_key}</p><p className="font-medium">{task.title}</p><p className="line-clamp-2 text-xs text-muted-foreground">{task.brief}</p></div><div className="flex gap-2"><Button size="sm" onClick={() => updateTask(task, "approve")} disabled={busy === task.id}><Check className="mr-1.5 h-4 w-4" /> Aprovar</Button><Button size="sm" variant="ghost" onClick={() => updateTask(task, "reject")} disabled={busy === task.id}><X className="mr-1.5 h-4 w-4" /> Rejeitar</Button></div></div>; }) : <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Nenhuma entrega da equipe esperando aprovação.</p>}</section>
            </TabsContent>

            <TabsContent value="team" className="space-y-4">
              <Tabs defaultValue="marketing_director">
                <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto bg-muted/50 p-1">
                  {agents.map((agent) => <TabsTrigger key={agent.key} value={agent.key} className="shrink-0 gap-1.5"><agent.icon className={`h-4 w-4 ${agent.color}`} /> {agent.name}</TabsTrigger>)}
                </TabsList>
                {agents.map((agent) => { const task = latestTaskFor(agent.key); const Icon = agent.icon; return <TabsContent key={agent.key} value={agent.key} className="mt-4"><div className="rounded-xl border bg-card p-4 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><div className="rounded-xl bg-muted p-3"><Icon className={`h-7 w-7 ${agent.color}`} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold">{agent.name}</h3>{task && <Badge variant="outline" className={statusClass[task.status] || ""}>{statusLabel[task.status] || task.status}</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{agent.role}</p>{task ? <div className="mt-4 rounded-lg border bg-muted/20 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Última entrega</p><p className="mt-1 font-medium">{task.title}</p><p className="mt-1 text-sm text-muted-foreground">{task.brief}</p><p className="mt-3 text-xs text-muted-foreground">Campanha: {task.marketing_campaigns?.name || "Campanha da Zuno"}</p></div> : <div className="mt-4 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Este agente ainda não recebeu uma campanha.</div>}<Button variant="outline" className="mt-4 gap-2" onClick={() => onNavigate("/admin/marketing")}>Ver trabalho completo <ChevronRight className="h-4 w-4" /></Button></div></div></div></TabsContent>; })}
              </Tabs>
            </TabsContent>

            <TabsContent value="system" className="space-y-4">
              <div>
                <h3 className="font-semibold">{"Administra\u00e7\u00e3o da Zuno"}</h3>
                <p className="text-xs text-muted-foreground">As ferramentas exclusivas do ADM ficam organizadas aqui, sem ocupar o menu superior.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { title: "Tempo Real", description: "Acompanhe usu\u00e1rios e eventos acontecendo agora.", icon: Activity, path: "/admin/realtime" },
                  { title: "Checkouts", description: "Veja pagamentos iniciados e oportunidades de recupera\u00e7\u00e3o.", icon: ShoppingCart, path: "/admin/checkouts-abandonados" },
                  { title: "E-mail", description: "Campanhas, mensagens e comunica\u00e7\u00e3o com usu\u00e1rios.", icon: Mail, path: "/admin/email" },
                  { title: "Funil", description: "Jornada completa da descoberta ao p\u00f3s-venda.", icon: Workflow, path: "/admin/funil" },
                  { title: "Sa\u00fade do sistema", description: "Verifique servi\u00e7os, integra\u00e7\u00f5es e disponibilidade.", icon: ShieldCheck, path: "/admin/system-health" },
                  { title: "Marketing completo", description: "Abra campanhas e entregas detalhadas dos agentes.", icon: Megaphone, path: "/admin/marketing" },
                ].map((item) => (
                  <button key={item.path} type="button" onClick={() => onNavigate(item.path)} className="group rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm">
                    <item.icon className="h-5 w-5 text-primary" />
                    <p className="mt-3 font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">Abrir <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span>
                  </button>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
        {lastUpdated && <p className="mt-3 text-right text-[11px] text-muted-foreground">Atualizado às {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>}
      </CardContent>
    </Card>
  );
}
