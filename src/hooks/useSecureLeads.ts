import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { LeadProspeccao } from '@/types/lead';

interface RateLimitInfo {
  remaining: number;
  limit: number;
  reset_in_minutes: number;
}

interface UseSecureLeadsOptions {
  salvo?: boolean | null;
  noPagination?: boolean;
  onRateLimitExceeded?: () => void;
}

// Helper function to generate WhatsApp link
const generateWhatsAppLink = (whatsappNumber: string | null, telefone: string | null): string | null => {
  if (whatsappNumber) {
    const cleaned = whatsappNumber.replace(/\D/g, "");
    if (cleaned.length >= 10) {
      const numberOnly = cleaned.startsWith("55") ? cleaned.substring(2) : cleaned;
      return `https://wa.me/55${numberOnly}`;
    }
  }
  
  if (telefone) {
    const cleaned = telefone.replace(/\D/g, "");
    if (cleaned.length >= 10) {
      const numberOnly = cleaned.startsWith("55") ? cleaned.substring(2) : cleaned;
      // Only generate WhatsApp link for mobile numbers
      if (numberOnly.length === 11 && numberOnly.charAt(2) === '9') {
        return `https://wa.me/55${numberOnly}`;
      }
    }
  }
  
  return null;
};

// Check if URL is Instagram
const isInstagramUrl = (url: string | null): boolean => {
  if (!url) return false;
  return /instagram\.com/i.test(url);
};

// Transform raw lead data to LeadProspeccao type
const transformLead = (lead: any): LeadProspeccao => {
  const websiteIsInstagram = isInstagramUrl(lead.website);
  const finalInstagramUrl = lead.instagram_url || (websiteIsInstagram ? lead.website : null);
  const finalWebsite = websiteIsInstagram ? null : lead.website;

  return {
    id: lead.id,
    placeId: lead.google_place_id,
    nome: lead.nome,
    telefone: lead.telefone,
    whatsapp_link: generateWhatsAppLink(lead.whatsapp_number, lead.telefone),
    email: lead.email || null,
    website: finalWebsite,
    instagram_url: finalInstagramUrl,
    instagram_context: lead.instagram_context,
    endereco: lead.endereco,
    cidade: lead.cidade,
    nicho: lead.nicho,
    foco: lead.foco as any,
    proximidadeAtiva: lead.proximidade_ativa || false,
    raioKm: lead.raio_km,
    sinais: {
      has_whatsapp_on_site: lead.whatsapp_on_site || false,
      has_meta_pixel: lead.has_meta_pixel || false,
      has_gtag: lead.has_gtag || false,
      has_gtm: lead.has_gtm || false,
    },
    diagnostico_bullets: (lead.diagnostico_bullets as string[]) || [],
    probabilidade_conversao: lead.probabilidade_conversao || 0,
    plano_prospecao_7dias: (lead.plano_prospeccao as any[]) || [],
    rating: lead.rating,
    total_reviews: lead.total_reviews,
    status: lead.status || 'novo',
    created_at: lead.created_at,
    ai_analise_gerada_em: lead.ai_analise_gerada_em,
    salvo: lead.salvo || false,
    notas: lead.notas || null,
    cnpj: lead.cnpj || null,
    razao_social: lead.razao_social || null,
    nome_responsavel: lead.nome_responsavel || null,
    cnpj_telefone: lead.cnpj_telefone || null,
    cnpj_email: lead.cnpj_email || null,
    situacao_cadastral: lead.situacao_cadastral || null,
    porte_empresa: lead.porte_empresa || null,
    cnae_principal: lead.cnae_principal || null,
  };
};

export const useSecureLeads = (options: UseSecureLeadsOptions = {}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<LeadProspeccao[]>([]);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async (salvoFilter?: boolean | null) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('get-leads-secure', {
        body: {
          action: 'list',
          salvo: salvoFilter ?? options.salvo ?? null,
          noPagination: options.noPagination ?? false,
        },
      });

      if (invokeError) {
        throw invokeError;
      }

      if (data.error) {
        // Handle rate limit
        if (data.rate_limit && data.rate_limit.remaining === 0) {
          setRateLimitInfo(data.rate_limit);
          options.onRateLimitExceeded?.();
          toast({
            title: "Limite de requisições",
            description: `Aguarde ${data.rate_limit.reset_in_minutes} minuto(s) para continuar.`,
            variant: "destructive",
          });
          throw new Error(data.error);
        }
        throw new Error(data.error);
      }

      if (data.rate_limit) {
        setRateLimitInfo(data.rate_limit);
      }

      const transformedLeads = (data.data?.leads || []).map(transformLead);
      setLeads(transformedLeads);
      
      return transformedLeads;
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao carregar leads';
      setError(errorMessage);
      console.error('❌ Error fetching secure leads:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [options.salvo, options.onRateLimitExceeded, toast]);

  const fetchLeadDetail = useCallback(async (leadId: string): Promise<LeadProspeccao | null> => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('get-leads-secure', {
        body: {
          action: 'view_detail',
          leadId,
        },
      });

      if (invokeError) {
        throw invokeError;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.rate_limit) {
        setRateLimitInfo(data.rate_limit);
      }

      return data.data ? transformLead(data.data) : null;
    } catch (err: any) {
      console.error('❌ Error fetching lead detail:', err);
      toast({
        title: "Erro ao carregar detalhes",
        description: err.message || 'Não foi possível carregar os detalhes do lead',
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  const exportLeads = useCallback(async (salvoFilter?: boolean | null): Promise<LeadProspeccao[]> => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('get-leads-secure', {
        body: {
          action: 'export',
          salvo: salvoFilter ?? options.salvo ?? null,
        },
      });

      if (invokeError) {
        throw invokeError;
      }

      if (data.error) {
        if (data.rate_limit && data.rate_limit.remaining === 0) {
          toast({
            title: "Limite de requisições",
            description: `Aguarde ${data.rate_limit.reset_in_minutes} minuto(s) para exportar.`,
            variant: "destructive",
          });
        }
        throw new Error(data.error);
      }

      return (data.data?.leads || []).map(transformLead);
    } catch (err: any) {
      console.error('❌ Error exporting leads:', err);
      toast({
        title: "Erro na exportação",
        description: err.message || 'Não foi possível exportar os leads',
        variant: "destructive",
      });
      return [];
    }
  }, [options.salvo, toast]);

  return {
    leads,
    loading,
    error,
    rateLimitInfo,
    fetchLeads,
    fetchLeadDetail,
    exportLeads,
    setLeads,
  };
};
