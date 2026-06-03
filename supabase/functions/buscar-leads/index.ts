import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ============= CORS HELPER =============
// Configure a env var ALLOWED_ORIGINS com os domínios permitidos separados por vírgula
// Exemplo: "https://meuapp.lovable.app,https://meudominio.com.br,http://localhost:5173"
function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const allowedOriginsEnv = Deno.env.get("ALLOWED_ORIGINS") || "";
  const allowedOrigins = allowedOriginsEnv.split(",").map((o) => o.trim()).filter(Boolean);
  
  const origin = (allowedOrigins.length === 0 || (requestOrigin && allowedOrigins.includes(requestOrigin)))
    ? (requestOrigin || "*")
    : "";
    
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

interface ProspeccaoRequest {
  cidade: string;
  estado: string;
  nicho: string;
  quantidade: number;
  foco: string;
  proximidadeAtiva: boolean;
  raioKm?: number;
  canaisProspeccao?: ("email" | "whatsapp" | "instagram")[];
  excludePlaceIds?: string[];
  pageToken?: string;
  pais?: "BR" | "US";
}

type NoLeadsReason = "google_zero" | "all_duplicates" | "filtered_out";

interface SearchAttemptLog {
  query: string;
  location: { lat: number; lng: number } | null;
  radiusKm: number | null;
  type: string | null;
  rawResults: number;
  returnedResults: number;
  duplicateResults: number;
  excludedResults: number;
  googleStatus?: string;
}

interface SearchDiagnostics {
  received: {
    cidade: string;
    estado: string;
    nicho: string;
    foco: string;
    quantidade: number;
  };
  normalized: {
    cidade: string;
    estado: string;
    locationText: string;
  };
  attempts: SearchAttemptLog[];
  rawResultsTotal: number;
  afterGoogleDedupTotal: number;
  afterDuplicateFilterTotal: number;
  discarded: Record<string, number>;
  fallbackNiches: string[];
}

const ADMIN_EMAILS = new Set([
  "jeferson.zanotell@gmail.com",
  "jefeson.zanotell@gmail.com",
]);
const ZUNO_INTERNAL_PROSPECTING_FOCUS = "zuno_internal_prospecting";

function isZunoInternalProspectingFocus(foco?: string | null): boolean {
  return foco === ZUNO_INTERNAL_PROSPECTING_FOCUS;
}

const BRAZILIAN_STATE_NAMES: Record<string, string> = {
  "acre": "AC",
  "alagoas": "AL",
  "amapa": "AP",
  "amazonas": "AM",
  "bahia": "BA",
  "ceara": "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  "goias": "GO",
  "maranhao": "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  "para": "PA",
  "paraiba": "PB",
  "parana": "PR",
  "pernambuco": "PE",
  "piaui": "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  "rondonia": "RO",
  "roraima": "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  "sergipe": "SE",
  "tocantins": "TO",
};

function removeDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function toTitleCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : part)
    .join(" ");
}

function normalizeState(input: string, pais: "BR" | "US" = "BR"): string {
  const value = (input || "").trim();
  const ufMatch = value.match(/\(([A-Za-z]{2})\)/);
  if (ufMatch) return ufMatch[1].toUpperCase();

  if (/^[A-Za-z]{2}$/.test(value)) return value.toUpperCase();
  if (pais === "US") return value;

  const key = removeDiacritics(value).toLowerCase();
  return BRAZILIAN_STATE_NAMES[key] || value;
}

function buildLocationText(cidade: string, estado: string, pais: "BR" | "US" = "BR"): string {
  const countryName = pais === "US" ? "USA" : "Brasil";
  return `${cidade}, ${estado}, ${countryName}`;
}

function buildNicheVariations(nicho: string): string[] {
  const normalized = removeDiacritics(nicho).toLowerCase().trim();
  const variations = [nicho.trim()];

  const add = (items: string[]) => {
    for (const item of items) {
      if (!variations.some((existing) => removeDiacritics(existing).toLowerCase() === removeDiacritics(item).toLowerCase())) {
        variations.push(item);
      }
    }
  };

  if (/(loja|revenda|concessionaria|carro|carros|veiculo|veiculos|automovel|automoveis|usado|usados)/i.test(normalized)) {
    add([
      "loja de carros",
      "concessionaria",
      "revenda de veiculos",
      "loja de veiculos",
      "carros usados",
      "automoveis",
    ]);
  }

  return variations.slice(0, 6);
}

function buildNoLeadsPayload(
  reason: NoLeadsReason,
  diagnostics: SearchDiagnostics,
  extra?: Record<string, unknown>,
) {
  const messages: Record<NoLeadsReason, string> = {
    google_zero: "Nenhuma empresa encontrada para essa busca.",
    all_duplicates: "Encontramos empresas, mas todas ja estavam no seu historico.",
    filtered_out: "Encontramos empresas, mas nenhuma passou nos filtros atuais.",
  };

  const suggestions: Record<NoLeadsReason, string> = {
    google_zero: "Nao encontramos empresas com esse termo. Tente uma variacao como concessionaria, revenda de veiculos ou carros usados.",
    all_duplicates: "Encontramos empresas, mas nenhuma nova para sua conta. Tente outro nicho ou remova filtros.",
    filtered_out: "Encontramos empresas, mas os filtros atuais ocultaram os resultados.",
  };

  return {
    success: true,
    error: messages[reason],
    noLeadsReason: reason,
    suggestion: suggestions[reason],
    leadsCount: 0,
    newLeadsCount: 0,
    updatedLeadsCount: 0,
    totalAvailable: diagnostics.afterDuplicateFilterTotal,
    limitedByQuota: false,
    additionalLeadsAvailable: 0,
    searchDiagnostics: diagnostics,
    ...(extra ?? {}),
  };
}

function logStep(searchRunId: string, step: string, data?: Record<string, unknown>) {
  console.log(`[buscar-leads:${searchRunId}] ${step}`, data ?? {});
}

function logError(searchRunId: string, step: string, error: unknown, data?: Record<string, unknown>) {
  const safeError = error instanceof Error
    ? { name: error.name, message: error.message }
    : error;
  console.error(`[buscar-leads:${searchRunId}] ${step}`, { error: safeError, ...(data ?? {}) });
}

async function logAppEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
  params: {
    userId: string;
    eventType: string;
    eventData?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
) {
  try {
    await supabaseAdmin.rpc("log_app_event", {
      p_user_id: params.userId,
      p_event_type: params.eventType,
      p_event_data: params.eventData || {},
      p_ip_address: params.ipAddress || null,
      p_user_agent: params.userAgent || null,
    });
  } catch (eventError) {
    console.warn("[buscar-leads] Falha ao registrar app_event", eventError);
  }
}

async function upsertSearchLog(
  supabaseAdmin: ReturnType<typeof createClient>,
  values: Record<string, unknown>,
) {
  try {
    const searchRunId = values.search_run_id;
    if (searchRunId) {
      const { data: existing } = await supabaseAdmin
        .from("search_logs")
        .select("id")
        .eq("search_run_id", searchRunId)
        .maybeSingle();

      if (existing?.id) {
        await supabaseAdmin
          .from("search_logs")
          .update(values)
          .eq("id", existing.id);
        return;
      }
    }

    await supabaseAdmin.from("search_logs").insert(values);
  } catch (logError) {
    console.warn("[buscar-leads] Falha ao registrar search_log", logError);
  }
}

