import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, Target, Activity, Loader2, Sparkles, Search } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { FloatingWhatsAppButton } from "@/components/FloatingWhatsAppButton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { AppHeader } from "@/components/AppHeader";
import { ReferralCard } from "@/components/ReferralCard";
import { UsageStats } from "@/components/UsageStats";
import { useUsage } from "@/hooks/useUsage";
import { useSubscription } from "@/hooks/useSubscription";
import { isAdminUser } from "@/config/admin";
import { PaymentRecoveryBanner } from "@/components/subscription/PaymentRecoveryBanner";

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
  const { usage, loading: usageLoading, isAdmin: usageIsAdmin } = useUsage();
  const { subscription } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ctaShown, setCtaShown] = useState(false);
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

  useEffect(() => {
    if (!loading && metrics.totalLeads === 0 && !ctaShown) {
      setCtaShown(true);
      trackEvent("First_Search_CTA_Shown", {
        user_plan: String(usage.plan_name || "free").toLowerCase(),
        leads_used: usage.leads_used || 0,
        leads_limit: usage.leads_limit || 20,
        ai_used: usage.ai_used || 0,
        ai_limit: usage.ai_limit || 3,
        source: "post_signup",
      });
    }
  }, [loading, metrics.totalLeads, ctaShown, usage]);

  const handleFirstSearchClick = () => {
    trackEvent("First_Search_CTA_Clicked", {
      user_plan: String(usage.plan_name || "free").toLowerCase(),
      source: "post_signup",
    });
    navigate("/prospeccao");
  };

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    // Check if admin
    const { data: adminData } = await supabase.rpc('is_admin', { _user_id: user.id });
    setIsAdmin(isAdminUser(user, { is_admin: adminData === true }));
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
        <PaymentRecoveryBanner />
        {/* Banner do Teste Grátis Ativo (Trial) */}
        {subscription?.subscription_status === "trialing" && (
          <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-emerald-900/10 to-zinc-950 p-5 shadow-xl transition-all duration-300">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Activity className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                    Teste grátis ativo — Plano {subscription.plan_name === "starter" ? "Starter" : subscription.plan_name === "pro" ? "Pro" : subscription.plan_name === "agency" ? "Agency" : subscription.plan_name}
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                      {subscription.trial_days_remaining ?? 7} {Number(subscription.trial_days_remaining) === 1 ? 'dia restante' : 'dias restantes'}
                    </span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Seu teste grátis termina em <strong className="text-slate-200">{subscription.trial_days_remaining ?? 7} {Number(subscription.trial_days_remaining) === 1 ? 'dia' : 'dias'}</strong>. 
                    Próxima cobrança: <strong className="text-slate-200">R$ {subscription.plan_name === "starter" ? "47" : subscription.plan_name === "pro" ? "97" : subscription.plan_name === "agency" ? "247" : "0"}</strong> em <strong className="text-slate-200">{subscription.trial_end ? new Date(subscription.trial_end).toLocaleDateString('pt-BR') : '-'}</strong>.
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <Button
                  onClick={() => navigate("/profile")}
                  variant="outline"
                  className="w-full sm:w-auto h-9 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 font-medium px-4 transition-all duration-200 text-xs sm:text-sm"
                >
                  Gerenciar Assinatura
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Banner de Onboarding pós-cadastro */}
        {metrics.totalLeads === 0 && (
          <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-6 shadow-xl transition-all duration-300">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 animate-pulse">
                  <Sparkles className="h-6 w-6 text-emerald-400" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-slate-100">
                    Faça sua primeira busca
                  </h2>
                  <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                    Você tem <strong className="text-emerald-400">20 leads grátis</strong> + <strong className="text-emerald-400">3 análises IA</strong> para testar o Zuno. Encontre contatos comerciais de tomadores de decisão de forma simples e gere abordagens sob medida!
                  </p>
                </div>
              </div>
              <div className="shrink-0 w-full md:w-auto">
                <Button
                  onClick={handleFirstSearchClick}
                  className="w-full md:w-auto h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 shadow-md gap-2 transition-all active:scale-95 duration-200"
                >
                  <Search className="h-4 w-4" />
                  Buscar meus primeiros leads
                </Button>
              </div>
            </div>
          </div>
        )}

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

        <UsageStats
          leadsUsed={usage.leads_used}
          leadsLimit={usage.leads_limit}
          aiUsed={usage.ai_used}
          aiLimit={usage.ai_limit}
          isAdmin={usageIsAdmin || isAdmin}
          loading={usageLoading}
          leadsBonusBalance={usage.leads_bonus_balance}
          leadsAvailableTotal={usage.leads_available_total}
          aiAvailableTotal={usage.ai_available_total}
        />

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
