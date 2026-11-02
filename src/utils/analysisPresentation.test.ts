if (!process.env.VITE_SUPABASE_URL) process.env.VITE_SUPABASE_URL = "https://mock.supabase.co";
if (!process.env.VITE_SUPABASE_PUBLISHABLE_KEY) process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "mock-anon-key";

import { describe, expect, it } from "vitest";
import {
  FACT_STATUS_LABEL,
  buildCompanyFacts,
  getFunnelStageGuidance,
  getRecommendedPlanDay,
  isLeadInAdvancedStage,
  previewLocalCopyUpdate,
  splitAnalysisBullets,
  validateLeadChannelForDay,
} from "./analysisPresentation";
import { makeLegacyLead, makeNewLead } from "@/test/leadFixtures";
import type { LeadProspeccao, PlanoProspeccaoDia } from "@/types/lead";

describe("splitAnalysisBullets", () => {
  it("remove só o rótulo (e põe a 1ª letra em maiúscula), preserva o restante do texto e a ordem", () => {
    const input = [
      "Registro público localizado em Vitória.",
      "Possibilidade comercial para Full Service: avaliar interesse em captação.",
      "Possibilidade comercial: avaliar anúncios locais em Vitória.",
      "Próxima ação recomendada: iniciar contato com abertura curta.",
    ];
    const out = splitAnalysisBullets(input);
    expect(out.resumo).toEqual(["Registro público localizado em Vitória."]);
    expect(out.oportunidade).toEqual(["Avaliar interesse em captação.", "Avaliar anúncios locais em Vitória."]);
    expect(out.proximoPasso).toEqual(["Iniciar contato com abertura curta."]);
    expect(input[1]).toContain("Possibilidade comercial para Full Service"); // entrada intacta
  });

  it("o rótulo repetido 'Possibilidade comercial para Oportunidade comercial' nunca sobra", () => {
    const out = splitAnalysisBullets(["Possibilidade comercial para Oportunidade comercial: avaliar a previsibilidade da demanda."]);
    expect(out.oportunidade).toEqual(["Avaliar a previsibilidade da demanda."]);
    expect(JSON.stringify(out)).not.toMatch(/Oportunidade comercial:/);
  });

  it.each([
    ["Próximo passo útil: enviar abertura curta.", "proximoPasso", "Enviar abertura curta."],
    ["PRÓXIMA AÇÃO RECOMENDADA: ligar.", "proximoPasso", "Ligar."],
    ["Hipótese comercial: página única complementa o Google.", "oportunidade", "Página única complementa o Google."],
    ["Ângulo comercial recomendado: estruturar captação local.", "oportunidade", "Estruturar captação local."],
    ["Pergunta para validar: vocês já têm site?", "proximoPasso", "Vocês já têm site?"],
    ["Observado: oficina em Serra.", "resumo", "Oficina em Serra."],
    ["O que isso não permite concluir: se existe site fora do perfil.", "resumo", "Limite: se existe site fora do perfil."],
  ])("%s", (input, bucket, expected) => {
    expect(splitAnalysisBullets([input])[bucket as "resumo" | "oportunidade" | "proximoPasso"]).toEqual([expected]);
  });

  it("entrada vazia, nula ou com itens inválidos não quebra e não inventa", () => {
    expect(splitAnalysisBullets(null)).toEqual({ resumo: [], oportunidade: [], proximoPasso: [] });
    expect(splitAnalysisBullets(["", "   ", 7 as unknown as string])).toEqual({ resumo: [], oportunidade: [], proximoPasso: [] });
  });
});

