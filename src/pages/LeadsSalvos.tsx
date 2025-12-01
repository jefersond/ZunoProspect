import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  LogOut,
  Bookmark,
  Search,
  BarChart3,
  History,
  FileText,
  User,
  ArrowLeft,
  MapPin,
  Phone,
  ExternalLink,
  Instagram,
  MessageSquare,
  Trash2,
  Eye,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LeadPlanDialog } from "@/components/prospeccao/LeadPlanDialog";
import type { LeadProspeccao } from "@/types/lead";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const LeadsSalvos = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [leads, setLeads] = useState<LeadProspeccao[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<LeadProspeccao[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLead, setSelectedLead] = useState<LeadProspeccao | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reanalyzingLeadId, setReanalyzingLeadId] = useState<string | null>(null);

  // Função para validar telefone brasileiro
  const isValidBrazilianPhone = (phone: string): boolean => {
    if (!phone) return false;
    const cleaned = phone.replace(/\D/g, "");
    return cleaned.length >= 10 && cleaned.length <= 11;
  };

  // Função para gerar link do WhatsApp
  const generateWhatsAppLink = (phone: string): string | null => {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, "");
    if (!isValidBrazilianPhone(phone)) return null;
    // Adiciona código do Brasil se não tiver
    const fullNumber = cleaned.length === 11 || cleaned.length === 10 
      ? `55${cleaned}` 
      : cleaned;
    return `https://wa.me/${fullNumber}`;
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
      } else {
        setUser(user);
        loadSavedLeads(user.id);
      }
    };
    checkUser();
  }, [navigate]);

  const loadSavedLeads = async (userId: string) => {
    try {
      setLoading(true);
      // Usa função RPC para obter dados descriptografados
      // p_salvo = true para buscar apenas leads salvos
      const { data, error } = await supabase
        .rpc("get_leads_decrypted_filtered", { p_salvo: true });

      if (error) throw error;

      const transformedLeads: LeadProspeccao[] = (data || []).map((lead: any) => {
        // Usa whatsapp_number se existir, senão tenta telefone
        const phoneForWhatsapp = lead.whatsapp_number || lead.telefone;
        
        return {
          id: lead.id,
          placeId: lead.google_place_id,
          nome: lead.nome,
          telefone: lead.telefone,
          whatsapp_link: generateWhatsAppLink(phoneForWhatsapp),
          website: lead.website || null,
          instagram_url: lead.instagram_url || null,
          instagram_context: lead.instagram_context,
        endereco: lead.endereco,
        cidade: lead.cidade,
        nicho: lead.nicho,
        foco: lead.foco as any,
        proximidadeAtiva: lead.proximidade_ativa || false,
        raioKm: lead.raio_km,
        sinais: {
          has_whatsapp_on_site: lead.whatsapp_on_site || false,
          has_meta_pixel: lead.has_meta_pixel || false,
          has_gtag: lead.has_gtag || false,
          has_gtm: lead.has_gtm || false,
        },
        diagnostico_bullets: (lead.diagnostico_bullets as string[]) || [],
        probabilidade_conversao: lead.probabilidade_conversao || 0,
        plano_prospecao_7dias: (lead.plano_prospeccao as any) || [],
        rating: lead.rating,
        total_reviews: lead.total_reviews,
        status: lead.status || "novo",
        created_at: lead.created_at,
        ai_analise_gerada_em: lead.ai_analise_gerada_em,
        salvo: lead.salvo || false,
      };
      });

      setLeads(transformedLeads);
      setFilteredLeads(transformedLeads);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar leads",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchTerm) {
      const filtered = leads.filter(
        (lead) =>
          lead.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.cidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.nicho.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredLeads(filtered);
    } else {
      setFilteredLeads(leads);
    }
  }, [searchTerm, leads]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleRemoveSaved = async (leadId: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ salvo: false })
        .eq("id", leadId);

      if (error) throw error;

      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      toast({
        title: "Lead removido",
        description: "Lead removido dos salvos com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleViewPlan = (lead: LeadProspeccao) => {
    setSelectedLead(lead);
    setDialogOpen(true);
  };

  const handleReanalyze = async (leadId: string) => {
    try {
      setReanalyzingLeadId(leadId);
      
      toast({
        title: "Reanalisando lead",
        description: "Aguarde enquanto a IA reanalisa este lead...",
      });

      const { error } = await supabase.functions.invoke("analisar-lead-ia", {
        body: { leadId },
      });

      if (error) throw error;

      // Recarrega os leads para obter a análise atualizada
      if (user) {
        await loadSavedLeads(user.id);
      }

      toast({
        title: "Reanálise concluída",
        description: "O lead foi reanalisado com sucesso",
      });
    } catch (error: any) {
      console.error("Erro ao reanalisar lead:", error);
      toast({
        title: "Erro na reanálise",
        description: error.message || "Não foi possível reanalisar o lead",
        variant: "destructive",
      });
    } finally {
      setReanalyzingLeadId(null);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-primary/5">
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo e Título */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/prospeccao")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Bookmark className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                Leads Salvos
              </h1>
            </div>

            {/* Navegação e Ações */}
            <div className="flex items-center gap-1">
              {/* Navegação Principal */}
              <nav className="flex items-center gap-1 mr-2 pr-2 border-r border-border">
                <Button variant="ghost" size="sm" onClick={() => navigate("/prospeccao")} className="gap-2">
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">Prospecção</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/templates")} className="gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Templates</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/historico")} className="gap-2">
                  <History className="h-4 w-4" />
                  <span className="hidden sm:inline">Histórico</span>
                </Button>
              </nav>

              {/* Ações do Usuário */}
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <Button variant="ghost" size="sm" onClick={() => navigate("/profile")} className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Perfil</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 ml-1">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sair</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Barra de busca */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, cidade ou nicho..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Contagem */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""} salvo{filteredLeads.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Lista de leads */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredLeads.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bookmark className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                {searchTerm
                  ? "Nenhum lead encontrado com este filtro"
                  : "Nenhum lead salvo ainda"}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Salve leads na página de prospecção clicando no ícone de favorito
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredLeads.map((lead) => (
              <Card key={lead.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{lead.nome}</CardTitle>
                      {lead.endereco && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{lead.endereco}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 ml-2">
                      <Badge variant="outline" className="text-xs">{lead.nicho}</Badge>
                      <Badge variant="secondary" className="text-xs">{lead.foco}</Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Contatos */}
                  <div className="flex flex-wrap gap-2">
                    {lead.telefone && lead.whatsapp_link && (
                      <a
                        href={lead.whatsapp_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-green-600 hover:underline"
                      >
                        <MessageSquare className="h-3 w-3" />
                        {lead.telefone}
                      </a>
                    )}
                    {lead.telefone && !lead.whatsapp_link && (
                      <a
                        href={`tel:${lead.telefone}`}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Phone className="h-3 w-3" />
                        {lead.telefone}
                      </a>
                    )}
                    {lead.instagram_url && (
                      <a
                        href={lead.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-pink-600 hover:underline"
                      >
                        <Instagram className="h-3 w-3" />
                        Instagram
                      </a>
                    )}
                    {lead.website && (
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Website
                      </a>
                    )}
                  </div>

                  {/* Probabilidade */}
                  {lead.probabilidade_conversao > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xs text-muted-foreground">Probabilidade:</span>
                      <Badge
                        className={
                          lead.probabilidade_conversao >= 70
                            ? "bg-green-100 text-green-700 border-green-200"
                            : lead.probabilidade_conversao >= 40
                            ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                            : "bg-red-100 text-red-700 border-red-200"
                        }
                        variant="outline"
                      >
                        {lead.probabilidade_conversao}%
                      </Badge>
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleViewPlan(lead)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver Plano
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReanalyze(lead.id)}
                      disabled={reanalyzingLeadId === lead.id}
                    >
                      {reanalyzingLeadId === lead.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover dos salvos?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O lead "{lead.nome}" será removido dos seus salvos. Você pode salvá-lo novamente depois.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRemoveSaved(lead.id)}>
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <LeadPlanDialog
        lead={selectedLead}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onLeadUpdate={() => user && loadSavedLeads(user.id)}
      />
    </div>
  );
};

export default LeadsSalvos;
