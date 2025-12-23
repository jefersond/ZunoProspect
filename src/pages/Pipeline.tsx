import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Kanban,
  GripVertical,
  Target,
  BarChart3
} from 'lucide-react';
import { FloatingWhatsAppButton } from '@/components/FloatingWhatsAppButton';
import { LeadsPipeline } from '@/components/pipeline';
import { LeadPlanDialog } from '@/components/prospeccao/LeadPlanDialog';
import { LeadProspeccao } from '@/types/lead';
import { useSubscription } from '@/hooks/useSubscription';
import { FeatureUpgradePrompt } from '@/components/shared/FeatureUpgradePrompt';
import { AppHeader } from '@/components/AppHeader';

export default function Pipeline() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [selectedLead, setSelectedLead] = useState<LeadProspeccao | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const { subscription, loading: subscriptionLoading, isAdmin: isSubscriptionAdmin } = useSubscription();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      setUser(session.user);
      // Check if admin
      const { data: adminData } = await supabase.rpc('is_admin', { _user_id: session.user.id });
      setIsAdmin(!!adminData);
    };
    checkAuth();
  }, [navigate]);

  const handleViewDetails = (lead: LeadProspeccao) => {
    setSelectedLead(lead);
    setDialogOpen(true);
  };

  const handleStatusChange = () => {
    // Refresh pipeline when status changes via dialog
    setRefreshKey(prev => prev + 1);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    toast.success('Pipeline atualizado');
  };

  if (!user) return null;

  // Check if user has access to Pipeline (only agencia plan or admin)
  const hasAccess = subscription?.plan_name === 'agencia' || isAdmin || isSubscriptionAdmin;

  if (!subscriptionLoading && !hasAccess) {
    return (
      <FeatureUpgradePrompt
        title="Pipeline Kanban"
        description="Gerencie seus leads de forma visual com drag-and-drop. Recurso exclusivo do plano Agência."
        features={[
          { icon: Kanban, label: 'Visualização Kanban com drag-and-drop' },
          { icon: GripVertical, label: 'Arraste leads entre colunas de status' },
          { icon: Target, label: 'Acompanhe o funil de prospecção visualmente' },
          { icon: BarChart3, label: 'Visão geral de todos os seus leads' },
        ]}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader
        isAdmin={isAdmin}
        showRefreshButton={true}
        onRefreshClick={handleRefresh}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Kanban className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Pipeline de Leads</h1>
              <p className="text-muted-foreground text-sm">
                Arraste os leads entre as colunas para gerenciar seu funil de prospecção
              </p>
            </div>
          </div>
        </div>

        {/* Pipeline Kanban */}
        <div className="bg-card/30 rounded-xl border border-border/50 overflow-hidden">
          <LeadsPipeline key={refreshKey} onViewDetails={handleViewDetails} />
        </div>
      </main>

      {/* Lead Details Dialog */}
      <LeadPlanDialog
        lead={selectedLead}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onStatusChange={handleStatusChange}
        onLeadUpdate={handleStatusChange}
      />

      <FloatingWhatsAppButton />
    </div>
  );
}
