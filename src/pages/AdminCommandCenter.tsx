/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Code2,
  Copy,
  Instagram,
  Laptop,
  Loader2,
  Megaphone,
  MessageSquareText,
  Mic,
  MicOff,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  WifiOff,
  Workflow,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { CommandCenterOperations } from "@/components/admin/CommandCenterOperations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { renderInstagramArtwork } from "@/lib/instagramPostRenderer";

type WorkMode = "cloud" | "codex";
type HistoryItem = { text: string; mode: WorkMode; createdAt: string };

type DirectorResult = {
  route: string;
  summary: string;
  agents: string[];
  detail?: string;
};

const REPOSITORY_URL = "https://github.com/jefersond/ZunoProspect.git";
const HISTORY_KEY = "zuno-command-center-history";

const quickCommands = [
  "Altere o post de hoje: deixe a copy mais direta e refa\u00e7a o design com foco na demonstra\u00e7\u00e3o da Zuno.",
  "Crie uma campanha sobre prospec\u00e7\u00e3o B2B com R$ 15 por dia, dois testes A/B, p\u00fablico, copy e criativos.",
  "Crie 7 posts educativos para o Instagram da Zuno, com CTA para o teste grátis de 7 dias no plano escolhido.",
  "Monte uma campanha orgânica para conquistar os primeiros clientes da Zuno sem tráfego pago.",
  "Crie uma sequência de prospecção humana para Instagram e WhatsApp, sem reunião e sem promessas exageradas.",
  "Analise a oferta atual da Zuno e proponha as três melhorias com maior chance de gerar assinaturas.",
];

const destinations = [
  { title: "Marketing OS", description: "Campanhas e entregas dos 8 agentes.", icon: Megaphone, to: "/admin/marketing" },
  { title: "Instagram", description: "Posts, revisão e publicação.", icon: Instagram, to: "/admin/instagram" },
  { title: "Funil", description: "Jornada completa até assinatura e pós-venda.", icon: Workflow, to: "/admin/funil" },
  { title: "Leads", description: "Revisão e correção dos dados capturados.", icon: Users, to: "/admin/leads" },
  { title: "Prospecção", description: "Busca, análise e abordagens.", icon: MessageSquareText, to: "/prospeccao" },
];

function readHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]").slice(0, 8);
  } catch {
    return [];
  }
}

function summarizeCommand(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 58 ? `${clean.slice(0, 58)}…` : clean;
}

