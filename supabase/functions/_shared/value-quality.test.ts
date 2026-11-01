import { describe, expect, it } from "vitest";
import {
  buildAnalysisPrompt,
  buildVerifiedFacts,
  evaluateAnalysisValue,
  hasSingleFinalQuestion,
  mentionsSellerService,
  validateAnalysis,
  type DayChannel,
  type HistoryStage,
  type ValidatedAnalysis,
} from "./lead-analysis";
import { day, goodRaw, lead, profile } from "./test-fixtures";

// Todas as respostas abaixo são FIXTURES escritas à mão para testar as regras; não são saídas do Gemini.
const facts = buildVerifiedFacts(lead);
const ctx = { channels: ["whatsapp", "telefone"] as DayChannel[], profile, stage: "nao_contatado" as HistoryStage, facts };

const validated = (raw: unknown, over: Partial<typeof ctx> = {}) => {
  const r = validateAnalysis(raw, { ...ctx, ...over });
  if (!r.ok) throw new Error(`fixture inválida: ${r.issues.join("; ")}`);
  return r;
};

describe("primeiro contato: apresenta o serviço e termina com uma pergunta simples", () => {
  it("aceita a fixture completa", () => {
    expect(validated(goodRaw()).demoted_days).toEqual([]);
  });

  it.each([
    ["sem pergunta", "Oi! Aqui é a Marina, da Costa Digital. Faço sites simples para oficinas, com serviços e horário numa página só."],
    ["duas perguntas", "Oi! Aqui é a Marina, da Costa Digital. Faço sites para oficinas. Vocês têm site? Posso explicar?"],
    ["pergunta no meio, texto depois", "Oi! Vocês têm site? Aqui é a Marina, da Costa Digital, e faço sites para oficinas com serviços, horário e WhatsApp.\nUm abraço,\nMarina\nCosta Digital"],
  ])("recusa o texto (%s) e transforma o dia em tarefa", (_n, mensagem) => {
    const raw = goodRaw();
    raw.plano[0].mensagem = mensagem;
    // sem nenhuma outra abertura válida, as etapas viram tarefas internas e o diagnóstico é preservado
    const r1 = validateAnalysis(raw, ctx);
    expect(r1.ok).toBe(true);
    expect(r1.demoted_days).toContain(1);
    expect(r1.warnings).toContain("nenhuma mensagem aprovada para envio direto: as etapas foram preservadas como tarefas internas");
    // com uma abertura válida mais adiante, só o dia 1 é descartado
    raw.plano[4] = day(5, { tipo: "mensagem", canal: "whatsapp", acao: "Enviar a abertura", mensagem: "Oi, aqui é a Marina, da Costa Digital. Faço sites simples para oficinas. Vocês já têm um?" });
    const r2 = validateAnalysis(raw, ctx);
    expect(r2.ok && r2.demoted_days).toContain(1);
  });

  it("recusa abertura que não diz o que o assinante vende", () => {
    const raw = goodRaw();
    raw.plano[0].mensagem = "Oi, aqui é a Marina, da Costa Digital. Vi a Irmãos Lima no Google e gostei do trabalho de vocês. Posso falar com o responsável?";
    raw.plano[4] = day(5, { tipo: "mensagem", canal: "whatsapp", acao: "Enviar a abertura", mensagem: "Oi, aqui é a Marina, da Costa Digital. Faço sites simples para oficinas. Vocês já têm um?" });
    const r = validateAnalysis(raw, ctx);
    expect(r.ok && r.demoted_days).toContain(1);
  });

  it("assinatura curta depois da pergunta é aceita", () => {
    expect(hasSingleFinalQuestion("Oi! Faço sites para oficinas. Vocês já têm um?\nMarina\nCosta Digital")).toBe(true);
    expect(hasSingleFinalQuestion("Oi, tudo bem? Faço sites para oficinas. Vocês já têm um?")).toBe(true);
  });

  it("serviço é reconhecido pelas palavras do próprio assinante", () => {
    expect(mentionsSellerService("Faço sites de uma página para oficinas", profile)).toBe(true);
    expect(mentionsSellerService("Gostei muito do trabalho de vocês", profile)).toBe(false);
  });
});

describe("placeholders", () => {
  it.each(["[Seu Nome]", "{{nome}}", "{empresa}", "<seu nome>"])("mensagem com %s é descartada", (placeholder) => {
    const raw = goodRaw();
    raw.plano[0].mensagem = `Oi! Aqui é ${placeholder}, da Costa Digital. Faço sites para oficinas. Vocês já têm um?`;
    raw.plano[4] = day(5, { tipo: "mensagem", canal: "whatsapp", acao: "Enviar a abertura", mensagem: "Oi, aqui é a Marina, da Costa Digital. Faço sites simples para oficinas. Vocês já têm um?" });
    const r = validateAnalysis(raw, ctx);
    expect(r.ok && r.demoted_days).toContain(1);
  });

  it("diagnóstico ou resumo com campo a preencher invalida a análise", () => {
    const raw = goodRaw();
    raw.resumo_estrategia = "Abrir com a pergunta e assinar como [Seu Nome].";
    expect(validateAnalysis(raw, ctx).ok).toBe(false);
  });
});

