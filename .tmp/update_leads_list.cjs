const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/components/prospeccao/LeadsList.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Declarar activeRequestsRef
const oldStateDecl = `  const [reanalyzingLeads, setReanalyzingLeads] = useState<Set<string>>(new Set());`;
const newStateDecl = `  const [reanalyzingLeads, setReanalyzingLeads] = useState<Set<string>>(new Set());
  const activeRequestsRef = useRef<Set<string>>(new Set());`;

// 2. Modificar o início de reanalyzeLead
const oldReanalyzeStart = `  const reanalyzeLead = async (lead: LeadProspeccao, source = "leads_list") => {
    if (!canAnalyzeAI) {`;

const newReanalyzeStart = `  const reanalyzeLead = async (lead: LeadProspeccao, source = "leads_list") => {
    if (activeRequestsRef.current.has(lead.id) || reanalyzingLeads.has(lead.id)) {
      console.log("Clique duplo detectado e prevenido para o lead:", lead.id);
      trackEvent("AI_Analysis_Duplicate_Click_Prevented", {
        lead_id: lead.id,
        lead_name: lead.nome,
        source,
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (!canAnalyzeAI) {`;

const oldStateUpdate = `    setReanalyzingLeads(prev => new Set(prev).add(lead.id));`;
const newStateUpdate = `    activeRequestsRef.current.add(lead.id);
    setReanalyzingLeads(prev => new Set(prev).add(lead.id));`;

// 3. Modificar o catch toast de erro de IA
const oldToast = `      toast({
        variant: "destructive",
        title: "Erro na análise",
        description: error.message || "Não foi possível analisar o lead",
      });`;

const newToast = `      const isBalanceError = (error.message || "").toLowerCase().includes("limite") || 
                             (error.message || "").toLowerCase().includes("crédito") || 
                             (error.message || "").toLowerCase().includes("saldo") ||
                             (error.message || "").includes("402");
      
      toast({
        variant: "destructive",
        title: "Erro na análise",
        description: isBalanceError 
          ? "Você não tem análises IA disponíveis." 
          : "Não conseguimos concluir a análise agora. Seu crédito de IA não foi consumido. Tente novamente em alguns instantes.",
      });`;

// 4. Modificar o finally em reanalyzeLead
const oldFinally = `    } finally {
      setReanalyzingLeads(prev => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }`;

const newFinally = `    } finally {
      activeRequestsRef.current.delete(lead.id);
      setReanalyzingLeads(prev => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
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

console.log("Iniciando substituições determinísticas no arquivo LeadsList.tsx...");
let modifiedContent = replaceAgnostic(content, oldStateDecl, newStateDecl);
modifiedContent = replaceAgnostic(modifiedContent, oldReanalyzeStart, newReanalyzeStart);
modifiedContent = replaceAgnostic(modifiedContent, oldStateUpdate, newStateUpdate);
modifiedContent = replaceAgnostic(modifiedContent, oldToast, newToast);
modifiedContent = replaceAgnostic(modifiedContent, oldFinally, newFinally);

fs.writeFileSync(filePath, modifiedContent, 'utf8');
console.log("Substituições concluídas com absoluto sucesso em LeadsList.tsx!");
