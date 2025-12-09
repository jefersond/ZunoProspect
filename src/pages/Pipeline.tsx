import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  LayoutDashboard, 
  Search, 
  History, 
  BookmarkCheck, 
  User, 
  FileText, 
  LogOut,
  Kanban,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { FloatingWhatsAppButton } from '@/components/FloatingWhatsAppButton';
import { LeadsPipeline } from '@/components/pipeline';
import { LeadPlanDialog } from '@/components/prospeccao/LeadPlanDialog';
import { LeadProspeccao } from '@/types/lead';

export default function Pipeline() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [selectedLead, setSelectedLead] = useState<LeadProspeccao | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      setUser(session.user);
    };
    checkAuth();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

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

  const navLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/prospeccao', icon: Search, label: 'Prospecção' },
    { to: '/leads-salvos', icon: BookmarkCheck, label: 'Leads Salvos' },
    { to: '/pipeline', icon: Kanban, label: 'Pipeline' },
    { to: '/historico', icon: History, label: 'Histórico' },
    { to: '/relatorios', icon: TrendingUp, label: 'Relatórios' },
    { to: '/templates', icon: FileText, label: 'Templates' },
    { to: '/profile', icon: User, label: 'Perfil' },
  ];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Logo />

            {/* Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <link.icon className="h-4 w-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* User Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                className="text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

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
