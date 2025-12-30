import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Users, Clock, TrendingUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface EmailStats {
  email_type: string;
  count: number;
}

interface RecentEmail {
  id: string;
  user_id: string;
  email_type: string;
  sent_at: string;
}

const EMAIL_TYPE_LABELS: Record<string, { label: string; color: string; description: string }> = {
  first_24h: {
    label: "Primeira busca",
    color: "#8B5CF6",
    description: "Usuários que não fizeram busca em 24h",
  },
  used_not_saved: {
    label: "Salvar leads",
    color: "#10B981",
    description: "Usou leads mas não salvou nenhum",
  },
  saved_no_ai: {
    label: "Análise IA",
    color: "#F59E0B",
    description: "Salvou leads mas não usou IA",
  },
  inactive_7d: {
    label: "Reengajamento",
    color: "#EC4899",
    description: "Usuários inativos há 7+ dias",
  },
  never_upgraded: {
    label: "Upgrade",
    color: "#3B82F6",
    description: "Nunca fizeram upgrade do plano",
  },
};

const COLORS = ["#8B5CF6", "#10B981", "#F59E0B", "#EC4899", "#3B82F6"];

export const OnboardingEmailsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<EmailStats[]>([]);
  const [recentEmails, setRecentEmails] = useState<RecentEmail[]>([]);
  const [totalSent, setTotalSent] = useState(0);
  const [todaySent, setTodaySent] = useState(0);
  const [weekSent, setWeekSent] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Get all onboarding emails
      const { data: emails, error } = await supabase
        .from("onboarding_emails_sent")
        .select("*")
        .order("sent_at", { ascending: false });

      if (error) throw error;

      // Calculate stats
      const emailsByType: Record<string, number> = {};
      let todayCount = 0;
      let weekCount = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      (emails || []).forEach((email) => {
        const type = email.email_type;
        emailsByType[type] = (emailsByType[type] || 0) + 1;

        const sentDate = new Date(email.sent_at);
        if (sentDate >= today) {
          todayCount++;
        }
        if (sentDate >= weekAgo) {
          weekCount++;
        }
      });

      const statsArray = Object.entries(emailsByType).map(([email_type, count]) => ({
        email_type,
        count,
      }));

      setStats(statsArray);
      setTotalSent(emails?.length || 0);
      setTodaySent(todayCount);
      setWeekSent(weekCount);
      setRecentEmails((emails || []).slice(0, 10));
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleTriggerOnboarding = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-onboarding-email");
      if (error) throw error;
      console.log("Resultado:", data);
      await loadData();
    } catch (error) {
      console.error("Erro ao disparar onboarding:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const chartData = stats.map((s) => ({
    name: EMAIL_TYPE_LABELS[s.email_type]?.label || s.email_type,
    value: s.count,
    fill: EMAIL_TYPE_LABELS[s.email_type]?.color || "#6B7280",
  }));

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com ações */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Emails de Onboarding Automáticos</h2>
          <p className="text-sm text-muted-foreground">
            Emails enviados automaticamente baseados no comportamento do usuário
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={handleTriggerOnboarding} disabled={refreshing}>
            <Mail className="h-4 w-4 mr-2" />
            Disparar Agora
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Enviados</p>
                <p className="text-2xl font-bold">{totalSent}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <Clock className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hoje</p>
                <p className="text-2xl font-bold">{todaySent}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Última Semana</p>
                <p className="text-2xl font-bold">{weekSent}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-purple-500/10">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipos de Email</p>
                <p className="text-2xl font-bold">{stats.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Emails por Tipo</CardTitle>
            <CardDescription>Distribuição de emails de onboarding enviados</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhum email enviado ainda
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição Percentual</CardTitle>
            <CardDescription>Proporção de cada tipo de email</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhum email enviado ainda
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Email Types Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipos de Email</CardTitle>
          <CardDescription>Descrição de cada tipo de email automático</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(EMAIL_TYPE_LABELS).map(([key, info]) => {
              const count = stats.find((s) => s.email_type === key)?.count || 0;
              return (
                <div
                  key={key}
                  className="p-4 rounded-lg border"
                  style={{ borderLeftColor: info.color, borderLeftWidth: 4 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{info.label}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{info.description}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Emails Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Emails Recentes</CardTitle>
          <CardDescription>Últimos 10 emails de onboarding enviados</CardDescription>
        </CardHeader>
        <CardContent>
          {recentEmails.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Nenhum email enviado ainda</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Enviado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEmails.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell>
                      <Badge
                        style={{
                          backgroundColor: `${EMAIL_TYPE_LABELS[email.email_type]?.color}20`,
                          color: EMAIL_TYPE_LABELS[email.email_type]?.color,
                          borderColor: EMAIL_TYPE_LABELS[email.email_type]?.color,
                        }}
                        variant="outline"
                      >
                        {EMAIL_TYPE_LABELS[email.email_type]?.label || email.email_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {email.user_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>{formatDate(email.sent_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
