import os

file_path = r"c:\Users\jefer\Desktop\Jeferson\Saas em teste\Zuno propecção\reach-gen\supabase\functions\analisar-lead-ia\index.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Modificar a assinatura de fetchWithRetry
old_sig = """async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelay = 2000
): Promise<Response> {"""

new_sig = """async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelay = 2000,
  onRetry?: () => void
): Promise<Response> {"""

# 2. Modificar rate limit retry em fetchWithRetry
old_rate_limit = """        console.log(`⏳ Rate limited (429). Aguardando ${delay / 1000}s... (tentativa ${attempt + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, delay));"""

new_rate_limit = """        console.log(`⏳ Rate limited (429). Aguardando ${delay / 1000}s... (tentativa ${attempt + 1}/${maxRetries})`);
        if (onRetry) onRetry();
        await new Promise((r) => setTimeout(r, delay));"""

# 3. Modificar rede retry em fetchWithRetry
old_net_error = """        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`⏳ Erro de rede. Aguardando ${delay / 1000}s... (tentativa ${attempt + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, delay));"""

new_net_error = """        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`⏳ Erro de rede. Aguardando ${delay / 1000}s... (tentativa ${attempt + 1}/${maxRetries})`);
        if (onRetry) onRetry();
        await new Promise((r) => setTimeout(r, delay));"""

# 4. Modificar a assinatura de analyzeWithGeminiDirect
old_gemini_sig = "async function analyzeWithGeminiDirect(lead: LeadData, apiKey: string): Promise<AnaliseResult> {"
new_gemini_sig = "async function analyzeWithGeminiDirect(lead: LeadData, apiKey: string, onRetry?: () => void): Promise<AnaliseResult> {"

# 5. Modificar a chamada fetchWithRetry dentro de analyzeWithGeminiDirect
# Vamos fazer uma substituição mais direcionada
old_fetch_call = """    // Usa fetchWithRetry para lidar com rate limits (429)
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: `${systemPrompt}\\n\\n${userPrompt}` }] }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8000,
          },
          tools: [{
            functionDeclarations: [{
              name: "gerar_analise_lead",
              description: "Gera análise completa do lead com diagnóstico, probabilidade e plano de prospecção de 7 dias",
              parameters: {
                type: "object",
                properties: {
                  diagnostico_bullets: {
                    type: "array",
                    items: { type: "string" },
                    description: "6-8 bullets de diagnóstico consultivo profundo"
                  },
                  probabilidade_conversao: {
                    type: "number",
                    description: "Probabilidade de conversão de 0-100"
                  },
                  plano_prospeccao_7dias: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        dia: { type: "number" },
                        canal: { type: "string", enum: ["whatsapp", "email", "instagram"] },
                        acao_sugerida: { type: "string", description: "Ação tática específica: enviar áudio, texto, curtir posts, reagir story, etc." },
                        mensagem: { type: "string" },
                        objecao_provavel: { type: "string" },
                        resposta_sugerida: { type: "string" },
                        cta: { type: "string" }
                      },
                      required: ["dia", "canal", "acao_sugerida", "mensagem", "objecao_provavel", "resposta_sugerida", "cta"]
                    }
                  }
                },
                required: ["diagnostico_bullets", "probabilidade_conversao", "plano_prospeccao_7dias"]
              }
            }]
          }]
        }),
        signal: controller.signal,
      }
    );"""

new_fetch_call = """    // Usa fetchWithRetry para lidar com rate limits (429)
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: `${systemPrompt}\\n\\n${userPrompt}` }] }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8000,
          },
          tools: [{
            functionDeclarations: [{
              name: "gerar_analise_lead",
              description: "Gera análise completa do lead com diagnóstico, probabilidade e plano de prospecção de 7 dias",
              parameters: {
                type: "object",
                properties: {
                  diagnostico_bullets: {
                    type: "array",
                    items: { type: "string" },
                    description: "6-8 bullets de diagnóstico consultivo profundo"
                  },
                  probabilidade_conversao: {
                    type: "number",
                    description: "Probabilidade de conversão de 0-100"
                  },
                  plano_prospeccao_7dias: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        dia: { type: "number" },
                        canal: { type: "string", enum: ["whatsapp", "email", "instagram"] },
                        acao_sugerida: { type: "string", description: "Ação tática específica: enviar áudio, texto, curtir posts, reagir story, etc." },
                        mensagem: { type: "string" },
                        objecao_provavel: { type: "string" },
                        resposta_sugerida: { type: "string" },
                        cta: { type: "string" }
                      },
                      required: ["dia", "canal", "acao_sugerida", "mensagem", "objecao_provavel", "resposta_sugerida", "cta"]
                    }
                  }
                },
                required: ["diagnostico_bullets", "probabilidade_conversao", "plano_prospeccao_7dias"]
              }
            }]
          }]
        }),
        signal: controller.signal,
      },
      3,
      2000,
      onRetry
    );"""