describe("buildCompanyFacts", () => {
  it("sempre devolve os quatro cartões, na ordem", () => {
    expect(buildCompanyFacts({}).map((f) => f.key)).toEqual(["telefone", "website", "local", "avaliacoes"]);
    expect(buildCompanyFacts(makeNewLead()).map((f) => f.key)).toEqual(["telefone", "website", "local", "avaliacoes"]);
  });

  it("lead vazio: tudo 'indisponivel' com valor vazio (nada preenchido por fantasia)", () => {
    for (const f of buildCompanyFacts({})) {
      expect(f.status).toBe("indisponivel");
      expect(f.value).toBe("");
    }
  });

  it("site informado nunca vira 'confirmado' por existir: o funcionamento é sempre 'não verificado'", () => {
    const [, site] = buildCompanyFacts({ website: "https://x.com.br" } as Partial<LeadProspeccao>);
    expect(site.status).toBe("informado");
    expect(site.secondaryStatus).toBe("nao_verificado");
    const [, confirmed] = buildCompanyFacts({ website: "https://x.com.br", data_sources: { website: "google_places" } } as Partial<LeadProspeccao>);
    expect(confirmed.status).toBe("confirmado");
    expect(confirmed.secondaryStatus).toBe("nao_verificado");
  });

  it("os rótulos de status são os quatro pedidos", () => {
    expect(Object.values(FACT_STATUS_LABEL)).toEqual(["Confirmado na fonte", "Informado no cadastro", "Não verificado", "Indisponível"]);
  });

  it("nota decimal usa vírgula e singular de 1 avaliação", () => {
    const reviews = buildCompanyFacts({ total_reviews: 1, rating: 4.5 } as Partial<LeadProspeccao>)[3];
    expect(reviews.value).toBe("1 avaliação · nota 4,5");
    expect(buildCompanyFacts({ total_reviews: 12 } as Partial<LeadProspeccao>)[3].note).toBe("Nota não disponível.");
  });

  it("lead antigo com campos nulos não lança exceção", () => {
    expect(() => buildCompanyFacts(makeLegacyLead())).not.toThrow();
  });

  it("não afirma que WhatsApp foi identificado no site público quando o lead não possui website cadastrado", () => {
    const leadSemSite = {
      telefone: "27999887766",
      website: null,
      sinais: { has_whatsapp_on_site: true },
    } as Partial<LeadProspeccao>;
    const facts = buildCompanyFacts(leadSemSite);
    const phoneFact = facts.find((f) => f.key === "telefone")!;
    expect(phoneFact.note).not.toContain("site público");
    expect(phoneFact.note).toContain("Celular. Se há WhatsApp só se confirma no primeiro contato.");
  });
});

describe("getRecommendedPlanDay", () => {
  const day = (dia: number, extra: Partial<PlanoProspeccaoDia> = {}) => ({ dia, canal: "whatsapp", mensagem: `m${dia}`, acao_sugerida: "", objecao_provavel: "", resposta_sugerida: "", cta: "", ...extra }) as PlanoProspeccaoDia;
  it("primeiro dia não concluído e com mensagem; nulo sem plano", () => {
    expect(getRecommendedPlanDay([day(2), day(1, { status_dia: "concluido" })])?.dia).toBe(2);
    expect(getRecommendedPlanDay([day(1, { mensagem: "" }), day(2)])?.dia).toBe(2);
    expect(getRecommendedPlanDay([day(1, { status_dia: "bloqueado_optout" }), day(2)])?.dia).toBe(2);
    expect(getRecommendedPlanDay([day(1, { status_dia: "bloqueado_optout" })])).toBeNull();
    expect(getRecommendedPlanDay([])).toBeNull();
    expect(getRecommendedPlanDay(null)).toBeNull();
  });
});

describe("previewLocalCopyUpdate (somente leitura)", () => {
  it("conta o que mudaria sem alterar o plano recebido", () => {
    const lead = makeNewLead();
    const plano = lead.plano_prospecao_7dias.map((d, i) => (i === 0 ? { ...d, mensagem: "Texto antigo de IA", is_custom_edited: false } : d));
    const before = JSON.stringify(plano);
    const preview = previewLocalCopyUpdate(lead, plano);
    expect(JSON.stringify(plano)).toBe(before);
    expect(preview.total).toBe(7);
    expect(preview.replaced).toBeGreaterThanOrEqual(1);
    expect(preview.example).toMatchObject({ dia: 1, before: "Texto antigo de IA" });
    expect(preview.example!.after).not.toBe("Texto antigo de IA");
  });

  it("mensagem editada à mão nunca entra na lista de trocas", () => {
    const lead = makeNewLead();
    const plano = lead.plano_prospecao_7dias.map((d) => ({ ...d, mensagem: `editada ${d.dia}`, is_custom_edited: true }));
    const preview = previewLocalCopyUpdate(lead, plano);
    expect(preview).toMatchObject({ replaced: 0, keptEdited: 7, example: null });
  });

  it("lead nulo ou erro interno não quebram", () => {
    expect(previewLocalCopyUpdate(null, [])).toMatchObject({ replaced: 0, example: null });
    expect(() => previewLocalCopyUpdate({ foco: null } as never, makeNewLead().plano_prospecao_7dias)).not.toThrow();
  });
});