describe("evidências: sem inventar necessidade, qualidade ou ausência", () => {
  it.each([
    ["necessidade afirmada", "A oficina precisa de mais clientes e está procurando um site."],
    ["intenção de compra", "O dono quer contratar um site novo."],
    ["ausência tratada como fato", "A oficina não tem site nem presença digital."],
    ["qualidade não medida", "O atendimento é lento e a reputação é ruim."],
  ])("diagnóstico com %s é recusado", (_n, hipotese) => {
    const raw = goodRaw();
    raw.diagnostico.hipotese_comercial = `${hipotese} Isso justifica abordar a empresa agora mesmo.`;
    const r = validateAnalysis(raw, ctx);
    expect(r.ok).toBe(false);
  });

  it("fato de cadastro ('nenhum site no perfil') continua permitido", () => {
    const raw = goodRaw();
    raw.diagnostico.observado = ["Oficina em Serra, 46 avaliações no Google, sem site cadastrado no perfil."];
    expect(validateAnalysis(raw, ctx).ok).toBe(true);
  });

  it("mensagem que afirma ausência ou qualidade é descartada", () => {
    const raw = goodRaw();
    raw.plano[3].mensagem = "Oi, aqui é a Marina de novo. Vocês não têm site e o atendimento é ruim. Posso explicar como os sites ajudam?";
    const r = validateAnalysis(raw, ctx);
    expect(r.ok && r.demoted_days).toContain(4);
  });
});

describe("objeções específicas", () => {
  it.each([
    "Quem é você e como conseguiu meu número?",
    "Não tenho interesse.",
    "Não entendi do que se trata.",
    "Não preciso.",
  ])("objeção genérica '%s' é removida junto com a resposta", (objecao) => {
    const raw = goodRaw();
    raw.plano[0].objecao_provavel = objecao;
    raw.plano[0].resposta_sugerida = "Resposta genérica.";
    const r = validated(raw);
    const d1 = r.analysis.plano[0];
    expect(d1.objecao_provavel).toBe("");
    expect(d1.resposta_sugerida).toBe("");
    expect(r.warnings.join(" ")).toMatch(/objeção genérica removida/);
  });

  it("objeção específica do serviço é mantida", () => {
    const r = validated(goodRaw());
    expect(r.analysis.plano[0].objecao_provavel).toBe("Já temos Instagram.");
  });
});

describe("prompt v6", () => {
  const prompt = buildAnalysisPrompt(facts, profile);
  it("diz como abrir, termina com pergunta simples e usa o nome e a empresa do assinante", () => {
    expect(prompt).toContain("Sou Marina Costa, da Costa Digital");
    expect(prompt).toContain("A pergunta é a ÚLTIMA frase");
    expect(prompt).toMatch(/nada de colchetes/);
  });
  it("proíbe objeção de identidade e afirmação de necessidade", () => {
    expect(prompt).toMatch(/NÃO use objeções de identidade/);
    expect(prompt).toMatch(/Não afirme necessidade, interesse ou intenção de compra/);
  });
  it("pede a próxima ação e mantém os sete dias como plano de trabalho", () => {
    expect(prompt).toContain("PRÓXIMA AÇÃO");
    expect(prompt).toContain("Os sete dias NÃO são sete mensagens");
  });
});

describe("evaluateAnalysisValue (teste de valor)", () => {
  const evalOf = (analysis: ValidatedAnalysis, f = facts) => Object.fromEntries(evaluateAnalysisValue(analysis, { facts: f, profile }).map((c) => [c.id, c]));

  it("fixture completa passa nas cinco perguntas", () => {
    const checks = evalOf(validated(goodRaw()).analysis);
    for (const c of Object.values(checks)) expect(c.ok, `${c.id}: ${c.detail}`).toBe(true);
  });

  it("dado inventado (número fora do cadastro) reprova 'dados verificáveis'", () => {
    const raw = goodRaw();
    raw.diagnostico.observado = ["Oficina em Serra com 46 avaliações e mais de 300 clientes por mês."];
    const checks = evalOf(validated(raw).analysis);
    expect(checks.dados_verificaveis.ok).toBe(false);
    expect(checks.dados_verificaveis.detail).toMatch(/300/);
  });

  it("abertura fria para quem já respondeu reprova 'histórico'", () => {
    const answered = buildVerifiedFacts({ ...lead, status: "respondeu", notas: "Respondeu perguntando o preço." });
    const analysis = validated(goodRaw(), { stage: "respondeu", facts: answered }).analysis;
    expect(evalOf(analysis, answered).proxima_acao_conforme_historico.ok).toBe(false);
  });

  it("plano sem orientação no dia 2 reprova 'dia seguinte'", () => {
    const raw = goodRaw();
    raw.plano[1] = day(2, { acao: "", condicao: "" });
    expect(evalOf(validated(raw).analysis).continua_no_dia_seguinte.ok).toBe(false);
  });

  it("hipótese sem ligação com os fatos reprova 'por que vale'", () => {
    const raw = goodRaw();
    raw.diagnostico.observado = ["Dados disponíveis são limitados e genéricos para qualquer empresa."];
    raw.diagnostico.hipotese_comercial = "Uma página única com informações básicas pode ajudar quem pesquisa serviços, se fizer sentido.";
    expect(evalOf(validated(raw).analysis).por_que_vale_abordar.ok).toBe(false);
  });
});