function errorResponse(
  corsHeaders: Record<string, string>,
  status: number,
  error: string,
  details?: string,
  code?: string,
) {
  return new Response(
    JSON.stringify({ error, details, code }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

serve(async (req) => {
  const corsCheck = handleCorsRequest(req);
  if (corsCheck) return corsCheck;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  const searchRunId = crypto.randomUUID();
  const startedAt = Date.now();
  let supabaseAdminForCatch: ReturnType<typeof createClient> | null = null;
  let authenticatedUserIdForCatch: string | null = null;
  let searchContextForCatch: Record<string, unknown> = {};

  try {
    logStep(searchRunId, "Inicio da Edge Function", {
      method: req.method,
      origin: origin ?? "sem-origin",
      hasAuthorizationHeader: !!req.headers.get("Authorization"),
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    
    // SECURITY: Get encryption key from external secret (NOT from database)
    const encryptionKey = Deno.env.get('LEADS_ENCRYPTION_KEY');
    logStep(searchRunId, "Secrets presentes", {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseAnonKey: !!supabaseAnonKey,
      hasSupabaseServiceRoleKey: !!supabaseServiceKey,
      hasGooglePlacesApiKey: !!GOOGLE_API_KEY,
      hasLeadsEncryptionKey: !!encryptionKey,
    });

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return errorResponse(
        corsHeaders,
        500,
        "Configuração Supabase incompleta",
        "Verifique SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY nas secrets da Edge Function.",
        "missing_supabase_secret",
      );
    }

    if (!encryptionKey) {
      logError(searchRunId, "Secret LEADS_ENCRYPTION_KEY ausente", new Error("LEADS_ENCRYPTION_KEY not configured"));
      return errorResponse(
        corsHeaders,
        500,
        "Configuração de segurança inválida",
        "A secret LEADS_ENCRYPTION_KEY não está configurada no Supabase.",
        "missing_leads_encryption_key",
      );
    }
    if (!encryptionKey) {
      console.error("❌ LEADS_ENCRYPTION_KEY not configured");
      return new Response(JSON.stringify({ error: "Configuração de segurança inválida" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    });
    
    // Admin client for secure insert operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    supabaseAdminForCatch = supabaseAdmin;

    // Verifica autenticação
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    authenticatedUserIdForCatch = user.id;

    const normalizedEmail = user.email?.trim().toLowerCase() || "";
    logStep(searchRunId, "Usuário autenticado", {
      userId: user.id,
      emailDomain: normalizedEmail.split("@")[1] ?? "sem-email",
    });

    const { data: adminCheck, error: adminError } = await supabaseAdmin.rpc("is_admin", { _user_id: user.id });
    if (adminError) {
      logError(searchRunId, "Erro ao consultar is_admin", adminError);
    }
    const isAdminUser = ADMIN_EMAILS.has(normalizedEmail) || adminCheck === true;

    const body: ProspeccaoRequest = await req.json();
    body.foco = body.foco || (body as any).focus;
    const requestedCountry = String(body.pais || "BR").trim().toUpperCase();
    const requestedQuantity = Math.max(1, Math.min(100, Number(body.quantidade) || 10));
    const receivedCidade = body.cidade || "";
    const receivedEstado = body.estado || "";
    const normalizedPais: "BR" | "US" = requestedCountry === "US" || requestedCountry === "ESTADOS UNIDOS" ? "US" : "BR";
    const normalizedCidade = toTitleCase(receivedCidade);
    const normalizedEstado = normalizeState(receivedEstado, normalizedPais);
    const normalizedLocationText = buildLocationText(normalizedCidade, normalizedEstado, normalizedPais);
    body.cidade = normalizedCidade;
    body.estado = normalizedEstado;
    body.pais = normalizedPais;

    searchContextForCatch = {
      city: normalizedCidade,
      state: normalizedEstado,
      country: normalizedPais,
      niche: body.nicho,
      focus: body.foco,
      requested_quantity: requestedQuantity,
      ...(isZunoInternalProspectingFocus(body.foco) && isAdminUser
        ? {
            internal_zuno_prospecting: true,
            admin_only: true,
            is_internal_event: true,
            event_source_type: "admin",
          }
        : {}),
    };

    if (isZunoInternalProspectingFocus(body.foco) && !isAdminUser) {
      await logAppEvent(supabaseAdmin, {
        userId: user.id,
        eventType: "admin_only_focus_blocked",
        eventData: {
          attempted_focus: ZUNO_INTERNAL_PROSPECTING_FOCUS,
          user_id: user.id,
          user_email: normalizedEmail,
        },
        ipAddress: req.headers.get("x-forwarded-for"),
        userAgent: req.headers.get("user-agent"),
      });
      return errorResponse(
        corsHeaders,
        403,
        "Este foco está disponível apenas para administradores.",
        "A opção Prospecção para a Zuno é exclusiva para administradores.",
        "ADMIN_ONLY_FOCUS",
      );
    }

    await upsertSearchLog(supabaseAdmin, {
      search_run_id: searchRunId,
      user_id: user.id,
      city: normalizedCidade,
      state: normalizedEstado,
      country: normalizedPais,
      niche: body.nicho,
      focus: body.foco,
      requested_quantity: requestedQuantity,
      status: "started",
      ip_address: req.headers.get("x-forwarded-for"),
      user_agent: req.headers.get("user-agent"),
      diagnostics: {},
    });
    await logAppEvent(supabaseAdmin, {
      userId: user.id,
      eventType: "search_started",
      eventData: { searchRunId, ...searchContextForCatch },
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });

    if (normalizedPais === "US" && !isAdminUser) {
      const { data: addonData, error: addonError } = await supabaseAdmin
        .from("user_addons")
        .select("status")
        .eq("user_id", user.id)
        .eq("addon_id", "us_prospecting")
        .eq("status", "active")
        .maybeSingle();

      if (addonError) {
        logError(searchRunId, "Erro ao validar add-on EUA", addonError);
        return errorResponse(
          corsHeaders,
          500,
          "Erro ao validar complemento EUA",
          addonError.message,
          "us_addon_validation_error",
        );
      }

      if (!addonData) {
        return errorResponse(
          corsHeaders,
          403,
          "Complemento EUA necessário",
          "Ative o complemento Prospecção nos Estados Unidos para buscar leads nos EUA.",
          "us_prospecting_addon_required",
        );
      }
    }

    const diagnostics: SearchDiagnostics = {
      received: {
        cidade: receivedCidade,
        estado: receivedEstado,
        nicho: body.nicho,
        foco: body.foco,
        quantidade: requestedQuantity,
      },
      normalized: {
        cidade: normalizedCidade,
        estado: normalizedEstado,
        locationText: normalizedLocationText,
      },
      attempts: [],
      rawResultsTotal: 0,
      afterGoogleDedupTotal: 0,
      afterDuplicateFilterTotal: 0,
      discarded: {
        duplicateWithinGoogle: 0,
        excludedExistingPlaceId: 0,
        missingName: 0,
        missingAddressOrCity: 0,
        detailsError: 0,
        insertError: 0,
      },
      fallbackNiches: [],
    };

    logStep(searchRunId, "Payload recebido", {
      cidade: body.cidade,
      estado: body.estado,
      nicho: body.nicho,
      quantidade: body.quantidade,
      foco: body.foco,
      proximidadeAtiva: body.proximidadeAtiva,
      raioKm: body.raioKm ?? null,
      canaisProspeccao: body.canaisProspeccao ?? null,
      excludePlaceIdsCount: body.excludePlaceIds?.length ?? 0,
      pais: body.pais ?? "BR",
      normalizedLocationText,
    });
    logStep(searchRunId, "Filtros de descarte ativos", {
      requiresWebsite: false,
      requiresPhone: false,
      requiresRating: false,
      requiresReviews: false,
      requiresFullAddress: false,
      minimumRequiredFields: "name",
      focoUsedInGoogleQuery: false,
    });

    const { data: usageData, error: usageError } = await supabaseClient.rpc("get_current_user_usage");

    if (usageError) {
      logError(searchRunId, "Erro ao validar usage mensal do usuario autenticado", usageError);
      return errorResponse(
        corsHeaders,
        500,
        "Erro ao validar limite do plano",
        usageError.message,
        "usage_validation_error",
      );
    }

    const usageInfo = usageData?.[0];
    const isUnlimited = isAdminUser || usageInfo?.is_admin === true || (usageInfo?.leads_limit ?? 0) >= 999999;
    const leadsAvailableTotal = isUnlimited
      ? 999999
      : Math.max(0, Number(usageInfo?.leads_available_total ?? 0));

    if (!isUnlimited && leadsAvailableTotal <= 0) {
      return errorResponse(
        corsHeaders,
        402,
        "Você atingiu seu limite de leads este mês.",
        "Faça upgrade do plano ou aguarde a renovação mensal para buscar novos leads.",
        "leads_limit_reached",
      );
    }

    const allowedQuantity = isUnlimited
      ? requestedQuantity
      : Math.min(requestedQuantity, leadsAvailableTotal);
    body.quantidade = allowedQuantity;

    logStep(searchRunId, "Usage validado antes do Google Places", {
      planName: usageInfo?.plan ?? usageInfo?.plan_name ?? null,
      isUnlimited,
      requestedQuantity,
      allowedQuantity,
      leadsLimit: usageInfo?.leads_limit ?? null,
      leadsUsed: usageInfo?.leads_used ?? null,
      leadsRemaining: usageInfo?.leads_remaining ?? null,
      leadsBonusBalance: usageInfo?.leads_bonus_balance ?? null,
      leadsAvailableTotal,
    });

    let leads: any[] = [];
    let totalAvailable = 0; // Total de leads disponíveis ANTES de limitar
    let exhaustedSource = false; // Indica se esgotou as possibilidades do Google
    let searchMetadata = { roundsUsed: 1, finalRadius: 0 }; // Metadados da busca

    // ============================================
    // FUNÇÃO DE PAGINAÇÃO AUTOMÁTICA
    // Busca até 3 páginas (60 resultados) automaticamente
    // ============================================
    async function fetchAllPagesFromGoogle(
      initialUrl: string,
      targetQuantity: number,
      maxPages: number = 3,
      existingPlaceIds: Set<string> = new Set(),
      attemptContext?: {
        query: string;
        location: { lat: number; lng: number } | null;
        radiusKm: number | null;
        type: string | null;
      }
    ): Promise<{ results: any[]; totalFound: number; hasMorePages: boolean; rawResults: number; duplicateResults: number; excludedResults: number; googleStatus?: string }> {
      const allResults: any[] = [];
      const seenPlaceIds = new Set<string>(existingPlaceIds);
      let pageToken: string | null = null;
      let currentPage = 0;
      let hasMorePages = false;
      let rawResults = 0;
      let duplicateResults = 0;
      let excludedResults = 0;
      let googleStatus: string | undefined;

      while (allResults.length < targetQuantity && currentPage < maxPages) {
        let url = initialUrl;
        
        // Se temos pageToken, usa ele (substitui a URL inteira)
        if (pageToken) {
          const baseUrl = initialUrl.includes('nearbysearch') 
            ? 'https://maps.googleapis.com/maps/api/place/nearbysearch/json'
            : 'https://maps.googleapis.com/maps/api/place/textsearch/json';
          url = `${baseUrl}?pagetoken=${pageToken}&key=${GOOGLE_API_KEY}`;
        }

        console.log(`📄 Buscando página ${currentPage + 1}/${maxPages}...`);
        const response = await fetch(url);
        const data = await response.json();
        googleStatus = data.status;
        logStep(searchRunId, "Resposta Google Places Search", {
          page: currentPage + 1,
          httpStatus: response.status,
          googleStatus: data.status,
          resultsCount: data.results?.length ?? 0,
          hasErrorMessage: !!data.error_message,
          errorMessage: data.error_message ?? null,
        });

        if (data.status === "OK" && data.results?.length > 0) {
          // Deduplica por place_id
          for (const result of data.results) {
            rawResults++;
            if (existingPlaceIds.has(result.place_id)) {
              excludedResults++;
              continue;
            }
            if (seenPlaceIds.has(result.place_id)) {
              duplicateResults++;
              continue;
            }
            seenPlaceIds.add(result.place_id);
            allResults.push(result);
          }
          
          console.log(`✅ Página ${currentPage + 1}: ${data.results.length} resultados (total acumulado: ${allResults.length})`);
          
          pageToken = data.next_page_token || null;
          hasMorePages = !!pageToken;
          
          // Se ainda não atingimos a quantidade e tem mais páginas
          if (pageToken && allResults.length < targetQuantity) {
            // Google EXIGE delay de 2 segundos antes de usar pageToken
            console.log(`⏳ Aguardando 2s para próxima página (requisito Google)...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } else if (data.status === "ZERO_RESULTS") {
          console.log(`📭 Página ${currentPage + 1}: Nenhum resultado`);
          break;
        } else {
          console.error(`❌ Erro na página ${currentPage + 1}:`, data.status, data.error_message);
          break;
        }

        currentPage++;
        if (!pageToken) break;
      }

      console.log(`📊 Paginação completa: ${allResults.length} leads únicos em ${currentPage} página(s)`);
      diagnostics.rawResultsTotal += rawResults;
      diagnostics.afterGoogleDedupTotal += allResults.length;
      diagnostics.discarded.duplicateWithinGoogle += duplicateResults;
      diagnostics.discarded.excludedExistingPlaceId += excludedResults;

      if (attemptContext) {
        diagnostics.attempts.push({
          ...attemptContext,
          rawResults,
          returnedResults: allResults.length,
          duplicateResults,
          excludedResults,
          googleStatus,
        });
      }

      logStep(searchRunId, "Paginacao Google Places concluida", {
        query: attemptContext?.query ?? "nao-informada",
        location: attemptContext?.location ?? null,
        radiusKm: attemptContext?.radiusKm ?? null,
        type: attemptContext?.type ?? null,
        rawResults,
        returnedResults: allResults.length,
        duplicateResults,
        excludedResults,
        pagesUsed: currentPage,
      });
      return { results: allResults, totalFound: allResults.length, hasMorePages, rawResults, duplicateResults, excludedResults, googleStatus };
    }

    // ============================================
    // BUSCA MULTI-RODADA COM EXPANSÃO DE RAIO
    // Supera o limite de ~60 resultados do Google
    // ============================================
    async function multiRoundSearch(
      nicho: string,
      targetQuantity: number,
      location: { lat: number; lng: number },
      initialRadius: number,
      excludePlaceIds: string[] = []
    ): Promise<{ results: any[]; totalFound: number; exhaustedSource: boolean; finalRadius: number; roundsUsed: number }> {
      const allResults: any[] = [];
      const seenPlaceIds = new Set<string>(excludePlaceIds);
      
      // Configuração de rodadas
      const MAX_ROUNDS = 3;
      const RADIUS_MULTIPLIERS = [1, 2, 4]; // 5km -> 10km -> 20km quando o raio inicial for 5km
      const MAX_RADIUS_KM = body.pais === "US" ? 50 : 30; // Limite máximo
      
      let currentRadius = initialRadius;
      let roundsUsed = 0;
      let isExhausted = false;
      let consecutiveEmptyRounds = 0;

      console.log(`🔄 Iniciando busca multi-rodada: alvo=${targetQuantity}, raio inicial=${initialRadius}km`);

      for (let round = 0; round < MAX_ROUNDS && allResults.length < targetQuantity; round++) {
        currentRadius = Math.min(initialRadius * RADIUS_MULTIPLIERS[round], MAX_RADIUS_KM);
        roundsUsed = round + 1;

        console.log(`\n🔄 RODADA ${round + 1}/${MAX_ROUNDS}: raio=${currentRadius.toFixed(1)}km, encontrados até agora=${allResults.length}`);

        const query = `${nicho} em ${normalizedLocationText}`;
        const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${
          Math.round(currentRadius * 1000)
        }&keyword=${encodeURIComponent(nicho)}&key=${GOOGLE_API_KEY}`;

        logStep(searchRunId, "Query enviada ao Google Places", {
          query,
          keyword: nicho,
          location,
          radiusKm: currentRadius,
          type: null,
          searchMode: "nearbysearch",
        });

        const { results: roundResults } = await fetchAllPagesFromGoogle(
          nearbyUrl,
          targetQuantity - allResults.length + 20, // Busca um pouco mais para compensar duplicatas
          3,
          seenPlaceIds,
          { query, location, radiusKm: currentRadius, type: null }
        );

        // Conta novos resultados únicos
        let newInRound = 0;
        for (const result of roundResults) {
          if (!seenPlaceIds.has(result.place_id)) {
            seenPlaceIds.add(result.place_id);
            allResults.push({ ...result, _nicho: nicho });
            newInRound++;
          }
        }

        console.log(`📊 Rodada ${round + 1}: +${newInRound} novos (total: ${allResults.length}/${targetQuantity})`);

        // Se não encontrou novos em 2 rodadas seguidas, para
        if (newInRound < 3) {
          consecutiveEmptyRounds++;
          if (consecutiveEmptyRounds >= 2) {
            console.log(`⚠️ 2 rodadas sem novos resultados. Encerrando busca.`);
            isExhausted = true;
            break;
          }
        } else {
          consecutiveEmptyRounds = 0;
        }

        // Se atingiu o raio máximo
        if (currentRadius >= MAX_RADIUS_KM) {
          console.log(`⚠️ Raio máximo atingido (${MAX_RADIUS_KM}km). Encerrando busca.`);
          isExhausted = true;
          break;
        }

        // Pequeno delay entre rodadas para evitar rate limit
        if (round < MAX_ROUNDS - 1 && allResults.length < targetQuantity) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log(`✅ Busca multi-rodada concluída: ${allResults.length} leads em ${roundsUsed} rodadas (raio final: ${currentRadius.toFixed(1)}km)`);

      return { 
        results: allResults, 
        totalFound: allResults.length, 
        exhaustedSource: isExhausted || allResults.length < targetQuantity,
        finalRadius: currentRadius,
        roundsUsed 
      };
    }

    // ============================================
    // FUNÇÃO PARA BUSCAR UM NICHO ESPECÍFICO
    // Agora usa multi-rodada quando proximidade ativa
    // ============================================
    async function searchSingleNiche(
      nicho: string,
      targetQuantity: number,
      location?: { lat: number; lng: number },
      searchRadius?: number,
      excludePlaceIds: string[] = []
    ): Promise<{ results: any[]; totalFound: number; exhaustedSource?: boolean; finalRadius?: number; roundsUsed?: number }> {
      if (body.proximidadeAtiva && location && searchRadius) {
        // Usa busca multi-rodada para superar limite de 60
        return await multiRoundSearch(nicho, targetQuantity, location, searchRadius, excludePlaceIds);
      } else if (location) {
        // Text Search não tem proximidade, mas podemos usar Nearby Search com raio maior
        console.log("🔄 Usando Nearby Search híbrido (localização disponível)");
        const defaultRadius = 15; // 15km padrão para busca sem proximidade explícita
        return await multiRoundSearch(nicho, targetQuantity, location, defaultRadius, excludePlaceIds);
      } else {
        // Text Search puro (sem localização conhecida) - limitado a ~60 resultados
        const query = `${nicho} em ${normalizedLocationText}`;
        const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
          query
        )}&key=${GOOGLE_API_KEY}`;

        logStep(searchRunId, "Query enviada ao Google Places", {
          query,
          location: null,
          radiusKm: null,
          type: null,
          searchMode: "textsearch",
        });
        const { results, totalFound } = await fetchAllPagesFromGoogle(
          textSearchUrl,
          targetQuantity,
          3,
          new Set(excludePlaceIds),
          { query, location: null, radiusKm: null, type: null },
        );
        return { results, totalFound, exhaustedSource: totalFound < targetQuantity };
      }
    }

    // Se não houver API key, retorna dados mockados para teste de UI
    if (!GOOGLE_API_KEY) {
      console.log("API key não configurada - retornando dados mockados");
      
      const mockLeads = Array.from({ length: Math.min(body.quantidade, 5) }, (_, i) => ({
        place_id: `mock_place_${i}_${Date.now()}`,
        name: `${body.nicho.charAt(0).toUpperCase() + body.nicho.slice(1)} ${i + 1} - ${body.cidade}`,
        formatted_address: `Rua Exemplo ${i + 100}, ${body.cidade}, Brasil`,
        formatted_phone_number: `(11) 9${1000 + i}-${1000 + i}`,
        website: i % 2 === 0 ? `https://exemplo${i + 1}.com.br` : null,
        rating: 3.5 + (i * 0.3),
        user_ratings_total: 10 + (i * 5),
        geometry: {
          location: {
            lat: -23.5505 + (i * 0.01),
            lng: -46.6333 + (i * 0.01)
          }
        },
        _nicho: body.nicho // Marca o nicho
      }));

      leads = mockLeads;
      totalAvailable = mockLeads.length;
    } else {
      // ============================================
      // DETECTA MÚLTIPLOS NICHOS (separados por vírgula)
      // ============================================
      const nichos = body.nicho.split(',').map((n: string) => n.trim()).filter((n: string) => n.length > 0);
      const isMultipleNiches = nichos.length > 1;

      if (isMultipleNiches) {
        console.log(`🔍 Detectados ${nichos.length} nichos: ${nichos.join(', ')}`);
      }

      // Prepara coordenadas - SEMPRE geocodifica para poder usar busca híbrida
      let location: { lat: number; lng: number } | undefined;
      let searchRadius = body.raioKm || 5;

      // Geocodifica a cidade + estado para obter lat/lng do centro
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        normalizedLocationText
      )}&key=${GOOGLE_API_KEY}`;

      const geocodeResponse = await fetch(geocodeUrl);
      const geocodeData = await geocodeResponse.json();
      logStep(searchRunId, "Resposta Google Geocoding", {
        locationText: normalizedLocationText,
        httpStatus: geocodeResponse.status,
        googleStatus: geocodeData.status,
        resultsCount: geocodeData.results?.length ?? 0,
        hasErrorMessage: !!geocodeData.error_message,
        errorMessage: geocodeData.error_message ?? null,
      });

      if (geocodeData.status === "OK" && geocodeData.results[0]) {
        location = geocodeData.results[0].geometry.location;
        console.log("📍 Coordenadas do centro da cidade:", location);
      } else {
        console.warn("⚠️ Geocodificação falhou, usando Text Search limitado:", geocodeData.status);
      }

      // Se for busca incremental, aumenta o raio em 50% para encontrar novos leads
      const isIncremental = body.excludePlaceIds && body.excludePlaceIds.length > 0;
      if (isIncremental && body.raioKm) {
        searchRadius = body.raioKm * 1.5;
        console.log(`Busca incremental: raio expandido de ${body.raioKm}km para ${searchRadius}km`);
      }

      // ============================================
      // BUSCA POR NICHO(S)
      // ============================================
      if (isMultipleNiches) {
        // MÚLTIPLOS NICHOS: Busca paralela para cada nicho
        console.log(`🚀 Iniciando busca paralela para ${nichos.length} nichos...`);
        
        const seenPlaceIds = new Set<string>();
        const allResults: any[] = [];
        
        // Calcula quantidade por nicho (divide igualmente + 20% extra para compensar duplicatas)
        const quantidadePorNicho = Math.ceil((body.quantidade * 1.2) / nichos.length);

        // Busca paralela para todos os nichos
        const searchPromises = nichos.map((nicho: string) => 
          searchSingleNiche(nicho, quantidadePorNicho, location, searchRadius)
            .then(result => ({ nicho, ...result }))
            .catch(error => {
              console.error(`❌ Erro ao buscar nicho "${nicho}":`, error.message);
              return { nicho, results: [], totalFound: 0 };
            })
        );

        const nichosResults = await Promise.all(searchPromises);

        // Combina resultados, removendo duplicatas e marcando o nicho de origem
        for (const { nicho, results } of nichosResults) {
          console.log(`📊 Nicho "${nicho}": ${results.length} resultados`);
          
          for (const result of results) {
            if (!seenPlaceIds.has(result.place_id)) {
              seenPlaceIds.add(result.place_id);
              allResults.push({
                ...result,
                _nicho: nicho // Marca qual nicho encontrou este lead
              });
            }
          }
        }

        console.log(`✅ Total combinado: ${allResults.length} leads únicos de ${nichos.length} nichos`);
        
        totalAvailable = allResults.length;
        leads = body.excludePlaceIds && body.excludePlaceIds.length > 0
          ? allResults // Busca incremental: pega tudo para filtrar
          : allResults.slice(0, body.quantidade);
          
        console.log(`🎯 Total disponível: ${totalAvailable}, entregando: ${leads.length}`);

        if (allResults.length === 0) {
          const noLeadsReason: NoLeadsReason = diagnostics.rawResultsTotal === 0 ? "google_zero" : "all_duplicates";
          return new Response(
            JSON.stringify(buildNoLeadsPayload(noLeadsReason, diagnostics, { searchRunId })),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } else {
        // NICHO ÚNICO: Busca com multi-rodada
        const singleNicho = nichos[0] || body.nicho;
        const nicheVariations = buildNicheVariations(singleNicho);
        diagnostics.fallbackNiches = nicheVariations;
        
        const seenPlaceIds = new Set<string>();
        const allVariationResults: any[] = [];
        let maxRoundsUsed = 1;
        let finalRadiusUsed = searchRadius;
        let anyExhausted = false;

        logStep(searchRunId, "Iniciando busca por variacoes de nicho", {
          nichoOriginal: singleNicho,
          fallbackNiches: nicheVariations,
          focoIgnoradoNaBusca: body.foco,
          location: location ?? null,
          initialRadiusKm: searchRadius,
        });

        for (const variation of nicheVariations) {
          const searchResult = await searchSingleNiche(
            variation,
            Math.max(body.quantidade - allVariationResults.length, body.quantidade),
            location,
            body.proximidadeAtiva ? searchRadius : undefined,
            [...(body.excludePlaceIds || []), ...Array.from(seenPlaceIds)]
          );

          maxRoundsUsed = Math.max(maxRoundsUsed, searchResult.roundsUsed || 1);
          finalRadiusUsed = Math.max(finalRadiusUsed, searchResult.finalRadius || searchRadius);
          anyExhausted = anyExhausted || !!searchResult.exhaustedSource;

          for (const result of searchResult.results) {
            if (!seenPlaceIds.has(result.place_id)) {
              seenPlaceIds.add(result.place_id);
              allVariationResults.push({ ...result, _nicho: variation });
            }
          }

          logStep(searchRunId, "Resultado da variacao de nicho", {
            variation,
            resultsCount: searchResult.results.length,
            totalAcumulado: allVariationResults.length,
          });

          if (allVariationResults.length >= body.quantidade) {
            break;
          }
        }

        totalAvailable = allVariationResults.length;
        exhaustedSource = anyExhausted || allVariationResults.length < body.quantidade;
        searchMetadata = {
          roundsUsed: maxRoundsUsed,
          finalRadius: finalRadiusUsed,
        };

        leads = body.excludePlaceIds && body.excludePlaceIds.length > 0
          ? allVariationResults
          : allVariationResults.slice(0, body.quantidade);

        console.log(`Total disponivel: ${totalAvailable}, entregando: ${leads.length}, esgotado: ${exhaustedSource}`);

        if (allVariationResults.length === 0) {
          const noLeadsReason: NoLeadsReason = diagnostics.rawResultsTotal === 0 ? "google_zero" : "all_duplicates";
          return new Response(
            JSON.stringify(buildNoLeadsPayload(noLeadsReason, diagnostics, { searchRunId })),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    console.log(`Encontrados ${leads.length} leads antes do filtro (total disponível: ${totalAvailable})`);
    
    // Filtra leads que já existem (busca incremental)
    const excludePlaceIds = body.excludePlaceIds || [];
    const originalLeadsCount = leads.length;
    if (excludePlaceIds.length > 0) {
      console.log(`Filtrando ${excludePlaceIds.length} place_ids ja existentes...`);
      leads = leads.filter((lead: any) => !excludePlaceIds.includes(lead.place_id));
      diagnostics.afterDuplicateFilterTotal = leads.length;
      console.log(`Leads apos filtro: ${leads.length} (removidos: ${originalLeadsCount - leads.length})`);

      if (leads.length === 0) {
        return new Response(
          JSON.stringify(buildNoLeadsPayload("all_duplicates", diagnostics, { searchRunId })),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else {
      diagnostics.afterDuplicateFilterTotal = leads.length;
    }
    
    // Calcula quantos leads podem ser processados com o saldo ja validado antes do Google Places
    const leadsAfterFilter = leads.length;
    const maxLeadsToProcess = Math.min(leadsAfterFilter, body.quantidade);
    const limitedByQuota = !isUnlimited && requestedQuantity > allowedQuantity;
    
    logStep(searchRunId, "Quota calculada", {
      isUnlimited,
      isAdminUser,
      leadsAvailableTotal: isUnlimited ? "ilimitado" : leadsAvailableTotal,
      leadsAfterFilter,
      maxLeadsToProcess,
      limitedByQuota,
    });
    
    // Separa leads desbloqueados e bloqueados (para mostrar preview com blur)
    const unlockedLeads = leads.slice(0, maxLeadsToProcess);
    const lockedLeadsPreview = leads.slice(maxLeadsToProcess, maxLeadsToProcess + 5); // Até 5 leads como preview
    
    // Atualiza leads para processar apenas os desbloqueados
    leads = unlockedLeads;
    
    // Calcula leads adicionais disponíveis (incentivo para upgrade)
    const additionalLeadsAvailable = limitedByQuota ? Math.max(0, requestedQuantity - allowedQuantity) : 0;
    const lockedLeadsCount = lockedLeadsPreview.length;
    
    if (additionalLeadsAvailable > 0) {
      console.log(`🎯 ${additionalLeadsAvailable} leads adicionais disponíveis além da cota do usuário!`);
    }

    // Função para analisar o HTML do site e extrair sinais digitais
    async function analyzeSiteHTML(websiteUrl: string) {
      const signals = {
        whatsapp_on_site: false,
        whatsapp_number: null as string | null,
        has_meta_pixel: false,
        has_gtag: false,
        has_gtm: false,
        instagram_url: null as string | null,
        email: null as string | null,
      };

      try {
        console.log(`Analisando site: ${websiteUrl}`);
        const siteResponse = await fetch(websiteUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LeadBot/1.0)',
          },
          redirect: 'follow',
        });

        if (!siteResponse.ok) {
          console.log(`Erro ao acessar site: ${siteResponse.status}`);
          return signals;
        }

        const html = await siteResponse.text();
        
        // =============================================
        // DETECÇÃO APRIMORADA DE WHATSAPP/TELEFONE
        // =============================================
        
        // 1. Padrões de links WhatsApp (mais completos)
        const whatsappLinkPatterns = [
          /wa\.me\/(\+?[0-9]+)/gi,
          /api\.whatsapp\.com\/send\?phone=(\+?[0-9]+)/gi,
          /web\.whatsapp\.com\/send\?phone=(\+?[0-9]+)/gi,
          /whatsapp:\/\/send\?phone=(\+?[0-9]+)/gi,
        ];
        
        for (const pattern of whatsappLinkPatterns) {
          const matches = [...html.matchAll(pattern)];
          for (const match of matches) {
            if (match[1]) {
              const cleanNumber = match[1].replace(/\D/g, '');
              if (cleanNumber.length >= 10) {
                signals.whatsapp_on_site = true;
                signals.whatsapp_number = cleanNumber;
                console.log(`📱 WhatsApp encontrado via link: ${cleanNumber}`);
                break;
              }
            }
          }
          if (signals.whatsapp_on_site) break;
        }

        // 2. Links tel: (telefone que pode ser WhatsApp)
        if (!signals.whatsapp_number) {
          const telPattern = /href\s*=\s*["']tel:(\+?55)?(\d{10,11})["']/gi;
          const telMatches = [...html.matchAll(telPattern)];
          for (const match of telMatches) {
            const number = (match[1] || '') + match[2];
            const cleanNumber = number.replace(/\D/g, '');
            // Prioriza números com 9 (celular = provável WhatsApp)
            if (cleanNumber.length >= 10 && /9\d{8}$/.test(cleanNumber)) {
              signals.whatsapp_number = cleanNumber;
              signals.whatsapp_on_site = true;
              console.log(`📱 Celular encontrado via tel: ${cleanNumber}`);
              break;
            }
          }
        }

        // 3. Números brasileiros em texto (próximos a "whatsapp", "zap", "wpp", "fale conosco")
        if (!signals.whatsapp_number) {
          const contextPatterns = [
            // Palavra-chave seguida de número
            /(?:whatsapp|wpp|whats|zap|fale\s*conosco|atendimento)[^0-9]{0,80}(?:\+?55\s*)?(?:\(?0?([1-9][0-9])\)?\s*)?([9]?\d{4}[-.\s]?\d{4})/gi,
            // Número seguido de palavra-chave
            /(?:\+?55\s*)?(?:\(?0?([1-9][0-9])\)?\s*)?([9]\d{4}[-.\s]?\d{4})[^0-9]{0,30}(?:whatsapp|wpp|whats|zap)/gi,
          ];
          
          for (const pattern of contextPatterns) {
            const matches = [...html.matchAll(pattern)];
            for (const match of matches) {
              const ddd = match[1] || '';
              const number = match[2] || '';
              const fullNumber = (ddd + number).replace(/\D/g, '');
              if (fullNumber.length >= 8 && /9\d{7,8}$/.test(fullNumber)) {
                // Adiciona DDD 11 se não tiver
                signals.whatsapp_number = fullNumber.length <= 9 ? '11' + fullNumber : fullNumber;
                signals.whatsapp_on_site = true;
                console.log(`📱 WhatsApp encontrado via contexto: ${signals.whatsapp_number}`);
                break;
              }
            }
            if (signals.whatsapp_number) break;
          }
        }

        // 4. Números brasileiros gerais no HTML (fallback para celulares)
        if (!signals.whatsapp_number) {
          // Formato: (11) 99999-9999 ou 11999999999 ou +55 11 99999-9999
          const phonePatterns = [
            /\+?55\s*\(?([1-9][0-9])\)?\s*(9\d{4})[-.\s]?(\d{4})/g,
            /\(?([1-9][0-9])\)?\s*(9\d{4})[-.\s]?(\d{4})/g,
          ];
          
          for (const pattern of phonePatterns) {
            const matches = [...html.matchAll(pattern)];
            for (const match of matches) {
              const ddd = match[1];
              const part1 = match[2];
              const part2 = match[3];
              const fullNumber = `${ddd}${part1}${part2}`.replace(/\D/g, '');
              if (fullNumber.length >= 10 && fullNumber.length <= 11) {
                signals.whatsapp_number = fullNumber;
                signals.whatsapp_on_site = true;
                console.log(`📱 Celular encontrado via regex geral: ${fullNumber}`);
                break;
              }
            }
            if (signals.whatsapp_number) break;
          }
        }

        // 5. Detecta se tem WhatsApp no site mesmo sem número extraível
        if (!signals.whatsapp_on_site) {
          if (/whatsapp|wa\.me|api\.whatsapp/i.test(html)) {
            signals.whatsapp_on_site = true;
            console.log(`📱 WhatsApp detectado no site (sem número extraível)`);
          }
        }

        // Detectar Meta Pixel
        if (/fbq\s*\(\s*['"]init['"]/i.test(html) || /facebook\.com\/tr\?id=/i.test(html)) {
          signals.has_meta_pixel = true;
        }

        // Detectar Google Analytics / gtag
        if (/gtag\s*\(\s*['"]config['"]/i.test(html) || /googletagmanager\.com\/gtag\/js/i.test(html)) {
          signals.has_gtag = true;
        }

        // Detectar Google Tag Manager
        if (/GTM-[A-Z0-9]+/i.test(html) || /googletagmanager\.com\/gtm\.js/i.test(html)) {
          signals.has_gtm = true;
        }

        // Detectar Instagram URL
        const instagramMatch = html.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
        if (instagramMatch && !['p', 'reel', 'stories', 'explore'].includes(instagramMatch[1].toLowerCase())) {
          signals.instagram_url = `https://instagram.com/${instagramMatch[1]}`;
        }

        // =============================================
        // DETECÇÃO APRIMORADA DE EMAIL
        // =============================================
        
        // Lista de emails genéricos para ignorar
        const excludeEmailPatterns = /\b(wix|google|facebook|instagram|example|test|noreply|suporte@wix|no-reply|support@|admin@|info@wix|webmaster@|hostmaster@)\b/i;
        
        // 1. Links mailto (mais confiável)
        const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        if (mailtoMatch && !excludeEmailPatterns.test(mailtoMatch[1])) {
          signals.email = mailtoMatch[1].toLowerCase();
          console.log(`📧 Email encontrado via mailto: ${signals.email}`);
        }

        // 2. Emails em texto (regex geral)
        if (!signals.email) {
          const emailPattern = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com\.br|com|net|org|br|io|me|info|co|gov\.br))\b/gi;
          const emailMatches = html.match(emailPattern);
          
          if (emailMatches) {
            // Pega o primeiro email que não seja genérico
            const validEmail = emailMatches.find(e => !excludeEmailPatterns.test(e));
            if (validEmail) {
              signals.email = validEmail.toLowerCase();
              console.log(`📧 Email encontrado via regex: ${signals.email}`);
            }
          }
        }

        // 3. Emails próximos a palavras-chave de contato
        if (!signals.email) {
          const contextPattern = /(?:email|e-mail|contato|contact|fale\s*conosco)[^a-z@]{0,50}([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
          const contextMatches = [...html.matchAll(contextPattern)];
          for (const match of contextMatches) {
            if (match[1] && !excludeEmailPatterns.test(match[1])) {
              signals.email = match[1].toLowerCase();
              console.log(`📧 Email encontrado via contexto: ${signals.email}`);
              break;
            }
          }
        }

        console.log(`Sinais detectados:`, signals);
      } catch (error) {
        console.error(`Erro ao analisar HTML do site ${websiteUrl}:`, error);
      }

      return signals;
    }

    // Função para processar um lead
    // Retorna { leadResult, isNew } onde isNew indica se foi INSERT ou UPDATE
    async function processLead(place: any): Promise<{ leadResult: any; isNew: boolean } | null> {
      try {
        let detailsData: any;

        // Se não estiver usando mock, busca detalhes na API real
        if (GOOGLE_API_KEY) {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,geometry&key=${GOOGLE_API_KEY}`;
          const detailsResponse = await fetch(detailsUrl);
          detailsData = await detailsResponse.json();
          logStep(searchRunId, "Resposta Google Place Details", {
            httpStatus: detailsResponse.status,
            googleStatus: detailsData.status,
            hasResult: !!detailsData.result,
            hasErrorMessage: !!detailsData.error_message,
            errorMessage: detailsData.error_message ?? null,
          });
        } else {
          detailsData = {
            status: "OK",
            result: place
          };
        }
        
        if (detailsData.status === "OK") {
          const details = detailsData.result;
          if (!details?.name) {
            diagnostics.discarded.missingName++;
            logStep(searchRunId, "Lead descartado", {
              reason: "missingName",
              placeId: place.place_id,
            });
            return null;
          }
          
          // Analisa o site se houver website (com timeout)
          let siteSignals = {
            whatsapp_on_site: false,
            whatsapp_number: null as string | null,
            has_meta_pixel: false,
            has_gtag: false,
            has_gtm: false,
            instagram_url: null as string | null,
            email: null as string | null,
          };

          if (details.website) {
            try {
              const signalsPromise = analyzeSiteHTML(details.website);
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 5000)
              );
              siteSignals = await Promise.race([signalsPromise, timeoutPromise]) as typeof siteSignals;
            } catch (error) {
              console.log(`Timeout ou erro ao analisar site ${details.website}`);
            }
          }
          
          // Verifica se user existe
          if (!user) {
            console.error("Usuário não autenticado");
            return null;
          }
          
          // Insere no banco usando a wrapper segura que define a chave de criptografia
          // SECURITY: Encryption key passed as parameter, restricted to service_role
          const { data: rpcResult, error: insertError } = await supabaseAdmin.rpc('set_encryption_key_and_insert_lead', {
            p_encryption_key: encryptionKey,
            p_nome: details.name,
            p_cidade: body.cidade,
            p_digital_signals: siteSignals,
            p_email: siteSignals.email,
            p_endereco: details.formatted_address,
            p_foco: body.foco,
            p_has_gtag: siteSignals.has_gtag,
            p_has_gtm: siteSignals.has_gtm,
            p_has_meta_pixel: siteSignals.has_meta_pixel,
            p_instagram_url: siteSignals.instagram_url,
            p_latitude: details.geometry?.location?.lat || null,
            p_longitude: details.geometry?.location?.lng || null,
            p_nicho: place._nicho || body.nicho,
            p_telefone: details.formatted_phone_number || null,
            p_proximidade_ativa: body.proximidadeAtiva,
            p_raio_km: body.raioKm,
            p_rating: details.rating || null,
            p_total_reviews: details.user_ratings_total || 0,
            p_user_id: user.id,
            p_website: details.website || null,
            p_whatsapp_on_site: siteSignals.whatsapp_on_site,
            p_whatsapp_number: siteSignals.whatsapp_number,
            p_google_place_id: place.place_id,
            p_pais: body.pais || "BR",
            p_search_run_id: searchRunId,
          });

          if (insertError) {
            diagnostics.discarded.insertError++;
            console.error("Erro ao inserir lead:", insertError);
            return null;
          }

          // rpcResult agora contém { id: uuid, is_new: boolean }
          const leadId = rpcResult?.id;
          const isNewLead = rpcResult?.is_new ?? false;
          const leadData = { id: leadId };
          console.log(`✅ Lead ${isNewLead ? 'INSERIDO (novo)' : 'ATUALIZADO (existente)'} com ID: ${leadId}`);

          return { 
            leadResult: {
              nome: details.name,
              endereco: details.formatted_address,
              sinais: siteSignals,
            },
            isNew: isNewLead
          };
        } else {
          diagnostics.discarded.detailsError++;
          logStep(searchRunId, "Lead descartado", {
            reason: "detailsError",
            placeId: place.place_id,
            googleStatus: detailsData.status,
            hasErrorMessage: !!detailsData.error_message,
          });
        }
      } catch (error) {
        console.error("Erro ao processar lead:", error);
      }
      return null;
    }

    // Processa leads em paralelo (máximo 5 por vez para não sobrecarregar)
    const leadsWithAnalysis: { leadResult: any; isNew: boolean }[] = [];
    const batchSize = 5;
    
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      const results = await Promise.all(batch.map((place: any) => processLead(place)));
      leadsWithAnalysis.push(...results.filter(r => r !== null) as any[]);
    }
    
    // Contagem de leads NOVOS vs ATUALIZADOS
    const newLeadsCount = leadsWithAnalysis.filter(item => item.isNew).length;
    const updatedLeadsCount = leadsWithAnalysis.filter(item => !item.isNew).length;
    console.log(`📊 Leads processados: ${newLeadsCount} NOVOS + ${updatedLeadsCount} ATUALIZADOS = ${leadsWithAnalysis.length} total`);

    // Extrai apenas os resultados dos leads para retorno
    const leadsDetails = leadsWithAnalysis.map(item => item.leadResult);

    if (leads.length > 0 && leadsDetails.length === 0) {
      return new Response(
        JSON.stringify(buildNoLeadsPayload("filtered_out", diagnostics, { searchRunId })),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (leadsDetails.length > 0) {
      const { data: incrementOk, error: incrementError } = await supabaseAdmin.rpc("increment_leads_usage", {
        p_user_id: user.id,
        p_amount: leadsDetails.length,
      });

      if (incrementError || incrementOk !== true) {
        logError(searchRunId, "Falha ao descontar uso real de leads", incrementError ?? new Error("increment_leads_usage returned false"), {
          amount: leadsDetails.length,
        });
        return errorResponse(
          corsHeaders,
          402,
          "Você atingiu seu limite de leads este mês.",
          "A busca encontrou leads, mas seu saldo acabou antes da confirmação de uso.",
          "leads_limit_reached",
        );
      }

      logStep(searchRunId, "Uso de leads incrementado apos processamento", {
        amount: leadsDetails.length,
      });
    }

    // Prepara preview dos leads bloqueados (dados básicos apenas, sem processar)
    await upsertSearchLog(supabaseAdmin, {
      search_run_id: searchRunId,
      user_id: user.id,
      city: normalizedCidade,
      state: normalizedEstado,
      country: normalizedPais,
      niche: body.nicho,
      focus: body.foco,
      requested_quantity: requestedQuantity,
      returned_quantity: leadsDetails.length,
      status: "success",
      duration_ms: Date.now() - startedAt,
      diagnostics,
      completed_at: new Date().toISOString(),
      ip_address: req.headers.get("x-forwarded-for"),
      user_agent: req.headers.get("user-agent"),
    });
    await logAppEvent(supabaseAdmin, {
      userId: user.id,
      eventType: "search_completed",
      eventData: {
        searchRunId,
        ...searchContextForCatch,
        returned_quantity: leadsDetails.length,
        newLeadsCount,
        updatedLeadsCount,
      },
      ipAddress: req.headers.get("x-forwarded-for"),
      userAgent: req.headers.get("user-agent"),
    });

    const lockedLeadsData = lockedLeadsPreview.map((place: any) => ({
      id: `locked_${place.place_id}`,
      nome: place.name,
      endereco: place.formatted_address || place.vicinity || '',
      cidade: body.cidade,
      nicho: body.nicho,
      foco: body.foco,
      rating: place.rating || null,
      total_reviews: place.user_ratings_total || 0,
      isLocked: true,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        leadsCount: leadsDetails.length,
        newLeadsCount: newLeadsCount,
        updatedLeadsCount: updatedLeadsCount,
        leads: leadsDetails,
        lockedLeads: lockedLeadsData,
        hasMore: leads.length >= body.quantidade,
        totalAvailable: leadsAfterFilter,
        limitedByQuota,
        additionalLeadsAvailable,
        lockedLeadsCount: additionalLeadsAvailable,
        analysisQueued: false,
        analysisCount: 0,
        // NOVO: search_run_id para identificar esta busca
        searchRunId: searchRunId,
        // Metadados da busca multi-rodada
        exhaustedSource,
        searchMetadata: {
          roundsUsed: searchMetadata.roundsUsed,
          finalRadiusKm: searchMetadata.finalRadius,
          requestedQuantity: body.quantidade,
          foundQuantity: leadsDetails.length,
        },
        // Sugestão para o usuário quando não atingiu a meta
        suggestion: exhaustedSource && leadsDetails.length < body.quantidade
          ? `Encontramos ${leadsDetails.length} de ${body.quantidade} leads. Tente: aumentar o raio, usar múltiplos nichos (ex: "restaurante, pizzaria"), ou testar outra cidade próxima.`
          : null,
        searchDiagnostics: diagnostics,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    logError(searchRunId, "Erro geral na busca de leads", error);
    if (supabaseAdminForCatch && authenticatedUserIdForCatch) {
      await upsertSearchLog(supabaseAdminForCatch, {
        search_run_id: searchRunId,
        user_id: authenticatedUserIdForCatch,
        ...searchContextForCatch,
        status: "error",
        error_message: error?.message || "Erro interno na Edge Function buscar-leads.",
        duration_ms: Date.now() - startedAt,
        completed_at: new Date().toISOString(),
        diagnostics: { error: error?.message || String(error) },
        ip_address: req.headers.get("x-forwarded-for"),
        user_agent: req.headers.get("user-agent"),
      });
      await logAppEvent(supabaseAdminForCatch, {
        userId: authenticatedUserIdForCatch,
        eventType: "search_failed",
        eventData: {
          searchRunId,
          ...searchContextForCatch,
          error: error?.message || String(error),
        },
        ipAddress: req.headers.get("x-forwarded-for"),
        userAgent: req.headers.get("user-agent"),
      });
    }
    return errorResponse(
      corsHeaders,
      500,
      "Erro ao buscar leads",
      error?.message || "Erro interno na Edge Function buscar-leads.",
      "buscar_leads_internal_error",
    );
  }
});
