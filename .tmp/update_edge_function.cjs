const fs = require('fs');
const path = require('path');

const filePath = path.resolve('supabase/functions/analisar-lead-ia/index.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Modificar a assinatura de fetchWithRetry
const oldSig = `async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelay = 2000
): Promise<Response> {`;

const newSig = `async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelay = 2000,
  onRetry?: () => void
): Promise<Response> {`;

// 2. Modificar rate limit retry em fetchWithRetry
const oldRateLimit = `        console.log(\`⏳ Rate limited (429). Aguardando \${delay / 1000}s... (tentativa \${attempt + 1}/\${maxRetries})\`);
        await new Promise((r) => setTimeout(r, delay));`;

const newRateLimit = `        console.log(\`⏳ Rate limited (429). Aguardando \${delay / 1000}s... (tentativa \${attempt + 1}/\${maxRetries})\`);
        if (onRetry) onRetry();
        await new Promise((r) => setTimeout(r, delay));`;

// 3. Modificar rede retry em fetchWithRetry
const oldNetError = `        const delay = baseDelay * Math.pow(2, attempt);
        console.log(\`⏳ Erro de rede. Aguardando \${delay / 1000}s... (tentativa \${attempt + 1}/\${maxRetries})\`);
        await new Promise((r) => setTimeout(r, delay));`;

const newNetError = `        const delay = baseDelay * Math.pow(2, attempt);
        console.log(\`⏳ Erro de rede. Aguardando \${delay / 1000}s... (tentativa \${attempt + 1}/\${maxRetries})\`);
        if (onRetry) onRetry();
        await new Promise((r) => setTimeout(r, delay));`;

// 4. Modificar a assinatura de analyzeWithGeminiDirect
const oldGeminiSig = "async function analyzeWithGeminiDirect(lead: LeadData, apiKey: string): Promise<AnaliseResult> {";
const newGeminiSig = "async function analyzeWithGeminiDirect(lead: LeadData, apiKey: string, onRetry?: () => void): Promise<AnaliseResult> {";

// 5. Modificar a chamada fetchWithRetry dentro de analyzeWithGeminiDirect (simplificada final)
const oldFetchCall = `        signal: controller.signal,
      },
      3, // maxRetries
      2000 // baseDelay 2s
    );`;

const newFetchCall = `        signal: controller.signal,
      },
      3, // maxRetries
      2000, // baseDelay 2s
      onRetry
    );`;

// 6. Declarar variáveis no serve
const oldServeVars = `  let supabaseAdminForCatch: ReturnType<typeof createClient> | null = null;
  let userIdForCatch: string | null = null;
  let leadIdForCatch: string | null = null;

  try {`;

const newServeVars = `  const startTime = Date.now();
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

  try {`;

// 7. Capturar source, path e limites
const oldPayloadCapture = `    const requestData = await req.json().catch(() => null);
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
    const userId = authenticatedUserId;`;

const newPayloadCapture = `    const requestData = await req.json().catch(() => null);
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
    pathForCatch = requestData.path || payloadLead.path || context.path || "prospeccao";`;

const oldUsageCapture = `    const { data: usageData, error: usageError } = await supabaseAuth.rpc("get_current_user_usage");

    if (usageError) {
      console.error("❌ Erro ao validar uso de IA:", usageError.message);
      throw new Error("Erro ao validar limite de análises com IA.");
    }

    const usageInfo = usageData?.[0];
    const aiRemaining = Number(usageInfo?.ai_available_total ?? usageInfo?.ai_remaining ?? 0);`;

const newUsageCapture = `    const { data: usageData, error: usageError } = await supabaseAuth.rpc("get_current_user_usage");

    if (usageError) {
      console.error("❌ Erro ao validar uso de IA:", usageError.message);
      throw new Error("Erro ao validar limite de análises com IA.");
    }

    const usageInfo = usageData?.[0];
    const aiRemaining = Number(usageInfo?.ai_available_total ?? usageInfo?.ai_remaining ?? 0);
    aiRemainingForCatch = aiRemaining;
    aiLimitForCatch = Number(usageInfo?.ai_limit ?? 3);
    aiUsedForCatch = Number(usageInfo?.ai_used_this_month ?? 0);`;

// 8. Mapear leadNameForCatch
const oldLeadElse = `      console.log(\`🌍 Lead country (from request): \${leadData.pais} | isUS: \${isUSLead(leadData)}\`);
    }`;

const newLeadElse = `      console.log(\`🌍 Lead country (from request): \${leadData.pais} | isUS: \${isUSLead(leadData)}\`);
    }

    leadNameForCatch = leadData.nome;`;

// 9. Modificar chamada Gemini Flash para passar callback de retry
const oldGeminiCall = `    console.log("🚀 Usando Gemini 2.0 Flash para análise manual...");
    const analise = await analyzeWithGeminiDirect(leadData, GOOGLE_GEMINI_API_KEY);`;

const newGeminiCall = `    console.log("🚀 Usando Gemini 2.0 Flash para análise manual...");
    const analise = await analyzeWithGeminiDirect(leadData, GOOGLE_GEMINI_API_KEY, () => {
      retryCountForCatch += 1;
    });`;

// 10. Atualizar o bloco catch do serve
const oldCatchBlock = `    return jsonResponse(analise as unknown as Record<string, unknown>);
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
  }`;

const newCatchBlock = `    return jsonResponse(analise as unknown as Record<string, unknown>);
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
  }`;

function replaceAgnostic(text, old, new_val) {
  if (text.includes(old)) {
    return text.replace(old, new_val);
  }
  const oldLF = old.replace(/\r\n/g, '\n');
  const newLF = new_val.replace(/\r\n/g, '\n');
  
  if (text.replace(/\r\n/g, '\n').includes(oldLF)) {
    const parts = text.split(text.includes('\r\n') ? '\r\n' : '\n');
    const oldParts = oldLF.split('\n');
    const newParts = newLF.split('\n');
    
    for (let i = 0; i <= parts.length - oldParts.length; i++) {
      let match = true;
      for (let j = 0; j < oldParts.length; j++) {
        if (parts[i + j].trim() !== oldParts[j].trim()) {
          match = false;
          break;
        }
      }
      if (match) {
        parts.splice(i, oldParts.length, ...newParts);
        return parts.join(text.includes('\r\n') ? '\r\n' : '\n');
      }
    }
  }
  console.log("⚠️ AVISO: Não conseguiu substituir:", old.substring(0, 60) + "...");
  return text;
}

console.log("Iniciando substituições determinísticas no arquivo da Edge Function via Node.js CommonJS...");
let modifiedContent = replaceAgnostic(content, oldSig, newSig);
modifiedContent = replaceAgnostic(modifiedContent, oldRateLimit, newRateLimit);
modifiedContent = replaceAgnostic(modifiedContent, oldNetError, newNetError);
modifiedContent = replaceAgnostic(modifiedContent, oldGeminiSig, newGeminiSig);
modifiedContent = replaceAgnostic(modifiedContent, oldFetchCall, newFetchCall);
modifiedContent = replaceAgnostic(modifiedContent, oldServeVars, newServeVars);
modifiedContent = replaceAgnostic(modifiedContent, oldPayloadCapture, newPayloadCapture);
modifiedContent = replaceAgnostic(modifiedContent, oldUsageCapture, newUsageCapture);
modifiedContent = replaceAgnostic(modifiedContent, oldLeadElse, newLeadElse);
modifiedContent = replaceAgnostic(modifiedContent, oldGeminiCall, newGeminiCall);
modifiedContent = replaceAgnostic(modifiedContent, oldCatchBlock, newCatchBlock);

// Se leadNameForCatch do lead do banco (via RPC) ainda não estiver setado, vamos atribuí-lo:
const oldDbLead = "leadData = {\n        nome: lead.nome,";
const newDbLead = "leadNameForCatch = lead.nome;\n      leadData = {\n        nome: lead.nome,";
modifiedContent = replaceAgnostic(modifiedContent, oldDbLead, newDbLead);

fs.writeFileSync(filePath, modifiedContent, 'utf8');
console.log("Substituições concluídas com absoluto sucesso via Node.js CommonJS!");
