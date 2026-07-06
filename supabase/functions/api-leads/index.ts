import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ============= CORS HELPER =============
function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const allowedOriginsEnv = Deno.env.get("ALLOWED_ORIGINS") || "";
  const allowedOrigins = allowedOriginsEnv.split(",").map((o) => o.trim()).filter(Boolean);
  
  const origin = (allowedOrigins.length === 0 || (requestOrigin && allowedOrigins.includes(requestOrigin)))
    ? (requestOrigin || "*")
    : "";
    
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, idempotency-key",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  };
}

function handleCorsRequest(req: Request): Response | null {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (origin && corsHeaders["Access-Control-Allow-Origin"] === "") {
    return new Response(JSON.stringify({ error: "Origem não autorizada" }), { 
      status: 403, 
      headers: { "Content-Type": "application/json" } 
    });
  }
  
  return null;
}

// SHA-256 Hash Helper
async function calculateHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Error response helper
function buildErrorResponse(
  code: string, 
  message: string, 
  status: number, 
  requestId: string, 
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify({
    error: {
      code,
      message,
      request_id: requestId
    }
  }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

serve(async (req) => {
  const startTime = Date.now();
  const corsCheck = handleCorsRequest(req);
  if (corsCheck) return corsCheck;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  const requestId = crypto.randomUUID();

  let apiKeyId: string | null = null;
  let currentUserId: string | null = null;
  let ipAddress = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "";

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encryptionKey = Deno.env.get('LEADS_ENCRYPTION_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (!encryptionKey) {
      console.error('LEADS_ENCRYPTION_KEY não configurada no Supabase.');
      return buildErrorResponse('INTERNAL_ERROR', 'Configuração de criptografia ausente', 500, requestId, corsHeaders);
    }

    // 1. Extração e validação do token / API key
    let token = "";
    const authHeader = req.headers.get('authorization');
    const xApiKeyHeader = req.headers.get('x-api-key');

    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (xApiKeyHeader) {
      token = xApiKeyHeader.trim();
    }

    if (!token) {
      return buildErrorResponse('INVALID_API_KEY', 'API Key não fornecida. Use o header Authorization Bearer ou x-api-key.', 401, requestId, corsHeaders);
    }

    // Apenas aceitar chaves geradas pelo sistema
    if (!token.startsWith('zuno_')) {
      return buildErrorResponse('INVALID_API_KEY', 'Formato de API Key inválido.', 401, requestId, corsHeaders);
    }

    const tokenHash = await calculateHash(token);

    // Buscar a API Key correspondente no banco
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from('api_keys')
      .select('id, user_id, revoked_at, expires_at, scopes, rate_limit_rpm')
      .eq('key_hash', tokenHash)
      .single();

    if (keyError || !keyData) {
      return buildErrorResponse('INVALID_API_KEY', 'API Key inválida.', 401, requestId, corsHeaders);
    }

    apiKeyId = keyData.id;
    currentUserId = keyData.user_id;

    if (keyData.revoked_at) {
      return buildErrorResponse('EXPIRED_API_KEY', 'API Key revogada.', 401, requestId, corsHeaders);
    }

    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return buildErrorResponse('EXPIRED_API_KEY', 'API Key expirada.', 401, requestId, corsHeaders);
    }

    // 2. Validação estrita de Perfil Administrador (Requisito Temporal Zuno)
    const { data: isAdmin, error: adminCheckError } = await supabaseAdmin.rpc('is_admin', { _user_id: currentUserId });
    
    if (adminCheckError || !isAdmin) {
      // Registrar log de auditoria de tentativa de acesso negado
      await supabaseAdmin.from('api_logs').insert({
        api_key_id: apiKeyId,
        user_id: currentUserId,
        endpoint: new URL(req.url).pathname,
        method: req.method,
        status_code: 403,
        duration_ms: Date.now() - startTime,
        request_id: requestId,
        error_code: 'ADMIN_ACCESS_REQUIRED',
        error_message: 'Acesso negado: Perfil administrador requerido para usar a API de integração.',
        ip_address: ipAddress
      });

      return buildErrorResponse('ADMIN_ACCESS_REQUIRED', 'Esta função está disponível apenas para administradores.', 403, requestId, corsHeaders);
    }

    // 3. Validação de Rate Limits (RPM parametrizável no banco)
    const rateLimitRpm = keyData.rate_limit_rpm || 60;
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    
    const { count: requestCount, error: countError } = await supabaseAdmin
      .from('api_logs')
      .select('*', { count: 'exact', head: true })
      .eq('api_key_id', apiKeyId)
      .gt('created_at', oneMinuteAgo);

    if (!countError && requestCount && requestCount >= rateLimitRpm) {
      return buildErrorResponse('RATE_LIMIT_EXCEEDED', 'Limite de requisições excedido. Tente novamente mais tarde.', 429, requestId, corsHeaders);
    }

    // 4. Tratamento de Idempotência (Operações de escrita: POST, PATCH)
    const idempotencyKey = req.headers.get('idempotency-key') || req.headers.get('Idempotency-Key');
    const isWriteMethod = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method);
    let payloadText = "";
    let payloadHash = "";

    if (isWriteMethod && idempotencyKey) {
      try {
        const clonedReq = req.clone();
        payloadText = await clonedReq.text();
        payloadHash = await calculateHash(payloadText || "{}");
      } catch (e) {
        console.error("Erro ao ler payload para idempotência:", e);
      }

      // Buscar idempotência anterior
      const { data: idempData, error: idempError } = await supabaseAdmin
        .from('api_idempotency_keys')
        .select('response_status, response_body, payload_hash')
        .eq('user_id', currentUserId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (!idempError && idempData) {
        if (idempData.payload_hash !== payloadHash) {
          return buildErrorResponse('INVALID_PAYLOAD', 'O payload enviado difere da requisição original para esta Idempotency-Key.', 400, requestId, corsHeaders);
        }

        // Salvar log de sucesso em cache
        await supabaseAdmin.from('api_logs').insert({
          api_key_id: apiKeyId,
          user_id: currentUserId,
          endpoint: new URL(req.url).pathname,
          method: req.method,
          status_code: idempData.response_status,
          duration_ms: Date.now() - startTime,
          request_id: requestId,
          ip_address: ipAddress
        });

        return new Response(JSON.stringify(idempData.response_body), {
          status: idempData.response_status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache-Lookup': 'HIT' }
        });
      }
    }

    // Atualizar last_used_at da chave
    await supabaseAdmin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyId);

    const url = new URL(req.url);
    const pathname = url.pathname;
    const scopes = (keyData.scopes as string[]) || [];

    // Extrair partes do caminho
    // Supabase pode passar pathname como /functions/v1/api-leads ou apenas /api-leads
    const pathParts = pathname.replace(/^\/(functions\/v1\/)?api-leads/, "").split("/").filter(Boolean);

    // ==========================================
    // ROTA: GET /api-leads OU GET /api-leads/pending
    // ==========================================
    if (req.method === 'GET' && (pathParts.length === 0 || (pathParts.length === 1 && pathParts[0] === 'pending'))) {
      if (!scopes.includes('leads:read')) {
        return buildErrorResponse('INSUFFICIENT_SCOPE', 'A API Key não possui o escopo necessário: leads:read.', 403, requestId, corsHeaders);
      }

      const isPendingRoute = pathParts.length === 1 && pathParts[0] === 'pending';
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
      const status = isPendingRoute ? 'pending' : url.searchParams.get('status');
      const city = url.searchParams.get('city');
      const niche = url.searchParams.get('niche');
      const createdAfter = url.searchParams.get('created_after');
      const createdBefore = url.searchParams.get('created_before');
      const updatedAfter = url.searchParams.get('updated_after');
      const sort = url.searchParams.get('sort') || 'created_at';
      const order = url.searchParams.get('order') || 'desc';
      const offset = (page - 1) * limit;

      // Executar a descriptografia do banco
      const { data: decryptedLeads, error: decryptError } = await supabaseAdmin.rpc(
        'set_encryption_key_and_get_leads_filtered',
        {
          p_encryption_key: encryptionKey,
          p_user_id: currentUserId,
          p_salvo: null
        }
      );

      if (decryptError) throw decryptError;

      // Aplicar filtros e paginação em memória no Deno para os dados descriptografados
      let filteredLeads = (decryptedLeads as any[]) || [];

      // Filtro de status operacional ou de CRM
      if (status) {
        filteredLeads = filteredLeads.filter(lead => 
          (isPendingRoute ? lead.processing_status === 'pending' : (lead.processing_status === status || lead.status === status))
        );
      }
      if (city) {
        filteredLeads = filteredLeads.filter(lead => lead.cidade?.toLowerCase() === city.toLowerCase());
      }
      if (niche) {
        filteredLeads = filteredLeads.filter(lead => lead.nicho?.toLowerCase() === niche.toLowerCase());
      }
      if (createdAfter) {
        filteredLeads = filteredLeads.filter(lead => new Date(lead.created_at) >= new Date(createdAfter));
      }
      if (createdBefore) {
        filteredLeads = filteredLeads.filter(lead => new Date(lead.created_at) <= new Date(createdBefore));
      }
      if (updatedAfter) {
        filteredLeads = filteredLeads.filter(lead => new Date(lead.updated_at) >= new Date(updatedAfter));
      }

      // Ordenação
      filteredLeads.sort((a, b) => {
        const valA = a[sort];
        const valB = b[sort];
        if (valA === undefined || valB === undefined) return 0;
        
        let compare = 0;
        if (typeof valA === 'string') {
          compare = valA.localeCompare(valB);
        } else {
          compare = (valA > valB ? 1 : -1);
        }
        return order.toLowerCase() === 'asc' ? compare : -compare;
      });

      const totalCount = filteredLeads.length;
      const paginatedLeads = filteredLeads.slice(offset, offset + limit);

      // Mapeamento do payload de leitura simplificado
      const mappedLeads = paginatedLeads.map(lead => ({
        id: lead.id,
        user_id: lead.user_id,
        company_name: lead.nome,
        website: lead.website || "",
        city: lead.cidade || "",
        niche: lead.nicho || "",
        phone: lead.telefone || "",
        email: lead.email || "",
        instagram: lead.instagram_url || "",
        description: lead.instagram_context || lead.notas || "",
        source: lead.search_run_id || "manual",
        status: lead.processing_status || "pending",
        created_at: lead.created_at
      }));

      const responseBody = {
        success: true,
        data: mappedLeads,
        pagination: {
          page,
          limit,
          total: totalCount,
          total_pages: Math.ceil(totalCount / limit)
        }
      };

      // Registrar log de sucesso
      await supabaseAdmin.from('api_logs').insert({
        api_key_id: apiKeyId,
        user_id: currentUserId,
        endpoint: pathname,
        method: req.method,
        status_code: 200,
        duration_ms: Date.now() - startTime,
        request_id: requestId,
        ip_address: ipAddress
      });

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==========================================
    // ROTA: GET /api-leads/:id
    // ==========================================
    if (req.method === 'GET' && pathParts.length === 1) {
      if (!scopes.includes('leads:read')) {
        return buildErrorResponse('INSUFFICIENT_SCOPE', 'A API Key não possui o escopo necessário: leads:read.', 403, requestId, corsHeaders);
      }

      const leadId = pathParts[0];

      // set_encryption_key_and_get_lead_by_id falha com service role context.
      // Workaround: set_encryption_key_and_get_leads_filtered + find por ID.
      const { data: allLeads, error } = await supabaseAdmin.rpc(
        'set_encryption_key_and_get_leads_filtered',
        {
          p_encryption_key: encryptionKey,
          p_salvo: null,
          p_user_id: currentUserId,
          p_search_run_id: null
        }
      );

      const lead = (allLeads || []).find((l: any) => l.id === leadId);

      if (error || !lead) {
        return buildErrorResponse('LEAD_NOT_FOUND', 'Lead não encontrado.', 404, requestId, corsHeaders);
      }

      const mappedLead = {
        id: lead.id,
        user_id: lead.user_id,
        company_name: lead.nome,
        website: lead.website || "",
        city: lead.cidade || "",
        niche: lead.nicho || "",
        phone: lead.whatsapp_number || lead.telefone || "",
        email: lead.email || "",
        instagram: lead.instagram_url || "",
        description: lead.instagram_context || lead.notas || "",
        source: lead.search_run_id || "manual",
        status: lead.processing_status || "pending",
        created_at: lead.created_at
      };

      // Registrar log
      await supabaseAdmin.from('api_logs').insert({
        api_key_id: apiKeyId,
        user_id: currentUserId,
        endpoint: pathname,
        method: req.method,
        lead_id: leadId,
        status_code: 200,
        duration_ms: Date.now() - startTime,
        request_id: requestId,
        ip_address: ipAddress
      });

      return new Response(JSON.stringify({ success: true, data: mappedLead }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==========================================
    // ROTA: PATCH /api-leads/:id
    // ==========================================
    if (req.method === 'PATCH' && pathParts.length === 1) {
      if (!scopes.includes('leads:update')) {
        return buildErrorResponse('INSUFFICIENT_SCOPE', 'A API Key não possui o escopo necessário: leads:update.', 403, requestId, corsHeaders);
      }

      const leadId = pathParts[0];
      const body = JSON.parse(payloadText || await req.text());
      const { notas, salvo } = body;

      const updateFields: Record<string, any> = {};
      if (notas !== undefined) updateFields.notas = notas;
      if (salvo !== undefined) updateFields.salvo = salvo;

      if (Object.keys(updateFields).length === 0) {
        return buildErrorResponse('INVALID_PAYLOAD', 'Nenhum campo válido para atualização fornecido (notas, salvo).', 400, requestId, corsHeaders);
      }

      const { data: updatedLead, error: updateError } = await supabaseAdmin
        .from('leads')
        .update(updateFields)
        .eq('id', leadId)
        .eq('user_id', currentUserId)
        .select('id, nome, notas, salvo')
        .single();

      if (updateError || !updatedLead) {
        return buildErrorResponse('LEAD_NOT_FOUND', 'Lead não encontrado ou não autorizado.', 404, requestId, corsHeaders);
      }

      const responseBody = { success: true, data: updatedLead };

      // Registrar Log
      await supabaseAdmin.from('api_logs').insert({
        api_key_id: apiKeyId,
        user_id: currentUserId,
        endpoint: pathname,
        method: req.method,
        lead_id: leadId,
        status_code: 200,
        duration_ms: Date.now() - startTime,
        request_id: requestId,
        ip_address: ipAddress
      });

      // Salvar idempotência
      if (idempotencyKey) {
        await supabaseAdmin.from('api_idempotency_keys').insert({
          user_id: currentUserId,
          idempotency_key: idempotencyKey,
          endpoint: pathname,
          payload_hash: payloadHash,
          response_status: 200,
          response_body: responseBody
        });
      }

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==========================================
    // ROTA: POST /api-leads/:id/claim (RESERVA ATÔMICA COM LOCK)
    // ==========================================
    if (req.method === 'POST' && pathParts.length === 2 && pathParts[1] === 'claim') {
      if (!scopes.includes('statuses:update')) {
        return buildErrorResponse('INSUFFICIENT_SCOPE', 'A API Key não possui o escopo necessário: statuses:update.', 403, requestId, corsHeaders);
      }

      const leadId = pathParts[0];

      // Verificação preliminar de tentativas para bloquear leads problemáticos (>3 falhas)
      const { data: leadCheck, error: checkError } = await supabaseAdmin
        .from('leads')
        .select('processing_attempts, processing_status')
        .eq('id', leadId)
        .eq('user_id', currentUserId)
        .single();

      if (checkError || !leadCheck) {
        return buildErrorResponse('LEAD_NOT_FOUND', 'Lead não encontrado.', 404, requestId, corsHeaders);
      }

      if (leadCheck.processing_attempts >= 3) {
        // Mudar status para failed permanentemente e barrar claim
        await supabaseAdmin
          .from('leads')
          .update({ processing_status: 'failed', last_processing_error: 'Claim negado: Limite máximo de tentativas de processamento (3) excedido.' })
          .eq('id', leadId);

        return buildErrorResponse('MAX_ATTEMPTS_EXCEEDED', 'Este lead excedeu o limite de 3 tentativas de processamento e está bloqueado.', 422, requestId, corsHeaders);
      }

      const lockToken = crypto.randomUUID();
      const expirationTime = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutos

      // UPDATE condicional e atômico
      const { data: reservedLead, error: reserveError } = await supabaseAdmin
        .from('leads')
        .update({
          processing_status: 'processing',
          processing_started_at: new Date().toISOString(),
          processing_expires_at: expirationTime,
          processing_agent_id: apiKeyId,
          processing_lock_token: lockToken,
          processing_attempts: (leadCheck.processing_attempts || 0) + 1
        })
        .eq('id', leadId)
        .eq('user_id', currentUserId)
        .or(`processing_status.in.(pending,failed,rejected),and(processing_status.eq.processing,processing_expires_at.lt.${new Date().toISOString()})`)
        .select('id')
        .maybeSingle();

      if (reserveError || !reservedLead) {
        return buildErrorResponse('PROCESSING_CONFLICT', 'O lead já está sendo processado por outro agente ou não está elegível para claim.', 409, requestId, corsHeaders);
      }

      const responseBody = {
        success: true,
        message: 'Lead reservado com sucesso.',
        processing_lock_token: lockToken,
        expires_at: expirationTime
      };

      // Registrar log
      await supabaseAdmin.from('api_logs').insert({
        api_key_id: apiKeyId,
        user_id: currentUserId,
        endpoint: pathname,
        method: req.method,
        lead_id: leadId,
        status_code: 200,
        duration_ms: Date.now() - startTime,
        request_id: requestId,
        ip_address: ipAddress
      });

      // Salvar idempotência
      if (idempotencyKey) {
        await supabaseAdmin.from('api_idempotency_keys').insert({
          user_id: currentUserId,
          idempotency_key: idempotencyKey,
          endpoint: pathname,
          payload_hash: payloadHash,
          response_status: 200,
          response_body: responseBody
        });
      }

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==========================================
    // ROTA: POST /api-leads/:id/analysis (SUBMISSÃO DE ANÁLISE TRANSAÇÃO RPC)
    // ==========================================
    if (req.method === 'POST' && pathParts.length === 2 && pathParts[1] === 'analysis') {
      if (!scopes.includes('analyses:write')) {
        return buildErrorResponse('INSUFFICIENT_SCOPE', 'A API Key não possui o escopo necessário: analyses:write.', 403, requestId, corsHeaders);
      }

      const leadId = pathParts[0];
      const body = JSON.parse(payloadText || await req.text());
      const {
        lock_token,
        agent_name,
        model_used,
        priority,
        opportunity_summary,
        possible_pain,
        approach_angle,
        whatsapp_message,
        instagram_message,
        email_subject,
        email_body,
        follow_up_message,
        metadata
      } = body;

      // Validação rápida de obrigatoriedade
      if (!lock_token) {
        return buildErrorResponse('INVALID_PAYLOAD', 'O campo lock_token é obrigatório.', 400, requestId, corsHeaders);
      }
      if (!priority || !['high', 'medium', 'low'].includes(priority)) {
        return buildErrorResponse('INVALID_PAYLOAD', 'O campo priority é obrigatório e deve ser: high, medium ou low.', 400, requestId, corsHeaders);
      }
      if (!agent_name || !model_used) {
        return buildErrorResponse('INVALID_PAYLOAD', 'Os campos agent_name e model_used são obrigatórios.', 400, requestId, corsHeaders);
      }

      // Executar a RPC transacional submit_external_lead_analysis
      const { data: analysisId, error: rpcError } = await supabaseAdmin.rpc(
        'submit_external_lead_analysis',
        {
          p_lead_id: leadId,
          p_user_id: currentUserId,
          p_api_key_id: apiKeyId,
          p_agent_name: agent_name,
          p_model_used: model_used,
          p_priority: priority,
          p_opportunity_summary: opportunity_summary || "",
          p_possible_pain: possible_pain || "",
          p_approach_angle: approach_angle || "",
          p_whatsapp_message: whatsapp_message || "",
          p_instagram_message: instagram_message || "",
          p_email_subject: email_subject || "",
          p_email_body: email_body || "",
          p_follow_up_message: follow_up_message || "",
          p_metadata: metadata || {},
          p_lock_token: lock_token
        }
      );

      if (rpcError) {
        console.error("Erro na RPC submit_external_lead_analysis:", rpcError);
        const errDetail = rpcError.message || rpcError.details || "";
        
        if (errDetail.includes("LEAD_NOT_FOUND")) {
          return buildErrorResponse('LEAD_NOT_FOUND', 'Lead não encontrado para este usuário.', 404, requestId, corsHeaders);
        }
        if (errDetail.includes("INVALID_LOCK_TOKEN")) {
          return buildErrorResponse('INVALID_LOCK_TOKEN', 'Token de lock inválido ou ausente.', 422, requestId, corsHeaders);
        }
        if (errDetail.includes("EXPIRED_LOCK")) {
          return buildErrorResponse('EXPIRED_LOCK', 'O tempo de reserva do lead expirou (limite de 15 minutos).', 422, requestId, corsHeaders);
        }
        if (errDetail.includes("PROCESSING_CONFLICT")) {
          return buildErrorResponse('PROCESSING_CONFLICT', 'O agente que enviou a análise não é o mesmo que reservou o lead.', 409, requestId, corsHeaders);
        }

        return buildErrorResponse('INVALID_PAYLOAD', rpcError.message || 'Erro de validação lógica.', 422, requestId, corsHeaders);
      }

      const responseBody = {
        success: true,
        message: 'Análise externa registrada com sucesso. Aguardando aprovação humana.',
        analysis_id: analysisId
      };

      // Registrar log
      await supabaseAdmin.from('api_logs').insert({
        api_key_id: apiKeyId,
        user_id: currentUserId,
        endpoint: pathname,
        method: req.method,
        lead_id: leadId,
        status_code: 201,
        duration_ms: Date.now() - startTime,
        request_id: requestId,
        ip_address: ipAddress
      });

      // Salvar idempotência
      if (idempotencyKey) {
        await supabaseAdmin.from('api_idempotency_keys').insert({
          user_id: currentUserId,
          idempotency_key: idempotencyKey,
          endpoint: pathname,
          payload_hash: payloadHash,
          response_status: 201,
          response_body: responseBody
        });
      }

      return new Response(JSON.stringify(responseBody), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==========================================
    // ROTA: GET /api-leads/:id/analysis (HISTÓRICO DE ANÁLISES)
    // ==========================================
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'analysis') {
      if (!scopes.includes('leads:read')) {
        return buildErrorResponse('INSUFFICIENT_SCOPE', 'A API Key não possui o escopo necessário: leads:read.', 403, requestId, corsHeaders);
      }

      const leadId = pathParts[0];

      const { data: analyses, error: queryError } = await supabaseAdmin
        .from('lead_analyses')
        .select('*')
        .eq('lead_id', leadId)
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false });

      if (queryError) {
        return buildErrorResponse('LEAD_NOT_FOUND', 'Erro ao recuperar análises.', 404, requestId, corsHeaders);
      }

      // Registrar log
      await supabaseAdmin.from('api_logs').insert({
        api_key_id: apiKeyId,
        user_id: currentUserId,
        endpoint: pathname,
        method: req.method,
        lead_id: leadId,
        status_code: 200,
        duration_ms: Date.now() - startTime,
        request_id: requestId,
        ip_address: ipAddress
      });

      return new Response(JSON.stringify({ success: true, data: analyses || [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==========================================
    // ROTA: PATCH /api-leads/:id/status (STATUS OPERACIONAL MANUAL)
    // ==========================================
    if (req.method === 'PATCH' && pathParts.length === 2 && pathParts[1] === 'status') {
      if (!scopes.includes('statuses:update')) {
        return buildErrorResponse('INSUFFICIENT_SCOPE', 'A API Key não possui o escopo necessário: statuses:update.', 403, requestId, corsHeaders);
      }

      const leadId = pathParts[0];
      const body = JSON.parse(payloadText || await req.text());
      const { status, error_message } = body;

      const validStatuses = ['processing', 'completed', 'failed'];
      if (!status || !validStatuses.includes(status)) {
        return buildErrorResponse('INVALID_PAYLOAD', 'O status informado deve ser: processing, completed ou failed.', 400, requestId, corsHeaders);
      }

      const updateData: Record<string, any> = {
        processing_status: status,
        last_processing_at: new Date().toISOString()
      };

      if (status === 'failed' && error_message) {
        updateData.last_processing_error = error_message;
      }

      const { data: updatedLead, error: updateError } = await supabaseAdmin
        .from('leads')
        .update(updateData)
        .eq('id', leadId)
        .eq('user_id', currentUserId)
        .select('id, nome, processing_status, last_processing_error')
        .single();

      if (updateError || !updatedLead) {
        return buildErrorResponse('LEAD_NOT_FOUND', 'Lead não encontrado ou não autorizado.', 404, requestId, corsHeaders);
      }

      const responseBody = { success: true, data: updatedLead };

      // Registrar log
      await supabaseAdmin.from('api_logs').insert({
        api_key_id: apiKeyId,
        user_id: currentUserId,
        endpoint: pathname,
        method: req.method,
        lead_id: leadId,
        status_code: 200,
        duration_ms: Date.now() - startTime,
        request_id: requestId,
        ip_address: ipAddress
      });

      // Salvar idempotência
      if (idempotencyKey) {
        await supabaseAdmin.from('api_idempotency_keys').insert({
          user_id: currentUserId,
          idempotency_key: idempotencyKey,
          endpoint: pathname,
          payload_hash: payloadHash,
          response_status: 200,
          response_body: responseBody
        });
      }

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==========================================
    // ROTAS DE APROVAÇÃO/REJEIÇÃO (POST /api-leads/:id/approve e /reject)
    // ==========================================
    if (req.method === 'POST' && pathParts.length === 2 && (pathParts[1] === 'approve' || pathParts[1] === 'reject')) {
      const leadId = pathParts[0];
      const action = pathParts[1];
      const body = JSON.parse(payloadText || await req.text());
      const { analysis_id } = body;

      if (!analysis_id) {
        return buildErrorResponse('INVALID_PAYLOAD', 'O campo analysis_id é obrigatório.', 400, requestId, corsHeaders);
      }

      if (action === 'approve') {
        const { data: ok, error: rpcError } = await supabaseAdmin.rpc(
          'approve_external_lead_analysis',
          {
            p_lead_id: leadId,
            p_analysis_id: analysis_id,
            p_admin_id: currentUserId
          }
        );

        if (rpcError || !ok) {
          console.error("Erro ao aprovar análise via RPC:", rpcError);
          return buildErrorResponse('INVALID_PAYLOAD', rpcError?.message || 'Erro ao processar aprovação.', 422, requestId, corsHeaders);
        }

        const responseBody = { success: true, message: 'Análise externa aprovada e copiada com sucesso.' };

        // Registrar log
        await supabaseAdmin.from('api_logs').insert({
          api_key_id: apiKeyId,
          user_id: currentUserId,
          endpoint: pathname,
          method: req.method,
          lead_id: leadId,
          status_code: 200,
          duration_ms: Date.now() - startTime,
          request_id: requestId,
          ip_address: ipAddress
        });

        return new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        const { data: ok, error: rpcError } = await supabaseAdmin.rpc(
          'reject_external_lead_analysis',
          {
            p_lead_id: leadId,
            p_analysis_id: analysis_id,
            p_admin_id: currentUserId
          }
        );

        if (rpcError || !ok) {
          console.error("Erro ao rejeitar análise via RPC:", rpcError);
          return buildErrorResponse('INVALID_PAYLOAD', rpcError?.message || 'Erro ao processar rejeição.', 422, requestId, corsHeaders);
        }

        const responseBody = { success: true, message: 'Análise externa rejeitada com sucesso.' };

        // Registrar log
        await supabaseAdmin.from('api_logs').insert({
          api_key_id: apiKeyId,
          user_id: currentUserId,
          endpoint: pathname,
          method: req.method,
          lead_id: leadId,
          status_code: 200,
          duration_ms: Date.now() - startTime,
          request_id: requestId,
          ip_address: ipAddress
        });

        return new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return buildErrorResponse('INVALID_PAYLOAD', 'Método ou endpoint não suportado.', 400, requestId, corsHeaders);

  } catch (error: unknown) {
    console.error('Erro na execução da Edge Function api-leads:', error);
    const msg = error instanceof Error ? error.message : 'Erro interno do servidor';
    
    // Registrar log de erro grave no banco se houver sessão de chave válida
    if (currentUserId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabaseAdmin.from('api_logs').insert({
          api_key_id: apiKeyId,
          user_id: currentUserId,
          endpoint: new URL(req.url).pathname,
          method: req.method,
          status_code: 500,
          duration_ms: Date.now() - startTime,
          request_id: requestId,
          error_code: 'INTERNAL_ERROR',
          error_message: msg,
          ip_address: ipAddress
        });
      } catch (logErr) {
        console.error("Falha ao registrar log de erro no banco:", logErr);
      }
    }

    return buildErrorResponse('INTERNAL_ERROR', msg, 500, requestId, corsHeaders);
  }
});
