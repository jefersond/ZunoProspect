import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminLoadingState, AdminErrorState, AdminEmptyState } from "@/components/admin/AdminStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Mail, Send, Eye, RefreshCw, AlertCircle, CheckCircle2, XCircle, Clock } from "lucide-react";

interface BehaviorTemplate {
  key: string;
  subject: string;
  preheader: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  microcopy: string;
}

const BEHAVIOR_TEMPLATES: Record<string, BehaviorTemplate> = {
  signup_no_search_1h: {
    key: "signup_no_search_1h",
    subject: "Sua primeira busca no Zuno está pronta para começar",
    preheader: "Comece encontrando empresas por cidade e nicho.",
    title: "Faça sua primeira busca",
    body: "Você criou sua conta no Zuno Propect, mas ainda não fez sua primeira busca.\n\nComece escolhendo uma cidade e um nicho. O Zuno encontra empresas e ajuda você a transformar isso em oportunidades de abordagem.",
    ctaLabel: "Fazer minha primeira busca",
    ctaUrl: "https://www.zunopropect.com.br/prospeccao?utm_source=email&utm_medium=behavior&utm_campaign=signup_no_search_1h",
    microcopy: "Você começa com 20 leads grátis e 3 análises IA."
  },
  search_no_ai_1h: {
    key: "search_no_ai_1h",
    subject: "Você encontrou leads. Agora gere a abordagem.",
    preheader: "Use a IA para transformar um lead em uma mensagem com contexto.",
    title: "Gere sua primeira abordagem com IA",
    body: "Você já encontrou leads no Zuno.\n\nO próximo passo é escolher uma empresa e gerar uma abordagem com IA para WhatsApp, Instagram ou e-mail.",
    ctaLabel: "Gerar abordagem com IA",
    ctaUrl: "https://www.zunopropect.com.br/prospeccao?utm_source=email&utm_medium=behavior&utm_campaign=search_no_ai_1h",
    microcopy: "Esse é o momento em que uma lista vira uma conversa com contexto."
  },
  ai_used_continue_2h: {
    key: "ai_used_continue_2h",
    subject: "Use suas análises grátis nos melhores leads",
    preheader: "Você ainda pode gerar mais abordagens com IA.",
    title: "Continue analisando seus melhores leads",
    body: "Você já usou a IA do Zuno para gerar contexto de abordagem.\n\nAgora escolha outro lead com potencial e gere uma nova mensagem antes de tomar a decisão de contato.",
    ctaLabel: "Analisar outro lead",
    ctaUrl: "https://www.zunopropect.com.br/prospeccao?utm_source=email&utm_medium=behavior&utm_campaign=ai_used_continue_2h",
    microcopy: "Priorize empresas que parecem ter mais chance de responder."
  },
  ai_limit_no_upgrade_1h: {
    key: "ai_limit_no_upgrade_1h",
    subject: "Suas análises IA grátis acabaram",
    preheader: "Continue gerando abordagens com mais análises IA.",
    title: "Libere mais análises IA",
    body: "Você usou suas análises IA grátis no Zuno Propect.\n\nCom um plano pago, você pode continuar transformando leads em abordagens com mais contexto para WhatsApp, Instagram e e-mail.",
    ctaLabel: "Ver planos",
    ctaUrl: "https://www.zunopropect.com.br/profile?utm_source=email&utm_medium=behavior&utm_campaign=ai_limit_no_upgrade_1h",
    microcopy: "O Starter libera 30 análises IA por mês. O Pro libera 100 análises IA por mês."
  },
  checkout_abandoned_1h: {
    key: "checkout_abandoned_1h",
    subject: "Você chegou perto de liberar mais análises no Zuno",
    preheader: "Continue de onde parou no plano Starter.",
    title: "Continue com o plano Starter",
    body: "Você iniciou o checkout do plano Starter no Zuno Propect, mas não finalizou a assinatura.\n\nCom o Starter, você libera 30 análises IA por mês para continuar transformando leads em abordagens mais claras para WhatsApp, Instagram e e-mail.",
    ctaLabel: "Continuar com o Starter",
    ctaUrl: "https://www.zunopropect.com.br/profile?utm_source=email&utm_medium=behavior&utm_campaign=checkout_abandoned_1h&utm_content=starter",
    microcopy: "Se o checkout anterior expirou, criaremos uma nova sessão segura."
  },
  hot_user_inactive_24h: {
    key: "hot_user_inactive_24h",
    subject: "Seus leads ainda podem virar conversas",
    preheader: "Volte para continuar sua prospecção no Zuno.",
    title: "Continue sua prospecção",
    body: "Você já encontrou leads e usou a IA do Zuno para gerar abordagens com contexto.\n\nVolte para continuar analisando oportunidades e organizar sua próxima abordagem.",
    ctaLabel: "Voltar para o Zuno",
    ctaUrl: "https://www.zunopropect.com.br/prospeccao?utm_source=email&utm_medium=behavior&utm_campaign=hot_user_inactive_24h",
    microcopy: "Continue de onde parou e mantenha sua prospecção em movimento."
  }
};

