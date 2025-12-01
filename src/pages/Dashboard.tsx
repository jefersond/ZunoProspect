import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, Users, Target, Activity, Loader2, History, BarChart3, Search, FileText, User, LogOut, Bookmark } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface DashboardMetrics {
  totalLeads: number;
  leadsNovos: number;
  leadsContatados: number;
  leadsQualificados: number;
  campanhasAtivas: number;
  totalCampanhas: number;
  taxaConversao: number;
  leadsPorNicho: Array<{ nicho: string; total: number }>;
  leadsPorStatus: Array<{ status: string; total: number }>;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalLeads: 0,
    leadsNovos: 0,
    leadsContatados: 0,
    leadsQualificados: 0,
    campanhasAtivas: 0,
    totalCampanhas: 0,
    taxaConversao: 0,
    leadsPorNicho: [],
    leadsPorStatus: [],
  });

  useEffect(() => {
    checkAuth();
    loadMetrics();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    }
  };

  const loadMetrics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar leads
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("*")
        .eq("user_id", user.id);

      if (leadsError) throw leadsError;

      // Buscar campanhas
      const { data: campanhas, error: campanhasError } = await supabase
        .from("campanhas")
        .select("*")
        .eq("user_id", user.id);

      if (campanhasError) throw campanhasError;

      // Calcular métricas
      const totalLeads = leads?.length || 0;
      const leadsNovos = leads?.filter(l => l.status === "novo").length || 0;
      const leadsContatados = leads?.filter(l => l.status === "contatado").length || 0;
      const leadsQualificados = leads?.filter(l => l.status === "qualificado").length || 0;
      
      const campanhasAtivas = campanhas?.filter(c => c.status === "ativa").length || 0;
      const totalCampanhas = campanhas?.length || 0;

      // Taxa de conversão (qualificados / total)
      const taxaConversao = totalLeads > 0 ? (leadsQualificados / totalLeads) * 100 : 0;

      // Leads por nicho
      const nichoMap = new Map<string, number>();
      leads?.forEach(lead => {
        const count = nichoMap.get(lead.nicho) || 0;
        nichoMap.set(lead.nicho, count + 1);
      });
      const leadsPorNicho = Array.from(nichoMap.entries())
        .map(([nicho, total]) => ({ nicho, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // Leads por status
      const statusMap = new Map<string, number>();
      leads?.forEach(lead => {
        const status = lead.status || "novo";
        const count = statusMap.get(status) || 0;
        statusMap.set(status, count + 1);
      });
      const leadsPorStatus = Array.from(statusMap.entries())
        .map(([status, total]) => ({ status, total }));

      setMetrics({
        totalLeads,
        leadsNovos,
        leadsContatados,
        leadsQualificados,
        campanhasAtivas,
        totalCampanhas,
        taxaConversao,
        leadsPorNicho,
        leadsPorStatus,
      });
    } catch (error: any) {
      console.error("Erro ao carregar métricas:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/10 to-primary/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-primary/5">
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo e Título */}
            <div className="flex items-center gap-2 group cursor-pointer">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12 rotate-180">
                <defs>
                  <linearGradient id="zGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="50%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
                <path d="M 8 6 L 24 6 L 24 10 L 16 10 L 24 22 L 24 26 L 8 26 L 8 22 L 16 22 L 8 10 L 8 6 Z" fill="url(#zGradient)" className="transition-all duration-500" />
              </svg>
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent bg-[length:200%_100%] bg-[position:0%_50%] transition-all duration-500 group-hover:bg-[position:100%_50%]">
                Zuno
              </span>
              <span className="text-xl font-semibold text-muted-foreground transition-colors duration-300 group-hover:text-foreground">
                Prospect
              </span>
            </div>

            {/* Navegação e Ações */}
            <div className="flex items-center gap-1">
              {/* Navegação Principal */}
              <nav className="flex items-center gap-1 mr-2 pr-2 border-r border-border">
                <Button variant="ghost" size="sm" onClick={() => navigate("/prospeccao")} className="gap-2">
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">Prospecção</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/leads-salvos")} className="gap-2">
                  <Bookmark className="h-4 w-4" />
                  <span className="hidden sm:inline">Salvos</span>
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
                <Button variant="outline" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate("/auth"); }} className="gap-2 ml-1">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sair</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* KPIs principais */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalLeads}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.leadsNovos} novos leads
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.taxaConversao.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {metrics.leadsQualificados} leads qualificados
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Campanhas Ativas</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.campanhasAtivas}</div>
              <p className="text-xs text-muted-foreground">
                de {metrics.totalCampanhas} campanhas
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leads Contatados</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.leadsContatados}</div>
              <p className="text-xs text-muted-foreground">
                em processo de prospecção
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Leads por Nicho</CardTitle>
              <CardDescription>Top 5 nichos com mais leads</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.leadsPorNicho}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nicho" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Leads por Status</CardTitle>
              <CardDescription>Distribuição dos leads por status</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={metrics.leadsPorStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ status, total }) => `${status}: ${total}`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="total"
                  >
                    {metrics.leadsPorStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
