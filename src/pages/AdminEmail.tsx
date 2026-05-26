import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Send, Trash2, Eye, Plus, ArrowLeft, Users, MailOpen, AlertCircle, Zap, FlaskConical, UserCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OnboardingEmailsDashboard } from "@/components/admin/OnboardingEmailsDashboard";
import { ABTestingDashboard } from "@/components/admin/ABTestingDashboard";
import { WelcomeEmailsDashboard } from "@/components/admin/WelcomeEmailsDashboard";
import { EmailTestCard } from "@/components/admin/EmailTestCard";
import { UsersDashboard } from "@/components/admin/UsersDashboard";
import { BehaviorEmailsDashboard } from "@/components/admin/BehaviorEmailsDashboard";
import { isAdminEmail } from "@/config/admin";
import { createFounderAccessCampaignTemplate } from "../../supabase/functions/_shared/emailTemplates";

// Sanitize HTML for safe rendering - allows common email tags
const sanitizeHtml = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      // Basic structure
      'p', 'br', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      // Text formatting
      'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'small', 'sub', 'sup',
      // Links and media
      'a', 'img',
      // Lists
      'ul', 'ol', 'li',
      // Tables (commonly used in emails)
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      // Others
      'hr', 'blockquote', 'pre', 'code',
    ],
    ALLOWED_ATTR: [
      // Links
      'href', 'target', 'rel',
      // Images
      'src', 'alt', 'width', 'height',
      // Inline styling (common in emails)
      'style', 'class',
      // Tables
      'border', 'cellpadding', 'cellspacing', 'align', 'valign', 'bgcolor',
      // Accessibility
      'title', 'aria-label',
    ],
    ALLOW_DATA_ATTR: false,
  });
};

interface Campaign {
  id: string;
  nome: string;
  assunto: string;
  conteudo: string;
  segmento: string;
  status: string;
  total_enviados: number;
  total_abertos: number;
  created_at: string;
}

