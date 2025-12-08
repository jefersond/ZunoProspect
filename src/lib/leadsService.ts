import { supabase } from "@/integrations/supabase/client";

/**
 * Leads Service - Application Layer Security
 * 
 * All operations on leads go through this service, which:
 * 1. Uses authenticated edge functions instead of direct database access
 * 2. Implements application-layer authorization checks
 * 3. Controls which fields are exposed to the client
 * 
 * IMPORTANT: The frontend should NEVER access the leads table directly.
 * All CRUD operations must go through this service which calls secure edge functions.
 */

interface LeadsServiceError {
  error: string;
  message: string;
}

interface LeadsServiceResponse {
  success: boolean;
  error?: LeadsServiceError;
}

interface LeadData {
  id: string;
  google_place_id: string | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  whatsapp_number: string | null;
  website: string | null;
  instagram_url: string | null;
  cidade: string;
  nicho: string;
  foco: string;
  status: string | null;
  notas: string | null;
  rating: number | null;
  total_reviews: number | null;
  whatsapp_on_site: boolean;
  has_meta_pixel: boolean;
  has_gtag: boolean;
  has_gtm: boolean;
  diagnostico_bullets: any;
  probabilidade_conversao: number | null;
  plano_prospeccao: any;
  ai_analise_gerada_em: string | null;
  proximidade_ativa: boolean;
  raio_km: number | null;
  salvo: boolean;
  instagram_context: string | null;
  created_at: string;
  updated_at: string;
  cnpj: string | null;
  razao_social: string | null;
  nome_responsavel: string | null;
  cnpj_telefone: string | null;
  cnpj_email: string | null;
  situacao_cadastral: string | null;
  porte_empresa: string | null;
  cnae_principal: string | null;
}

interface LeadsListResponse {
  success: boolean;
  data?: LeadData[];
  error?: LeadsServiceError;
}

interface LeadSingleResponse {
  success: boolean;
  data?: LeadData;
  error?: LeadsServiceError;
}

// ============================================
// READ OPERATIONS - Via leads-read edge function
// ============================================

/**
 * Fetch leads with optional salvo filter
 * @param salvo - true (saved only), false (unsaved only), or null (all)
 */
export async function fetchLeads(salvo: boolean | null = null): Promise<LeadsListResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('leads-read', {
      body: {
        action: 'get_filtered',
        salvo
      }
    });

    if (error) {
      console.error('Error fetching leads:', error);
      return { 
        success: false, 
        error: { error: 'FETCH_FAILED', message: error.message } 
      };
    }

    return { success: true, data: data?.data ?? [] };
  } catch (err: any) {
    console.error('Fetch leads error:', err);
    return { 
      success: false, 
      error: { error: 'NETWORK_ERROR', message: 'Erro de conexão' } 
    };
  }
}

/**
 * Fetch a single lead by ID
 */
export async function fetchLeadById(leadId: string): Promise<LeadSingleResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('leads-read', {
      body: {
        action: 'get_by_id',
        leadId
      }
    });

    if (error) {
      console.error('Error fetching lead:', error);
      return { 
        success: false, 
        error: { error: 'FETCH_FAILED', message: error.message } 
      };
    }

    return { success: true, data: data?.data };
  } catch (err: any) {
    console.error('Fetch lead error:', err);
    return { 
      success: false, 
      error: { error: 'NETWORK_ERROR', message: 'Erro de conexão' } 
    };
  }
}

/**
 * Fetch all leads (no filter)
 */
export async function fetchAllLeads(): Promise<LeadsListResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('leads-read', {
      body: {
        action: 'list'
      }
    });

    if (error) {
      console.error('Error fetching all leads:', error);
      return { 
        success: false, 
        error: { error: 'FETCH_FAILED', message: error.message } 
      };
    }

    return { success: true, data: data?.data ?? [] };
  } catch (err: any) {
    console.error('Fetch all leads error:', err);
    return { 
      success: false, 
      error: { error: 'NETWORK_ERROR', message: 'Erro de conexão' } 
    };
  }
}

// ============================================
// WRITE OPERATIONS - Via leads-manage edge function
// ============================================

// Delete a single lead by ID
export async function deleteLead(leadId: string): Promise<LeadsServiceResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('leads-manage', {
      body: {
        action: 'delete',
        leadId
      }
    });

    if (error) {
      console.error('Error deleting lead:', error);
      return { 
        success: false, 
        error: { error: 'DELETE_FAILED', message: error.message } 
      };
    }

    return { success: data?.success ?? false };
  } catch (err: any) {
    console.error('Delete lead error:', err);
    return { 
      success: false, 
      error: { error: 'NETWORK_ERROR', message: 'Erro de conexão' } 
    };
  }
}

// Delete all unsaved leads for current user
export async function deleteUnsavedLeads(): Promise<LeadsServiceResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('leads-manage', {
      body: {
        action: 'delete_unsaved'
      }
    });

    if (error) {
      console.error('Error deleting unsaved leads:', error);
      return { 
        success: false, 
        error: { error: 'DELETE_FAILED', message: error.message } 
      };
    }

    return { success: data?.success ?? false };
  } catch (err: any) {
    console.error('Delete unsaved leads error:', err);
    return { 
      success: false, 
      error: { error: 'NETWORK_ERROR', message: 'Erro de conexão' } 
    };
  }
}

// Update salvo status for a single lead
export async function updateLeadSalvo(leadId: string, salvo: boolean): Promise<LeadsServiceResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('leads-manage', {
      body: {
        action: 'update_salvo',
        leadId,
        salvo
      }
    });

    if (error) {
      console.error('Error updating lead salvo:', error);
      return { 
        success: false, 
        error: { error: 'UPDATE_FAILED', message: error.message } 
      };
    }

    return { success: data?.success ?? false };
  } catch (err: any) {
    console.error('Update lead salvo error:', err);
    return { 
      success: false, 
      error: { error: 'NETWORK_ERROR', message: 'Erro de conexão' } 
    };
  }
}

// Bulk update salvo status for multiple leads
export async function bulkUpdateLeadsSalvo(leadIds: string[], salvo: boolean): Promise<LeadsServiceResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('leads-manage', {
      body: {
        action: 'bulk_update_salvo',
        leadIds,
        salvo
      }
    });

    if (error) {
      console.error('Error bulk updating leads:', error);
      return { 
        success: false, 
        error: { error: 'UPDATE_FAILED', message: error.message } 
      };
    }

    return { success: data?.success ?? false };
  } catch (err: any) {
    console.error('Bulk update leads error:', err);
    return { 
      success: false, 
      error: { error: 'NETWORK_ERROR', message: 'Erro de conexão' } 
    };
  }
}
