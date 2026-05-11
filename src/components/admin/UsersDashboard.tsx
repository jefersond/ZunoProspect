import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  Brain,
  Building2,
  Crown,
  FileSpreadsheet,
  Gift,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { exportUsersToExcel, type UserExportData } from "@/utils/exportUsersToExcel";

interface UserStats {
  total: number;
  filtered: number;
  byPlan: {
    free: number;
    starter: number;
    iniciante: number;
    pro: number;
    agencia: number;
  };
  annual: number;
  withUsaAddon: number;
  admins: number;
  confirmed: number;
  referredUsers: number;
  usersWithReferralBonus: number;
  totalReferrals: number;
  pendingReferrals: number;
  rewardedReferrals: number;
  rejectedReferrals: number;
  totalLeadsUsed: number;
  totalAiUsed: number;
}

const getPlanBadge = (planName: string) => {
  const variants: Record<string, { className?: string; label: string; variant?: "default" | "secondary" | "outline" }> = {
    free: { variant: "outline", label: "Free" },
    starter: { variant: "outline", label: "Starter" },
    iniciante: { variant: "secondary", label: "Iniciante" },
    pro: { variant: "default", label: "Pro" },
    agencia: { className: "bg-emerald-600 text-white hover:bg-emerald-500", label: "Agencia" },
  };
  const config = variants[planName] || { variant: "outline", label: planName || "-" };
  return (
    <Badge variant={config.variant || "default"} className={config.className}>
      {config.label}
    </Badge>
  );
};

const formatDate = (date?: string | null) =>
  date ? new Date(date).toLocaleDateString("pt-BR") : "-";

const formatUsage = (used?: number, limit?: number) => {
  if ((limit || 0) >= 999999) return "Ilimitado";
  return `${used || 0}/${limit || 0}`;
};

const getReferralStatusBadge = (status?: string) => {
  const value = status || "pending";
  const labels: Record<string, string> = {
    pending: "pending: conta criada, sem plano pago",
    rewarded: "rewarded: plano pago, bonus liberado",
    rejected: "rejected: invalida ou cancelada",
  };
  const variant = value === "rewarded" ? "secondary" : value === "rejected" ? "destructive" : "outline";

  return <Badge variant={variant}>{labels[value] || value}</Badge>;
};

