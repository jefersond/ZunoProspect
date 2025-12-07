import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

// Sanitize error messages for security
function sanitizeError(error: unknown): string {
  console.error('Internal error:', error);
  return 'Erro interno do servidor';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get the authorization header to verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        error: 'UNAUTHORIZED',
        message: 'Não autorizado'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with user's token to verify authentication
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ 
        error: 'UNAUTHORIZED',
        message: 'Sessão inválida'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    
    // Use service role for database operations (bypasses RLS but we enforce our own checks)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ 
        error: 'INVALID_JSON',
        message: 'Corpo da requisição inválido'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, leadId, leadIds } = body;

    // Validate action
    const validActions = ['delete', 'delete_unsaved', 'update_salvo', 'bulk_update_salvo'];
    if (!action || !validActions.includes(action)) {
      return new Response(JSON.stringify({ 
        error: 'INVALID_ACTION',
        message: 'Ação inválida'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE single lead
    if (action === 'delete') {
      if (!leadId || !isValidUUID(leadId)) {
        return new Response(JSON.stringify({ 
          error: 'INVALID_LEAD_ID',
          message: 'ID do lead inválido'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify ownership before deletion (application-layer security)
      const { data: lead, error: leadError } = await supabaseAdmin
        .from('leads')
        .select('id, user_id')
        .eq('id', leadId)
        .single();

      if (leadError || !lead) {
        return new Response(JSON.stringify({ 
          error: 'LEAD_NOT_FOUND',
          message: 'Lead não encontrado'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Application-layer authorization check
      if (lead.user_id !== userId) {
        console.warn(`Unauthorized delete attempt: user ${userId} tried to delete lead ${leadId} owned by ${lead.user_id}`);
        return new Response(JSON.stringify({ 
          error: 'FORBIDDEN',
          message: 'Não autorizado a deletar este lead'
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Perform deletion
      const { error: deleteError } = await supabaseAdmin
        .from('leads')
        .delete()
        .eq('id', leadId)
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        return new Response(JSON.stringify({ 
          error: 'DELETE_FAILED',
          message: 'Erro ao deletar lead'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Lead ${leadId} deleted by user ${userId}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE all unsaved leads for user
    if (action === 'delete_unsaved') {
      const { error: deleteError } = await supabaseAdmin
        .from('leads')
        .delete()
        .eq('user_id', userId)
        .eq('salvo', false);

      if (deleteError) {
        console.error('Delete unsaved error:', deleteError);
        return new Response(JSON.stringify({ 
          error: 'DELETE_FAILED',
          message: 'Erro ao deletar leads não salvos'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Unsaved leads deleted for user ${userId}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // UPDATE salvo status for single lead
    if (action === 'update_salvo') {
      if (!leadId || !isValidUUID(leadId)) {
        return new Response(JSON.stringify({ 
          error: 'INVALID_LEAD_ID',
          message: 'ID do lead inválido'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { salvo } = body;
      if (typeof salvo !== 'boolean') {
        return new Response(JSON.stringify({ 
          error: 'INVALID_SALVO',
          message: 'Campo salvo deve ser booleano'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify ownership
      const { data: lead, error: leadError } = await supabaseAdmin
        .from('leads')
        .select('id, user_id')
        .eq('id', leadId)
        .single();

      if (leadError || !lead) {
        return new Response(JSON.stringify({ 
          error: 'LEAD_NOT_FOUND',
          message: 'Lead não encontrado'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (lead.user_id !== userId) {
        console.warn(`Unauthorized update attempt: user ${userId} tried to update lead ${leadId} owned by ${lead.user_id}`);
        return new Response(JSON.stringify({ 
          error: 'FORBIDDEN',
          message: 'Não autorizado a atualizar este lead'
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: updateError } = await supabaseAdmin
        .from('leads')
        .update({ salvo })
        .eq('id', leadId)
        .eq('user_id', userId);

      if (updateError) {
        console.error('Update error:', updateError);
        return new Response(JSON.stringify({ 
          error: 'UPDATE_FAILED',
          message: 'Erro ao atualizar lead'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Lead ${leadId} salvo=${salvo} by user ${userId}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // BULK UPDATE salvo status for multiple leads
    if (action === 'bulk_update_salvo') {
      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'INVALID_LEAD_IDS',
          message: 'Lista de IDs de leads inválida'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate all UUIDs
      for (const id of leadIds) {
        if (!isValidUUID(id)) {
          return new Response(JSON.stringify({ 
            error: 'INVALID_LEAD_ID',
            message: `ID inválido: ${id.substring(0, 8)}...`
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Limit bulk operations
      if (leadIds.length > 500) {
        return new Response(JSON.stringify({ 
          error: 'TOO_MANY_LEADS',
          message: 'Máximo de 500 leads por operação'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { salvo } = body;
      if (typeof salvo !== 'boolean') {
        return new Response(JSON.stringify({ 
          error: 'INVALID_SALVO',
          message: 'Campo salvo deve ser booleano'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update only leads owned by the user (application-layer filter)
      const { error: updateError } = await supabaseAdmin
        .from('leads')
        .update({ salvo })
        .in('id', leadIds)
        .eq('user_id', userId);

      if (updateError) {
        console.error('Bulk update error:', updateError);
        return new Response(JSON.stringify({ 
          error: 'UPDATE_FAILED',
          message: 'Erro ao atualizar leads'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Bulk update salvo=${salvo} for ${leadIds.length} leads by user ${userId}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      error: 'INVALID_ACTION',
      message: 'Ação não reconhecida'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = sanitizeError(error);
    return new Response(JSON.stringify({ 
      error: 'INTERNAL_ERROR',
      message: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