describe("isLeadInAdvancedStage e getFunnelStageGuidance", () => {
  it("diferencia com precisão prospecção fria de funil avançado", () => {
    expect(isLeadInAdvancedStage(null)).toBe(false);
    expect(isLeadInAdvancedStage(undefined)).toBe(false);
    expect(isLeadInAdvancedStage("novo")).toBe(false);
    expect(isLeadInAdvancedStage("em_contato")).toBe(false);
    expect(isLeadInAdvancedStage("qualificacao")).toBe(true);
    expect(isLeadInAdvancedStage("negociacao")).toBe(true);
    expect(isLeadInAdvancedStage("convertido")).toBe(true);
    expect(isLeadInAdvancedStage("perdido")).toBe(true);
  });

  it("getRecommendedPlanDay retorna null quando lead está em funil avançado", () => {
    const day = (dia: number) => ({ dia, canal: "whatsapp", mensagem: `m${dia}` }) as PlanoProspeccaoDia;
    expect(getRecommendedPlanDay([day(1)], "novo")?.dia).toBe(1);
    expect(getRecommendedPlanDay([day(1)], "qualificacao")).toBeNull();
    expect(getRecommendedPlanDay([day(1)], "negociacao")).toBeNull();
    expect(getRecommendedPlanDay([day(1)], "convertido")).toBeNull();
    expect(getRecommendedPlanDay([day(1)], "perdido")).toBeNull();
  });

  it("retorna orientações contextuais específicas para cada estágio avançado do CRM", () => {
    expect(getFunnelStageGuidance("qualificacao")?.badgeLabel).toContain("Qualificação");
    expect(getFunnelStageGuidance("negociacao")?.badgeLabel).toContain("Negociação");
    expect(getFunnelStageGuidance("convertido")?.badgeLabel).toContain("Convertido");
    expect(getFunnelStageGuidance("perdido")?.badgeLabel).toContain("Arquivada");
    expect(getFunnelStageGuidance("novo")).toBeNull();
  });
});

describe("validateLeadChannelForDay", () => {
  it("valida e-mail: ausente avisa e sugere WhatsApp/Google", () => {
    const semEmail = validateLeadChannelForDay({ email: "" }, "email");
    expect(semEmail.isAvailable).toBe(false);
    expect(semEmail.warningBadge).toBe("E-mail não cadastrado");

    const comEmail = validateLeadChannelForDay({ email: "contato@empresa.com.br" }, "email");
    expect(comEmail.isAvailable).toBe(true);
  });

  it("valida whatsapp: fixo sem evidência avisa; celular com DDD é aceito", () => {
    const fixoSemSite = validateLeadChannelForDay({ telefone: "1133334444" }, "whatsapp");
    expect(fixoSemSite.isAvailable).toBe(false);
    expect(fixoSemSite.warningBadge).toBe("WhatsApp não confirmado");

    const fixoComSite = validateLeadChannelForDay({ telefone: "1133334444", sinais: { has_whatsapp_on_site: true } }, "whatsapp");
    expect(fixoComSite.isAvailable).toBe(true);

    const celular = validateLeadChannelForDay({ telefone: "41999887766" }, "whatsapp");
    expect(celular.isAvailable).toBe(true);
  });

  it("valida instagram: ausente gera aviso com sugestão de busca", () => {
    const semInsta = validateLeadChannelForDay({ instagram: "" }, "instagram");
    expect(semInsta.isAvailable).toBe(false);
    expect(semInsta.warningBadge).toBe("Instagram não cadastrado");

    const comInsta = validateLeadChannelForDay({ instagram: "@empresa" }, "instagram");
    expect(comInsta.isAvailable).toBe(true);
  });

  it("aviso de telefone fixo sem site não menciona site público", () => {
    const fixoSemSite = validateLeadChannelForDay({ telefone: "2733221100", website: "" }, "whatsapp");
    expect(fixoSemSite.warningNote).toContain("cadastro público");
    expect(fixoSemSite.warningNote).not.toContain("site público");
  });
});