interface QueueItem {
  id: string;
  email: string;
  automation_key: string;
  status: string;
  scheduled_for: string;
  sent_at: string | null;
  skipped_at: string | null;
  failed_at: string | null;
  skip_reason: string | null;
}

export const BehaviorEmailsDashboard = () => {
  const { toast } = useToast();
  const [selectedKey, setSelectedKey] = useState<string>("signup_no_search_1h");
  const [testEmail, setTestEmail] = useState<string>("");
  const [sendingTest, setSendingTest] = useState<boolean>(false);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(true);
  const [logs, setLogs] = useState<QueueItem[]>([]);
  const [error, setError] = useState<any>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    loadAdminEmail();
    loadQueueLogs();
  }, []);

  const loadAdminEmail = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setTestEmail(user.email);
      }
    } catch (error) {
      console.error("Erro ao carregar email do administrador:", error);
    }
  };

  const loadQueueLogs = async () => {
    setLoadingLogs(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from("behavior_email_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (fetchErr) throw fetchErr;
      setLogs(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar logs da fila comportamental:", err);
      setError(err);
      toast({
        variant: "destructive",
        title: "Erro ao carregar fila",
        description: err.message || "Não foi possível conectar com o banco de dados."
      });
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadQueueLogs();
    setRefreshing(false);
  };

  const handleSendTest = async () => {
    if (!testEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(testEmail)) {
      toast({
        variant: "destructive",
        title: "E-mail inválido",
        description: "Por favor, insira um e-mail de teste válido."
      });
      return;
    }

    setSendingTest(true);
    try {
      console.log(`Disparando envio de teste comportamental: ${selectedKey} para ${testEmail}`);
      const { data, error } = await supabase.functions.invoke("process-behavior-emails", {
        body: {
          action: "send_test",
          email: testEmail,
          automation_key: selectedKey
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "E-mail de teste enviado!",
          description: `O template ${selectedKey} foi despachado para ${testEmail} via Resend.`
        });
        // Atualizar logs de fila
        await loadQueueLogs();
      } else {
        throw new Error(data?.error || "Resposta desconhecida da Edge Function.");
      }
    } catch (error: any) {
      console.error("Erro ao disparar teste de e-mail:", error);
      toast({
        variant: "destructive",
        title: "Falha ao enviar teste",
        description: error.message || "Verifique se a Edge Function está implantada e o Resend configurado."
      });
    } finally {
      setSendingTest(false);
    }
  };

  const currentTemplate = BEHAVIOR_TEMPLATES[selectedKey];

  const getHtmlPreviewContent = (template: BehaviorTemplate) => {
    const mockUnsubscribeUrl = `https://zunopropect.com.br/unsubscribe?email_hash=mock_hash_12345`;
    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${template.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f0e; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%;">
  <!-- Preheader invisível -->
  <div style="display: none; max-height: 0px; overflow: hidden; opacity: 0; color: transparent; font-size: 1px; line-height: 1px;">
    ${template.preheader}
  </div>

  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #0b0f0e; padding: 40px 10px;">
    <tr>
      <td align="center">
        <!-- Container Central -->
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%; border-collapse: collapse;">
          <!-- Topo/Header -->
          <tr>
            <td style="padding: 0 0 24px 0; text-align: left;">
              <span style="font-size: 16px; font-weight: 700; letter-spacing: 0.5px; color: #10d98a;">
                Zuno Propect
              </span>
            </td>
          </tr>
          
          <!-- Card Principal -->
          <tr>
            <td style="background-color: #111816; border: 1px solid #1f2d29; border-radius: 12px; padding: 40px 32px; text-align: left;">
              <!-- Título -->
              <h1 style="margin: 0 0 20px 0; font-size: 22px; font-weight: 700; color: #ffffff; line-height: 1.3;">
                ${template.title}
              </h1>
              
              <!-- Corpo de Texto -->
              <p style="margin: 0 0 32px 0; font-size: 15px; line-height: 1.6; color: #f4f4f5; white-space: pre-line;">
                ${template.body}
              </p>

              <!-- Bloco do Botão CTA -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="left">
                    <a href="${template.ctaUrl}" target="_blank" style="display: inline-block; background-color: #10d98a; color: #0b0f0e; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 700; text-align: center;">
                      ${template.ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Microcopy / Texto Secundário -->
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #9ca3af;">
                ${template.microcopy}
              </p>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="padding: 32px 24px 0 24px; text-align: center;">
              <p style="margin: 0 0 12px 0; font-size: 12px; line-height: 1.6; color: #9ca3af;">
                Você recebeu este e-mail porque criou uma conta no Zuno Propect.
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 1.6;">
                <a href="${mockUnsubscribeUrl}" target="_blank" style="color: #9ca3af; text-decoration: underline;">
                  Descadastrar
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  };

  const getTextPlainContent = (template: BehaviorTemplate) => {
    return `${template.title}

${template.body}

👉 ${template.ctaLabel}:
${template.ctaUrl}

---
${template.microcopy}

---
Você recebeu este e-mail porque criou uma conta no Zuno Propect.
Descadastrar:
https://zunopropect.com.br/unsubscribe?email_hash=mock_hash_12345`;
  };

  const getStatusBadge = (status: string, skipReason: string | null) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1"><CheckCircle2 className="h-3 w-3" /> Enviado</Badge>;
      case "skipped":
        return (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1" title={skipReason || "Pulado por regra comercial"}>
            <AlertCircle className="h-3 w-3" /> Pulado
          </Badge>
        );
      case "failed":
        return <Badge variant="destructive" className="bg-rose-500/10 text-rose-400 border-rose-500/20 gap-1"><XCircle className="h-3 w-3" /> Falhou</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-blue-400 border-blue-400/30 gap-1"><Clock className="h-3 w-3 animate-pulse" /> Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAutomationLabel = (key: string) => {
    const labels: Record<string, string> = {
      signup_no_search_1h: "Primeira busca",
      search_no_ai_1h: "Abordagem com IA",
      ai_used_continue_2h: "Continuar IA",
      ai_limit_no_upgrade_1h: "Limite IA atingido",
      checkout_abandoned_1h: "Checkout abandonado",
      hot_user_inactive_24h: "Usuário inativo"
    };
    return labels[key] || key;
  };

  return (
    <div className="space-y-6">
      {/* Informações superiores */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Automações Comportamentais (Behavioral)</h2>
          <p className="text-sm text-muted-foreground">
            E-mails de alta performance acionados síncronamente pela atividade em tempo real do usuário.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar Fila
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lado Esquerdo: Lista de Seleção e Envio de Teste */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="border-border bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-base">Gatilhos de Reengajamento</CardTitle>
              <CardDescription>Selecione uma automação para inspecionar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.keys(BEHAVIOR_TEMPLATES).map((key) => {
                const isSelected = selectedKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedKey(key)}
                    className={`w-full text-left p-3 rounded-lg border transition-all text-sm font-medium ${
                      isSelected
                        ? "bg-primary/10 border-primary/40 text-primary"
                        : "bg-background/40 border-border/60 hover:bg-background/80 hover:border-border text-muted-foreground"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span>{getAutomationLabel(key)}</span>
                      <code className="text-xs opacity-75 font-mono text-[11px]">{key}</code>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Card de Disparo de Teste */}
          <Card className="border-border bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                Enviar Teste
              </CardTitle>
              <CardDescription>Valide a entrega e a aparência na sua caixa postal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-recipient-email" className="text-xs">Destinatário do Teste</Label>
                <Input
                  id="test-recipient-email"
                  type="email"
                  placeholder="admin@zunopropect.com.br"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="bg-background/40 border-border"
                />
                <p className="text-[11px] text-muted-foreground">
                  Nota: Certifique-se de que o e-mail está na lista permitida se o modo de teste estiver ativo.
                </p>
              </div>
              <Button
                onClick={handleSendTest}
                disabled={sendingTest}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/95"
              >
                {sendingTest ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando teste...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar Teste
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Lado Direito: Preview do E-mail */}
        <div className="lg:col-span-2">
          <Card className="border-border bg-card/60 backdrop-blur-md h-full flex flex-col">
            <CardHeader className="border-b border-border/80">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <Badge variant="outline" className="mb-2 border-primary/20 text-primary bg-primary/5 uppercase tracking-wider font-semibold text-[10px]">
                    {currentTemplate.key}
                  </Badge>
                  <CardTitle className="text-lg text-foreground">{currentTemplate.subject}</CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    <span className="font-semibold text-muted-foreground">Preheader:</span> {currentTemplate.preheader}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col">
              <Tabs defaultValue="html" className="w-full flex-1 flex flex-col">
                <div className="px-6 py-2 border-b border-border/80 bg-background/20">
                  <TabsList className="bg-background/50">
                    <TabsTrigger value="html" className="text-xs gap-1"><Eye className="h-3.5 w-3.5" /> HTML Premium</TabsTrigger>
                    <TabsTrigger value="text" className="text-xs gap-1"><Mail className="h-3.5 w-3.5" /> Texto Puro</TabsTrigger>
                  </TabsList>
                </div>

                {/* ABA HTML PREVIEW */}
                <TabsContent value="html" className="mt-0 flex-1 p-6 bg-[#070b0a] min-h-[450px]">
                  <div className="w-full h-full min-h-[420px] rounded-lg border border-border/60 bg-[#0b0f0e] overflow-hidden shadow-inner flex flex-col">
                    <iframe
                      srcDoc={getHtmlPreviewContent(currentTemplate)}
                      title={`Preview: ${selectedKey}`}
                      className="w-full flex-1 border-0 min-h-[420px] bg-[#0b0f0e]"
                      sandbox="allow-popups allow-popups-to-escape-sandbox"
                    />
                  </div>
                </TabsContent>

                {/* ABA TEXT PLAIN PREVIEW */}
                <TabsContent value="text" className="mt-0 flex-1 p-6 bg-background/10 min-h-[450px]">
                  <ScrollAreaBox text={getTextPlainContent(currentTemplate)} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Histórico e Auditoria de Fila em Tempo Real */}
      <Card className="border-border bg-card/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Logs de Processamento da Fila
          </CardTitle>
          <CardDescription>
            Acompanhe o status de envios e as razões comerciais de pulos (skipped) em tempo real
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <AdminLoadingState message="Carregando logs da fila comportamental..." />
          ) : error ? (
            <AdminErrorState
              title="Erro ao carregar logs da fila comportamental"
              description="Não foi possível ler os registros da tabela behavior_email_queue no Supabase. Verifique RLS ou migrations."
              error={error}
              onRetry={loadQueueLogs}
            />
          ) : logs.length === 0 ? (
            <AdminEmptyState
              title="Nenhum e-mail na fila"
              description="Não há registros de e-mails disparados ou pendentes na fila de remarketing."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs">Destinatário</TableHead>
                    <TableHead className="text-xs">Automação</TableHead>
                    <TableHead className="text-xs">Programado Para</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Eventos</TableHead>
                    <TableHead className="text-xs text-right">Razão de Pulo / Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((item) => (
                    <TableRow key={item.id} className="border-border hover:bg-background/40 transition-colors">
                      <TableCell className="font-medium text-xs text-foreground max-w-[180px] truncate" title={item.email}>
                        {item.email}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {getAutomationLabel(item.automation_key)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(item.scheduled_for).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </TableCell>
                      <TableCell className="text-xs">
                        {getStatusBadge(item.status, item.skip_reason)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.sent_at && (
                          <span className="block text-[11px]" title={`Enviado: ${new Date(item.sent_at).toLocaleString()}`}>
                            ✓ Enviado às {new Date(item.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {item.skipped_at && (
                          <span className="block text-[11px]" title={`Pulado: ${new Date(item.skipped_at).toLocaleString()}`}>
                            ⚠ Pulado às {new Date(item.skipped_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {item.failed_at && (
                          <span className="block text-[11px] text-rose-400" title={`Falhou: ${new Date(item.failed_at).toLocaleString()}`}>
                            ✗ Falha às {new Date(item.failed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground max-w-[180px] truncate" title={item.skip_reason || ""}>
                        {item.skip_reason ? (
                          <span className="font-mono text-[11px] bg-background/60 py-0.5 px-2 rounded border border-border/40 text-amber-300">
                            {item.skip_reason}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Componente utilitário simples de ScrollArea para renderização do Texto
const ScrollAreaBox = ({ text }: { text: string }) => {
  return (
    <div className="w-full flex-grow rounded-lg border border-border/60 bg-[#0e1211] p-4 text-xs font-mono text-zinc-300 overflow-y-auto whitespace-pre-wrap max-h-[420px] min-h-[420px] shadow-inner select-text">
      {text}
    </div>
  );
};
