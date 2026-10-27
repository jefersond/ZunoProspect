// Validador do contrato HTTP de generateContent, baseado no documento de descoberta oficial (fixture versionada).
// Serve para os testes recusarem um corpo que a API recusaria, em vez de aceitar qualquer JSON.
import contract from "./fixtures/gemini-v1beta-contract.json";

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => Boolean(v) && typeof v === "object" && !Array.isArray(v);

export const GEMINI_CONTRACT_REVISION: string = contract.revision;

function checkSchema(schema: unknown, path: string, errors: string[]) {
  if (!isObj(schema)) return;
  const allowed = new Set(contract.supportedJsonSchemaKeywords);
  for (const key of Object.keys(schema)) {
    if (!allowed.has(key)) errors.push(`${path}: palavra-chave de schema não suportada "${key}"`);
  }
  if (Array.isArray(schema.type)) errors.push(`${path}: "type" como lista não é usado; prefira tipo único`);
  if (isObj(schema.properties)) {
    for (const [name, sub] of Object.entries(schema.properties)) checkSchema(sub, `${path}.properties.${name}`, errors);
    if (Array.isArray(schema.required)) {
      for (const req of schema.required) if (!(req in schema.properties)) errors.push(`${path}: required "${String(req)}" não existe em properties`);
    }
  }
  if (isObj(schema.items)) checkSchema(schema.items, `${path}.items`, errors);
}

/** Lista de violações do contrato (vazia = a API aceitaria a estrutura). */
export function validateGenerateContentBody(body: unknown): string[] {
  const errors: string[] = [];
  if (!isObj(body)) return ["corpo não é um objeto"];

  const topAllowed = new Set(contract.generateContentRequestFields);
  for (const key of Object.keys(body)) if (!topAllowed.has(key)) errors.push(`Unknown name "${key}": Cannot find field.`);
  if (!Array.isArray(body.contents) || !body.contents.length) errors.push('"contents" é obrigatório');

  const gc = body.generationConfig;
  if (gc === undefined) return errors;
  if (!isObj(gc)) return [...errors, "generationConfig deve ser objeto"];

  const gcFields = contract.generationConfigFields as Record<string, { deprecated: boolean }>;
  for (const key of Object.keys(gc)) {
    if (!(key in gcFields)) errors.push(`generation_config: Unknown name "${key}": Cannot find field.`);
  }
  if ("responseSchema" in gc || "responseMimeType" in gc) {
    errors.push("generation_config: responseSchema/responseMimeType estão obsoletos; use responseFormat");
  }

  if (gc.maxOutputTokens !== undefined && !Number.isInteger(gc.maxOutputTokens)) errors.push("maxOutputTokens deve ser inteiro");

  if (gc.thinkingConfig !== undefined) {
    const tc = gc.thinkingConfig;
    if (!isObj(tc)) errors.push("thinkingConfig deve ser objeto");
    else {
      for (const key of Object.keys(tc)) if (!contract.thinkingConfig.fields.includes(key)) errors.push(`thinking_config: Unknown name "${key}"`);
      if (tc.thinkingLevel !== undefined && !contract.thinkingConfig.thinkingLevelEnum.includes(String(tc.thinkingLevel))) {
        errors.push(`thinking_config.thinking_level: valor inválido "${String(tc.thinkingLevel)}" (aceitos: ${contract.thinkingConfig.thinkingLevelEnum.join(", ")})`);
      }
    }
  }

  if (gc.responseFormat !== undefined) {
    const rf = gc.responseFormat;
    if (!isObj(rf)) errors.push("responseFormat deve ser objeto");
    else {
      for (const key of Object.keys(rf)) if (!contract.responseFormatConfigFields.includes(key)) errors.push(`response_format: Unknown name "${key}"`);
      const text = rf.text;
      if (text !== undefined) {
        if (!isObj(text)) errors.push("responseFormat.text deve ser objeto");
        else {
          for (const key of Object.keys(text)) if (!contract.textResponseFormat.fields.includes(key)) errors.push(`response_format.text: Unknown name "${key}"`);
          if (text.mimeType !== undefined && !contract.textResponseFormat.mimeTypeEnum.includes(String(text.mimeType))) {
            errors.push(`response_format.text.mime_type: Invalid value "${String(text.mimeType)}" (aceitos: ${contract.textResponseFormat.mimeTypeEnum.join(", ")})`);
          }
          if (text.schema !== undefined) {
            if (text.mimeType !== "APPLICATION_JSON") errors.push("response_format.text.schema só se aplica com mime_type APPLICATION_JSON");
            checkSchema(text.schema, "schema", errors);
          }
        }
      }
    }
  }
  return errors;
}

export interface FakeGeminiOptions {
  /** Respostas por tentativa (na ordem); a última se repete. Função recebe o modelo da URL. */
  script: Array<
    | { status: 200; text?: string | null; finishReason?: string; usage?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number }; thoughtText?: string }
    | { status: number }
    | { throws: "network" | "timeout" }
  >;
}

/** fetch falso que valida o corpo contra o contrato oficial e devolve 400 INVALID_ARGUMENT como a API faria. */
export function createFakeGeminiFetch(options: FakeGeminiOptions) {
  const calls: Array<{ url: string; model: string; body: unknown; contractErrors: string[] }> = [];
  const fetchFn = async (url: string, init: { body: string; signal?: AbortSignal }) => {
    const body = JSON.parse(init.body);
    const contractErrors = validateGenerateContentBody(body);
    const model = /models\/([^:]+):generateContent/.exec(url)?.[1] ?? "?";
    calls.push({ url, model, body, contractErrors });

    if (contractErrors.length) {
      return { ok: false, status: 400, json: async () => ({ error: { code: 400, status: "INVALID_ARGUMENT", message: contractErrors.join("; ") } }) };
    }
    const step = options.script[Math.min(calls.length - 1, options.script.length - 1)];
    if ("throws" in step) {
      if (step.throws === "timeout") throw Object.assign(new Error("aborted"), { name: "AbortError" });
      throw new TypeError("fetch failed");
    }
    if (step.status !== 200) return { ok: false, status: step.status, json: async () => ({ error: { code: step.status } }) };
    const s = step as Extract<FakeGeminiOptions["script"][number], { status: 200 }>;
    const parts: Array<{ text: string; thought?: boolean }> = [];
    if (s.thoughtText) parts.push({ text: s.thoughtText, thought: true });
    if (s.text) parts.push({ text: s.text });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ finishReason: s.finishReason ?? "STOP", content: { parts } }],
        usageMetadata: s.usage ?? { promptTokenCount: 1500, candidatesTokenCount: 1400, thoughtsTokenCount: 600, totalTokenCount: 3500 },
      }),
    };
  };
  return { fetchFn, calls };
}
