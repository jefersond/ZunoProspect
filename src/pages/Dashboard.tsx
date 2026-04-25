import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Target, Activity, Loader2 } from "lucide-react";
import { FloatingWhatsAppButton } from "@/components/FloatingWhatsAppButton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { AppHeader } from "@/components/AppHeader";
import { ReferralCard } from "@/components/ReferralCard";

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
  const [isAdmin, setIsAdmin] = useState(false);
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
      return;
    }
    // Check if admin
    const { data: adminData } = await supabase.rpc('is_admin', { _user_id: user.id });
    setIsAdmin(!!adminData);
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
    <div className="min-h-screen bg-zinc-950">
      <AppHeader isAdmin={isAdmin} />

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

        {/* Motor de Viralidade — Indique e Ganhe */}
        <ReferralCard />

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
      <FloatingWhatsAppButton />
    </div>
  );
};

export default Dashboard;
