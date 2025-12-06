import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DistribuicaoProbabilidade } from '@/hooks/useRelatoriosData';

interface Props {
  data: DistribuicaoProbabilidade[];
  loading?: boolean;
}

export const DistribuicaoProbChart = ({ data, loading }: Props) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribuição de Probabilidade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] bg-muted/30 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((acc, d) => acc + d.quantidade, 0);
  const dataWithPercent = data.map(d => ({
    ...d,
    percentual: total > 0 ? (d.quantidade / total) * 100 : 0,
  }));

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Distribuição de Probabilidade de Conversão</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          {total === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Nenhum dado para o período selecionado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataWithPercent} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="faixa" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number, name: string, props: any) => [
                    `${value} leads (${props.payload.percentual.toFixed(1)}%)`,
                    'Quantidade'
                  ]}
                />
                <Bar 
                  dataKey="quantidade" 
                  name="Quantidade" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
