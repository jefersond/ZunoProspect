import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { FileSpreadsheet, Users, Crown, Rocket, Building2, RefreshCw } from 'lucide-react';
import { exportUsersToExcel, type UserExportData } from '@/utils/exportUsersToExcel';

interface UserStats {
  total: number;
  byPlan: {
    starter: number;
    iniciante: number;
    pro: number;
    agencia: number;
  };
  annual: number;
  withUsaAddon: number;
}

const getPlanBadge = (planName: string) => {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
    starter: { variant: 'outline', label: 'Starter' },
    iniciante: { variant: 'secondary', label: 'Iniciante' },
    pro: { variant: 'default', label: 'Pro' },
    agencia: { variant: 'default', label: 'Agência' },
  };
  const config = variants[planName] || { variant: 'outline', label: planName };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export const UsersDashboard = () => {
  const [users, setUsers] = useState<UserExportData[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const { data, error } = await supabase.functions.invoke('admin-get-users', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setUsers(data.users);
      setStats(data.stats);
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast({
        title: 'Erro ao carregar usuários',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleExport = () => {
    setExporting(true);
    try {
      const fileName = exportUsersToExcel(users);
      toast({
        title: 'Exportado com sucesso!',
        description: `${users.length} usuários exportados para ${fileName}`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao exportar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plano Pro</CardTitle>
            <Crown className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.byPlan.pro || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Iniciante</CardTitle>
            <Rocket className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.byPlan.iniciante || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agência</CardTitle>
            <Building2 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.byPlan.agencia || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>Usuários Cadastrados</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadUsers}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Button onClick={handleExport} disabled={exporting || users.length === 0}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {exporting ? 'Exportando...' : 'Exportar Excel'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-center">Leads</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Último Acesso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.nome_completo || '-'}</TableCell>
                      <TableCell>{user.empresa || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPlanBadge(user.plan_name)}
                          {user.is_annual && (
                            <Badge variant="outline" className="text-xs">Anual</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {user.leads_used_this_month}/{user.leads_limit}
                      </TableCell>
                      <TableCell>
                        {user.created_at 
                          ? new Date(user.created_at).toLocaleDateString('pt-BR') 
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {user.last_sign_in_at 
                          ? new Date(user.last_sign_in_at).toLocaleDateString('pt-BR') 
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {users.length > 0 && (
            <p className="text-sm text-muted-foreground mt-4">
              Exibindo {users.length} usuários
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
