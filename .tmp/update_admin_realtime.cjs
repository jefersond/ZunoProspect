const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/pages/AdminRealtime.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Divide em linhas
const lines = content.split(/\r?\n/);

console.log("Iniciando processamento de linhas de forma determinística em AdminRealtime.tsx...");

// 1. Modificar a tipagem do journeyViewMode
const modeIndex = lines.findIndex(l => l.includes('journeyViewMode') && l.includes('useState') && l.includes('compact'));
if (modeIndex !== -1) {
  lines[modeIndex] = `  const [journeyViewMode, setJourneyViewMode] = useState<"compact" | "failures" | "raw">("compact");`;
  console.log("✅ 1. Tipagem de journeyViewMode atualizada na linha", modeIndex + 1);
} else {
  console.log("❌ 1. Não encontrou a tipagem de journeyViewMode!");
}

// 2. Injetar o helper classifyAiFailure
// Encontrar a linha da definição da função AdminRealtime
const exportIndex = lines.findIndex(l => l.trim() === 'export default function AdminRealtime() {');
if (exportIndex !== -1) {
  const helperCode = `interface AiFailureClassification {
  type: "api_error" | "timeout" | "no_balance" | "duplicate_event" | "multiple_clicks" | "recovered" | "unknown";
  label: string;
  severity: "low" | "medium" | "high";
  explanation: string;
}

function classifyAiFailure(event: any, eventsForSameLead: any[]): AiFailureClassification {
  const meta = event.metadata || {};
  const errMsg = (meta.error_message || meta.error || "").toLowerCase();
  const errCode = String(meta.error_code || meta.code || "").toLowerCase();
  
  const eventTime = new Date(event.created_at).getTime();
  const leadId = meta.lead_id || meta.leadId;
  
  const successEvent = eventsForSameLead.find(e => {
    const isSuccess = ["AI_Analysis_Completed", "First_AI_Analysis_Completed", "ai_analysis_completed"].includes(e.event_name);
    const sameLead = (e.metadata?.lead_id || e.metadata?.leadId) === leadId && leadId;
    if (!isSuccess || !sameLead) return false;
    
    const diffSeconds = (new Date(e.created_at).getTime() - eventTime) / 1000;
    return diffSeconds > 0 && diffSeconds <= 120;
  });
  
  if (successEvent) {
    const diffSecs = Math.round((new Date(successEvent.created_at).getTime() - eventTime) / 1000);
    return {
      type: "recovered",
      label: "Falha recuperada",
      severity: "low",
      explanation: \`Sucesso \${diffSecs}s pós falha.\`
    };
  }

  const successLateEvent = eventsForSameLead.find(e => {
    const isSuccess = ["AI_Analysis_Completed", "First_AI_Analysis_Completed", "ai_analysis_completed"].includes(e.event_name);
    const sameLead = (e.metadata?.lead_id || e.metadata?.leadId) === leadId && leadId;
    if (!isSuccess || !sameLead) return false;
    
    const diffSeconds = (new Date(e.created_at).getTime() - eventTime) / 1000;
    return diffSeconds > 120;
  });
  
  if (successLateEvent) {
    return {
      type: "recovered",
      label: "Sucesso posterior",
      severity: "low",
      explanation: "Sucesso posterior (> 2 min)."
    };
  }

  const duplicateEvent = eventsForSameLead.find(e => {
    if (e.id === event.id) return false;
    const isFailed = ["AI_Analysis_Failed", "ai_analysis_failed"].includes(e.event_name);
    const sameLead = (e.metadata?.lead_id || e.metadata?.leadId) === leadId && leadId;
    if (!isFailed || !sameLead) return false;
    
    const sameMsg = (e.metadata?.error_message || e.metadata?.error || "") === (meta.error_message || meta.error || "");
    const diffSeconds = Math.abs((new Date(e.created_at).getTime() - eventTime) / 1000);
    return sameMsg && diffSeconds <= 5;
  });
  
  if (duplicateEvent) {
    return {
      type: "duplicate_event",
      label: "Possível duplicação",
      severity: "low",
      explanation: "Falha duplicada detectada em menos de 5 segundos."
    };
  }

  const multipleClicks = eventsForSameLead.find(e => {
    if (e.id === event.id) return false;
    const isFailed = ["AI_Analysis_Failed", "ai_analysis_failed"].includes(e.event_name);
    const sameLead = (e.metadata?.lead_id || e.metadata?.leadId) === leadId && leadId;
    if (!isFailed || !sameLead) return false;
    
    const diffSeconds = Math.abs((new Date(e.created_at).getTime() - eventTime) / 1000);
    return diffSeconds <= 5;
  });
  
  if (multipleClicks) {
    return {
      type: "multiple_clicks",
      label: "Múltiplos cliques",
      severity: "medium",
      explanation: "Tentativas concorrentes enviadas em poucos segundos."
    };
  }

  const isNoBalance = errMsg.includes("limite") || errMsg.includes("saldo") || errMsg.includes("crédito") || 
                      errCode.includes("limit") || errCode === "402" || meta.ai_available_before === 0;
  if (isNoBalance) {
    return {
      type: "no_balance",
      label: "Sem saldo de IA",
      severity: "medium",
      explanation: "Usuário não possui saldo de créditos ou bateu o limite grátis."
    };
  }

  const isTimeout = errMsg.includes("timeout") || errMsg.includes("aborted") || errMsg.includes("deadline") || 
                    errMsg.includes("gateway") || errMsg.includes("demorou") || errCode.includes("timeout");
  if (isTimeout) {
    return {
      type: "timeout",
      label: "Timeout de API",
      severity: "high",
      explanation: "A Edge Function ou provedor estouraram o tempo limite de resposta."
    };
  }

  const isApiError = errMsg.includes("api") || errMsg.includes("gemini") || errMsg.includes("model") || 
                     errMsg.includes("fetch") || errMsg.includes("network") || errCode !== "";
  if (isApiError) {
    return {
      type: "api_error",
      label: "Falha real de API",
      severity: "high",
      explanation: "O provedor Gemini ou o backend retornaram erro técnico na execução."
    };
  }

  return {
    type: "unknown",
    label: "Erro desconhecido",
    severity: "medium",
    explanation: meta.error_message || meta.error || "Código do erro não categorizado no helper."
  };
}
`;
  lines[exportIndex] = helperCode + "\n\nexport default function AdminRealtime() {";
  console.log("✅ 2. Helper classifyAiFailure injetado na linha", exportIndex + 1);
} else {
  console.log("❌ 2. Não encontrou a linha do export default function!");
}

