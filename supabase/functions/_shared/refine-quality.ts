export interface ProspectingDay {
  dia: number;
  canal: string;
  acao_sugerida: string;
  mensagem: string;
  objecao_provavel: string;
  resposta_sugerida: string;
  cta: string;
}

export interface ProspectingAnalysis {
  diagnostico_bullets?: string[];
  plano_prospeccao_7dias?: ProspectingDay[];
}

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const isUsefulText = (value: unknown, min: number, max: number) =>
  typeof value === "string" && value.trim().length >= min && value.trim().length <= max;

export function validateProspectingAnalysis(analysis: ProspectingAnalysis): string[] {
  const issues: string[] = [];
  const bullets = Array.isArray(analysis.diagnostico_bullets) ? analysis.diagnostico_bullets : [];
  if (bullets.length < 3 || bullets.length > 4 || bullets.some((item) => !isUsefulText(item, 35, 280))) {
    issues.push("diagnostico_invalido");
  }

  const plan = Array.isArray(analysis.plano_prospeccao_7dias) ? analysis.plano_prospeccao_7dias : [];
  if (plan.length !== 7) {
    issues.push("plano_deve_ter_7_dias");
    return issues;
  }

  const expectedDays = new Set([1, 2, 3, 4, 5, 6, 7]);
  const messageKeys = new Set<string>();
  for (const day of plan) {
    expectedDays.delete(Number(day.dia));
    if (
      !isUsefulText(day.acao_sugerida, 8, 220) ||
      !isUsefulText(day.mensagem, 45, 900) ||
      !isUsefulText(day.objecao_provavel, 8, 280) ||
      !isUsefulText(day.resposta_sugerida, 15, 500) ||
      !isUsefulText(day.cta, 5, 180)
    ) {
      issues.push(`dia_${day.dia}_incompleto`);
    }
    const key = normalize(day.mensagem || "");
    if (messageKeys.has(key)) issues.push("mensagens_duplicadas");
    messageKeys.add(key);
  }

  if (expectedDays.size > 0) issues.push("dias_invalidos");
  return [...new Set(issues)];
}

export function preserveDiagnosisOrFallback(
  analysis: ProspectingAnalysis,
  fallback: string[],
): string[] {
  const bullets = Array.isArray(analysis.diagnostico_bullets)
    ? analysis.diagnostico_bullets.map((item) => item.trim()).filter(Boolean).slice(0, 4)
    : [];
  return bullets.length >= 3 ? bullets : fallback.slice(0, 4);
}

export function buildProspectingQualityContract(): string {
  return `CONTRATO FINAL DE QUALIDADE — TEM PRIORIDADE SOBRE INSTRUCOES ANTERIORES
- Entregue exatamente 3 ou 4 diagnostico_bullets. Preserve apenas conclusoes comerciais sustentadas pelos dados; diferencie fato observado de hipotese a validar.
- Entregue exatamente 7 dias, numerados de 1 a 7, sem repetir mensagem, CTA ou objetivo.
- Dia 1: abertura humana com achado real e pergunta curta; sem pitch e sem inventar auditoria.
- Dia 2: aprofundar a dor provavel como pergunta, sem afirmar algo nao comprovado.
- Dia 3: compartilhar uma ideia pratica e especifica ao nicho/foco.
- Dia 4: email objetivo com assunto e corpo, conectando achado, impacto e pergunta.
- Dia 5: pergunta diagnostica que qualifica processo, prioridade ou gargalo.
- Dia 6: tratar uma objecao plausivel sem pressionar nem discutir.
- Dia 7: ultimo toque respeitoso, permitindo encerrar a cadencia.
- Cada dia deve conter canal, acao_sugerida, mensagem pronta, objecao_provavel, resposta_sugerida e CTA coerentes entre si.
- Use nome, nicho, cidade, canais e sinais somente quando fornecidos. Nunca invente responsavel, campanha, resultado, concorrente, numero, auditoria ou comportamento do lead.
- Linguagem brasileira natural, frases curtas, sem jargao vazio, sem promessas garantidas e sem repetir a mesma abertura.
- A mensagem deve vender a proxima conversa, nao o servico inteiro.`;
}
