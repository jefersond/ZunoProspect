import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

// Maximum leads to prevent bulk export abuse
const MAX_LEADS_FOR_EXPORT = 1000;

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

      // Fetch leads via secure edge function - dados não sensíveis para relatórios
      const { data: response, error } = await supabase.functions.invoke('leads-read', {
        body: {
          action: 'get_reports_data',
          dateStart: inicio.toISOString(),
          dateEnd: fim.toISOString(),
          nicho: filters.nicho || undefined,
          foco: filters.foco || undefined,
          cidade: filters.cidade || undefined,
        }
      });

      if (error) throw error;
      if (!response?.success) throw new Error('Falha ao buscar dados de relatórios');

      const leads = response.data || [];
      
      // Enforce export limit for security
      const limitedLeads = leads.slice(0, MAX_LEADS_FOR_EXPORT);
      if (leads.length > MAX_LEADS_FOR_EXPORT) {
        console.warn(`Relatórios limitados a ${MAX_LEADS_FOR_EXPORT} leads para segurança`);
      }

      // Update filter options from response
      if (response.filterOptions) {
        setNichos(response.filterOptions.nichos || []);
        setFocos(response.filterOptions.focos || []);
        setCidades(response.filterOptions.cidades || []);
      }

      // Fetch previous period count via edge function for comparison
      const { data: previousResponse } = await supabase.functions.invoke('leads-read', {
        body: {
          action: 'get_reports_data',
          dateStart: periodoAnteriorInicio.toISOString(),
          dateEnd: inicio.toISOString(),
          nicho: filters.nicho || undefined,
          foco: filters.foco || undefined,
          cidade: filters.cidade || undefined,
        }
      });
      
      const leadsAnteriores = previousResponse?.data || [];
      // Use limited leads for all calculations
      if (!limitedLeads || limitedLeads.length === 0) {
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

      // Calculate KPIs using secure data (has_* booleans instead of encrypted columns)
      const totalLeads = limitedLeads.length;
      const leadsSalvos = limitedLeads.filter((l: any) => l.salvo).length;
      const taxaSalvos = totalLeads > 0 ? (leadsSalvos / totalLeads) * 100 : 0;
      const probMediaConversao = limitedLeads.reduce((acc: number, l: any) => acc + (l.probabilidade_conversao || 0), 0) / totalLeads;
      // Use secure boolean flags instead of checking encrypted columns directly
      const leadsComContato = limitedLeads.filter((l: any) => l.has_whatsapp || l.has_email || l.has_telefone).length;
      const crescimentoPercent = leadsAnteriores && leadsAnteriores.length > 0 
        ? ((totalLeads - leadsAnteriores.length) / leadsAnteriores.length) * 100 
        : 0;

      setKpis({ totalLeads, leadsSalvos, taxaSalvos, probMediaConversao, leadsComContato, crescimentoPercent });

      // Leads por período (group by day)
      const leadsByDay: Record<string, { leads: number; salvos: number }> = {};
      limitedLeads.forEach((lead: any) => {
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

      // Funil de prospecção - use secure boolean flags
      const comWhatsapp = limitedLeads.filter((l: any) => l.has_whatsapp || l.whatsapp_on_site).length;
      const funilData: FunilData[] = [
        { etapa: 'Leads Encontrados', valor: totalLeads, percentual: 100 },
        { etapa: 'Com WhatsApp', valor: comWhatsapp, percentual: (comWhatsapp / totalLeads) * 100 },
        { etapa: 'Salvos', valor: leadsSalvos, percentual: (leadsSalvos / totalLeads) * 100 },
      ];
      setFunil(funilData);

      // Performance por foco
      const focoMap: Record<string, { count: number; prob: number; salvos: number }> = {};
      limitedLeads.forEach((lead: any) => {
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

      // Sinais digitais - use secure boolean flags
      const sinais = [
        { nome: 'WhatsApp', valor: limitedLeads.filter((l: any) => l.whatsapp_on_site || l.has_whatsapp).length },
        { nome: 'Meta Pixel', valor: limitedLeads.filter((l: any) => l.has_meta_pixel).length },
        { nome: 'Google Analytics', valor: limitedLeads.filter((l: any) => l.has_gtag).length },
        { nome: 'GTM', valor: limitedLeads.filter((l: any) => l.has_gtm).length },
        { nome: 'Instagram', valor: limitedLeads.filter((l: any) => l.has_instagram).length },
      ];
      setSinaisDigitais(sinais.map(s => ({ ...s, percentual: (s.valor / totalLeads) * 100 })));

      // Performance por cidade
      const cidadeMap: Record<string, { count: number; prob: number; salvos: number }> = {};
      limitedLeads.forEach((lead: any) => {
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
          quantidade: limitedLeads.filter((l: any) => (l.probabilidade_conversao || 0) >= f.min && (l.probabilidade_conversao || 0) <= f.max).length,
        }))
      );

      // Análise por nicho - use secure boolean flags
      const nichoMap: Record<string, { count: number; salvos: number; prob: number; whatsapp: number; email: number; instagram: number }> = {};
      limitedLeads.forEach((lead: any) => {
        const n = lead.nicho || 'Não definido';
        if (!nichoMap[n]) nichoMap[n] = { count: 0, salvos: 0, prob: 0, whatsapp: 0, email: 0, instagram: 0 };
        nichoMap[n].count++;
        nichoMap[n].prob += lead.probabilidade_conversao || 0;
        if (lead.salvo) nichoMap[n].salvos++;
        if (lead.has_whatsapp || lead.whatsapp_on_site) nichoMap[n].whatsapp++;
        if (lead.has_email) nichoMap[n].email++;
        if (lead.has_instagram) nichoMap[n].instagram++;
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
