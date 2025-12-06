import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

export interface RelatoriosFilters {
  periodo: '7d' | '30d' | '90d' | '365d' | 'custom';
  dataInicio?: Date;
  dataFim?: Date;
  nicho?: string;
  foco?: string;
  cidade?: string;
}

export interface KPIData {
  totalLeads: number;
  leadsSalvos: number;
  taxaSalvos: number;
  probMediaConversao: number;
  leadsComContato: number;
  crescimentoPercent: number;
}

export interface LeadsPorPeriodo {
  data: string;
  leads: number;
  leadsSalvos: number;
}

export interface FunilData {
  etapa: string;
  valor: number;
  percentual: number;
}

export interface PerformanceFoco {
  foco: string;
  quantidade: number;
  probMedia: number;
  taxaSalvos: number;
}

export interface SinaisDigitais {
  nome: string;
  valor: number;
  percentual: number;
}

export interface PerformanceCidade {
  cidade: string;
  leads: number;
  probMedia: number;
  taxaSalvos: number;
}

export interface DistribuicaoProbabilidade {
  faixa: string;
  quantidade: number;
}

export interface AnaliseNicho {
  nicho: string;
  totalLeads: number;
  taxaSalvos: number;
  probMedia: number;
  comWhatsapp: number;
  comEmail: number;
  comInstagram: number;
}

