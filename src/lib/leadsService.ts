import { supabase } from "@/integrations/supabase/client";

/**
 * Leads Service - Application Layer Security
 * 
 * All operations on leads go through this service, which:
 * 1. Uses authenticated edge functions instead of direct database access
 * 2. Implements application-layer authorization checks
 * 3. Controls which fields are exposed to the client
 */

interface LeadsServiceError {
  error: string;
  message: string;
}

interface LeadsServiceResponse {
  success: boolean;
  error?: LeadsServiceError;
}

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