const AdminEmail = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const [testingCampaign, setTestingCampaign] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // New campaign form
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    nome: "",
    assunto: "",
    conteudo: "",
    segmento: "todos",
    formato: "texto", // "texto" ou "html"
    manualRecipientsRaw: "",
  });
  const [creating, setCreating] = useState(false);

  // Preview dialog
  const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if user is admin
      const { data: adminCheck } = await supabase.rpc("is_admin", { _user_id: user.id });
      
      if (!adminCheck && !isAdminEmail(user.email)) {
        toast({
          variant: "destructive",
          title: "Acesso negado",
          description: "Esta página é restrita a administradores.",
        });
        navigate("/prospeccao");
        return;
      }

      setIsAdmin(true);
      await loadCampaigns();
    } catch (error: any) {
      console.error("Erro:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCampaigns = async () => {
    const { data, error } = await supabase
      .from("email_campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar campanhas:", error);
      return;
    }

    setCampaigns(data || []);
  };

  const handleCreateCampaign = async () => {
    if (!newCampaign.nome || !newCampaign.assunto || !newCampaign.conteudo) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha todos os campos.",
      });
      return;
    }

    const rawEmails = (newCampaign as any).manualRecipientsRaw?.split(/[\n,;]+/).map((e: string) => e.trim().toLowerCase()).filter(Boolean) || [];
    const manual_recipients = Array.from(new Set(rawEmails.filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))));
    const invalidEmails = Array.from(new Set(rawEmails.filter((e: string) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))));

    if (invalidEmails.length > 0) {
      toast({
        variant: "destructive",
        title: "E-mails inválidos detectados",
        description: `Corrija ou remova: ${invalidEmails.slice(0, 3).join(", ")}${invalidEmails.length > 3 ? "..." : ""}`,
      });
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase.from("email_campaigns").insert({
        nome: newCampaign.nome,
        assunto: newCampaign.assunto,
        conteudo: newCampaign.conteudo,
        segmento: newCampaign.segmento,
        manual_recipients,
      });

      if (error) throw error;

      toast({
        title: "Campanha criada!",
        description: "A campanha foi salva como rascunho.",
      });

      setNewCampaign({ nome: "", assunto: "", conteudo: "", segmento: "todos", formato: "texto", manualRecipientsRaw: "" } as any);
      setShowNewCampaign(false);
      await loadCampaigns();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao criar campanha",
        description: error.message,
      });
    } finally {
      setCreating(false);
    }
  };

  const applyFounderCampaignTemplate = () => {
    const template = createFounderAccessCampaignTemplate();

    setNewCampaign((current) => ({
      ...current,
      nome: "Reativacao - Parceiro Fundador Zuno",
      assunto: template.subject,
      conteudo: template.html,
      segmento: "nao_pagantes",
      formato: "html",
    }));
  };

  const handleSendCampaign = async (campaignId: string) => {
    setSending(campaignId);
    try {
      console.log("Iniciando envio da campanha:", campaignId);

      const { data: previewData, error: previewError } = await supabase.functions.invoke("send-email-campaign", {
        body: { campaignId, dryRun: true },
      });

      if (previewError) throw previewError;
      if (previewData?.error) throw new Error(previewData.error);

      const confirmed = window.confirm(
        `Enviar campanha para ${previewData?.cappedTo || 0} destinatários elegíveis?\n\n` +
        `Limite por disparo: ${previewData?.limit || 50}\n` +
        `Elegíveis no segmento: ${previewData?.eligible || 0}\n` +
        `Descadastrados ignorados: ${previewData?.skipped?.unsubscribed || 0}\n` +
        `Cooldown de 7 dias ignorado: ${previewData?.skipped?.cooldown || 0}`,
      );

      if (!confirmed) {
        return;
      }
      
      const { data, error } = await supabase.functions.invoke("send-email-campaign", {
        body: { campaignId, confirmed: true },
      });

      console.log("Resposta da função:", { data, error });

      if (error) {
        console.error("Erro na resposta:", error);
        throw error;
      }

      if (!data) {
        throw new Error("Nenhuma resposta recebida da função de envio");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Campanha enviada!",
        description: `${data.sent || 0} emails enviados com sucesso.${data.errors > 0 ? ` ${data.errors} erros.` : ""}${data.capped ? " Envio limitado ao lote seguro." : ""}`,
      });

      // Show error details if any
      if (data.errorDetails && data.errorDetails.length > 0) {
        console.warn("Detalhes dos erros:", data.errorDetails);
        toast({
          variant: "destructive",
          title: "Alguns emails falharam",
          description: data.errorDetails.slice(0, 2).join(", "),
        });
      }

      await loadCampaigns();
    } catch (error: any) {
      console.error("Erro ao enviar campanha:", error);
      toast({
        variant: "destructive",
        title: "Erro ao enviar campanha",
        description: error.message || "Ocorreu um erro desconhecido. Verifique os logs.",
      });
    } finally {
      setSending(null);
    }
  };

  const handleSendTestCampaign = async (campaignId: string) => {
    setTestingCampaign(campaignId);
    try {
      const recipientEmail = "falecom@klsalescompany.com";
      const { data, error } = await supabase.functions.invoke("send-email-campaign", {
        body: {
          mode: "test",
          campaignId,
          recipientEmail,
        },
      });

      if (error) {
        let message = error.message;
        const contextResponse = (error as any)?.context;
        if (contextResponse instanceof Response) {
          try {
            const text = await contextResponse.clone().text();
            const payload = text ? JSON.parse(text) : null;
            message = payload?.details || payload?.error || message;
            console.error("Erro detalhado ao enviar teste de campanha:", {
              campaignId,
              recipientEmail,
              payload,
              error,
            });
          } catch {
            console.error("Erro ao ler resposta do teste de campanha:", error);
          }
        } else {
          console.error("Erro ao enviar teste de campanha:", {
            campaignId,
            recipientEmail,
            error,
            data,
          });
        }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.details || data.error);

      toast({
        title: "Teste enviado",
        description: `${data.sent || 0} email de teste enviado para ${recipientEmail}.`,
      });

      if (data?.errorDetails?.length) {
        toast({
          variant: "destructive",
          title: "Falha no teste",
          description: data.errorDetails[0],
        });
      }
    } catch (error: any) {
      console.error("Erro ao enviar teste:", error);
      toast({
        variant: "destructive",
        title: "Erro ao enviar teste",
        description: error.message || "Verifique a configuração de e-mail.",
      });
    } finally {
      setTestingCampaign(null);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    setDeleting(campaignId);
    try {
      const { error } = await supabase.from("email_campaigns").delete().eq("id", campaignId);

      if (error) throw error;

      toast({
        title: "Campanha excluída",
        description: "A campanha foi removida.",
      });

      await loadCampaigns();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error.message,
      });
    } finally {
      setDeleting(null);
    }
  };

  const getSegmentLabel = (seg: string) => {
    const labels: Record<string, string> = {
      todos: "Todos os usuários",
      starter: "Plano Starter",
      pro: "Plano Pro",
      agencia: "Plano Agência",
      inativos: "Usuários Inativos (0 leads)",
      starter_inativos: "Starter Inativos (nunca usaram)",
      nao_pagantes: "Não Pagantes (todos Starter)",
      never_searched: "Criaram conta e nunca buscaram",
      searched_not_returned: "Buscaram leads e não voltaram",
      free_active: "Free ativos",
      inactive_old: "Antigos inativos",
      clicked_pricing: "Clicaram em preço/upgrade",
      signup_not_paid: "Criaram conta e não assinaram",
      paying: "Pagantes",
      internal_admins: "Admins/testes internos",
    };
    return labels[seg] || seg;
  };

  const getStatusBadge = (status: string) => {
    if (status === "rascunho") {
      return <Badge variant="secondary">Rascunho</Badge>;
    }
    if (status === "enviada") {
      return <Badge className="bg-green-500 hover:bg-green-600">Enviada</Badge>;
    }
    if (status === "enviando") {
      return <Badge variant="outline">Enviando</Badge>;
    }
    if (status === "erro") {
      return <Badge variant="destructive">Erro</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Mail className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">Email Marketing</h1>
              </div>
            </div>
            <Button onClick={() => setShowNewCampaign(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Campanha
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 pb-24">
        <Tabs defaultValue="campanhas" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="campanhas" className="gap-2">
              <Mail className="h-4 w-4" />
              Campanhas Manuais
            </TabsTrigger>
            <TabsTrigger value="welcome" className="gap-2">
              <Users className="h-4 w-4" />
              Boas-Vindas
            </TabsTrigger>
            <TabsTrigger value="onboarding" className="gap-2">
              <Zap className="h-4 w-4" />
              Onboarding
            </TabsTrigger>
            <TabsTrigger value="comportamentais" className="gap-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              Comportamentais
            </TabsTrigger>
            <TabsTrigger value="abtesting" className="gap-2">
              <FlaskConical className="h-4 w-4" />
              A/B Testing
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="gap-2">
              <UserCircle className="h-4 w-4" />
              Usuários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campanhas">
            {/* Email Test Card */}
            <div className="mb-6">
              <EmailTestCard />
            </div>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-primary/10">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Campanhas</p>
                      <p className="text-2xl font-bold">{campaigns.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-green-500/10">
                      <Send className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Emails Enviados</p>
                      <p className="text-2xl font-bold">
                        {campaigns.reduce((sum, c) => sum + c.total_enviados, 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-blue-500/10">
                      <MailOpen className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Emails Abertos</p>
                      <p className="text-2xl font-bold">
                        {campaigns.reduce((sum, c) => sum + c.total_abertos, 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Campaigns Table */}
            <Card>
              <CardHeader>
                <CardTitle>Campanhas</CardTitle>
                <CardDescription>Gerencie suas campanhas de email marketing</CardDescription>
              </CardHeader>
              <CardContent>
                {campaigns.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma campanha criada ainda.</p>
                    <Button onClick={() => setShowNewCampaign(true)} className="mt-4 gap-2">
                      <Plus className="h-4 w-4" />
                      Criar primeira campanha
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Segmento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Enviados</TableHead>
                        <TableHead className="text-center">Abertos</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell className="font-medium">{campaign.nome}</TableCell>
                          <TableCell>{getSegmentLabel(campaign.segmento)}</TableCell>
                          <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                          <TableCell className="text-center">{campaign.total_enviados}</TableCell>
                          <TableCell className="text-center">{campaign.total_abertos}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setPreviewCampaign(campaign)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {campaign.status === "rascunho" && (
                                <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleSendTestCampaign(campaign.id)}
                                  disabled={testingCampaign === campaign.id || sending === campaign.id}
                                  title="Enviar teste"
                                >
                                  {testingCampaign === campaign.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <FlaskConical className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleSendCampaign(campaign.id)}
                                  disabled={sending === campaign.id}
                                  title="Enviar campanha"
                                >
                                  {sending === campaign.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Send className="h-4 w-4" />
                                  )}
                                </Button>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteCampaign(campaign.id)}
                                disabled={deleting === campaign.id}
                                className="text-destructive hover:text-destructive"
                              >
                                {deleting === campaign.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="welcome">
            <WelcomeEmailsDashboard />
          </TabsContent>

          <TabsContent value="onboarding">
            <OnboardingEmailsDashboard />
          </TabsContent>

          <TabsContent value="comportamentais">
            <BehaviorEmailsDashboard />
          </TabsContent>

          <TabsContent value="abtesting">
            <ABTestingDashboard />
          </TabsContent>

          <TabsContent value="usuarios">
            <UsersDashboard />
          </TabsContent>
        </Tabs>
      </main>

      {/* New Campaign Dialog */}
      <Dialog open={showNewCampaign} onOpenChange={setShowNewCampaign}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border/80 px-6 py-5">
            <DialogTitle>Nova Campanha de Email</DialogTitle>
            <DialogDescription>
              Crie uma nova campanha para enviar aos usuários
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 pr-5">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-950">Template Parceiro Fundador</p>
                  <p className="text-xs text-emerald-700">Preenche assunto, segmento e HTML premium da campanha VIP.</p>
                </div>
                <Button type="button" variant="outline" className="border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100" onClick={applyFounderCampaignTemplate}>
                  Usar template
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Campanha</Label>
              <Input
                id="nome"
                placeholder="Ex: Promoção Black Friday"
                value={newCampaign.nome}
                onChange={(e) => setNewCampaign({ ...newCampaign, nome: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="segmento">Segmento de Usuários</Label>
              <Select
                value={newCampaign.segmento}
                onValueChange={(value) => setNewCampaign({ ...newCampaign, segmento: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os usuários</SelectItem>
                  <SelectItem value="starter">Plano Starter</SelectItem>
                  <SelectItem value="pro">Plano Pro</SelectItem>
                  <SelectItem value="agencia">Plano Agência</SelectItem>
                  <SelectItem value="inativos">🔴 Inativos (0 leads este mês)</SelectItem>
                  <SelectItem value="starter_inativos">🎯 Starter Inativos (nunca usaram)</SelectItem>
                  <SelectItem value="nao_pagantes">💰 Não Pagantes (todos Starter)</SelectItem>
                  <SelectItem value="never_searched">Criaram conta e nunca buscaram</SelectItem>
                  <SelectItem value="searched_not_returned">Buscaram leads e não voltaram</SelectItem>
                  <SelectItem value="free_active">Free ativos</SelectItem>
                  <SelectItem value="inactive_old">Antigos inativos</SelectItem>
                  <SelectItem value="signup_not_paid">Criaram conta e não assinaram</SelectItem>
                  <SelectItem value="paying">Pagantes</SelectItem>
                  <SelectItem value="internal_admins">Admins/testes internos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="manualRecipients">Destinatários manuais (opcional)</Label>
              <Textarea
                id="manualRecipients"
                placeholder="email1@gmail.com, email2@gmail.com&#10;ou um por linha"
                value={newCampaign.manualRecipientsRaw}
                onChange={(e) => setNewCampaign({ ...newCampaign, manualRecipientsRaw: e.target.value })}
                className="min-h-[80px]"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <p>Adicione e-mails extras que também devem receber esta campanha.</p>
                {(() => {
                  const rawEmails = newCampaign.manualRecipientsRaw.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
                  const valid = rawEmails.filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
                  const invalid = rawEmails.filter(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
                  if (rawEmails.length === 0) return null;
                  return (
                    <span className={invalid.length > 0 ? "text-destructive font-medium" : "text-emerald-600 font-medium"}>
                      {valid.length} válido(s) {invalid.length > 0 && `| ${invalid.length} inválido(s)`}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assunto">Assunto do Email</Label>
              <Input
                id="assunto"
                placeholder="Ex: Seus primeiros 10 leads estão esperando por você 🎯"
                value={newCampaign.assunto}
                onChange={(e) => setNewCampaign({ ...newCampaign, assunto: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Formato do Email</Label>
              <Select
                value={newCampaign.formato}
                onValueChange={(value) => setNewCampaign({ ...newCampaign, formato: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="texto">📝 Texto simples (recomendado)</SelectItem>
                  <SelectItem value="html">🖥️ HTML avançado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="conteudo">
                {newCampaign.formato === "texto" ? "Mensagem do Email" : "Conteúdo HTML"}
              </Label>
              <Textarea
                id="conteudo"
                placeholder={newCampaign.formato === "texto" 
                  ? "Olá!\n\nVocê criou sua conta mas ainda não prospectou nenhum lead.\n\nSeus 10 leads gratuitos estão esperando por você!\n\nAcesse agora: https://www.zunopropect.com.br/prospeccao\n\nAbraços,\nEquipe Zuno Prospect"
                  : "<h1>Olá!</h1><p>Este é o conteúdo do seu email...</p>"
                }
                rows={12}
                value={newCampaign.conteudo}
                onChange={(e) => setNewCampaign({ ...newCampaign, conteudo: e.target.value })}
                className="min-h-[220px] max-h-[420px] resize-y"
              />
              <p className="text-xs text-muted-foreground">
                {newCampaign.formato === "texto" 
                  ? "Escreva naturalmente. Links serão clicáveis automaticamente."
                  : "Use tags HTML para formatar (h1, p, a, strong, etc.)."
                }
              </p>
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 border-t border-border/80 bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <Button variant="outline" onClick={() => setShowNewCampaign(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleCreateCampaign} disabled={creating} className="w-full sm:w-auto">
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                "Salvar campanha"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewCampaign} onOpenChange={() => setPreviewCampaign(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{previewCampaign?.nome}</DialogTitle>
            <DialogDescription>
              Assunto: {previewCampaign?.assunto}
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg p-4 bg-white">
            <div
              dangerouslySetInnerHTML={{ 
                __html: sanitizeHtml(previewCampaign?.conteudo || "") 
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEmail;
