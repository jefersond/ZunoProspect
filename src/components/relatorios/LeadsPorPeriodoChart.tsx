import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { LeadsPorPeriodo } from '@/hooks/useRelatoriosData';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  data: LeadsPorPeriodo[];
  loading?: boolean;
}

export const LeadsPorPeriodoChart = ({ data, loading }: Props) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads por Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-muted/30 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const formattedData = data.map(d => ({
    ...d,
    dataFormatada: format(parseISO(d.data), 'dd/MM', { locale: ptBR }),
  }));

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Leads por Período</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {data.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Nenhum dado para o período selecionado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSalvos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dataFormatada" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="leads" 
                  name="Leads Encontrados"
                  stroke="hsl(var(--primary))" 
                  fillOpacity={1} 
                  fill="url(#colorLeads)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="leadsSalvos" 
                  name="Leads Salvos"
                  stroke="hsl(var(--muted-foreground))" 
                  fillOpacity={1} 
                  fill="url(#colorSalvos)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
