import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Bookmark,
  Search,
  MapPin,
  Phone,
  ExternalLink,
  Instagram,
  MessageSquare,
  Trash2,
  Eye,
  Loader2,
  RefreshCw,
  Mail as MailIcon,
  StickyNote,
} from "lucide-react";
import { FloatingWhatsAppButton } from "@/components/FloatingWhatsAppButton";
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
import { AppHeader } from "@/components/AppHeader";
import { isAdminUser } from "@/config/admin";

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
  const [verifyingNumbers, setVerifyingNumbers] = useState<Set<string>>(new Set());
  const [numberStatus, setNumberStatus] = useState<Record<string, 'valid' | 'invalid' | 'checking'>>({});
  const [isAdmin, setIsAdmin] = useState(false);

  // Função para validar telefone brasileiro
  const isValidBrazilianPhone = (phone: string): boolean => {
    if (!phone) return false;
    const cleaned = phone.replace(/\D/g, "");
    return cleaned.length >= 10 && cleaned.length <= 11;
  };

  // Função para validar se o número tem formato de celular (9 dígitos)
  const isMobileNumber = (phone: string): boolean => {
    if (!phone) return false;
    const cleaned = phone.replace(/\D/g, "");
    // Remove código do país se existir
    const number = cleaned.startsWith("55") ? cleaned.substring(2) : cleaned;
    // Celular brasileiro: DDD (2 dígitos) + 9 + 8 dígitos = 11 dígitos total
    return number.length === 11 && number.charAt(2) === '9';
  };

  // Função para gerar link do WhatsApp
  const generateWhatsAppLink = (whatsappNumber: string | null, telefone: string | null): string | null => {
    // Prioriza whatsapp_number (já é confirmado, não precisa validar se é celular)
    if (whatsappNumber) {
      const cleaned = whatsappNumber.replace(/\D/g, "");
      if (cleaned.length >= 10) {
        const numberOnly = cleaned.startsWith("55") ? cleaned.substring(2) : cleaned;
        return `https://wa.me/55${numberOnly}`;
      }
    }
    
    // Fallback para telefone - só se for celular válido
    if (telefone) {
      const cleaned = telefone.replace(/\D/g, "");
      if (!isValidBrazilianPhone(telefone)) return null;
      
      const numberOnly = cleaned.startsWith("55") ? cleaned.substring(2) : cleaned;
      
      // Só gera link WhatsApp para celulares (11 dígitos, começa com 9)
      if (numberOnly.length === 11 && numberOnly.charAt(2) === '9') {
        return `https://wa.me/55${numberOnly}`;
      }
    }
    
    return null;
  };

  // Função para formatar telefone com prefixo do país
  const formatPhoneWithCountryCode = (phone: string): string => {
    if (!phone) return "";
    const cleaned = phone.replace(/\D/g, "");
    
    // Se já começa com 55, formata
    if (cleaned.startsWith("55")) {
      return `+${cleaned}`;
    }
    
    // Se não tem o prefixo, adiciona +55
    return `+55${cleaned}`;
  };

  // Função para verificar formato do número
  const validatePhoneNumber = (phone: string): 'valid' | 'invalid' | 'landline' => {
    if (!phone) return 'invalid';
    
    if (!isValidBrazilianPhone(phone)) {
      return 'invalid';
    }
    
    if (!isMobileNumber(phone)) {
      return 'landline';
    }
    
    return 'valid';
  };

  // Valida números ao carregar leads
  useEffect(() => {
    const statusMap: Record<string, 'valid' | 'invalid' | 'checking'> = {};
    leads.forEach(lead => {
      if (lead.telefone) {
        const validation = validatePhoneNumber(lead.telefone);
        statusMap[lead.telefone] = validation === 'valid' ? 'valid' : 'invalid';
      }
    });
    setNumberStatus(statusMap);
  }, [leads]);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
      } else {
        setUser(user);
        loadSavedLeads(user.id);
        // Check if admin
        const { data: adminData } = await supabase.rpc('is_admin', { _user_id: user.id });
        setIsAdmin(isAdminUser(user, { is_admin: adminData === true }));
      }
    };
    checkUser();
  }, [navigate]);

  const loadSavedLeads = async (userId: string) => {
    try {
      setLoading(true);
      // Usa edge function segura com rate limiting e auditoria
      const { data, error } = await supabase.functions.invoke('get-leads-secure', {
        body: {
          action: 'list',
          salvo: true,
        },
      });

      if (error) throw error;

      if (data.error) {
        // Handle rate limit
        if (data.rate_limit && data.rate_limit.remaining === 0) {
          toast({
            title: "Limite de requisições",
            description: `Aguarde ${data.rate_limit.reset_in_minutes} minuto(s) para continuar.`,
            variant: "destructive",
          });
          return;
        }
        throw new Error(data.error);
      }

      const transformedLeads: LeadProspeccao[] = (data.data?.leads || []).map((lead: any) => {
        return {
          id: lead.id,
          placeId: lead.google_place_id,
          nome: lead.nome,
          telefone: lead.telefone,
          whatsapp_link: generateWhatsAppLink(lead.whatsapp_number, lead.telefone),
          email: lead.email || null,
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
          notas: lead.notas || null,
          // Campos CNPJ
          cnpj: lead.cnpj || null,
          razao_social: lead.razao_social || null,
          nome_responsavel: lead.nome_responsavel || null,
          cnpj_telefone: lead.cnpj_telefone || null,
          cnpj_email: lead.cnpj_email || null,
          situacao_cadastral: lead.situacao_cadastral || null,
          porte_empresa: lead.porte_empresa || null,
          cnae_principal: lead.cnae_principal || null,
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

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");

      const { error } = await supabase.functions.invoke("analisar-lead-ia", {
        body: { leadId },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) {
        console.error("Erro analisar-lead-ia:", error);
        throw error;
      }

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
      <AppHeader isAdmin={isAdmin} />

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
                  <div className="space-y-1">
                    {lead.telefone && (
                      <div className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        <span>{formatPhoneWithCountryCode(lead.telefone)}</span>
                      </div>
                    )}
                    {lead.whatsapp_link && (
                      <a
                        href={lead.whatsapp_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-green-600 hover:underline"
                      >
                        <MessageSquare className="h-3 w-3 flex-shrink-0" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}`}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                      >
                        <MailIcon className="h-3 w-3 flex-shrink-0" />
                        <span>Email</span>
                      </a>
                    )}
                    {lead.website && (
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{lead.website}</span>
                      </a>
                    )}
                    {lead.instagram_url && (
                      <a
                        href={lead.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-pink-600 hover:underline"
                      >
                        <Instagram className="h-3 w-3 flex-shrink-0" />
                        <span>Instagram</span>
                      </a>
                    )}
                  </div>

                  {/* Notas */}
                  {lead.notas && (
                    <div className="flex items-start gap-1 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                      <StickyNote className="h-3 w-3 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{lead.notas}</span>
                    </div>
                  )}

                  {/* Probabilidade */}
                  {lead.probabilidade_conversao > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Probabilidade:</span>
                      <Badge
                        variant={
                          lead.probabilidade_conversao >= 70
                            ? "default"
                            : lead.probabilidade_conversao >= 40
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {lead.probabilidade_conversao}%
                      </Badge>
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewPlan(lead)}
                      className="flex-1 gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      Ver Plano
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReanalyze(lead.id)}
                      disabled={reanalyzingLeadId === lead.id}
                      className="gap-1"
                    >
                      {reanalyzingLeadId === lead.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover lead salvo?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O lead será removido dos seus salvos, mas não será excluído permanentemente.
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
      />
      <FloatingWhatsAppButton />
    </div>
  );
};

export default LeadsSalvos;