// 3. Modificar o cálculo da taxa de falhas de IA
const failureIndex = lines.findIndex(l => l.includes('// Taxa de Falhas de IA'));
const diagIndex = lines.findIndex(l => l.includes('// Diagnóstico de Gargalos de acordo'));
if (failureIndex !== -1 && diagIndex !== -1) {
  const newRateCalc = `    // Telemetria detalhada de Falhas de IA (Fórmula Real Zuno)
    let countIaRecovered = 0;
    let countIaDuplicates = 0;
    
    selectedJourney.forEach(e => {
      if (["AI_Analysis_Failed", "ai_analysis_failed"].includes(eventKey(e))) {
        const cl = classifyAiFailure(e, selectedJourney);
        if (cl.type === "recovered") countIaRecovered++;
        else if (cl.type === "duplicate_event" || cl.type === "multiple_clicks") countIaDuplicates++;
      }
    });
    
    const countIaRealFailures = Math.max(0, countIaFailed - countIaRecovered - countIaDuplicates);
    
    let failureRate = 0;
    if (countIaStarted > 0) {
      failureRate = Math.round((countIaRealFailures / countIaStarted) * 100);
    } else if (countIaRealFailures + countIaCompleted > 0) {
      failureRate = Math.round((countIaRealFailures / (countIaRealFailures + countIaCompleted)) * 100);
    }`;
  
  lines.splice(failureIndex, diagIndex - failureIndex, newRateCalc);
  console.log("✅ 3. Cálculo da Taxa de Falhas Real injetado nas linhas", failureIndex + 1, "a", diagIndex);
} else {
  console.log("❌ 3. Não encontrou linhas para substituir o cálculo da Taxa de Falha!");
}

