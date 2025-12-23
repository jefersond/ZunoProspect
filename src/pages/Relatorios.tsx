import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { FloatingWhatsAppButton } from '@/components/FloatingWhatsAppButton';
import { toast } from 'sonner';
import { AppHeader } from '@/components/AppHeader';

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
      <AppHeader isAdmin={isAdmin} />

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
