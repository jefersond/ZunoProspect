import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  digitalSignalsForPersistence,
  emptySiteSignals,
  SITE_HTML_INSPECTION_ENABLED,
  unknownSiteSignals,
} from "./site-inspection.ts";

const buscarLeadsSource = readFileSync(new URL("../buscar-leads/index.ts", import.meta.url), "utf8");

describe("suspensao da inspecao automatica de HTML (mitigacao SSRF)", () => {
  it("esta desligada", () => {
    expect(SITE_HTML_INSPECTION_ENABLED).toBe(false);
  });

  it("sinais nao inspecionados sao desconhecidos (null), nunca false", () => {
    const signals = unknownSiteSignals();
    for (const value of Object.values(signals)) expect(value).toBeNull();
    expect(signals.has_meta_pixel).not.toBe(false);
    expect(signals.whatsapp_on_site).not.toBe(false);
  });

  it("com a inspecao ligada, os padroes continuam booleanos como antes", () => {
    const signals = emptySiteSignals();
    expect(signals.has_meta_pixel).toBe(false);
    expect(signals.whatsapp_on_site).toBe(false);
  });

  it("nao persiste digital_signals quando suspensa, preservando o historico via COALESCE", () => {
    expect(digitalSignalsForPersistence(unknownSiteSignals(), false)).toBeNull();
    const enabled = emptySiteSignals();
    expect(digitalSignalsForPersistence(enabled, true)).toBe(enabled);
  });

  it("buscar-leads so chama analyzeSiteHTML atras da flag", () => {
    const calls = buscarLeadsSource.match(/analyzeSiteHTML\(/g) ?? [];
    // 1 definicao (async function analyzeSiteHTML(...)) + 1 chamada
    expect(calls).toHaveLength(2);
    expect(buscarLeadsSource).toMatch(/if \(SITE_HTML_INSPECTION_ENABLED && details\.website\) \{\s*try \{\s*const signalsPromise = analyzeSiteHTML\(/);
  });

  it("buscar-leads nao faz fetch de website de lead fora da funcao protegida", () => {
    const withoutAnalyzer = buscarLeadsSource.replace(/async function analyzeSiteHTML[\s\S]*?\n {4}\/\/ Função para processar um lead/, "");
    expect(withoutAnalyzer).not.toMatch(/fetch\(\s*(websiteUrl|details\.website|lead\.website)/);
  });

  it("a busca no Google Places e o salvamento do lead continuam presentes", () => {
    expect(buscarLeadsSource).toContain("place/details/json");
    expect(buscarLeadsSource).toContain("set_encryption_key_and_insert_lead");
    expect(buscarLeadsSource).toContain("p_telefone: details.formatted_phone_number");
    expect(buscarLeadsSource).toContain("p_website: details.website");
    expect(buscarLeadsSource).toContain("p_endereco: details.formatted_address");
  });
});
