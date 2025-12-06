import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FunilData } from '@/hooks/useRelatoriosData';

interface Props {
  data: FunilData[];
  loading?: boolean;
}

export const FunilChart = ({ data, loading }: Props) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funil de Prospecção</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-muted/30 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const maxValue = data.length > 0 ? Math.max(...data.map(d => d.valor)) : 1;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Funil de Prospecção</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Nenhum dado para o período selecionado
            </div>
          ) : (
            data.map((item, index) => {
              const widthPercent = (item.valor / maxValue) * 100;
              return (
                <div key={item.etapa} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.etapa}</span>
                    <span className="font-medium">{item.valor} ({item.percentual.toFixed(1)}%)</span>
                  </div>
                  <div className="h-10 bg-muted/30 rounded-md overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500 flex items-center justify-center"
                      style={{ 
                        width: `${widthPercent}%`,
                        opacity: 1 - (index * 0.15),
                      }}
                    >
                      {widthPercent > 20 && (
                        <span className="text-xs font-medium text-primary-foreground">
                          {item.valor}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};
