/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  Check,
  Copy,
  Image,
  Instagram,
  LayoutList,
  Loader2,
  Palette,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { renderInstagramArtwork } from "@/lib/instagramPostRenderer";

type ContentPost = {
  id: string;
  status: string;
  objective: string;
  format: "single" | "carousel";
  pillar: string | null;
  theme: string;
  target_audience: string | null;
  hook: string;
  caption: string;
  hashtags: string[];
  cta: string | null;
  alt_text: string | null;
  visual_brief: string | null;
  slides: Array<{ title?: string; body?: string }>;
  media_url: string | null;
  media_urls: string[];
  scheduled_at: string | null;
  published_at: string | null;
  instagram_media_id: string | null;
  last_error: string | null;
  agent_trace: Record<string, any>;
  created_at: string;
};

type ContentSettings = {
  singleton: boolean;
  brand_name: string;
  product_description: string;
  target_audience: string;
  brand_voice: string;
  content_pillars: string[];
  posting_mode: "approval" | "automatic";
  default_posts_per_week: number;
  timezone: string;
};

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  pending_review: "Revisar",
  approved: "Aprovado",
  scheduled: "Agendado",
  publishing: "Publicando",
  published: "Publicado",
  rejected: "Rejeitado",
  failed: "Falhou",
};

const statusClass: Record<string, string> = {
  pending_review: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  approved: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  scheduled: "border-violet-500/30 bg-violet-500/10 text-violet-400",
  publishing: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  rejected: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
  failed: "border-red-500/30 bg-red-500/10 text-red-400",
};

const defaultSettings: ContentSettings = {
  singleton: true,
  brand_name: "Zuno Prospect",
  product_description: "",
  target_audience: "",
  brand_voice: "",
  content_pillars: [],
  posting_mode: "approval",
  default_posts_per_week: 3,
  timezone: "America/Sao_Paulo",
};

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

type EditorialSlot = {
  scheduled_at: string;
  objective: "education" | "connection" | "engagement" | "conversion";
  funnel_stage: string;
  pillar: string;
  theme: string;
  format: "single" | "carousel";
};

function dateInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function defaultCalendarStart() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dateInputValue(tomorrow);
}

function buildEditorialPlan(startValue: string, postsPerWeek: number): EditorialSlot[] {
  const start = new Date((startValue || defaultCalendarStart()) + "T12:00:00");
  const allowedDays: Record<number, number[]> = {
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 4, 5],
  };
  const objectives: EditorialSlot["objective"][] = [
    "education",
    "education",
    "connection",
    "education",
    "engagement",
    "education",
    "conversion",
    "education",
    "connection",
    "education",
    "engagement",
    "conversion",
  ];
  const themes = [
    "3 sinais de que sua prospecção depende demais da memória",
    "Como escolher cidade e nicho sem atirar para todo lado",
    "Bastidor: uma rotina de 30 minutos para prospectar com consistência",
    "O que analisar antes de mandar a primeira mensagem",
    "Qual parte da prospecção mais toma seu tempo hoje?",
    "Checklist de um lead que realmente vale abordar",
    "Da busca ao WhatsApp: como funciona o fluxo da Zuno",
    "5 erros que deixam qualquer abordagem com cara de mensagem genérica",
    "O que aprendi tentando conciliar trabalho, rotina e a construção da Zuno",
    "Como procurar o tomador de decisão sem inventar dados",
    "Você prefere buscar os leads ou escrever a abordagem?",
    "Teste de 7 dias da Zuno: o que fazer primeiro para perceber valor",
  ];
  const details = {
    education: { funnel_stage: "descoberta", pillar: "Educação e autoridade" },
    connection: { funnel_stage: "descoberta", pillar: "Conexão e bastidores" },
    engagement: { funnel_stage: "interesse", pillar: "Engajamento e diagnóstico" },
    conversion: { funnel_stage: "decisão", pillar: "Produto e conversão" },
  };
  const slots: EditorialSlot[] = [];

  for (let offset = 0; offset < 30; offset += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    if (!allowedDays[postsPerWeek]?.includes(day.getDay())) continue;
    day.setHours(19, 0, 0, 0);
    const index = slots.length;
    const objective = objectives[index % objectives.length];
    slots.push({
      scheduled_at: day.toISOString(),
      objective,
      theme: themes[index % themes.length],
      format: index % 3 === 1 ? "single" : "carousel",
      ...details[objective],
    });
  }
  return slots;
}

