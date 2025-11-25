import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, History, LayoutDashboard, FileText, User, Search } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
      } else {
        setUser(user);
        loadInteracoes(user.id);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getTipoIcon = (tipo: string) => {
    const icons: Record<string, string> = {
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
      whatsapp: "default",
      email: "secondary",
      telefone: "outline",
      reuniao: "default",
      nota: "secondary",
    };
    return variants[tipo] || "outline";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <History className="h-6 w-6" />
              Histórico de Interações
            </h1>
            <nav className="hidden md:flex items-center gap-1">
              <NavLink to="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </NavLink>
              <NavLink to="/prospeccao" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors">
                <Search className="h-4 w-4" />
                Prospecção
              </NavLink>
              <NavLink to="/templates" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors">
                <FileText className="h-4 w-4" />
                Templates
              </NavLink>
              <NavLink to="/historico" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors" activeClassName="bg-accent text-accent-foreground">
                <History className="h-4 w-4" />
                Histórico
              </NavLink>
              <NavLink to="/profile" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors">
                <User className="h-4 w-4" />
                Perfil
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="todos">Todos</TabsTrigger>
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
    </div>
  );
}