# 6. Declarar variáveis no serve
old_serve_vars = """  let supabaseAdminForCatch: ReturnType<typeof createClient> | null = null;
  let userIdForCatch: string | null = null;
  let leadIdForCatch: string | null = null;

  try {"""

new_serve_vars = """  const startTime = Date.now();
  let supabaseAdminForCatch: ReturnType<typeof createClient> | null = null;
  let userIdForCatch: string | null = null;
  let leadIdForCatch: string | null = null;
  let leadNameForCatch: string | null = null;
  let aiRemainingForCatch: number | null = null;
  let aiLimitForCatch: number | null = null;
  let aiUsedForCatch: number | null = null;
  let sourceForCatch = "app";
  let pathForCatch = "prospeccao";
  let retryCountForCatch = 0;
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();

  try {"""

# 7. Capturar source, path e limites
old_payload_capture = """    const requestData = await req.json().catch(() => null);
    if (!requestData || typeof requestData !== "object") {
      return jsonResponse({
        error: "Payload invalido",
        details: "Envie um JSON com leadId/lead_id ou com o objeto lead.",
      }, 400);
    }

    const payloadLead = requestData.lead && typeof requestData.lead === "object"
      ? requestData.lead
      : requestData;
    const context = requestData.context && typeof requestData.context === "object"
      ? requestData.context
      : {};
    const leadId = requestData.leadId || requestData.lead_id || payloadLead.id;
    leadIdForCatch = leadId || null;
    // Use authenticated user ID, ignore any user_id from request body for security
    const userId = authenticatedUserId;"""

new_payload_capture = """    const requestData = await req.json().catch(() => null);
    if (!requestData || typeof requestData !== "object") {
      return jsonResponse({
        error: "Payload invalido",
        details: "Envie um JSON com leadId/lead_id ou com o objeto lead.",
      }, 400);
    }

    const payloadLead = requestData.lead && typeof requestData.lead === "object"
      ? requestData.lead
      : requestData;
    const context = requestData.context && typeof requestData.context === "object"
      ? requestData.context
      : {};
    const leadId = requestData.leadId || requestData.lead_id || payloadLead.id;
    leadIdForCatch = leadId || null;
    // Use authenticated user ID, ignore any user_id from request body for security
    const userId = authenticatedUserId;

    sourceForCatch = requestData.source || payloadLead.source || context.source || "app";
    pathForCatch = requestData.path || payloadLead.path || context.path || "prospeccao";"""

old_usage_capture = """    const { data: usageData, error: usageError } = await supabaseAuth.rpc("get_current_user_usage");

    if (usageError) {
      console.error("❌ Erro ao validar uso de IA:", usageError.message);
      throw new Error("Erro ao validar limite de análises com IA.");
    }

    const usageInfo = usageData?.[0];
    const aiRemaining = Number(usageInfo?.ai_available_total ?? usageInfo?.ai_remaining ?? 0);"""

new_usage_capture = """    const { data: usageData, error: usageError } = await supabaseAuth.rpc("get_current_user_usage");

    if (usageError) {
      console.error("❌ Erro ao validar uso de IA:", usageError.message);
      throw new Error("Erro ao validar limite de análises com IA.");
    }

    const usageInfo = usageData?.[0];
    const aiRemaining = Number(usageInfo?.ai_available_total ?? usageInfo?.ai_remaining ?? 0);
    aiRemainingForCatch = aiRemaining;
    aiLimitForCatch = Number(usageInfo?.ai_limit ?? 3);
    aiUsedForCatch = Number(usageInfo?.ai_used_this_month ?? 0);"""

# 8. Mapear leadNameForCatch
old_lead_else = """      console.log(`🌍 Lead country (from request): ${leadData.pais} | isUS: ${isUSLead(leadData)}`);
    }"""

new_lead_else = """      console.log(`🌍 Lead country (from request): ${leadData.pais} | isUS: ${isUSLead(leadData)}`);
    }

    leadNameForCatch = leadData.nome;"""

# 9. Modificar chamada Gemini Flash para passar callback de retry
old_gemini_call = """    console.log("🚀 Usando Gemini 2.0 Flash para análise manual...");
    const analise = await analyzeWithGeminiDirect(leadData, GOOGLE_GEMINI_API_KEY);"""