function parseFunctionError(error: any, data: any) {
  return data?.error || error?.message || "Nao foi possivel concluir a operacao.";
}

export default function AdminInstagram() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [settings, setSettings] = useState<ContentSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [busyPost, setBusyPost] = useState<string | null>(null);
  const [mediaDrafts, setMediaDrafts] = useState<Record<string, string>>({});
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState({ status: "all" });
  const [view, setView] = useState<"queue" | "calendar">("calendar");
  const [calendarStart, setCalendarStart] = useState(defaultCalendarStart);
  const [calendarFrequency, setCalendarFrequency] = useState("3");
  const [calendarGenerating, setCalendarGenerating] = useState(false);
  const [calendarProgress, setCalendarProgress] = useState("");
  const [brief, setBrief] = useState({
    theme: "",
    objective: "awareness",
    format: "mixed",
    count: "3",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const client = supabase as any;
      const [postsResult, settingsResult] = await Promise.all([
        client
          .from("instagram_content_posts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        client
          .from("instagram_content_settings")
          .select("*")
          .eq("singleton", true)
          .single(),
      ]);
      if (postsResult.error) throw postsResult.error;
      if (settingsResult.error) throw settingsResult.error;
      setPosts(postsResult.data || []);
      setSettings(settingsResult.data || defaultSettings);
      setMediaDrafts(
        Object.fromEntries(
          (postsResult.data || []).map((post: ContentPost) => [
            post.id,
            (post.media_urls?.length
              ? post.media_urls
              : post.media_url
              ? [post.media_url]
              : []
            ).join("\n"),
          ])
        )
      );
      setScheduleDrafts(
        Object.fromEntries(
          (postsResult.data || []).map((post: ContentPost) => [
            post.id,
            localDateTime(post.scheduled_at),
          ])
        )
      );
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar o Instagram",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const visiblePosts = useMemo(
    () =>
      filters.status === "all"
        ? posts
        : posts.filter((post) => post.status === filters.status),
    [filters.status, posts]
  );
  const calendarPosts = useMemo(
    () => posts.filter((post) => post.scheduled_at)
      .sort((a, b) => new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime()),
    [posts]
  );

  const generatePosts = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "instagram-content-agent",
        {
          body: {
            theme: brief.theme,
            objective: brief.objective,
            format: brief.format,
            count: Number(brief.count),
          },
        }
      );
      if (error || !data?.success) {
        throw new Error(parseFunctionError(error, data));
      }

      let artworkFailures = 0;
      for (const post of (data.posts || []) as ContentPost[]) {
        try {
          await createArtwork(post, false);
        } catch {
          artworkFailures += 1;
        }
      }

      toast({
        title: "Lote completo criado",
        description: artworkFailures
          ? String(data.posts?.length || 0) + " post(s) criados. Algumas artes ficaram pendentes."
          : String(data.posts?.length || 0) + " post(s) com copy, hashtags e artes prontos para revisar.",
      });
      setBrief((current) => ({ ...current, theme: "" }));
      await loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Falha nos agentes",
        description: error.message,
      });
    } finally {
      setGenerating(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const { error } = await (supabase as any)
        .from("instagram_content_settings")
        .upsert({
          ...settings,
          singleton: true,
        });
      if (error) throw error;
      toast({
        title: "Configuracoes salvas",
        description:
          settings.posting_mode === "approval"
            ? "Novos posts aguardarao sua aprovacao."
            : "Novos lotes serao agendados automaticamente.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar configuracoes",
        description: error.message,
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const createArtwork = async (post: ContentPost, showFeedback = true) => {
    if (showFeedback) setBusyPost(post.id);
    try {
      const blobs = await renderInstagramArtwork(post);
      const version = Date.now();
      const urls: string[] = [];

      for (let index = 0; index < blobs.length; index += 1) {
        const path = post.id + "/slide-" + String(index + 1).padStart(2, "0") + ".png";
        const { error } = await supabase.storage
          .from("instagram-assets")
          .upload(path, blobs[index], {
            contentType: "image/png",
            cacheControl: "3600",
            upsert: true,
          });
        if (error) throw error;
        const { data } = supabase.storage.from("instagram-assets").getPublicUrl(path);
        urls.push(data.publicUrl + "?v=" + version);
      }

      await updatePost(post.id, {
        media_url: urls[0],
        media_urls: urls,
        last_error: null,
      });
      setMediaDrafts((current) => ({ ...current, [post.id]: urls.join("\n") }));

      if (showFeedback) {
        toast({
          title: "Artes da Zuno criadas",
          description: urls.length + " imagem(ns) em 1080 × 1350 prontas para aprovação.",
        });
        await loadData();
      }
      return urls;
    } finally {
      if (showFeedback) setBusyPost(null);
    }
  };

  const generateCalendar = async () => {
    const plan = buildEditorialPlan(calendarStart, Number(calendarFrequency));
    if (!plan.length) return;

    setCalendarGenerating(true);
    setCalendarProgress("Diretor de conteúdo montando o mês…");
    try {
      const generated: ContentPost[] = [];
      const totalBatches = Math.ceil(plan.length / 7);

      for (let start = 0; start < plan.length; start += 7) {
        const batch = plan.slice(start, start + 7);
        const batchNumber = Math.floor(start / 7) + 1;
        setCalendarProgress(
          "Criando lote " + batchNumber + " de " + totalBatches + " do calendário…"
        );
        const { data, error } = await supabase.functions.invoke(
          "instagram-content-agent",
          {
            body: {
              theme: brief.theme || "Calendário de conteúdo da Zuno para gerar demanda e testes qualificados",
              objective: "monthly_funnel",
              format: "mixed",
              count: batch.length,
              post_plan: batch,
            },
          }
        );
        if (error || !data?.success) {
          throw new Error(parseFunctionError(error, data));
        }
        generated.push(...((data.posts || []) as ContentPost[]));
      }

      let artworkFailures = 0;
      for (let index = 0; index < generated.length; index += 1) {
        setCalendarProgress(
          "Criando artes " + (index + 1) + " de " + generated.length + "…"
        );
        try {
          await createArtwork(generated[index], false);
        } catch {
          artworkFailures += 1;
        }
      }

      setView("calendar");
      setFilters({ status: "all" });
      await loadData();
      toast({
        title: "Calendário de 30 dias pronto",
        description: artworkFailures
          ? generated.length + " posts programados; algumas artes precisam ser refeitas."
          : generated.length + " posts com texto, hashtags, arte e data aguardando sua aprovação.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Não foi possível concluir o calendário",
        description: error.message,
      });
    } finally {
      setCalendarGenerating(false);
      setCalendarProgress("");
    }
  };

  const updatePost = async (id: string, values: Record<string, any>) => {
    const { error } = await (supabase as any)
      .from("instagram_content_posts")
      .update(values)
      .eq("id", id);
    if (error) throw error;
  };

  const runPostAction = async (
    post: ContentPost,
    action: "approve" | "reject" | "schedule" | "media" | "publish"
  ) => {
    setBusyPost(post.id);
    try {
      if (action === "approve") {
        await updatePost(post.id, {
          status: post.scheduled_at ? "scheduled" : "approved",
          approved_at: new Date().toISOString(),
          last_error: null,
        });
      }
      if (action === "reject") {
        await updatePost(post.id, { status: "rejected" });
      }
      if (action === "schedule") {
        const rawDate = scheduleDrafts[post.id];
        if (!rawDate) throw new Error("Escolha a data e o horario.");
        await updatePost(post.id, {
          status: "scheduled",
          scheduled_at: new Date(rawDate).toISOString(),
          approved_at: post.status === "pending_review"
            ? new Date().toISOString()
            : undefined,
          last_error: null,
        });
      }
      if (action === "media") {
        const urls = String(mediaDrafts[post.id] || "")
          .split(/\r?\n/)
          .map((value) => value.trim())
          .filter(Boolean);
        if (!urls.length) throw new Error("Informe ao menos uma URL publica.");
        if (urls.some((value) => !/^https:\/\//i.test(value))) {
          throw new Error("As imagens precisam usar URLs publicas HTTPS.");
        }
        await updatePost(post.id, {
          media_url: urls[0],
          media_urls: urls.slice(0, 10),
        });
      }
      if (action === "publish") {
        const { data, error } = await supabase.functions.invoke(
          "instagram-publisher",
          { body: { post_id: post.id } }
        );
        if (error || !data?.success) {
          throw new Error(parseFunctionError(error, data));
        }
        const failed = data.results?.find((item: any) => !item.success);
        if (failed) throw new Error(failed.error || "A Meta recusou o post.");
      }

      toast({
        title:
          action === "publish"
            ? "Publicacao processada"
            : "Post atualizado",
      });
      await loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Nao foi possivel atualizar o post",
        description: error.message,
      });
    } finally {
      setBusyPost(null);
    }
  };

  const copyCaption = async (post: ContentPost) => {
    await navigator.clipboard.writeText(
      [post.caption, post.hashtags.join(" ")].filter(Boolean).join("\n\n")
    );
    toast({ title: "Legenda copiada" });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader isAdmin={isAdmin} />
      <main className="container mx-auto space-y-4 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-pink-400">
              <Instagram className="h-4 w-4" />
              Operacao de conteudo
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Instagram da Zuno</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Estrategia, criacao, revisao, aprovacao e publicacao em uma fila auditavel.
            </p>
          </div>
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={"mr-2 h-4 w-4 " + (loading ? "animate-spin" : "")} />
            Atualizar
          </Button>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <Card className="border-emerald-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                Novo lote com agentes
              </CardTitle>
              <CardDescription>
                Um agente planeja, outro escreve e um terceiro revisa antes de salvar.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="theme">Tema ou campanha</Label>
                <Input
                  id="theme"
                  value={brief.theme}
                  onChange={(event) =>
                    setBrief((current) => ({ ...current, theme: event.target.value }))
                  }
                  placeholder="Ex.: Por que a prospeccao manual trava o crescimento"
                />
              </div>
              <div className="space-y-2">
                <Label>Objetivo</Label>
                <Select
                  value={brief.objective}
                  onValueChange={(value) =>
                    setBrief((current) => ({ ...current, objective: value }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="awareness">Reconhecimento</SelectItem>
                    <SelectItem value="education">Educacao</SelectItem>
                    <SelectItem value="product">Demonstrar produto</SelectItem>
                    <SelectItem value="conversion">Conversao</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Formato</Label>
                <Select
                  value={brief.format}
                  onValueChange={(value) =>
                    setBrief((current) => ({ ...current, format: value }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">Misturar</SelectItem>
                    <SelectItem value="single">Post unico</SelectItem>
                    <SelectItem value="carousel">Carrossel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Select
                  value={brief.count}
                  onValueChange={(value) =>
                    setBrief((current) => ({ ...current, count: value }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 3, 5, 7].map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value} post{value > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
                  onClick={generatePosts}
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Rodar agentes
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Modo de operacao
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Publicacao</Label>
                <Select
                  value={settings.posting_mode}
                  onValueChange={(value: "approval" | "automatic") =>
                    setSettings((current) => ({ ...current, posting_mode: value }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approval">Aprovacao humana</SelectItem>
                    <SelectItem value="automatic">Agendamento automatico</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Automatico publica somente quando houver imagem publica e a Meta estiver conectada.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Publico principal</Label>
                <Textarea
                  rows={3}
                  value={settings.target_audience}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      target_audience: event.target.value,
                    }))
                  }
                />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={saveSettings}
                disabled={savingSettings}
              >
                {savingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar configuracoes
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-background to-emerald-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-violet-400" />
              Calendário editorial de 30 dias
            </CardTitle>
            <CardDescription>
              A equipe distribui o mês pelo funil, cria as copies, hashtags, carrosséis e artes. Nada publica sem sua aprovação.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label>Começar em</Label>
              <Input
                type="date"
                value={calendarStart}
                onChange={(event) => setCalendarStart(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Frequência</Label>
              <Select value={calendarFrequency} onValueChange={setCalendarFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 posts por semana</SelectItem>
                  <SelectItem value="4">4 posts por semana</SelectItem>
                  <SelectItem value="5">5 posts por semana</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="lg"
              className="gap-2"
              onClick={generateCalendar}
              disabled={calendarGenerating || generating}
            >
              {calendarGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarDays className="h-4 w-4" />
              )}
              Criar mês completo
            </Button>
            <div className="flex flex-wrap gap-2 sm:col-span-3">
              <Badge variant="secondary">50% educação</Badge>
              <Badge variant="secondary">20% conexão</Badge>
              <Badge variant="secondary">15% engajamento</Badge>
              <Badge variant="secondary">15% venda</Badge>
              <Badge variant="outline">
                {buildEditorialPlan(calendarStart, Number(calendarFrequency)).length} posts previstos
              </Badge>
            </div>
            <details className="rounded-lg border bg-background/60 p-3 sm:col-span-3">
              <summary className="cursor-pointer text-sm font-medium">Ver a pauta inicial do mês</summary>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {buildEditorialPlan(calendarStart, Number(calendarFrequency)).map((slot, index) => (
                  <div key={slot.scheduled_at} className="rounded-lg border p-3">
                    <p className="text-xs font-semibold text-primary">
                      {new Date(slot.scheduled_at).toLocaleDateString("pt-BR", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                      })}
                      {" • "}{slot.objective}
                    </p>
                    <p className="mt-1 text-sm leading-5">{index + 1}. {slot.theme}</p>
                  </div>
                ))}
              </div>
            </details>
            {calendarProgress && (
              <div className="rounded-lg border bg-background/70 p-3 text-sm text-muted-foreground sm:col-span-3">
                {calendarProgress}
              </div>
            )}
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {view === "calendar" ? "Calendário para aprovação" : "Fila de conteúdo"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {view === "calendar"
                ? calendarPosts.length + " post(s) com data definida"
                : visiblePosts.length + " post(s) visíveis"}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="grid grid-cols-2 rounded-lg border bg-muted/25 p-1">
              <Button
                size="sm"
                variant={view === "calendar" ? "secondary" : "ghost"}
                className="gap-2"
                onClick={() => setView("calendar")}
              >
                <CalendarDays className="h-4 w-4" /> Calendário
              </Button>
              <Button
                size="sm"
                variant={view === "queue" ? "secondary" : "ghost"}
                className="gap-2"
                onClick={() => setView("queue")}
              >
                <LayoutList className="h-4 w-4" /> Fila
              </Button>
            </div>
            {view === "queue" && (
              <Select
                value={filters.status}
                onValueChange={(status) => setFilters({ status })}
              >
                <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending_review">Para revisar</SelectItem>
                  <SelectItem value="approved">Aprovados</SelectItem>
                  <SelectItem value="scheduled">Agendados</SelectItem>
                  <SelectItem value="published">Publicados</SelectItem>
                  <SelectItem value="failed">Com falha</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </section>

        {view === "calendar" && (
          loading ? (
            <div className="flex min-h-48 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
            </div>
          ) : calendarPosts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-14 text-center text-muted-foreground">
                Crie o calendário de 30 dias para ver os posts organizados por data.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {calendarPosts.map((post) => {
                const busy = busyPost === post.id;
                const preview = post.media_urls?.[0] || post.media_url;
                const hasMedia = Boolean(preview);
                const scheduled = new Date(post.scheduled_at || "");
                return (
                  <Card key={post.id} className="min-w-0 overflow-hidden">
                    {preview ? (
                      <img
                        src={preview}
                        alt={post.alt_text || post.hook}
                        className="aspect-[4/5] w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[4/5] items-center justify-center bg-gradient-to-br from-emerald-500/10 to-violet-500/10 p-8 text-center">
                        <div>
                          <Palette className="mx-auto h-8 w-8 text-primary" />
                          <p className="mt-3 text-sm font-medium">Arte aguardando geração</p>
                        </div>
                      </div>
                    )}
                    <CardHeader className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold capitalize">
                            {scheduled.toLocaleDateString("pt-BR", {
                              weekday: "long",
                              day: "2-digit",
                              month: "short",
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {scheduled.toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <Badge variant="outline" className={statusClass[post.status] || ""}>
                          {statusLabel[post.status] || post.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{post.objective}</Badge>
                        <Badge variant="secondary">
                          {post.format === "carousel" ? "Carrossel" : "Post único"}
                        </Badge>
                      </div>
                      <CardTitle className="text-base leading-6">{post.hook}</CardTitle>
                      <CardDescription className="line-clamp-3">{post.caption}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2 p-4 pt-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => createArtwork(post)}
                        disabled={busy}
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Palette className="h-4 w-4" />}
                        {hasMedia ? "Refazer arte" : "Criar arte"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => copyCaption(post)}>
                        <Copy className="mr-2 h-4 w-4" /> Copiar
                      </Button>
                      {post.status === "pending_review" && (
                        <>
                          <Button
                            size="sm"
                            className="bg-emerald-600 text-white hover:bg-emerald-500"
                            onClick={() => runPostAction(post, "approve")}
                            disabled={busy || !hasMedia}
                          >
                            <Check className="mr-2 h-4 w-4" /> Aprovar e agendar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => runPostAction(post, "reject")}
                            disabled={busy}
                          >
                            <X className="mr-2 h-4 w-4" /> Rejeitar
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )
        )}


        {view === "queue" && (loading ? (
          <div className="flex min-h-48 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
          </div>
        ) : visiblePosts.length === 0 ? (
          <Card><CardContent className="py-14 text-center text-muted-foreground">
            Rode os agentes para criar o primeiro lote.
          </CardContent></Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {visiblePosts.map((post) => {
              const busy = busyPost === post.id;
              const hasMedia = Boolean(post.media_urls?.length || post.media_url);
              const preview = post.media_urls?.[0] || post.media_url;
              return (
                <Card key={post.id} className="overflow-hidden">
                  <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={statusClass[post.status] || ""}>
                          {statusLabel[post.status] || post.status}
                        </Badge>
                        <Badge variant="secondary">
                          {post.format === "carousel" ? "Carrossel" : "Post unico"}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(post.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <CardTitle className="text-lg leading-snug">{post.hook}</CardTitle>
                    <CardDescription>{post.theme}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {preview && (
                      <img
                        src={preview}
                        alt={post.alt_text || post.hook}
                        className="aspect-[4/5] w-full rounded-xl border object-cover"
                      />
                    )}
                    <div className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm leading-6">
                      {post.caption}
                    </div>

                    {post.slides?.length > 0 && (
                      <div className="grid gap-2">
                        {post.slides.map((slide, index) => (
                          <div key={index} className="rounded-md border p-3 text-sm">
                            <strong>Slide {index + 1}: {slide.title}</strong>
                            {slide.body && <p className="mt-1 text-muted-foreground">{slide.body}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-xs leading-5 text-emerald-400">
                      {post.hashtags?.join(" ")}
                    </div>

                    <div className="rounded-lg border border-dashed p-3">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <Image className="h-4 w-4" />
                        Artes e imagens
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mb-3 gap-2"
                        onClick={() => createArtwork(post)}
                        disabled={busy}
                      >
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Palette className="h-4 w-4" />
                        )}
                        {hasMedia ? "Refazer artes da Zuno" : "Criar artes da Zuno"}
                      </Button>
                      <Textarea
                        rows={post.format === "carousel" ? 4 : 2}
                        value={mediaDrafts[post.id] || ""}
                        onChange={(event) =>
                          setMediaDrafts((current) => ({
                            ...current,
                            [post.id]: event.target.value,
                          }))
                        }
                        placeholder={
                          post.format === "carousel"
                            ? "Uma URL HTTPS por linha, na ordem dos slides"
                            : "URL HTTPS da imagem"
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => runPostAction(post, "media")}
                        disabled={busy}
                      >
                        Salvar imagens
                      </Button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Input
                        type="datetime-local"
                        value={scheduleDrafts[post.id] || ""}
                        onChange={(event) =>
                          setScheduleDrafts((current) => ({
                            ...current,
                            [post.id]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        variant="outline"
                        onClick={() => runPostAction(post, "schedule")}
                        disabled={busy || !hasMedia}
                      >
                        <CalendarClock className="mr-2 h-4 w-4" />
                        Agendar
                      </Button>
                    </div>

                    {post.last_error && (
                      <p className="rounded-md bg-red-500/10 p-3 text-xs text-red-400">
                        {post.last_error}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => copyCaption(post)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar
                      </Button>
                      {post.status === "pending_review" && (
                        <>
                          <Button
                            size="sm"
                            className="bg-emerald-600 text-white hover:bg-emerald-500"
                            onClick={() => runPostAction(post, "approve")}
                            disabled={busy || (Boolean(post.scheduled_at) && !hasMedia)}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            {post.scheduled_at ? "Aprovar e agendar" : "Aprovar"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => runPostAction(post, "reject")}
                            disabled={busy}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Rejeitar
                          </Button>
                        </>
                      )}
                      {["approved", "scheduled", "failed"].includes(post.status) && (
                        <Button
                          size="sm"
                          onClick={() => runPostAction(post, "publish")}
                          disabled={busy || !hasMedia}
                        >
                          {busy ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="mr-2 h-4 w-4" />
                          )}
                          Publicar agora
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))}
      </main>
    </div>
  );
}