// 4. Modificar o retorno de selectedJourneySummary
const countsStartIndex = lines.findIndex(l => l.trim() === 'counts: {');
const countsEndIndex = lines.findIndex((l, idx) => idx > countsStartIndex && l.trim() === '}');
if (countsStartIndex !== -1 && countsEndIndex !== -1) {
  const newCountsObj = `      counts: {
        searches: countSearches,
        iaStarted: countIaStarted,
        iaCompleted: countIaCompleted,
        iaFailed: countIaFailed,
        iaFailedReal: countIaRealFailures,
        iaFailedRecovered: countIaRecovered,
        iaFailedDuplicates: countIaDuplicates,
        upgrades: totalUpgradeClicks,
        checkouts: countCheckouts,
        purchases: countPurchases
      }`;
  lines.splice(countsStartIndex, countsEndIndex - countsStartIndex + 1, newCountsObj);
  console.log("✅ 4. counts de retorno do summary atualizado!");
} else {
  console.log("❌ 4. Não encontrou o bloco counts: {!");
}

// 5. Modificar os cards no Resumo Executivo
const executiveCardsStartIndex = lines.findIndex(l => l.includes('searches') && l.includes('label:') && l.includes('counts.searches'));
const executiveCardsEndIndex = lines.findIndex((l, idx) => idx > executiveCardsStartIndex && l.includes('failureRate') && l.includes('val:'));
if (executiveCardsStartIndex !== -1 && executiveCardsEndIndex !== -1) {
  const newExecutiveCards = `                    { label: "Buscas", val: selectedJourneySummary.counts.searches, color: "text-sky-400" },
                    { label: "IA Iniciadas", val: selectedJourneySummary.counts.iaStarted, color: "text-violet-400" },
                    { label: "IA Sucesso", val: selectedJourneySummary.counts.iaCompleted, color: "text-emerald-400 font-bold" },
                    { label: "Falhas Totais", val: selectedJourneySummary.counts.iaFailed, color: "text-red-400/50" },
                    { label: "Falhas Reais", val: selectedJourneySummary.counts.iaFailedReal, color: "text-red-400 font-bold" },
                    { label: "Recuperadas", val: selectedJourneySummary.counts.iaFailedRecovered, color: "text-emerald-400 font-semibold" },
                    { label: "Duplicadas", val: selectedJourneySummary.counts.iaFailedDuplicates, color: "text-amber-400/80" },
                    { label: "Taxa Falha Real", val: \`\${selectedJourneySummary.failureRate}%\`, color: selectedJourneySummary.failureRate >= 30 ? "text-rose-500 font-bold animate-pulse" : "text-slate-300" }`;
  lines.splice(executiveCardsStartIndex, executiveCardsEndIndex - executiveCardsStartIndex + 1, newExecutiveCards);
  console.log("✅ 5. Cards de estatísticas do Resumo Executivo atualizados!");
} else {
  console.log("❌ 5. Não encontrou os cards de estatísticas do Resumo Executivo!");
}

// 6. Modificar grid class
const gridClassIndex = lines.findIndex(l => l.includes('grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-800/40'));
if (gridClassIndex !== -1) {
  lines[gridClassIndex] = `                <div className="flex flex-wrap gap-3.5 mt-4 pt-4 border-t border-slate-800/40">`;
  console.log("✅ 6. Grid class flex-wrap atualizada na linha", gridClassIndex + 1);
} else {
  console.log("❌ 6. Não encontrou a linha do grid-cols-5!");
}

