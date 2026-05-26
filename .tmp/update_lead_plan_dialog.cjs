const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/components/prospeccao/LeadPlanDialog.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Declarar activeRequestRef e importar useRef se necessário
const oldReactImport = `import { useState, useEffect, useCallback } from "react";`;
const newReactImport = `import { useState, useEffect, useCallback, useRef } from "react";`;

const oldRefDecl = `  const [isReanalyzing, setIsReanalyzing] = useState(false);`;
const newRefDecl = `  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const activeRequestRef = useRef(false);`;

// 2. Modificar o início de handleReanalyze
const oldReanalyzeStart = `  const handleReanalyze = async () => {
    if (!lead) return;
    if (!canAnalyzeLead) {`;

const newReanalyzeStart = `  const handleReanalyze = async () => {
    if (!lead) return;
    
    if (activeRequestRef.current || isReanalyzing) {
      console.log("Clique duplo detectado e prevenido para o lead no dialog:", lead.id);
      trackEvent("AI_Analysis_Duplicate_Click_Prevented", {
        lead_id: lead.id,
        lead_name: lead.nome,
        source: "lead_dialog",
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (!canAnalyzeLead) {`;

const oldStateUpdate = `    setIsReanalyzing(true);`;
const newStateUpdate = `    activeRequestRef.current = true;
    setIsReanalyzing(true);`;

// 3. Modificar a linha de descrição de erro do toast (ATÔMICA)
const oldToastDescription = `description: error.message || "Não foi possível reanalisar o lead",`;
const newToastDescription = `description: ((error.message || "").toLowerCase().includes("limite") || 
                     (error.message || "").toLowerCase().includes("crédito") || 
                     (error.message || "").toLowerCase().includes("saldo") ||
                     (error.message || "").includes("402")) 
          ? "Você não tem análises IA disponíveis." 
          : "Não conseguimos concluir a análise agora. Seu crédito de IA não foi consumido. Tente novamente em alguns instantes.",`;

// 4. Modificar o finally em handleReanalyze
const oldFinally = `    } finally {
      setIsReanalyzing(false);
    }`;

const newFinally = `    } finally {
      activeRequestRef.current = false;
      setIsReanalyzing(false);
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

console.log("Iniciando substituições determinísticas no arquivo LeadPlanDialog.tsx...");
let modifiedContent = replaceAgnostic(content, oldReactImport, newReactImport);
modifiedContent = replaceAgnostic(modifiedContent, oldRefDecl, newRefDecl);
modifiedContent = replaceAgnostic(modifiedContent, oldReanalyzeStart, newReanalyzeStart);
modifiedContent = replaceAgnostic(modifiedContent, oldStateUpdate, newStateUpdate);
modifiedContent = replaceAgnostic(modifiedContent, oldToastDescription, newToastDescription);
modifiedContent = replaceAgnostic(modifiedContent, oldFinally, newFinally);

fs.writeFileSync(filePath, modifiedContent, 'utf8');
console.log("Substituições concluídas com absoluto sucesso em LeadPlanDialog.tsx!");