export const useRelatoriosData = (filters: RelatoriosFilters) => {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [leadsPorPeriodo, setLeadsPorPeriodo] = useState<LeadsPorPeriodo[]>([]);
  const [funil, setFunil] = useState<FunilData[]>([]);
  const [performanceFoco, setPerformanceFoco] = useState<PerformanceFoco[]>([]);
  const [sinaisDigitais, setSinaisDigitais] = useState<SinaisDigitais[]>([]);
  const [performanceCidade, setPerformanceCidade] = useState<PerformanceCidade[]>([]);
  const [distribuicaoProb, setDistribuicaoProb] = useState<DistribuicaoProbabilidade[]>([]);
  const [analiseNicho, setAnaliseNicho] = useState<AnaliseNicho[]>([]);
  const [nichos, setNichos] = useState<string[]>([]);
  const [focos, setFocos] = useState<string[]>([]);
  const [cidades, setCidades] = useState<string[]>([]);

  const getDateRange = () => {
    const hoje = new Date();
    let inicio: Date;
    let fim = endOfDay(hoje);

    switch (filters.periodo) {
      case '7d':
        inicio = startOfDay(subDays(hoje, 7));
        break;
      case '30d':
        inicio = startOfDay(subDays(hoje, 30));
        break;
      case '90d':
        inicio = startOfDay(subDays(hoje, 90));
        break;
      case '365d':
        inicio = startOfDay(subDays(hoje, 365));
        break;
      case 'custom':
        inicio = filters.dataInicio ? startOfDay(filters.dataInicio) : startOfDay(subDays(hoje, 30));
        fim = filters.dataFim ? endOfDay(filters.dataFim) : endOfDay(hoje);
        break;
      default:
        inicio = startOfDay(subDays(hoje, 30));
    }

    return { inicio, fim };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { inicio, fim } = getDateRange();
      const periodoAnteriorInicio = subDays(inicio, Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)));

      // Fetch all leads for the user
      let query = supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', inicio.toISOString())
        .lte('created_at', fim.toISOString());

      if (filters.nicho) query = query.eq('nicho', filters.nicho);
      if (filters.foco) query = query.eq('foco', filters.foco);
      if (filters.cidade) query = query.eq('cidade', filters.cidade);

      const { data: leads, error } = await query;
      if (error) throw error;

      // Fetch previous period for comparison
      let queryAnterior = supabase
        .from('leads')
        .select('id')
        .eq('user_id', user.id)
        .gte('created_at', periodoAnteriorInicio.toISOString())
        .lt('created_at', inicio.toISOString());

      if (filters.nicho) queryAnterior = queryAnterior.eq('nicho', filters.nicho);
      if (filters.foco) queryAnterior = queryAnterior.eq('foco', filters.foco);
      if (filters.cidade) queryAnterior = queryAnterior.eq('cidade', filters.cidade);

      const { data: leadsAnteriores } = await queryAnterior;

      // Fetch all leads for filter options
      const { data: allLeads } = await supabase
        .from('leads')
        .select('nicho, foco, cidade')
        .eq('user_id', user.id);

      if (allLeads) {
        setNichos([...new Set(allLeads.map(l => l.nicho).filter(Boolean))]);
        setFocos([...new Set(allLeads.map(l => l.foco).filter(Boolean))]);
        setCidades([...new Set(allLeads.map(l => l.cidade).filter(Boolean))]);
      }

      if (!leads || leads.length === 0) {
        setKpis({ totalLeads: 0, leadsSalvos: 0, taxaSalvos: 0, probMediaConversao: 0, leadsComContato: 0, crescimentoPercent: 0 });
        setLeadsPorPeriodo([]);
        setFunil([]);
        setPerformanceFoco([]);
        setSinaisDigitais([]);
        setPerformanceCidade([]);
        setDistribuicaoProb([]);
        setAnaliseNicho([]);
        setLoading(false);
        return;
      }

      // Calculate KPIs
      const totalLeads = leads.length;
      const leadsSalvos = leads.filter(l => l.salvo).length;
      const taxaSalvos = totalLeads > 0 ? (leadsSalvos / totalLeads) * 100 : 0;
      const probMediaConversao = leads.reduce((acc, l) => acc + (l.probabilidade_conversao || 0), 0) / totalLeads;
      const leadsComContato = leads.filter(l => l.whatsapp_number_encrypted || l.email_encrypted || l.telefone_encrypted).length;
      const crescimentoPercent = leadsAnteriores && leadsAnteriores.length > 0 
        ? ((totalLeads - leadsAnteriores.length) / leadsAnteriores.length) * 100 
        : 0;

      setKpis({ totalLeads, leadsSalvos, taxaSalvos, probMediaConversao, leadsComContato, crescimentoPercent });

      // Leads por período (group by day)
      const leadsByDay: Record<string, { leads: number; salvos: number }> = {};
      leads.forEach(lead => {
        const day = format(new Date(lead.created_at), 'yyyy-MM-dd');
        if (!leadsByDay[day]) leadsByDay[day] = { leads: 0, salvos: 0 };
        leadsByDay[day].leads++;
        if (lead.salvo) leadsByDay[day].salvos++;
      });
      setLeadsPorPeriodo(
        Object.entries(leadsByDay)
          .map(([data, v]) => ({ data, leads: v.leads, leadsSalvos: v.salvos }))
          .sort((a, b) => a.data.localeCompare(b.data))
      );

      // Funil de prospecção
      const comWhatsapp = leads.filter(l => l.whatsapp_number_encrypted || l.whatsapp_on_site).length;
      const funilData: FunilData[] = [
        { etapa: 'Leads Encontrados', valor: totalLeads, percentual: 100 },
        { etapa: 'Com WhatsApp', valor: comWhatsapp, percentual: (comWhatsapp / totalLeads) * 100 },
        { etapa: 'Salvos', valor: leadsSalvos, percentual: (leadsSalvos / totalLeads) * 100 },
      ];
      setFunil(funilData);

      // Performance por foco
      const focoMap: Record<string, { count: number; prob: number; salvos: number }> = {};
      leads.forEach(lead => {
        const f = lead.foco || 'Não definido';
        if (!focoMap[f]) focoMap[f] = { count: 0, prob: 0, salvos: 0 };
        focoMap[f].count++;
        focoMap[f].prob += lead.probabilidade_conversao || 0;
        if (lead.salvo) focoMap[f].salvos++;
      });
      setPerformanceFoco(
        Object.entries(focoMap).map(([foco, v]) => ({
          foco,
          quantidade: v.count,
          probMedia: v.count > 0 ? v.prob / v.count : 0,
          taxaSalvos: v.count > 0 ? (v.salvos / v.count) * 100 : 0,
        }))
      );

      // Sinais digitais
      const sinais = [
        { nome: 'WhatsApp', valor: leads.filter(l => l.whatsapp_on_site || l.whatsapp_number_encrypted).length },
        { nome: 'Meta Pixel', valor: leads.filter(l => l.has_meta_pixel).length },
        { nome: 'Google Analytics', valor: leads.filter(l => l.has_gtag).length },
        { nome: 'GTM', valor: leads.filter(l => l.has_gtm).length },
        { nome: 'Instagram', valor: leads.filter(l => l.instagram_url_encrypted).length },
      ];
      setSinaisDigitais(sinais.map(s => ({ ...s, percentual: (s.valor / totalLeads) * 100 })));

      // Performance por cidade
      const cidadeMap: Record<string, { count: number; prob: number; salvos: number }> = {};
      leads.forEach(lead => {
        const c = lead.cidade || 'Não definido';
        if (!cidadeMap[c]) cidadeMap[c] = { count: 0, prob: 0, salvos: 0 };
        cidadeMap[c].count++;
        cidadeMap[c].prob += lead.probabilidade_conversao || 0;
        if (lead.salvo) cidadeMap[c].salvos++;
      });
      setPerformanceCidade(
        Object.entries(cidadeMap)
          .map(([cidade, v]) => ({
            cidade,
            leads: v.count,
            probMedia: v.count > 0 ? v.prob / v.count : 0,
            taxaSalvos: v.count > 0 ? (v.salvos / v.count) * 100 : 0,
          }))
          .sort((a, b) => b.leads - a.leads)
          .slice(0, 10)
      );

      // Distribuição de probabilidade
      const faixas = [
        { faixa: '0-20%', min: 0, max: 20 },
        { faixa: '21-40%', min: 21, max: 40 },
        { faixa: '41-60%', min: 41, max: 60 },
        { faixa: '61-80%', min: 61, max: 80 },
        { faixa: '81-100%', min: 81, max: 100 },
      ];
      setDistribuicaoProb(
        faixas.map(f => ({
          faixa: f.faixa,
          quantidade: leads.filter(l => (l.probabilidade_conversao || 0) >= f.min && (l.probabilidade_conversao || 0) <= f.max).length,
        }))
      );

      // Análise por nicho
      const nichoMap: Record<string, { count: number; salvos: number; prob: number; whatsapp: number; email: number; instagram: number }> = {};
      leads.forEach(lead => {
        const n = lead.nicho || 'Não definido';
        if (!nichoMap[n]) nichoMap[n] = { count: 0, salvos: 0, prob: 0, whatsapp: 0, email: 0, instagram: 0 };
        nichoMap[n].count++;
        nichoMap[n].prob += lead.probabilidade_conversao || 0;
        if (lead.salvo) nichoMap[n].salvos++;
        if (lead.whatsapp_number_encrypted || lead.whatsapp_on_site) nichoMap[n].whatsapp++;
        if (lead.email_encrypted) nichoMap[n].email++;
        if (lead.instagram_url_encrypted) nichoMap[n].instagram++;
      });
      setAnaliseNicho(
        Object.entries(nichoMap).map(([nicho, v]) => ({
          nicho,
          totalLeads: v.count,
          taxaSalvos: v.count > 0 ? (v.salvos / v.count) * 100 : 0,
          probMedia: v.count > 0 ? v.prob / v.count : 0,
          comWhatsapp: v.count > 0 ? (v.whatsapp / v.count) * 100 : 0,
          comEmail: v.count > 0 ? (v.email / v.count) * 100 : 0,
          comInstagram: v.count > 0 ? (v.instagram / v.count) * 100 : 0,
        }))
      );

    } catch (error) {
      console.error('Error fetching relatorios data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters.periodo, filters.dataInicio, filters.dataFim, filters.nicho, filters.foco, filters.cidade]);

  return {
    loading,
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
    refetch: fetchData,
  };
};
