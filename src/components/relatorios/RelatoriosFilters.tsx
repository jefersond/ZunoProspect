import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { RelatoriosFilters as FiltersType } from '@/hooks/useRelatoriosData';

interface Props {
  filters: FiltersType;
  setFilters: (filters: FiltersType) => void;
  nichos: string[];
  focos: string[];
  cidades: string[];
  onExport?: () => void;
}

export const RelatoriosFilters = ({ filters, setFilters, nichos, focos, cidades, onExport }: Props) => {
  return (
    <div className="flex flex-wrap gap-3 items-center bg-card p-4 rounded-lg border border-border">
      <div className="flex-1 min-w-[140px]">
        <label className="text-xs text-muted-foreground mb-1 block">Período</label>
        <Select 
          value={filters.periodo} 
          onValueChange={(v) => setFilters({ ...filters, periodo: v as FiltersType['periodo'] })}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="365d">Último ano</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filters.periodo === 'custom' && (
        <>
          <div className="min-w-[140px]">
            <label className="text-xs text-muted-foreground mb-1 block">Data Início</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal bg-background', !filters.dataInicio && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dataInicio ? format(filters.dataInicio, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={filters.dataInicio} onSelect={(d) => setFilters({ ...filters, dataInicio: d })} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs text-muted-foreground mb-1 block">Data Fim</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal bg-background', !filters.dataFim && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dataFim ? format(filters.dataFim, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={filters.dataFim} onSelect={(d) => setFilters({ ...filters, dataFim: d })} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </>
      )}

      <div className="min-w-[140px]">
        <label className="text-xs text-muted-foreground mb-1 block">Nicho</label>
        <Select value={filters.nicho || 'all'} onValueChange={(v) => setFilters({ ...filters, nicho: v === 'all' ? undefined : v })}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {nichos.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-[140px]">
        <label className="text-xs text-muted-foreground mb-1 block">Foco</label>
        <Select value={filters.foco || 'all'} onValueChange={(v) => setFilters({ ...filters, foco: v === 'all' ? undefined : v })}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {focos.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-[140px]">
        <label className="text-xs text-muted-foreground mb-1 block">Cidade</label>
        <Select value={filters.cidade || 'all'} onValueChange={(v) => setFilters({ ...filters, cidade: v === 'all' ? undefined : v })}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {cidades.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {onExport && (
        <div className="ml-auto">
          <label className="text-xs text-muted-foreground mb-1 block opacity-0">Ação</label>
          <Button variant="outline" onClick={onExport} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      )}
    </div>
  );
};
