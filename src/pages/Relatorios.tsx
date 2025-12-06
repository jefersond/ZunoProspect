import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { useRelatoriosData, RelatoriosFilters as FiltersType } from '@/hooks/useRelatoriosData';
import { 
  RelatoriosFilters, 
  KPICards, 
  LeadsPorPeriodoChart, 
  FunilChart, 
  PerformanceFocoChart, 
  SinaisDigitaisChart, 
  PerformanceCidadeChart, 
  DistribuicaoProbChart, 
  AnaliseNichoTable,
  UpgradePrompt 
} from '@/components/relatorios';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { FloatingWhatsAppButton } from '@/components/FloatingWhatsAppButton';
import { 
  Search, 
  History, 
  BookmarkCheck, 
  FileText, 
  User, 
  LogOut,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';

const Relatorios = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const { subscription, isAdmin } = useSubscription();
  
  const [filters, setFilters] = useState<FiltersType>({
    periodo: '30d',
  });

  const {
    loading: dataLoading,
    kpis,
    leadsPorPeriodo,
    funil,
    performanceFoco,
    sinaisDigitais,
    performanceCidade,
    distribuicaoProb,
    analiseNicho,
    nichos,
    focos,
    cidades,
  } = useRelatoriosData(filters);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Check if user has agency plan or is admin
      const hasAgencyPlan = subscription?.plan_name === 'agencia';
      setHasAccess(hasAgencyPlan || isAdmin);
      setLoading(false);
    };

    if (subscription !== undefined) {
      checkAccess();
    }
  }, [subscription, isAdmin, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logout realizado com sucesso');
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return <UpgradePrompt />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Logo />
            
            <nav className="hidden md:flex items-center gap-1">
              <Link to="/prospeccao">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Search className="h-4 w-4" />
                  Prospecção
                </Button>
              </Link>
              <Link to="/historico">
                <Button variant="ghost" size="sm" className="gap-2">
                  <History className="h-4 w-4" />
                  Histórico
                </Button>
              </Link>
              <Link to="/leads-salvos">
                <Button variant="ghost" size="sm" className="gap-2">
                  <BookmarkCheck className="h-4 w-4" />
                  Salvos
                </Button>
              </Link>
              <Link to="/templates">
                <Button variant="ghost" size="sm" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Templates
                </Button>
              </Link>
              <Link to="/relatorios">
                <Button variant="ghost" size="sm" className="gap-2 bg-accent">
                  <BarChart3 className="h-4 w-4" />
                  Relatórios
                </Button>
              </Link>
            </nav>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link to="/profile">
                <Button variant="ghost" size="icon">
                  <User className="h-4 w-4" />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Relatórios Avançados</h1>
            <p className="text-muted-foreground text-sm">Análise completa da sua prospecção</p>
          </div>
        </div>

        {/* Filters */}
        <RelatoriosFilters 
          filters={filters} 
          setFilters={setFilters} 
          nichos={nichos} 
          focos={focos} 
          cidades={cidades} 
        />

        {/* KPIs */}
        <KPICards kpis={kpis} loading={dataLoading} />

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LeadsPorPeriodoChart data={leadsPorPeriodo} loading={dataLoading} />
          <FunilChart data={funil} loading={dataLoading} />
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PerformanceFocoChart data={performanceFoco} loading={dataLoading} />
          <SinaisDigitaisChart data={sinaisDigitais} loading={dataLoading} />
        </div>

        {/* Charts Row 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PerformanceCidadeChart data={performanceCidade} loading={dataLoading} />
          <DistribuicaoProbChart data={distribuicaoProb} loading={dataLoading} />
        </div>

        {/* Table */}
        <AnaliseNichoTable data={analiseNicho} loading={dataLoading} />
      </main>

      <FloatingWhatsAppButton />
    </div>
  );
};

export default Relatorios;
