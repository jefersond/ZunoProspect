import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FloatingWhatsAppButton } from "@/components/FloatingWhatsAppButton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, History } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { isAdminUser } from "@/config/admin";

interface Interacao {
  id: string;
  tipo: string;
  conteudo: string;
  data_interacao: string;
  lead_id: string;
  lead_nome?: string;
}

export default function Historico() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [filteredInteracoes, setFilteredInteracoes] = useState<Interacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("todos");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
      } else {
        setUser(user);
        loadInteracoes(user.id);
        // Check if admin
        const { data: adminData } = await supabase.rpc('is_admin', { _user_id: user.id });
        setIsAdmin(isAdminUser(user, { is_admin: adminData === true }));
      }
    };
    checkUser();
  }, [navigate]);

  const loadInteracoes = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("interacoes")
        .select(`
          id,
          tipo,
          conteudo,
          data_interacao,
          lead_id,
          leads (nome)
        `)
        .eq("user_id", userId)
        .order("data_interacao", { ascending: false });

      if (error) throw error;

      const interacoesFormatadas = data?.map((int: any) => ({
        id: int.id,
        tipo: int.tipo,
        conteudo: int.conteudo,
        data_interacao: int.data_interacao,
        lead_id: int.lead_id,
        lead_nome: int.leads?.nome || "Lead não encontrado",
      })) || [];

      setInteracoes(interacoesFormatadas);
      setFilteredInteracoes(interacoesFormatadas);
    } catch (error: any) {
      toast.error("Erro ao carregar histórico", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = interacoes;

    // Filtrar por tipo
    if (activeTab !== "todos") {
      filtered = filtered.filter((int) => int.tipo === activeTab);
    }

    // Filtrar por busca
    if (searchTerm) {
      filtered = filtered.filter(
        (int) =>
          int.lead_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          int.conteudo.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredInteracoes(filtered);
  }, [searchTerm, activeTab, interacoes]);

  const getTipoIcon = (tipo: string) => {
    const icons: Record<string, string> = {
      busca: "🔍",
      whatsapp: "💬",
      email: "📧",
      telefone: "📞",
      reuniao: "🤝",
      nota: "📝",
    };
    return icons[tipo] || "📄";
  };

  const getTipoBadgeVariant = (tipo: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      busca: "default",
      whatsapp: "default",
      email: "secondary",
      telefone: "outline",
      reuniao: "default",
      nota: "secondary",
    };
    return variants[tipo] || "outline";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-primary/5">
      <AppHeader isAdmin={isAdmin} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa ou conteúdo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="busca">Buscas</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="email">E-mail</TabsTrigger>
            <TabsTrigger value="telefone">Telefone</TabsTrigger>
            <TabsTrigger value="reuniao">Reunião</TabsTrigger>
            <TabsTrigger value="nota">Notas</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Carregando histórico...</p>
              </div>
            ) : filteredInteracoes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {searchTerm ? "Nenhuma interação encontrada com este filtro" : "Nenhuma interação registrada ainda"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredInteracoes.map((interacao) => (
                  <Card key={interacao.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getTipoIcon(interacao.tipo)}</span>
                          <div>
                            <CardTitle className="text-lg">{interacao.lead_nome}</CardTitle>
                            <CardDescription>
                              {format(new Date(interacao.data_interacao), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant={getTipoBadgeVariant(interacao.tipo)} className="capitalize">
                          {interacao.tipo}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{interacao.conteudo}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <FloatingWhatsAppButton />
    </div>
  );
}
