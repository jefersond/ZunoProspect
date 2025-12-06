import { Card, CardContent } from '@/components/ui/card';
import { Users, BookmarkCheck, TrendingUp, Phone, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { KPIData } from '@/hooks/useRelatoriosData';

interface Props {
  kpis: KPIData | null;
  loading?: boolean;
}

export const KPICards = ({ kpis, loading }: Props) => {
  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded w-20 mb-2" />
              <div className="h-8 bg-muted rounded w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'Total de Leads',
      value: kpis.totalLeads,
      icon: Users,
      format: 'number',
    },
    {
      label: 'Leads Salvos',
      value: kpis.leadsSalvos,
      subValue: `${kpis.taxaSalvos.toFixed(1)}%`,
      icon: BookmarkCheck,
      format: 'number',
    },
    {
      label: 'Prob. Média',
      value: kpis.probMediaConversao,
      icon: TrendingUp,
      format: 'percent',
    },
    {
      label: 'Com Contato',
      value: kpis.leadsComContato,
      subValue: `${kpis.totalLeads > 0 ? ((kpis.leadsComContato / kpis.totalLeads) * 100).toFixed(1) : 0}%`,
      icon: Phone,
      format: 'number',
    },
    {
      label: 'vs Período Anterior',
      value: kpis.crescimentoPercent,
      icon: kpis.crescimentoPercent >= 0 ? ArrowUpRight : ArrowDownRight,
      format: 'growth',
      color: kpis.crescimentoPercent >= 0 ? 'text-green-500' : 'text-red-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card, i) => (
        <Card key={i} className="bg-card border-border hover:border-primary/30 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{card.label}</span>
              <card.icon className={`h-4 w-4 ${card.color || 'text-muted-foreground'}`} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${card.color || 'text-foreground'}`}>
                {card.format === 'percent' ? `${card.value.toFixed(1)}%` :
                 card.format === 'growth' ? `${card.value >= 0 ? '+' : ''}${card.value.toFixed(1)}%` :
                 card.value.toLocaleString('pt-BR')}
              </span>
              {card.subValue && (
                <span className="text-xs text-muted-foreground">{card.subValue}</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
