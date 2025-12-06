import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { AnaliseNicho } from '@/hooks/useRelatoriosData';
import * as XLSX from 'xlsx';

interface Props {
  data: AnaliseNicho[];
  loading?: boolean;
}

export const AnaliseNichoTable = ({ data, loading }: Props) => {
  const handleExport = () => {
    const exportData = data.map(d => ({
      Nicho: d.nicho,
      'Total Leads': d.totalLeads,
      'Taxa Salvos (%)': d.taxaSalvos.toFixed(1),
      'Prob. Média (%)': d.probMedia.toFixed(1),
      'Com WhatsApp (%)': d.comWhatsapp.toFixed(1),
      'Com Email (%)': d.comEmail.toFixed(1),
      'Com Instagram (%)': d.comInstagram.toFixed(1),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Análise por Nicho');
    XLSX.writeFile(wb, `analise-nichos-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Análise por Nicho</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-muted/30 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">Análise por Nicho</CardTitle>
        {data.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Excel
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Nenhum dado para o período selecionado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nicho</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Taxa Salvos</TableHead>
                  <TableHead className="text-right">Prob. Média</TableHead>
                  <TableHead className="text-right">WhatsApp</TableHead>
                  <TableHead className="text-right">Email</TableHead>
                  <TableHead className="text-right">Instagram</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sort((a, b) => b.totalLeads - a.totalLeads).map((row) => (
                  <TableRow key={row.nicho}>
                    <TableCell className="font-medium">{row.nicho}</TableCell>
                    <TableCell className="text-right">{row.totalLeads}</TableCell>
                    <TableCell className="text-right">{row.taxaSalvos.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{row.probMedia.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{row.comWhatsapp.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{row.comEmail.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{row.comInstagram.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