export const UsersDashboard = () => {
  const [users, setUsers] = useState<UserExportData[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserExportData | null>(null);
  const [userDetail, setUserDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { toast } = useToast();

  const loadUsers = async () => {
    setLoading(true);
    setErrorMessage(null);
    setErrorDetails(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Nao autenticado");
      }

      const { data, error } = await supabase.functions.invoke("admin-get-users", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          q: searchTerm.trim(),
          plan: planFilter,
        },
      });

      if (error) {
        throw new Error(error.message || "Falha ao chamar a Edge Function admin-get-users.");
      }

      if (data?.error) {
        throw new Error(`${data.error}${data.details ? ` ${data.details}` : ""}`);
      }

      setUsers(data?.users || []);
      setStats(data?.stats || null);
    } catch (error: any) {
      const message = error?.message || "Erro desconhecido ao carregar usuarios.";
      console.error("Error loading users:", error);
      setErrorMessage("Erro ao carregar usuarios");
      setErrorDetails(message);
      toast({
        title: "Erro ao carregar usuarios",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(loadUsers, searchTerm ? 350 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planFilter, searchTerm]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleExport = () => {
    setExporting(true);
    try {
      const fileName = exportUsersToExcel(users);
      toast({
        title: "Exportado com sucesso!",
        description: `${users.length} usuarios exportados para ${fileName}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao exportar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const loadUserDetail = async (user: UserExportData) => {
    setSelectedUser(user);
    setUserDetail(null);
    setDetailLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Nao autenticado");
      }

      const { data, error } = await supabase.functions.invoke("admin-get-users", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          action: "detail",
          userId: user.id,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(`${data.error}${data.details ? ` ${data.details}` : ""}`);

      setUserDetail(data);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar detalhes",
        description: error.message || "Nao foi possivel carregar o usuario.",
        variant: "destructive",
      });
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-72 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{errorMessage}</AlertTitle>
          <AlertDescription>{errorDetails}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.filtered || 0} no filtro</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Free</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.byPlan.free || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pro</CardTitle>
            <Crown className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.byPlan.pro || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agencia</CardTitle>
            <Building2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.byPlan.agencia || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Indicacoes</CardTitle>
            <Gift className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.rewardedReferrals || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.pendingReferrals || 0} pending sem bonus</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IA Usada</CardTitle>
            <Brain className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalAiUsed || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle>Usuarios Cadastrados</CardTitle>
              <CardDescription>
                Auth, plano, uso de leads/IA, indicacoes, bonus pago e status de e-mail.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-[240px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder="Buscar email, nome, empresa ou ref"
                  className="pl-9"
                />
              </div>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-full sm:w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="iniciante">Iniciante</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="agencia">Agencia</SelectItem>
                  <SelectItem value="paying">Pagantes</SelectItem>
                  <SelectItem value="referred">Indicados</SelectItem>
                  <SelectItem value="bonus">Com bonus</SelectItem>
                  <SelectItem value="inactive">Sem ultimo acesso</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={loadUsers} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <Button onClick={handleExport} disabled={exporting || users.length === 0}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {exporting ? "Exportando..." : "Exportar Excel"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="w-full overflow-x-auto">
              <Table className="min-w-[1350px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[280px]">Usuario</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-center">Leads</TableHead>
                    <TableHead className="text-center">IA</TableHead>
                    <TableHead>Indicacao</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead>Ultimo Acesso</TableHead>
                    <TableHead>Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                        Nenhum usuario encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="max-w-[220px] truncate font-medium">{user.email}</span>
                              {user.is_admin && (
                                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
                                  Admin
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {user.nome_completo || "-"} {user.empresa ? `â€¢ ${user.empresa}` : ""}
                            </div>
                            <div className="text-xs text-muted-foreground">ID: {user.id}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            {getPlanBadge(user.plan_name)}
                            {user.is_annual && <Badge variant="outline">Anual</Badge>}
                            {user.usa_addon && <Badge variant="outline">EUA</Badge>}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{user.plan_status || "active"}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="font-medium">{formatUsage(user.leads_used_this_month, user.leads_limit)}</div>
                          <div className="text-xs text-muted-foreground">
                            Total disp.: {user.leads_available_total ?? 0}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="font-medium">{formatUsage(user.ai_used_this_month, user.ai_limit)}</div>
                          <div className="text-xs text-muted-foreground">Disp.: {user.ai_available ?? 0}</div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div className="font-medium">{user.referral_code || "-"}</div>
                            <div className="text-xs text-muted-foreground">
                              Pending: {user.referral_pending_count || 0} • Rewarded: {user.referral_rewarded_count || user.referral_count || 0} • Bonus: {user.referral_bonus_available || 0}
                            </div>
                            {user.referred_by_email && (
                              <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                                Veio de: {user.referred_by_email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={user.email_confirmed ? "secondary" : "outline"} className="w-fit">
                              <UserCheck className="mr-1 h-3 w-3" />
                              {user.email_confirmed ? "Email ok" : "Nao confirmado"}
                            </Badge>
                            <Badge variant="outline" className="w-fit">
                              <ShieldCheck className="mr-1 h-3 w-3" />
                              {user.auth_provider || "email"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(user.created_at)}</TableCell>
                        <TableCell>{formatDate(user.last_sign_in_at)}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => loadUserDetail(user)}>
                            Ver detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          {users.length > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Exibindo {users.length} usuarios. Os detalhes completos por usuario entram na Fase 2 do painel admin.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={(open) => {
        if (!open) {
          setSelectedUser(null);
          setUserDetail(null);
        }
      }}>
        <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle>Detalhes do Usuario</DialogTitle>
            <DialogDescription>
              {selectedUser?.email} {selectedUser?.nome_completo ? `â€¢ ${selectedUser.nome_completo}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {detailLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : userDetail ? (
              <Tabs defaultValue="resumo" className="w-full">
                <TabsList className="mb-5 grid h-auto w-full grid-cols-2 md:grid-cols-5">
                  <TabsTrigger value="resumo">Resumo</TabsTrigger>
                  <TabsTrigger value="uso">Uso</TabsTrigger>
                  <TabsTrigger value="indicacoes">Indicacoes</TabsTrigger>
                  <TabsTrigger value="leads">Leads/IA</TabsTrigger>
                  <TabsTrigger value="atividade">Atividade</TabsTrigger>
                </TabsList>

                <TabsContent value="resumo" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Dados Basicos</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <p><span className="text-muted-foreground">ID:</span> {userDetail.user.id}</p>
                        <p><span className="text-muted-foreground">Email:</span> {userDetail.user.email}</p>
                        <p><span className="text-muted-foreground">Nome:</span> {userDetail.user.nome_completo || "-"}</p>
                        <p><span className="text-muted-foreground">Empresa:</span> {userDetail.user.empresa || "-"}</p>
                        <p><span className="text-muted-foreground">Telefone:</span> {userDetail.user.phone || "-"}</p>
                        <p><span className="text-muted-foreground">Provider:</span> {userDetail.user.auth_provider}</p>
                        <p><span className="text-muted-foreground">Email confirmado:</span> {userDetail.user.email_confirmed ? "Sim" : "Nao"}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Plano</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div>{getPlanBadge(userDetail.user.plan_name)}</div>
                        <p><span className="text-muted-foreground">Status:</span> {userDetail.user.plan_status}</p>
                        <p><span className="text-muted-foreground">Anual:</span> {userDetail.user.is_annual ? "Sim" : "Nao"}</p>
                        <p><span className="text-muted-foreground">Add-on EUA:</span> {userDetail.user.usa_addon ? "Ativo" : "Nao"}</p>
                        <p><span className="text-muted-foreground">Customer:</span> {userDetail.user.stripe_customer_id || "-"}</p>
                        <p><span className="text-muted-foreground">Subscription:</span> {userDetail.user.stripe_subscription_id || "-"}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Cadastro</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <p><span className="text-muted-foreground">Criado em:</span> {formatDate(userDetail.user.created_at)}</p>
                        <p><span className="text-muted-foreground">Ultimo acesso:</span> {formatDate(userDetail.user.last_sign_in_at)}</p>
                        <p><span className="text-muted-foreground">Periodo inicio:</span> {formatDate(userDetail.user.billing_period_start)}</p>
                        <p><span className="text-muted-foreground">Periodo fim:</span> {formatDate(userDetail.user.billing_period_end)}</p>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="uso" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Leads</p><p className="text-2xl font-bold">{formatUsage(userDetail.user.leads_used_this_month, userDetail.user.leads_limit)}</p></CardContent></Card>
                    <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">IA</p><p className="text-2xl font-bold">{formatUsage(userDetail.user.ai_used_this_month, userDetail.user.ai_limit)}</p></CardContent></Card>
                    <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Leads encontrados</p><p className="text-2xl font-bold">{userDetail.detail.usage.leads_found}</p></CardContent></Card>
                    <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Leads salvos</p><p className="text-2xl font-bold">{userDetail.detail.usage.leads_saved}</p></CardContent></Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Interacoes recentes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(userDetail.detail.interactions || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma interacao encontrada.</p>
                      ) : (
                        <div className="space-y-3">
                          {userDetail.detail.interactions.slice(0, 8).map((item: any) => (
                            <div key={item.id} className="rounded-md border p-3 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <Badge variant="outline">{item.tipo}</Badge>
                                <span className="text-xs text-muted-foreground">{formatDate(item.data_interacao)}</span>
                              </div>
                              <p className="mt-2 line-clamp-2 text-muted-foreground">{item.conteudo}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="indicacoes" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Codigo</p><p className="text-lg font-semibold">{userDetail.user.referral_code || "-"}</p></CardContent></Card>
                    <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Indicacoes pendentes</p><p className="text-2xl font-bold">{userDetail.user.referral_pending_count || 0}</p></CardContent></Card>
                    <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Indicacoes convertidas</p><p className="text-2xl font-bold">{userDetail.user.referral_rewarded_count || userDetail.user.referral_count || 0}</p></CardContent></Card>
                  </div>

                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Leads extras ganhos</p>
                      <p className="text-2xl font-bold">{userDetail.user.referral_bonus_earned || 0}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Pending nao conta como bonus disponivel. Bonus so libera apos pagamento Stripe confirmado.</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Origem e indicados</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-md border p-3 text-sm">
                        <p className="font-medium">Quem indicou este usuario</p>
                        <p className="text-muted-foreground">{userDetail.detail.referrals.inbound?.referrer_email || "-"}</p>
                      </div>
                      {(userDetail.detail.referrals.outbound || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum usuario indicado por esta conta.</p>
                      ) : (
                        <div className="space-y-2">
                          {userDetail.detail.referrals.outbound.map((referral: any) => (
                            <div key={referral.referred_user_id} className="flex flex-col gap-2 rounded-md border p-3 text-sm md:flex-row md:items-center md:justify-between">
                              <span>{referral.referred_email || referral.referred_user_id}</span>
                              <div className="flex flex-wrap items-center gap-2">
                                {getReferralStatusBadge(referral.status)}
                                <Badge variant="outline">Bonus {referral.status === "rewarded" ? referral.bonus_searches || 0 : 0}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="leads" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Analises IA</CardTitle>
                      <CardDescription>Baseado nos leads com `ai_analise_gerada_em` preenchido.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(userDetail.detail.aiAnalyses || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma analise IA encontrada.</p>
                      ) : (
                        <div className="space-y-2">
                          {userDetail.detail.aiAnalyses.map((analysis: any) => (
                            <div key={`${analysis.lead_id}-${analysis.created_at}`} className="rounded-md border p-3 text-sm">
                              <div className="font-medium">{analysis.lead_name || analysis.lead_id}</div>
                              <div className="text-muted-foreground">{analysis.model} â€¢ {formatDate(analysis.created_at)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Leads recentes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(userDetail.detail.leads || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum lead encontrado.</p>
                      ) : (
                        <div className="space-y-2">
                          {userDetail.detail.leads.slice(0, 15).map((lead: any) => (
                            <div key={lead.id} className="grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[1fr_auto]">
                              <div>
                                <div className="font-medium">{lead.nome || "-"}</div>
                                <div className="text-muted-foreground">{lead.cidade || "-"} â€¢ {lead.nicho || "-"} â€¢ {lead.foco || "-"}</div>
                              </div>
                              <div className="flex flex-wrap gap-2 md:justify-end">
                                {lead.salvo && <Badge variant="secondary">Salvo</Badge>}
                                {lead.ai_analise_gerada_em && <Badge variant="outline">IA</Badge>}
                                <Badge variant="outline">{formatDate(lead.created_at)}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="atividade" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Pesquisas e eventos</CardTitle>
                      <CardDescription>
                        Mostra `search_logs` e `app_events` quando essas tabelas existirem. Sem migration aplicada, fica vazio sem quebrar a tela.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {(userDetail.detail.activity.searchLogs || []).length === 0 &&
                      (userDetail.detail.activity.events || []).length === 0 &&
                      (userDetail.detail.activity.paymentEvents || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum log global encontrado ainda.</p>
                      ) : (
                        <>
                          {(userDetail.detail.activity.searchLogs || []).slice(0, 8).map((log: any) => (
                            <div key={log.id} className="rounded-md border p-3 text-sm">
                              <div className="font-medium">{log.niche || log.nicho || "-"} â€¢ {log.city || log.cidade || "-"}</div>
                              <div className="text-muted-foreground">{log.status || "-"} â€¢ {formatDate(log.created_at)}</div>
                            </div>
                          ))}
                          {(userDetail.detail.activity.events || []).slice(0, 8).map((event: any) => (
                            <div key={event.id} className="rounded-md border p-3 text-sm">
                              <div className="font-medium">{event.event_type}</div>
                              <div className="text-muted-foreground">{formatDate(event.created_at)}</div>
                            </div>
                          ))}
                          {(userDetail.detail.activity.paymentEvents || []).slice(0, 8).map((event: any) => (
                            <div key={event.id} className="rounded-md border p-3 text-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="font-medium">{event.event_type || "payment_event"}</div>
                                <Badge variant="outline">{event.status || "-"}</Badge>
                              </div>
                              <div className="text-muted-foreground">
                                {event.plan || "-"} Ã¢â‚¬Â¢ {event.provider_event_type || event.provider || "stripe"} Ã¢â‚¬Â¢ {formatDate(event.created_at)}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">E-mails</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(userDetail.detail.email.logs || []).length === 0 && (userDetail.detail.email.events || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum evento de e-mail encontrado.</p>
                      ) : (
                        <div className="space-y-2">
                          {(userDetail.detail.email.logs || []).slice(0, 8).map((email: any) => (
                            <div key={email.id} className="rounded-md border p-3 text-sm">
                              <div className="font-medium">{email.subject || email.email_type || "-"}</div>
                              <div className="text-muted-foreground">{email.status || "-"} â€¢ {formatDate(email.created_at || email.sent_at)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            ) : (
              <p className="text-sm text-muted-foreground">Selecione um usuario para carregar os detalhes.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
