import type { LeadProspeccao } from "@/types/lead";

interface TemplateVariables {
  nome: string;
  empresa: string;
  cidade: string;
  nicho: string;
  foco: string;
}

export const extractVariables = (lead: LeadProspeccao): TemplateVariables => {
  return {
    nome: lead.nome || "Cliente",
    empresa: lead.nome || "sua empresa", // usando nome como empresa
    cidade: lead.cidade || "sua cidade",
    nicho: lead.nicho || "seu segmento",
    foco: lead.foco || "marketing digital",
  };
};

export const fillTemplate = (template: string, variables: TemplateVariables): string => {
  let filledTemplate = template;
  
  // Substituir todas as variáveis
  filledTemplate = filledTemplate.replace(/\{nome\}/gi, variables.nome);
  filledTemplate = filledTemplate.replace(/\{empresa\}/gi, variables.empresa);
  filledTemplate = filledTemplate.replace(/\{cidade\}/gi, variables.cidade);
  filledTemplate = filledTemplate.replace(/\{nicho\}/gi, variables.nicho);
  filledTemplate = filledTemplate.replace(/\{foco\}/gi, variables.foco);
  
  return filledTemplate;
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Erro ao copiar:", error);
    return false;
  }
};

export const generateWhatsAppMessage = (lead: LeadProspeccao): string => {
  const variables = extractVariables(lead);
  
  return `Olá! Tudo bem?

Meu nome é [SEU NOME] e trabalho com ${variables.foco.toLowerCase()} para empresas de ${variables.nicho.toLowerCase()} em ${variables.cidade}.

Encontrei ${variables.empresa} e gostaria de conversar sobre como podemos ajudar a melhorar os resultados digitais do seu negócio.

Teria alguns minutos para conversarmos?`;
};