// 7. Modificar a exibição enriquecida se for falha de IA na timeline
const aiFailedCardStartIndex = lines.findIndex(l => l.includes('Exibição enriquecida se for falha de IA'));
const aiFailedCardEndIndex = lines.findIndex((l, idx) => idx > aiFailedCardStartIndex && l.trim() === ')}' && lines[idx+2] && lines[idx+2].includes('Exibição enriquecida se for checkout falho'));
if (aiFailedCardStartIndex !== -1 && aiFailedCardEndIndex !== -1) {
  const newAiFailedCard = `                                    {/* Exibição enriquecida se for falha de IA */}
                                    {["AI_Analysis_Failed", "ai_analysis_failed"].includes(eventKey(e)) && (() => {
                                      const cl = classifyAiFailure(e, selectedJourney);
                                      const eventTime = new Date(e.created_at).getTime();
                                      const leadId = metadata(e).lead_id || metadata(e).leadId;
                                      
                                      const successEventAfter = selectedJourney.find(evt => {
                                        const isSuccess = ["AI_Analysis_Completed", "First_AI_Analysis_Completed", "ai_analysis_completed"].includes(eventKey(evt));
                                        const sameLead = (metadata(evt).lead_id || metadata(evt).leadId) === leadId && leadId;
                                        if (!isSuccess || !sameLead) return false;
                                        const diffSeconds = (new Date(evt.created_at).getTime() - eventTime) / 1000;
                                        return diffSeconds > 0 && diffSeconds <= 120;
                                      });
                                      
                                      const isDeducted = metadata(e).deducted_credit === true || 
                                                         (metadata(e).ai_used_after !== undefined && 
                                                          metadata(e).ai_used_before !== undefined && 
                                                          Number(metadata(e).ai_used_after) > Number(metadata(e).ai_used_before));

                                      return (
                                        <div className="my-2.5 p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-slate-300 space-y-3.5 max-w-2xl shadow-md">
                                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-500/10 pb-2 mb-1.5">
                                            <span className="font-bold text-red-400 flex items-center gap-1.5 text-[12px]">
                                              <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                                              Falha técnica na análise de IA • {cl.label}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                              {successEventAfter && (
                                                <Badge className="bg-emerald-500/25 text-emerald-400 border-emerald-500/40 text-[9px] font-bold">
                                                  Falha Recuperada
                                                </Badge>
                                              )}
                                              <Badge variant="outline" className={\`text-[9px] h-5 font-bold uppercase \${
                                                isDeducted 
                                                  ? "bg-red-500/20 text-red-500 border-red-500/40 animate-bounce" 
                                                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                              }\`}>
                                                Descontou crédito: {isDeducted ? "Sim (CRÍTICO)" : "Não"}
                                              </Badge>
                                            </div>
                                          </div>
                                          
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-slate-400">
                                            <p className="sm:col-span-2"><span className="text-slate-500 font-medium">Erro retornado:</span> <span className="font-mono text-red-400 text-[10.5px] break-all">{String(metadata(e).error_message || metadata(e).error || "Não informado")}</span></p>
                                            {metadata(e).error_code && <p><span className="text-slate-500">Código do Erro:</span> <span className="font-mono">{String(metadata(e).error_code)}</span></p>}
                                            {metadata(e).error_type && <p><span className="text-slate-500">Tipo de Erro:</span> <span className="font-mono">{String(metadata(e).error_type)}</span></p>}
                                            <p><span className="text-slate-500">Lead afetado:</span> <span className="font-semibold text-slate-200">{String(metadata(e).lead_name || metadata(e).leadName || "Não informado")}</span></p>
                                            <p><span className="text-slate-500">Lead ID:</span> <span className="font-mono text-[10px] break-all">{String(metadata(e).lead_id || "Não informado")}</span></p>
                                            <p><span className="text-slate-500">Saldo IA Antes:</span> <span>{String(metadata(e).ai_available_before !== undefined ? metadata(e).ai_available_before : "Não informado")}</span></p>
                                            <p><span className="text-slate-500">Saldo IA Depois:</span> <span>{String(metadata(e).ai_available_after !== undefined ? metadata(e).ai_available_after : "Não informado")}</span></p>
                                            <p><span className="text-slate-500">Uso IA Antes:</span> <span>{String(metadata(e).ai_used_before !== undefined ? metadata(e).ai_used_before : "Não informado")}</span></p>
                                            <p><span className="text-slate-500">Uso IA Depois:</span> <span>{String(metadata(e).ai_used_after !== undefined ? metadata(e).ai_used_after : "Não informado")}</span></p>
                                            <p><span className="text-slate-500">Edge Function:</span> <span className="font-mono">{String(metadata(e).edge_function || "não informado")}</span></p>
                                            <p><span className="text-slate-500">IA Provedor:</span> <span className="font-mono">{String(metadata(e).provider || "não informado")}</span></p>
                                            <p><span className="text-slate-500">Duração Chamada:</span> <span>{String(metadata(e).duration_ms !== undefined ? \`\${metadata(e).duration_ms} ms\` : "não informado")}</span></p>
                                            <p><span className="text-slate-500">Retentativas:</span> <span>{String(metadata(e).retry_count !== undefined ? metadata(e).retry_count : "não informado")}</span></p>
                                            <p><span className="text-slate-500">Request ID:</span> <span className="font-mono text-[9px] break-all">{String(metadata(e).request_id || "não informado")}</span></p>
                                            <p><span className="text-slate-500">Sessão ID:</span> <span className="font-mono text-[9px] break-all">{String(e.session_id || "não informado")}</span></p>
                                          </div>

                                          {isDeducted && (
                                            <div className="flex items-center gap-2 text-[10px] text-red-400 font-bold bg-red-500/15 p-2 rounded-lg border border-red-500/30 animate-pulse">
                                              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                                              Possível desconto indevido em falha de IA detectado (crédito foi debitado em erro).
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}`;
  lines.splice(aiFailedCardStartIndex, aiFailedCardEndIndex - aiFailedCardStartIndex + 1, newAiFailedCard);
  console.log("✅ 7. Card de visualização detalhada de AI_Analysis_Failed atualizado!");
} else {
  console.log("❌ 7. Não encontrou o bloco de AI_Analysis_Failed na timeline!");
}

