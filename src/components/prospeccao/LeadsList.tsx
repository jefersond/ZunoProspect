import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ExternalLink, MapPin, Phone, Star, Trash2, Eye, MessageSquare, Instagram, Download, Save, Archive, Mail } from "lucide-react";
import type { LeadProspeccao } from "@/types/lead";
import { LeadPlanDialog } from "./LeadPlanDialog";
import { Progress } from "@/components/ui/progress";
import { exportLeadsToExcel } from "@/utils/exportToExcel";

export const LeadsList = () => {
  const { toast } = useToast();
  const [leads, setLeads] = useState<LeadProspeccao[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<LeadProspeccao | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Função para validar se um número de telefone brasileiro é válido
  const isValidBrazilianPhone = (phone: string): boolean => {
    const cleanNumber = phone.replace(/\D/g, '');
    
    // Remove código do país se presente
    const numberWithoutCountry = cleanNumber.startsWith('55') 
      ? cleanNumber.slice(2) 
      : cleanNumber;
    
    // Deve ter 10 (fixo) ou 11 (celular) dígitos
    if (numberWithoutCountry.length < 10 || numberWithoutCountry.length > 11) {
      return false;
    }
    
    // Extrai DDD (primeiros 2 dígitos)
    const ddd = parseInt(numberWithoutCountry.slice(0, 2), 10);
    
    // DDDs válidos no Brasil (11-99, exceto alguns inválidos)
    const invalidDDDs = [20, 23, 25, 26, 29, 30, 36, 39, 40, 50, 52, 56, 57, 58, 59, 60, 70, 72, 76, 78, 80, 90];
    if (ddd < 11 || ddd > 99 || invalidDDDs.includes(ddd)) {
      return false;
    }
    
    // Para celulares (11 dígitos), o primeiro dígito após DDD deve ser 9
    if (numberWithoutCountry.length === 11) {
      const firstDigitAfterDDD = numberWithoutCountry.charAt(2);
      if (firstDigitAfterDDD !== '9') {
        return false;
      }
    }
    
    return true;
  };

  // Função para verificar se é número de celular
  const isMobileNumber = (phone: string): boolean => {
    if (!phone) return false;
    const cleaned = phone.replace(/\D/g, "");
    const number = cleaned.startsWith("55") ? cleaned.substring(2) : cleaned;
    // Celular brasileiro: DDD (2 dígitos) + 9 + 8 dígitos = 11 dígitos total
    return number.length === 11 && number.charAt(2) === '9';
  };

  // Função helper para gerar link do WhatsApp a partir de um número (apenas celulares)
  const generateWhatsAppLink = (whatsappNumber: string | null, telefone: string | null): string | null => {
    // Prioriza whatsapp_number encontrado no site
    if (whatsappNumber) {
      const cleanWhatsapp = whatsappNumber.replace(/\D/g, '');
      if (cleanWhatsapp.length >= 10) {
        // Adiciona código do país se não tiver
        const fullNumber = cleanWhatsapp.startsWith('55') ? cleanWhatsapp : `55${cleanWhatsapp}`;
        return `https://wa.me/${fullNumber}`;
      }
    }
    
    // Se não houver, usa o telefone como fallback (apenas se for celular)
    if (telefone && isValidBrazilianPhone(telefone) && isMobileNumber(telefone)) {
      const cleanNumber = telefone.replace(/\D/g, '');
      const numberWithoutCountry = cleanNumber.startsWith('55') ? cleanNumber.substring(2) : cleanNumber;
      // Sempre adiciona o código do Brasil +55
      return `https://wa.me/55${numberWithoutCountry}`;
    }
    
    return null;
  };

  // Função para verificar se uma URL é do Instagram
  const isInstagramUrl = (url: string | null): boolean => {
    if (!url) return false;
    return /instagram\.com/i.test(url);
  };

  // Função helper para transformar dados do banco
  const transformLeadFromDb = (lead: any): LeadProspeccao => {
    // Verifica se o website é na verdade um Instagram
    const websiteIsInstagram = isInstagramUrl(lead.website);
    
    // Se o website for Instagram, usa como instagram_url
    const finalInstagramUrl = lead.instagram_url || (websiteIsInstagram ? lead.website : null);
    
    // Website só é válido se não for Instagram
    const finalWebsite = websiteIsInstagram ? null : lead.website;
    
    return {
      id: lead.id,
      placeId: lead.google_place_id,
      nome: lead.nome,
      telefone: lead.telefone,
      whatsapp_link: generateWhatsAppLink(lead.whatsapp_number, lead.telefone),
      email: lead.email || null,
      website: finalWebsite,
      instagram_url: finalInstagramUrl,
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
      plano_prospecao_7dias: (lead.plano_prospeccao as any[]) || [],
      rating: lead.rating,
      total_reviews: lead.total_reviews,
      status: lead.status || 'novo',
      created_at: lead.created_at,
      ai_analise_gerada_em: lead.ai_analise_gerada_em,
      salvo: lead.salvo || false,
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
  };

  const loadLeads = async () => {
    try {
      // Usa função RPC para obter dados descriptografados
      // p_salvo = false para buscar apenas leads não salvos
      const { data, error } = await supabase
        .rpc("get_leads_decrypted_filtered", { p_salvo: false });

      if (error) throw error;
      
      const leadsFormatted: LeadProspeccao[] = (data || []).map(transformLeadFromDb);
      
      setLeads(leadsFormatted);
    } catch (error: any) {
      console.error("Erro ao carregar leads:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar leads",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Carrega leads ao montar o componente (mantém resultados da última pesquisa)
    loadLeads();
    
    // Listener para recarregar quando novos leads são adicionados
    const handleReload = () => loadLeads();
    window.addEventListener("reloadLeads", handleReload);
    
    // Listener para limpar leads antes de nova busca
    const handleClear = () => {
      setLeads([]);
      setLoading(true);
    };
    window.addEventListener("clearLeads", handleClear);
    
    // Configurar realtime para atualizar leads quando análise IA for concluída
    const channel = supabase
      .channel('leads-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads'
        },
        (payload) => {
          console.log('Lead atualizado via realtime:', payload.new);
          
          // IMPORTANTE: O payload do realtime contém dados brutos (não descriptografados)
          // Apenas atualizamos os campos da análise IA, preservando os dados descriptografados
          setLeads(prevLeads => 
            prevLeads.map(lead => {
              if (lead.id === payload.new.id) {
                // Atualiza apenas os campos de IA, mantendo os dados de contato existentes
                return {
                  ...lead,
                  diagnostico_bullets: (payload.new.diagnostico_bullets as string[]) || lead.diagnostico_bullets,
                  probabilidade_conversao: payload.new.probabilidade_conversao || lead.probabilidade_conversao,
                  plano_prospecao_7dias: (payload.new.plano_prospeccao as any[]) || lead.plano_prospecao_7dias,
                  ai_analise_gerada_em: payload.new.ai_analise_gerada_em || lead.ai_analise_gerada_em,
                  status: payload.new.status || lead.status,
                  salvo: payload.new.salvo ?? lead.salvo,
                };
              }
              return lead;
            })
          );
          
          // Se a análise foi concluída agora, mostrar toast
          if (payload.new.ai_analise_gerada_em && !payload.old?.ai_analise_gerada_em) {
            toast({
              title: "✨ Análise IA concluída",
              description: `Lead "${payload.new.nome}" foi analisado com sucesso`,
            });
          }
        }
      )
      .subscribe();
    
    return () => {
      window.removeEventListener("reloadLeads", handleReload);
      window.removeEventListener("clearLeads", handleClear);
      supabase.removeChannel(channel);
    };
  }, []);

  const deleteLead = async (id: string) => {
    try {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
      
      toast({
        title: "Lead removido",
        description: "O lead foi removido com sucesso",
      });
      
      loadLeads();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao remover lead",
        description: error.message,
      });
    }
  };

  const openPlanDialog = (lead: LeadProspeccao) => {
    setSelectedLead(lead);
    setDialogOpen(true);
  };

  const getProbabilidadeColor = (prob: number) => {
    if (prob >= 70) return "text-green-600";
    if (prob >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  const handleExportExcel = () => {
    try {
      const fileName = exportLeadsToExcel(leads);
      toast({
        title: "Excel exportado!",
        description: `Arquivo ${fileName} foi baixado com sucesso`,
      });
    } catch (error: any) {
      console.error("Erro ao exportar Excel:", error);
      toast({
        variant: "destructive",
        title: "Erro na exportação",
        description: error.message || "Não foi possível exportar para Excel",
      });
    }
  };

  const handleSaveLeads = async () => {
    try {
      const leadsNaoSalvos = leads.filter(lead => !lead.salvo);
      
      if (leadsNaoSalvos.length === 0) {
        toast({
          title: "Nenhum lead para salvar",
          description: "Todos os leads já estão salvos",
        });
        return;
      }

      // Marca todos os leads não salvos como salvos
      const { error } = await supabase
        .from("leads")
        .update({ salvo: true })
        .in("id", leadsNaoSalvos.map(l => l.id));

      if (error) throw error;

      toast({
        title: "Leads salvos com sucesso!",
        description: `${leadsNaoSalvos.length} leads foram salvos e não serão deletados em novas buscas`,
      });

      loadLeads();
    } catch (error: any) {
      console.error("Erro ao salvar leads:", error);
      toast({
        variant: "destructive",
        title: "Erro ao salvar leads",
        description: error.message,
      });
    }
  };

  const toggleSaveLead = async (leadId: string, currentSalvo: boolean) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ salvo: !currentSalvo })
        .eq("id", leadId);

      if (error) throw error;

      toast({
        title: currentSalvo ? "Lead desmarcado" : "Lead salvo",
        description: currentSalvo 
          ? "Lead será deletado na próxima busca" 
          : "Lead será preservado em novas buscas",
      });

      loadLeads();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Carregando leads...</p>
        </CardContent>
      </Card>
    );
  }

  if (leads.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            Nenhum lead encontrado. Faça uma busca para começar!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Leads Encontrados ({leads.length})</CardTitle>
            {leads.length > 0 && (
              <div className="flex gap-2">
                <Button onClick={handleSaveLeads} variant="default" size="sm">
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Leads
                </Button>
                <Button onClick={handleExportExcel} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Excel
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div className="p-6">
              <Table>
                <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Sinais Digitais</TableHead>
                  <TableHead className="text-center">Prob. Conversão</TableHead>
                  <TableHead>Preview Plano</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div className="space-y-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{lead.nome}</p>
                          {lead.salvo && (
                            <Badge variant="secondary" className="text-xs">
                              <Archive className="h-3 w-3 mr-1" />
                              Salvo
                            </Badge>
                          )}
                          {lead.cnpj && (
                            <Badge 
                              variant="outline" 
                              className={
                                lead.situacao_cadastral === "ATIVA"
                                  ? "text-xs bg-green-500/10 text-green-700 border-green-500/20"
                                  : "text-xs bg-red-500/10 text-red-700 border-red-500/20"
                              }
                              title={`CNPJ: ${lead.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}${lead.razao_social ? ` - ${lead.razao_social}` : ""}`}
                            >
                              {lead.situacao_cadastral === "ATIVA" ? "✓ CNPJ" : "⚠ CNPJ"}
                            </Badge>
                          )}
                        </div>
                        {lead.endereco && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="line-clamp-2">{lead.endereco}</span>
                          </div>
                        )}
                        {lead.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs font-medium">{lead.rating}</span>
                            <span className="text-xs text-muted-foreground">
                              ({lead.total_reviews})
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1 min-w-[150px]">
                        {lead.telefone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            <span>{lead.telefone}</span>
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
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            <span>Email</span>
                          </a>
                        )}
                        {lead.website && (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate max-w-[120px]">Site</span>
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
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex flex-wrap gap-1 min-w-[180px]">
                        {lead.sinais.has_whatsapp_on_site && (
                          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-500/20">
                            WhatsApp
                          </Badge>
                        )}
                        {lead.sinais.has_meta_pixel && (
                          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-500/20">
                            Pixel
                          </Badge>
                        )}
                        {lead.sinais.has_gtag && (
                          <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-700 border-orange-500/20">
                            GA
                          </Badge>
                        )}
                        {lead.sinais.has_gtm && (
                          <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-700 border-purple-500/20">
                            GTM
                          </Badge>
                        )}
                        {!lead.sinais.has_whatsapp_on_site && 
                         !lead.sinais.has_meta_pixel && 
                         !lead.sinais.has_gtag && 
                         !lead.sinais.has_gtm && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex flex-col items-center gap-2 min-w-[120px]">
                        {lead.probabilidade_conversao > 0 ? (
                          <>
                            <div className={`text-2xl font-bold ${getProbabilidadeColor(lead.probabilidade_conversao)}`}>
                              {lead.probabilidade_conversao}%
                            </div>
                            <Progress 
                              value={lead.probabilidade_conversao} 
                              className="h-2 w-full"
                            />
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">Aguardando IA</span>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="min-w-[250px] max-w-[300px]">
                        {lead.plano_prospecao_7dias.length > 0 ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                Dia 1
                              </Badge>
                              <Badge 
                                variant={lead.plano_prospecao_7dias[0].canal === "whatsapp" ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {lead.plano_prospecao_7dias[0].canal === "whatsapp" ? (
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                ) : (
                                  "📧"
                                )}
                                {lead.plano_prospecao_7dias[0].canal}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {lead.plano_prospecao_7dias[0].mensagem}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Plano em geração...</span>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPlanDialog(lead)}
                          disabled={lead.plano_prospecao_7dias.length === 0}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver Plano
                        </Button>
                        <Button
                          variant={lead.salvo ? "default" : "ghost"}
                          size="sm"
                          onClick={() => toggleSaveLead(lead.id, lead.salvo)}
                          title={lead.salvo ? "Desmarcar lead" : "Salvar lead"}
                        >
                          {lead.salvo ? (
                            <Archive className="h-4 w-4" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteLead(lead.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

          <LeadPlanDialog
            lead={selectedLead}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onLeadUpdate={() => {
              // Recarrega os leads após reanálise
              window.location.reload();
            }}
          />
    </>
  );
};
