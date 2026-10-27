if (!process.env.VITE_SUPABASE_URL) process.env.VITE_SUPABASE_URL = "https://mock.supabase.co";
if (!process.env.VITE_SUPABASE_PUBLISHABLE_KEY) process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "mock-anon-key";

import { describe, expect, it } from "vitest";
import {
  buildAlignmentCompatibility,
  dayHasMessage,
  extractEmailSubjectAndBody,
  getRecommendedDay,
  getSavedPlanDays,
  getSdrMessageFromPlan,
  hasExplicitOptOut,
  isColdSequenceObsolete,
  resolveDayType,
  resolveLeadHistoryStage,
} from "./intelligentSevenDayPlan";
import { generateSdrFirstApproachMessage } from "./sdrProspectingService";
import { makeGeminiPlanDays, makeLegacyLead, makeNewLead } from "@/test/leadFixtures";
import type { LeadProspeccao } from "@/types/lead";

describe("plano salvo é a única fonte do SDR", () => {
  it("IDENTIDADE para os 7 dias: texto do plano === texto do SDR; dia sem mensagem não carrega texto", () => {
    const lead = makeNewLead();
    for (const day of lead.plano_prospecao_7dias) {
      const sdr = getSdrMessageFromPlan(lead, day.dia);
      const viaService = generateSdrFirstApproachMessage({ lead, dayNumber: day.dia });
      if (dayHasMessage(day)) {
        expect(sdr.text).toBe(day.mensagem);
        expect(viaService.text).toBe(day.mensagem);
        expect(viaService.isFromPlan).toBe(true);
      } else {
        expect(sdr.text).toBe("");
        expect(sdr.hasMessage).toBe(false);
        expect(viaService.text).toBe("");
      }
      expect(sdr.dayNumber).toBe(day.dia);
    }
  });

  it("lead antigo mantém todas as mensagens salvas, idênticas ao plano", () => {
    const lead = makeLegacyLead();
    for (const day of lead.plano_prospecao_7dias) {
      expect(getSdrMessageFromPlan(lead, day.dia).text).toBe(day.mensagem);
    }
  });

  it("ler o plano não altera nem regenera nada (mesma referência de dados, sem efeito colateral)", () => {
    const lead = makeNewLead();
    const before = JSON.stringify(lead.plano_prospecao_7dias);
    getSdrMessageFromPlan(lead, 1);
    getSavedPlanDays(lead);
    generateSdrFirstApproachMessage({ lead, dayNumber: 4 });
    expect(JSON.stringify(lead.plano_prospecao_7dias)).toBe(before);
  });

  it("e-mail: assunto separado do corpo, e plano legado com 'Assunto:' no texto é separado sem mexer no corpo", () => {
    const lead = {
      ...makeNewLead(),
      plano_prospecao_7dias: [
        { dia: 1, canal: "email", tipo_dia: "mensagem", assunto_email: "Sites para oficinas", mensagem: "Olá! Corpo do e-mail.", acao_sugerida: "", objecao_provavel: "", resposta_sugerida: "", cta: "" },
        { dia: 2, canal: "email", mensagem: "Assunto: Antigo\n\nCorpo antigo.", acao_sugerida: "", objecao_provavel: "", resposta_sugerida: "", cta: "" },
      ],
    } as unknown as LeadProspeccao;
    expect(getSdrMessageFromPlan(lead, 1)).toMatchObject({ assuntoEmail: "Sites para oficinas", text: "Olá! Corpo do e-mail." });
    expect(getSdrMessageFromPlan(lead, 2)).toMatchObject({ assuntoEmail: "Antigo", text: "Corpo antigo." });
    expect(extractEmailSubjectAndBody("Sem assunto aqui").subject).toBe("");
  });

  it("lead sem plano: sem dias, sem mensagem, sem dia recomendado", () => {
    const lead = { ...makeNewLead(), plano_prospecao_7dias: [] } as LeadProspeccao;
    expect(getSavedPlanDays(lead)).toEqual([]);
    expect(getSdrMessageFromPlan(lead, 1)).toMatchObject({ text: "", hasMessage: false, totalDays: 0 });
    expect(getRecommendedDay([])).toBeNull();
  });

  it("opt-out/recusa bloqueia qualquer texto, mesmo salvo no plano", () => {
    const lead = { ...makeNewLead(), status: "recusou_optout" } as LeadProspeccao;
    expect(hasExplicitOptOut(lead)).toBe(true);
    expect(getSdrMessageFromPlan(lead, 1)).toMatchObject({ text: "", isOptedOut: true, hasMessage: false });
    const byNotes = { ...makeNewLead(), notas: "Cliente pediu para não contatar" } as LeadProspeccao;
    expect(getSdrMessageFromPlan(byNotes, 1).text).toBe("");
  });

  it("dia recomendado é o primeiro não concluído", () => {
    const days = makeGeminiPlanDays().map((d) => (d.dia === 1 ? { ...d, status_dia: "concluido" as const } : d));
    expect(getRecommendedDay(days)).toBe(2);
  });
});

describe("tipos de dia e estágio do histórico", () => {
  it("dias antigos sem tipo_dia: texto vira mensagem, vazio vira sem mensagem", () => {
    expect(resolveDayType({ mensagem: "Oi" })).toBe("mensagem");
    expect(resolveDayType({ mensagem: "  " })).toBe("sem_mensagem");
    expect(resolveDayType({ tipo_dia: "tarefa", mensagem: "" })).toBe("tarefa");
  });

  it("empresa que respondeu: a sequência fria deixa de valer", () => {
    expect(resolveLeadHistoryStage({ status: "respondeu" })).toBe("empresa_respondeu");
    expect(isColdSequenceObsolete("empresa_respondeu")).toBe(true);
    expect(isColdSequenceObsolete("empresa_interessada")).toBe(true);
    expect(isColdSequenceObsolete("nao_contatado")).toBe(false);
    expect(isColdSequenceObsolete("contato_iniciado_sem_resposta")).toBe(false);
  });
});

describe("alinhamento cadastral (sem inspeção de HTML, sem percentual)", () => {
  it("não usa Pixel/GTM/WhatsApp-do-site mesmo que os campos venham preenchidos", () => {
    const lead = { ...makeNewLead(), website: "https://x.com.br", sinais: { has_whatsapp_on_site: true, has_meta_pixel: true, has_gtag: true, has_gtm: true } } as LeadProspeccao;
    const compat = buildAlignmentCompatibility(lead);
    const text = JSON.stringify(compat).toLowerCase();
    expect(text).not.toMatch(/pixel|gtm|gtag|rastreamento|varredura/);
    expect(compat.score).toBeNull();
    expect(compat.criteria.find((c) => c.label === "Endereço web cadastrado")?.detail).toContain("funcionamento não verificado");
  });

  it("telefone fixo é descrito como tal, e dados insuficientes não viram nota", () => {
    const fixo = buildAlignmentCompatibility({ ...makeNewLead(), telefone: "2733221100" } as LeadProspeccao);
    expect(fixo.criteria[0].detail).toContain("telefone fixo");
    const vazio = buildAlignmentCompatibility({ nome: "X" } as LeadProspeccao);
    expect(vazio.level).toBe("nao_determinada");
  });
});