// 8. Botão do seletor de visualização (Timeline Compacta / Falhas de IA / Eventos Brutos)
const rawButtonIndex = lines.findIndex(l => l.includes('journeyViewMode === "raw" ? "secondary" : "ghost"'));
if (rawButtonIndex !== -1) {
  // Encontramos o início do botão 'Terminal'
  let startBtnIdx = rawButtonIndex;
  while (startBtnIdx > 0 && !lines[startBtnIdx].trim().startsWith('<Button')) {
    startBtnIdx--;
  }
  let endBtnIdx = rawButtonIndex;
  while (endBtnIdx < lines.length && !lines[endBtnIdx].trim().endsWith('</Button>')) {
    endBtnIdx++;
  }
  
  const newViewButtons = `                  <Button
                    variant={journeyViewMode === "failures" ? "secondary" : "ghost"}
                    size="sm"
                    className={\`h-7 px-3 text-xs rounded-md transition-all \${
                      journeyViewMode === "failures" ? "bg-slate-800 text-slate-100 hover:bg-slate-700" : "text-slate-400 hover:text-slate-200"
                    }\`}
                    onClick={() => setJourneyViewMode("failures")}
                  >
                    <Brain className="h-3.5 w-3.5 mr-1.5 text-violet-400" />
                    Falhas de IA por Lead
                  </Button>
                  <Button
                    variant={journeyViewMode === "raw" ? "secondary" : "ghost"}
                    size="sm"
                    className={\`h-7 px-3 text-xs rounded-md transition-all \${
                      journeyViewMode === "raw" ? "bg-slate-800 text-slate-100 hover:bg-slate-700" : "text-slate-400 hover:text-slate-200"
                    }\`}
                    onClick={() => setJourneyViewMode("raw")}
                  >
                    <Terminal className="h-3.5 w-3.5 mr-1.5" />
                    Eventos Brutos
                  </Button>`;
  
  lines.splice(startBtnIdx, endBtnIdx - startBtnIdx + 1, newViewButtons);
  console.log("✅ 8. Botões de visualização (aba Falhas de IA) atualizados!");
} else {
  console.log("❌ 8. Não encontrou o botão de visualização raw!");
}

