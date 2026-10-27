if (!process.env.VITE_SUPABASE_URL) {
  process.env.VITE_SUPABASE_URL = "https://mock.supabase.co";
}
if (!process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "mock-anon-key";
}

import { describe, it, expect } from "vitest";
import {
  sanitizeBrazilianPhoneNumber,
  generateSdrFirstApproachMessage,
} from "./sdrProspectingService";

describe("sdrProspectingService - Regras Comerciais e Sanitização", () => {
  it("deve sanitizar números brasileiros com 11 dígitos (celular) e adicionar DDI 55", () => {
    const res = sanitizeBrazilianPhoneNumber("(27) 99999-8888");
    expect(res.isValid).toBe(true);
    expect(res.isCellPhone).toBe(true);
    expect(res.cleanNumber).toBe("5527999998888");
    expect(res.formattedDisplay).toBe("(27) 99999-8888");
  });

  it("deve sanitizar números que já possuem 55 sem duplicar o prefixo", () => {
    const res = sanitizeBrazilianPhoneNumber("+55 27 99999-8888");
    expect(res.isValid).toBe(true);
    expect(res.cleanNumber).toBe("5527999998888");
  });

  it("deve reconhecer telefones fixos de 10 dígitos (sem marcar como celular)", () => {
    const res = sanitizeBrazilianPhoneNumber("(27) 3322-1100");
    expect(res.isValid).toBe(true);
    expect(res.isCellPhone).toBe(false);
    expect(res.cleanNumber).toBe("552733221100");
  });

  it("deve retornar vazio para números inválidos ou nulos", () => {
    const res1 = sanitizeBrazilianPhoneNumber(null);
    expect(res1.isValid).toBe(false);
    expect(res1.cleanNumber).toBe("");

    const res2 = sanitizeBrazilianPhoneNumber("123");
    expect(res2.isValid).toBe(false);
    expect(res2.cleanNumber).toBe("");
  });

  it("deve usar o plano de 7 dias como fonte única de verdade quando existente", () => {
    const lead = {
      nome: "Clínica Sorriso",
      cidade: "Vitória",
      nicho: "odontologia",
      telefone: "27999887766",
      plano_prospecao_7dias: [
        {
          dia: 1,
          canal: "whatsapp",
          titulo: "Abordagem Inicial",
          mensagem: "Olá Dr. Roberto! Vi a Clínica Sorriso em Vitória e preparei este contato específico.",
          objetivo: "Abertura",
          acao_sugerida: "Enviar no WhatsApp",
          objecao_provavel: "Sem tempo",
          resposta_sugerida: "Compreendo a rotina",
          cta: "Podemos conversar amanhã?"
        },
        {
          dia: 3,
          canal: "email",
          titulo: "Follow-up Educativo",
          mensagem: "Assunto: Observação sobre captação em Vitória\n\nOi equipe da Clínica Sorriso, complementando nossa mensagem anterior...",
          objetivo: "Follow-up",
          acao_sugerida: "Enviar por e-mail",
          objecao_provavel: "Já temos agência",
          resposta_sugerida: "Ótimo ponto",
          cta: "Qual o melhor e-mail?"
        }
      ]
    };

    const sdrDia1 = generateSdrFirstApproachMessage({
      lead,
      dayNumber: 1
    });

    expect(sdrDia1.isFromPlan).toBe(true);
    expect(sdrDia1.text).toBe("Olá Dr. Roberto! Vi a Clínica Sorriso em Vitória e preparei este contato específico.");

    const sdrDia3 = generateSdrFirstApproachMessage({
      lead,
      dayNumber: 3
    });

    expect(sdrDia3.isFromPlan).toBe(true);
    expect(sdrDia3.text).toBe("Oi equipe da Clínica Sorriso, complementando nossa mensagem anterior...");
  });

  it("lead sem plano salvo: o SDR não inventa texto (nenhum gerador local) e nenhuma IA é acionada", () => {
    const res = generateSdrFirstApproachMessage({
      lead: { nome: "Auto Peças Litoral", cidade: "Guarapari", nicho: "autopeças", telefone: "27993334455" },
      dayNumber: 1,
    });
    expect(res.text).toBe("");
    expect(res.isFromPlan).toBe(false);
    expect(res.whatsappUrl).toBeNull();
  });

  it("dia de tarefa ou sem mensagem não carrega texto para envio", () => {
    const lead = {
      nome: "Oficina Lima",
      telefone: "27999887766",
      plano_prospecao_7dias: [
        { dia: 2, canal: "nenhum", tipo_dia: "tarefa", acao_sugerida: "Pesquisar o Instagram", mensagem: "", objecao_provavel: "", resposta_sugerida: "", cta: "" },
        { dia: 3, canal: "nenhum", tipo_dia: "sem_mensagem", acao_sugerida: "", mensagem: "texto que não deveria ser enviado", objecao_provavel: "", resposta_sugerida: "", cta: "" },
      ],
    };
    expect(generateSdrFirstApproachMessage({ lead: lead as never, dayNumber: 2 }).text).toBe("");
    // texto residual em dia "sem mensagem" também não é enviável
    const stray = generateSdrFirstApproachMessage({ lead: lead as never, dayNumber: 3 });
    expect(stray.text).toBe("");
    expect(stray.isFromPlan).toBe(false);
  });

  it("opt-out registrado bloqueia o texto do plano", () => {
    const res = generateSdrFirstApproachMessage({
      lead: {
        nome: "Loja X", telefone: "27999887766", status: "recusou_optout",
        plano_prospecao_7dias: [{ dia: 1, canal: "whatsapp", mensagem: "Oi, tudo bem? Posso falar com o responsável?", acao_sugerida: "", objecao_provavel: "", resposta_sugerida: "", cta: "" }],
      } as never,
      dayNumber: 1,
    });
    expect(res.text).toBe("");
    expect(res.whatsappUrl).toBeNull();
  });

  it("o link do WhatsApp carrega exatamente o texto salvo, codificado, sem alteração", () => {
    const text = "Oi, tudo bem? Aqui é a Marina, da Costa Digital.\n\nVocês já têm site?";
    const res = generateSdrFirstApproachMessage({
      lead: {
        nome: "Oficina Lima", telefone: "27999887766",
        plano_prospecao_7dias: [{ dia: 1, canal: "whatsapp", mensagem: text, acao_sugerida: "", objecao_provavel: "", resposta_sugerida: "", cta: "" }],
      } as never,
      dayNumber: 1,
    });
    expect(res.text).toBe(text);
    expect(res.whatsappUrl).toBe(`https://wa.me/5527999887766?text=${encodeURIComponent(text)}`);
  });
});
