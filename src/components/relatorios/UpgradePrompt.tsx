import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, Lock, TrendingUp, PieChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const UpgradePrompt = () => {
  const navigate = useNavigate();

  const features = [
    { icon: BarChart3, label: 'Gráficos de performance por período' },
    { icon: TrendingUp, label: 'Análise de funil de prospecção' },
    { icon: PieChart, label: 'Distribuição de sinais digitais' },
    { icon: BarChart3, label: 'Comparativos por nicho e cidade' },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-border">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          
          <h1 className="text-2xl font-bold mb-2">Relatórios Avançados</h1>
          <p className="text-muted-foreground mb-6">
            Acesse dashboards profissionais e analytics avançados exclusivos do plano Agência.
          </p>

          <div className="space-y-3 mb-8 text-left">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <feature.icon className="h-5 w-5 text-primary" />
                <span className="text-sm">{feature.label}</span>
              </div>
            ))}
          </div>

          <Button 
            onClick={() => navigate('/profile')} 
            className="w-full"
            size="lg"
          >
            Fazer Upgrade para Agência
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={() => navigate('/prospeccao')} 
            className="w-full mt-2"
          >
            Voltar para Prospecção
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