export default function AdminCommandCenter() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<WorkMode>("cloud");
  const [command, setCommand] = useState(quickCommands[0]);
  const [history, setHistory] = useState<HistoryItem[]>(readHistory);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Pronto para receber seu pedido.");
  const [listening, setListening] = useState(false);
  const [directorResult, setDirectorResult] = useState<DirectorResult | null>(null);
  const [interimTranscript, setInterimTranscript] = useState("");
  const speechRecognitionRef = useRef<any>(null);

  const canSend = command.trim().length >= 12 && !running;
  const modeDescription = useMemo(() => mode === "cloud"
    ? "O time trabalha nos servidores da Zuno. Depois que o pedido entrar na fila, você pode fechar a página ou desligar o computador."
    : "O pedido abre no Codex do seu computador, já ligado ao repositório da Zuno.", [mode]);

  const saveHistory = (selectedMode: WorkMode) => {
    const item: HistoryItem = { text: command.trim(), mode: selectedMode, createdAt: new Date().toISOString() };
    const next = [item, ...history.filter((entry) => entry.text !== item.text)].slice(0, 8);
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  };

  const invokeMarketing = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("marketing-orchestrator", { body });
    if (error || !data?.success) throw new Error(data?.error || error?.message || "O time não conseguiu concluir o pedido.");
    return data;
  };

  const runLegacyCloudTeam = async () => {
    if (!canSend) return;
    setRunning(true);
    setProgress(4);
    setStatus("O Diretor de Marketing está organizando o pedido…");
    try {
      const created = await invokeMarketing({
        action: "create_campaign",
        name: `Central — ${summarizeCommand(command)}`,
        objective: command.trim(),
        offer: "Teste grátis de 7 dias da Zuno Propect no plano escolhido, com cartão obrigatório e R$0 cobrados hoje.",
        target_audience: "Freelancers, gestores de tráfego, social medias, designers e agências que vendem serviços para negócios locais.",
        paid_media_monthly_budget: 0,
        channels: ["instagram", "whatsapp"],
      });
      const campaignId = created.campaign.id as string;
      setProgress(55);
      setStatus("Colocando os 8 agentes na fila da nuvem…");
      await invokeMarketing({ action: "run_campaign_async", campaign_id: campaignId });
      saveHistory("cloud");
      setProgress(100);
      setStatus("Pedido aceito. O time continuará trabalhando na nuvem.");
      toast({ title: "Pedido enviado para a nuvem", description: "Você pode fechar a página. Acompanhe as entregas na Central de Marketing." });
      window.setTimeout(() => navigate("/admin/marketing"), 700);
    } catch (error: any) {
      setStatus("O trabalho foi interrompido. Você pode tentar novamente sem perder as campanhas já salvas.");
      toast({ variant: "destructive", title: "Não foi possível concluir", description: error.message });
    } finally {
      setRunning(false);
    }
  };


  const createDirectorArtwork = async (post: any) => {
    const blobs = await renderInstagramArtwork(post);
    const urls: string[] = [];
    const revision = Date.now();
    for (let index = 0; index < blobs.length; index += 1) {
      const path = `director/${post.id}/revision-${revision}-${String(index + 1).padStart(2, "0")}.png`;
      const { error } = await supabase.storage.from("instagram-assets").upload(path, blobs[index], {
        contentType: "image/png",
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("instagram-assets").getPublicUrl(path);
      urls.push(`${data.publicUrl}?v=${revision}`);
    }
    const { error } = await (supabase as any).from("instagram_content_posts").update({
      media_url: urls[0] || null,
      media_urls: urls,
      status: "pending_review",
    }).eq("id", post.id);
    if (error) throw error;
    return urls;
  };

  const runCloudTeam = async () => {
    if (!canSend) return;
    setRunning(true);
    setDirectorResult(null);
    setProgress(5);
    setStatus("O Diretor da Zuno est\u00e1 entendendo sua ordem...");
    try {
      const result = await invokeMarketing({
        action: "director_command",
        instruction: command.trim(),
        offer: "Teste gr\u00e1tis de 7 dias da Zuno Propect no plano escolhido, com cart\u00e3o obrigat\u00f3rio e R$0 cobrados hoje.",
        target_audience: "Prestadores de servi\u00e7os B2B, ag\u00eancias e profissionais comerciais que precisam prospectar com consist\u00eancia.",
      });
      setProgress(55);

      let detail = "";
      if (result.route === "instagram_revision" && result.post) {
        setStatus("Social Media, Copy e Design conclu\u00edram a revis\u00e3o. Refazendo as artes...");
        try {
          const urls = await createDirectorArtwork(result.post);
          detail = `${urls.length} arte(s) refeita(s). O post voltou para sua aprova\u00e7\u00e3o.`;
        } catch (artError: any) {
          detail = "O texto e o briefing foram revisados, mas a arte ficou pendente: " + artError.message;
        }
      } else {
        const labels: Record<string, string> = {
          marketing_director: "Diretor",
          traffic_manager: "Gestor de Tr\u00e1fego",
          copywriter: "Copywriter",
          creative_director: "Design",
          social_media: "Social Media",
          sdr: "SDR",
          closer: "Closer",
          performance_analyst: "Performance",
        };
        detail = "Encaminhado para: " + (result.agents || []).map((key: string) => labels[key] || key).join(" -> ") + ".";
        if (result.meta_connection_required) {
          detail += " O plano ser\u00e1 criado, mas a ativa\u00e7\u00e3o do an\u00fancio aguarda a conex\u00e3o oficial da Meta e sua aprova\u00e7\u00e3o.";
        }
      }

      const finalResult: DirectorResult = {
        route: result.route || "general_marketing",
        summary: result.summary || "O Diretor encaminhou a ordem.",
        agents: result.agents || [],
        detail,
      };
      setDirectorResult(finalResult);
      saveHistory("cloud");
      setProgress(100);
      setStatus("O Diretor recebeu o retorno do time e trouxe o resultado para voc\u00ea.");
      toast({
        title: result.route === "instagram_revision" ? "Post revisado pelo time" : "Diretor distribuiu o trabalho",
        description: detail || finalResult.summary,
      });
    } catch (error: any) {
      setStatus("O Diretor n\u00e3o conseguiu concluir essa ordem. Ajuste o pedido ou tente novamente.");
      toast({ variant: "destructive", title: "N\u00e3o foi poss\u00edvel concluir", description: error.message });
    } finally {
      setRunning(false);
    }
  };
  const openInCodex = () => {
    if (!canSend) return;
    const prompt = [
      "Você está trabalhando no projeto Zuno Prospect.",
      "Pedido do fundador:",
      command.trim(),
      "Considere a arquitetura e as mudanças já existentes no repositório. Preserve alterações do usuário, implemente, valide e explique o que ficou pronto.",
    ].join("\n\n");
    saveHistory("codex");
    setStatus("Abrindo o Codex neste computador…");
    window.location.href = `codex://threads/new?prompt=${encodeURIComponent(prompt)}&originUrl=${encodeURIComponent(REPOSITORY_URL)}`;
  };

  const copyForCodex = async () => {
    await navigator.clipboard.writeText(command.trim());
    toast({ title: "Pedido copiado", description: "Você pode colar em qualquer conversa do Codex." });
  };

  const stopListening = () => {
    speechRecognitionRef.current?.stop();
  };

  const toggleVoiceInput = () => {
    if (listening) {
      stopListening();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        variant: "destructive",
        title: "Áudio não disponível neste navegador",
        description: "Abra a Central pelo Chrome ou Edge atualizado para ditar seu pedido.",
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setListening(true);
      setInterimTranscript("");
      setStatus("Ouvindo você… Fale normalmente e toque em Parar quando terminar.");
    };

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || "";
        if (event.results[index].isFinal) finalText += transcript;
        else interimText += transcript;
      }

      if (finalText.trim()) {
        setCommand((current) => `${current.trim()}${current.trim() ? " " : ""}${finalText.trim()}`);
      }
      setInterimTranscript(interimText.trim());
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        const permissionDenied = event.error === "not-allowed" || event.error === "service-not-allowed";
        toast({
          variant: "destructive",
          title: permissionDenied ? "Permissão do microfone bloqueada" : "Não consegui ouvir o áudio",
          description: permissionDenied
            ? "Libere o microfone nas permissões do navegador e tente novamente."
            : "Confira sua conexão e tente falar outra vez.",
        });
      }
    };

    recognition.onend = () => {
      setListening(false);
      setInterimTranscript("");
      setStatus("Áudio convertido em texto. Revise o pedido antes de enviar.");
      speechRecognitionRef.current = null;
    };

    speechRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      speechRecognitionRef.current = null;
      setListening(false);
    }
  };

  useEffect(() => () => {
    speechRecognitionRef.current?.abort();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader isAdmin={isAdmin} />
      <main className="container mx-auto space-y-4 px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:space-y-6 sm:px-4 sm:py-6 lg:py-8">
        <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-500/10 via-background to-violet-500/10 p-4 shadow-sm sm:p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <Badge className="mb-4 gap-1.5 border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400">
                <BrainCircuit className="h-3.5 w-3.5" /> Central de comando
              </Badge>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">Converse com a equipe da Zuno em um só lugar</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                Diga o resultado que você quer. Use a nuvem para marketing e conteúdo; quando estiver no computador, envie programação e mudanças do produto diretamente ao Codex.
              </p>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:gap-3 lg:w-auto lg:min-w-[280px]">
              <div className="rounded-xl border bg-background/75 p-3">
                <Cloud className="h-5 w-5 text-emerald-500" />
                <p className="mt-2 text-sm font-semibold">Nuvem Zuno</p>
                <p className="text-xs text-muted-foreground">Sempre disponível</p>
              </div>
              <div className="rounded-xl border bg-background/75 p-3">
                <Laptop className="h-5 w-5 text-violet-500" />
                <p className="mt-2 text-sm font-semibold">Codex local</p>
                <p className="text-xs text-muted-foreground">PC + aplicativo</p>
              </div>
            </div>
          </div>
        </section>

        <CommandCenterOperations onNavigate={navigate} />

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> Fale com a Sol</CardTitle>
              <CardDescription>Escolha onde o trabalho será executado e descreva o que precisa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0 sm:space-y-5 sm:p-6 sm:pt-0">
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setMode("cloud")} className={`rounded-xl border p-4 text-left transition ${mode === "cloud" ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/20" : "hover:bg-muted/50"}`}>
                  <div className="flex items-center justify-between gap-3"><Cloud className="h-5 w-5 text-emerald-500" />{mode === "cloud" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}</div>
                  <p className="mt-3 font-semibold">Agentes na nuvem</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Marketing, Instagram, copy, SDR, closer e estratégia.</p>
                </button>
                <button type="button" onClick={() => setMode("codex")} className={`rounded-xl border p-4 text-left transition ${mode === "codex" ? "border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/20" : "hover:bg-muted/50"}`}>
                  <div className="flex items-center justify-between gap-3"><Code2 className="h-5 w-5 text-violet-500" />{mode === "codex" && <CheckCircle2 className="h-4 w-4 text-violet-500" />}</div>
                  <p className="mt-3 font-semibold">Codex no computador</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Programação, correções, integrações e mudanças no produto.</p>
                </button>
              </div>

              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">{modeDescription}</div>
              <div className={`relative rounded-lg ${listening ? "ring-2 ring-rose-500/40" : ""}`}>
                <Textarea
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="Digite ou toque no microfone para falar o que você precisa…"
                  className="min-h-40 resize-y pb-16 pr-4 text-base leading-6 sm:min-h-36 sm:pb-14"
                />
                <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-md bg-background/95 pl-2 shadow-sm backdrop-blur">
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" aria-live="polite">
                    {listening ? (interimTranscript || "Ouvindo…") : "Você também pode falar seu pedido"}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={listening ? "destructive" : "secondary"}
                    onClick={toggleVoiceInput}
                    className="h-11 shrink-0 gap-2 px-3 sm:h-9"
                    aria-pressed={listening}
                    aria-label={listening ? "Parar de ouvir" : "Falar pedido por áudio"}
                  >
                    {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {listening ? "Parar" : "Falar"}
                  </Button>
                </div>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">O áudio vira texto para você revisar. A Zuno não salva a gravação.</p>

              <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                {quickCommands.map((item) => <Button key={item} type="button" size="sm" variant="outline" className="h-auto min-w-[230px] snap-start whitespace-normal py-2 text-left text-xs sm:min-w-0" onClick={() => setCommand(item)}>{summarizeCommand(item)}</Button>)}
              </div>

              {running && <div className="space-y-2"><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} /></div><p className="text-xs text-muted-foreground">{status}</p></div>}

              <div className="flex flex-col gap-3 sm:flex-row [&>button]:w-full sm:[&>button]:w-auto">
                {mode === "cloud" ? (
                  <Button size="lg" className="gap-2" onClick={runCloudTeam} disabled={!canSend}>{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Executar com o time na nuvem</Button>
                ) : (
                  <Button size="lg" className="gap-2 bg-violet-600 text-white hover:bg-violet-500" onClick={openInCodex} disabled={!canSend}><Sparkles className="h-4 w-4" /> Abrir pedido no Codex</Button>
                )}
                <Button size="lg" variant="outline" className="gap-2" onClick={copyForCodex} disabled={!command.trim()}><Copy className="h-4 w-4" /> Copiar pedido</Button>
              </div>
              {!running && <p className="text-xs text-muted-foreground">{status}</p>}
              {directorResult && (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-emerald-500/10 p-2"><BrainCircuit className="h-5 w-5 text-emerald-500" /></div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Retorno do Diretor</p>
                      <p className="mt-1 text-sm font-medium leading-6">{directorResult.summary}</p>
                      {directorResult.detail && <p className="mt-2 text-xs leading-5 text-muted-foreground">{directorResult.detail}</p>}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="min-w-0 space-y-4 sm:space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">O que funciona em cada situação</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex gap-3"><Cloud className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /><div><p className="font-medium">PC desligado</p><p className="text-xs leading-5 text-muted-foreground">Campanhas concluídas, conteúdo, aprovações e dados continuam disponíveis no site.</p></div></div>
                <div className="flex gap-3"><Laptop className="mt-0.5 h-5 w-5 shrink-0 text-violet-500" /><div><p className="font-medium">PC ligado</p><p className="text-xs leading-5 text-muted-foreground">Tudo acima, mais programação e acesso ao projeto local pelo Codex.</p></div></div>
                <div className="flex gap-3"><WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /><div><p className="font-medium">Sem internet</p><p className="text-xs leading-5 text-muted-foreground">Somente tarefas locais que não dependam dos serviços da Zuno.</p></div></div>
                <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" /><div><p className="font-medium">Proteção</p><p className="text-xs leading-5 text-muted-foreground">A Central permanece exclusiva para sua conta de administrador.</p></div></div>
              </CardContent>
            </Card>

            {history.length > 0 && <Card><CardHeader><CardTitle className="text-lg">Pedidos recentes</CardTitle></CardHeader><CardContent className="space-y-2">{history.slice(0, 5).map((item) => <button type="button" key={`${item.createdAt}-${item.text}`} onClick={() => { setCommand(item.text); setMode(item.mode); }} className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50"><div className={`rounded-md p-1.5 ${item.mode === "cloud" ? "bg-emerald-500/10 text-emerald-500" : "bg-violet-500/10 text-violet-500"}`}>{item.mode === "cloud" ? <Cloud className="h-4 w-4" /> : <Code2 className="h-4 w-4" />}</div><span className="min-w-0 flex-1 truncate text-xs">{item.text}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></button>)}</CardContent></Card>}
          </div>
        </div>

        <section>
          <div className="mb-3 flex items-center gap-2"><h2 className="text-lg font-semibold">Áreas da operação</h2><Badge variant="outline">atalhos</Badge></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {destinations.map((item) => <button type="button" key={item.to} onClick={() => navigate(item.to)} className="group rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm"><item.icon className="h-5 w-5 text-primary" /><p className="mt-3 font-semibold">{item.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p><span className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">Abrir <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span></button>)}
          </div>
        </section>
      </main>
    </div>
  );
}