new_gemini_call = """    console.log("🚀 Usando Gemini 2.0 Flash para análise manual...");
    const analise = await analyzeWithGeminiDirect(leadData, GOOGLE_GEMINI_API_KEY, () => {
      retryCountForCatch += 1;
    });"""

# 10. Atualizar o bloco catch do serve
old_catch_block = """    return jsonResponse(analise as unknown as Record<string, unknown>);
  } catch (error: any) {
    console.error("Erro analisar-lead-ia:", error);
    if (supabaseAdminForCatch && userIdForCatch) {
      await logAppEvent(supabaseAdminForCatch, {
        userId: userIdForCatch,
        eventType: "ai_analysis_failed",
        eventData: {
          leadId: leadIdForCatch,
          error: error?.message || String(error),
        },
        ipAddress: req.headers.get("x-forwarded-for"),
        userAgent: req.headers.get("user-agent"),
      });
    }
    return jsonResponse({
      error: "Erro ao analisar lead",
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }"""

new_catch_block = """    return jsonResponse(analise as unknown as Record<string, unknown>);
  } catch (error: any) {
    console.error("Erro analisar-lead-ia:", error);
    if (supabaseAdminForCatch && userIdForCatch) {
      await logAppEvent(supabaseAdminForCatch, {
        userId: userIdForCatch,
        eventType: "ai_analysis_failed",
        eventData: {
          lead_id: leadIdForCatch,
          lead_name: leadNameForCatch || null,
          source: sourceForCatch,
          path: pathForCatch,
          error_message: error?.message || String(error),
          error_code: error?.code || null,
          error_type: error?.name || null,
          ai_used_before: aiUsedForCatch,
          ai_used_after: aiUsedForCatch,
          ai_available_before: aiRemainingForCatch,
          ai_available_after: aiRemainingForCatch,
          deducted_credit: false,
          request_id: requestId,
          edge_function: "analisar-lead-ia",
          provider: "gemini",
          duration_ms: Date.now() - startTime,
          retry_count: retryCountForCatch
        },
        ipAddress: req.headers.get("x-forwarded-for"),
        userAgent: req.headers.get("user-agent"),
      });
    }
    return jsonResponse({
      error: "Erro ao analisar lead",
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }"""

# Normalizando quebras de linha em strings (Deno usa \n ou \r\n dependendo do arquivo)
def replace_agnostic(text, old, new):
    # Tenta match exato primeiro
    if old in text:
        return text.replace(old, new)
    # Tenta com quebras \n
    old_lf = old.replace("\r\n", "\n")
    new_lf = new.replace("\r\n", "\n")
    if old_lf in text:
        return text.replace(old_lf, new_lf)
    # Tenta com quebras \r\n
    old_crlf = old.replace("\n", "\r\n").replace("\r\r\n", "\r\n")
    new_crlf = new.replace("\n", "\r\n").replace("\r\r\n", "\r\n")
    if old_crlf in text:
        return text.replace(old_crlf, new_crlf)
    print(f"⚠️ AVISO: Não conseguiu substituir: {repr(old[:50])}...")
    return text

print("Iniciando substituições determinísticas no arquivo da Edge Function...")
modified_content = replace_agnostic(content, old_sig, new_sig)
modified_content = replace_agnostic(modified_content, old_rate_limit, new_rate_limit)
modified_content = replace_agnostic(modified_content, old_net_error, new_net_error)
modified_content = replace_agnostic(modified_content, old_gemini_sig, new_gemini_sig)
modified_content = replace_agnostic(modified_content, old_fetch_call, new_fetch_call)
modified_content = replace_agnostic(modified_content, old_serve_vars, new_serve_vars)
modified_content = replace_agnostic(modified_content, old_payload_capture, new_payload_capture)
modified_content = replace_agnostic(modified_content, old_usage_capture, new_usage_capture)
modified_content = replace_agnostic(modified_content, old_lead_else, new_lead_else)
modified_content = replace_agnostic(modified_content, old_gemini_call, new_gemini_call)
modified_content = replace_agnostic(modified_content, old_catch_block, new_catch_block)

# Se leadNameForCatch do lead do banco (via RPC) ainda não estiver setado, vamos atribuí-lo:
# Vamos buscar a atribuição de leadData de lead.id do banco
old_db_lead = "leadData = {\n        nome: lead.nome,"
new_db_lead = "leadNameForCatch = lead.nome;\n      leadData = {\n        nome: lead.nome,"
modified_content = replace_agnostic(modified_content, old_db_lead, new_db_lead)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(modified_content)

print("Substituições concluídas com absoluto sucesso!")