// 9. Renderizar a seção Falhas de IA por Lead
const timelineRenderIndex = lines.findIndex(l => l.includes('{journeyViewMode === "compact" ? ('));
if (timelineRenderIndex !== -1) {
  const newTimelineRender = `              {/* Renderização condicional do modo de visualização */}
              {journeyViewMode === "failures" ? (() => {
                const iaEvents = selectedJourney.filter(e => 
                  ["AI_Analysis_Started", "First_AI_Analysis_Started", 
                   "AI_Analysis_Completed", "First_AI_Analysis_Completed", "ai_analysis_completed", 
                   "AI_Analysis_Failed", "ai_analysis_failed"].includes(eventKey(e))
                );

                const leadsGroup = {};

                iaEvents.forEach(e => {
                  const meta = metadata(e) || {};
                  const leadId = meta.lead_id || meta.leadId || "";
                  const leadName = meta.lead_name || meta.leadName || "";
                  
                  const fallbackKey = leadId || (leadName ? \`name_\${leadName}\` : "unknown_lead");
                  
                  if (!leadsGroup[fallbackKey]) {
                    leadsGroup[fallbackKey] = {
                      leadId: leadId || "não informado",
                      leadName: leadName || "Não informado",
                      attempts: [],
                      failures: [],
                      successes: [],
                      started: [],
                      firstFailureAt: null,
                      lastSuccessAt: null,
                      deductedCredit: false
                    };
                  }
                  
                  const group = leadsGroup[fallbackKey];
                  group.attempts.push(e);
                  
                  const key = eventKey(e);
                  if (["AI_Analysis_Failed", "ai_analysis_failed"].includes(key)) {
                    group.failures.push(e);
                    if (!group.firstFailureAt) {
                      group.firstFailureAt = e.created_at;
                    }
                    const aiUsedAfter = Number(meta.ai_used_after || 0);
                    const aiUsedBefore = Number(meta.ai_used_before || 0);
                    if (meta.deducted_credit === true || aiUsedAfter > aiUsedBefore) {
                      group.deductedCredit = true;
                    }
                  } else if (["AI_Analysis_Completed", "First_AI_Analysis_Completed", "ai_analysis_completed"].includes(key)) {
                    group.successes.push(e);
                    group.lastSuccessAt = e.created_at;
                  } else if (["AI_Analysis_Started", "First_AI_Analysis_Started"].includes(key)) {
                    group.started.push(e);
                  }
                });

                const groupedLeadsList = Object.values(leadsGroup).filter(g => g.failures.length > 0);

                return (
                  <div className="mt-4 space-y-4 pt-1">
                    <div className="p-3 bg-slate-900/30 rounded-xl border border-slate-805 text-xs text-slate-400 space-y-1">
                      <p className="font-semibold text-slate-200">Painel de Auditoria de Falhas de IA</p>
                      <p>Lista de leads que tiveram falhas no processamento com diagnóstico, taxa de recuperação e auditoria de concorrência.</p>
                      <p>Total de leads com instabilidade: <span className="font-bold text-red-400">{groupedLeadsList.length}</span></p>
                    </div>

                    {groupedLeadsList.length === 0 ? (
                      <p className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-6 text-xs text-slate-400 text-center">
                        Nenhuma falha técnica de IA registrada para este usuário!
                      </p>
                    ) : (
                      <div className="space-y-3.5">
                        {groupedLeadsList.map((g, idx) => {
                          const hasRecovery = g.successes.length > 0;
                          
                          let hasDuplication = false;
                          let hasMultipleClicks = false;
                          
                          g.failures.forEach(f => {
                            const cl = classifyAiFailure(f, selectedJourney);
                            if (cl.type === "duplicate_event") hasDuplication = true;
                            if (cl.type === "multiple_clicks") hasMultipleClicks = true;
                          });

                          let statusLabel = "Falha Não Recuperada";
                          let statusColor = "bg-red-500/10 text-red-400 border-red-500/25";
                          
                          if (hasRecovery) {
                            const firstFailTime = new Date(g.firstFailureAt).getTime();
                            const recoverySuccess = g.successes.find(s => {
                              const diffSecs = (new Date(s.created_at).getTime() - firstFailTime) / 1000;
                              return diffSecs > 0 && diffSecs <= 120;
                            });
                            
                            if (recoverySuccess) {
                              const diff = Math.round((new Date(recoverySuccess.created_at).getTime() - firstFailTime) / 1000);
                              statusLabel = \`Falha recuperada (\${diff}s após)\`;
                              statusColor = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-semibold";
                            } else {
                              statusLabel = "Sucesso posterior (> 2min)";
                              statusColor = "bg-teal-500/10 text-teal-400 border-teal-500/20";
                            }
                          } else if (hasDuplication) {
                            statusLabel = "Possível duplicação";
                            statusColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                          } else if (hasMultipleClicks) {
                            statusLabel = "Múltiplos cliques";
                            statusColor = "bg-violet-500/10 text-violet-400 border-violet-500/20";
                          }

                          return (
                            <div key={idx} className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4 shadow-sm space-y-3.5 hover:border-slate-800 hover:bg-slate-950/60 transition-all">
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/40 pb-2 mb-0.5">
                                <div>
                                  <h4 className="font-bold text-slate-100 text-[12.5px] flex items-center gap-1.5">
                                    <Brain className="h-4 w-4 text-violet-400" />
                                    {g.leadName}
                                  </h4>
                                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {g.leadId}</p>
                                </div>
                                <div className="flex flex-wrap gap-1.5 items-center">
                                  <Badge variant="outline" className={\`text-[9px] px-2 py-0.5 uppercase tracking-wider \${statusColor}\`}>
                                    {statusLabel}
                                  </Badge>
                                  {g.deductedCredit && (
                                    <Badge className="bg-red-500/20 text-red-500 border border-red-500/40 text-[9px] font-bold uppercase animate-pulse">
                                      Desconto Indevido
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-[10.5px] text-slate-400">
                                <div className="bg-slate-900/30 p-2 rounded-lg border border-slate-850">
                                  <span className="text-slate-500 block">Tentativas</span>
                                  <span className="font-bold text-slate-200 text-xs">{g.attempts.length}</span>
                                </div>
                                <div className="bg-slate-900/30 p-2 rounded-lg border border-slate-850">
                                  <span className="text-slate-500 block">Falhas IA</span>
                                  <span className="font-bold text-red-400 text-xs">{g.failures.length}</span>
                                </div>
                                <div className="bg-slate-900/30 p-2 rounded-lg border border-slate-850">
                                  <span className="text-slate-500 block">Sucessos IA</span>
                                  <span className="font-bold text-emerald-400 text-xs">{g.successes.length}</span>
                                </div>
                                <div className="bg-slate-900/30 p-2 rounded-lg border border-slate-850">
                                  <span className="text-slate-500 block">Primeira Falha</span>
                                  <span className="font-mono text-slate-350">{g.firstFailureAt ? formatTime(g.firstFailureAt) : "-"}</span>
                                </div>
                                <div className="bg-slate-900/30 p-2 rounded-lg border border-slate-850">
                                  <span className="text-slate-500 block">Último Sucesso</span>
                                  <span className="font-mono text-slate-350">{g.lastSuccessAt ? formatTime(g.lastSuccessAt) : "-"}</span>
                                </div>
                              </div>

                              {g.deductedCredit && (
                                <div className="flex items-center gap-1.5 text-[9.5px] text-red-400 font-bold bg-red-500/15 p-2.5 rounded-lg border border-red-500/25 animate-pulse">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                                  Possível desconto indevido detectado para este lead! Crédito debitado mesmo com falha técnica.
                                </div>
                              )}

                              <details className="mt-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 p-2.5 text-xs text-slate-400">
                                <summary className="cursor-pointer font-bold text-slate-300 hover:text-slate-200 transition-colors list-none select-none flex items-center gap-1">
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                                  Linha do Tempo de Erros deste Lead ({g.failures.length} eventos)
                                </summary>
                                <div className="mt-3.5 space-y-3.5 border-l-2 border-slate-800/80 pl-3 ml-1.5">
                                  {g.failures.map((f, fIdx) => {
                                    const cl = classifyAiFailure(f, selectedJourney);
                                    const isDeducted = metadata(f).deducted_credit === true || 
                                                       (metadata(f).ai_used_after !== undefined && 
                                                        metadata(f).ai_used_before !== undefined && 
                                                        Number(metadata(f).ai_used_after) > Number(metadata(f).ai_used_before));
                                    
                                    return (
                                      <div key={fIdx} className="space-y-2 relative">
                                        <div className="absolute -left-[19.5px] top-1.5 h-2 w-2 rounded-full bg-red-500/70 border border-slate-950 animate-ping" />
                                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                                          <Badge className="bg-red-500/15 text-red-400 border border-red-500/20 text-[9px] font-bold">
                                            {cl.label}
                                          </Badge>
                                          <span className="text-[10px] text-slate-500 font-mono">{formatTime(f.created_at)}</span>
                                        </div>
                                        <p className="text-[11px] text-slate-300 font-mono bg-slate-950 p-2 rounded border border-slate-850 max-h-24 overflow-y-auto">{metadata(f).error_message || metadata(f).error || "Não informado"}</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-slate-500">
                                          {metadata(f).error_code && <p><span className="text-slate-650">Error Code:</span> <span className="font-mono text-slate-400">{String(metadata(f).error_code)}</span></p>}
                                          {metadata(f).error_type && <p><span className="text-slate-650">Error Type:</span> <span className="font-mono text-slate-400">{String(metadata(f).error_type)}</span></p>}
                                          <p><span className="text-slate-650">Duração:</span> <span className="text-slate-400">{metadata(f).duration_ms !== undefined ? \`\${metadata(f).duration_ms} ms\` : "não informado"}</span></p>
                                          <p><span className="text-slate-650">Retries:</span> <span className="text-slate-400">{metadata(f).retry_count !== undefined ? metadata(f).retry_count : "não informado"}</span></p>
                                          {metadata(f).request_id && <p className="sm:col-span-2"><span className="text-slate-650 font-mono">Request ID:</span> <span className="font-mono text-slate-400">{String(metadata(f).request_id)}</span></p>}
                                          <p><span className="text-slate-650">Crédito Descontado:</span> <span className={isDeducted ? "text-red-400 font-bold" : "text-slate-400"}>{isDeducted ? "Sim (CRÍTICO)" : "Não"}</span></p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </details>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })() : journeyViewMode === "compact" ? (
                <div className="space-y-4 pt-1">`;
  
  lines[timelineRenderIndex] = newTimelineRender;
  console.log("✅ 9. Renderização do failures injetada com absoluto sucesso!");
} else {
  console.log("❌ 9. Não encontrou a linha de journeyViewMode === 'compact' ?!");
}

// Salva o arquivo final
fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log("Substituições concluídas com absoluto sucesso em AdminRealtime.tsx!");
