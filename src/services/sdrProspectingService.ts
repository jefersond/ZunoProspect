import type { LeadProspeccao } from "@/types/lead";
import {
  getSdrMessageFromPlan,
  hasExplicitOptOut,
  resolveLeadHistoryStage,
  type LeadHistoryStage,
} from "./intelligentSevenDayPlan";

// Carregamento dinâmico para evitar falhas em ambientes de teste sem variáveis do Supabase
async function getSupabaseClient() {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
}

export type SdrProspectingStatus =
  | "preparado"
  | "abertura_iniciada"
  | "contato_realizado"
  | "respondeu"
  | "interessado"
  | "reuniao_marcada"
  | "sem_resposta"
  | "descartado"
  | "recusou_optout";

export interface SdrProspectingConfig {
  lead: Partial<LeadProspeccao>;
  dayNumber?: number;
}

export interface GeneratedSdrMessage {
  /** Texto salvo no plano para o dia. Vazio quando o dia não tem mensagem. */
  text: string;
  targetPhone: string | null;
  whatsappUrl: string | null;
  isValidMobile: boolean;
  isFromPlan: boolean;
  dayNumber: number;
}

/**
 * Sanitiza números de telefone do Brasil para o padrão E.164 sem o sinal de +
 * Retorna apenas dígitos. Ex: 5527999998888 ou 27999998888 -> 5527999998888
 */
export function sanitizeBrazilianPhoneNumber(rawPhone?: string | null): {
  cleanNumber: string;
  formattedDisplay: string;
  isCellPhone: boolean;
  isValid: boolean;
} {
  if (!rawPhone) {
    return { cleanNumber: "", formattedDisplay: "", isCellPhone: false, isValid: false };
  }

  // Remove caracteres não numéricos
  let digits = rawPhone.replace(/\D/g, "");

  // Remove 0 inicial se houver (ex: 027...)
  if (digits.startsWith("0") && digits.length > 2) {
    digits = digits.slice(1);
  }

  // Se já começar com código do Brasil 55
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  // No Brasil: DDD (2 dígitos) + número (8 dígitos fixo ou 9 dígitos celular)
  const isCellPhone = digits.length === 11 && digits[2] === "9";
  const isValid = digits.length === 10 || digits.length === 11;

  let formattedDisplay = rawPhone;
  if (digits.length === 11) {
    formattedDisplay = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    formattedDisplay = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  // Adiciona o DDI 55 para envio no WhatsApp
  const cleanNumber = isValid ? `55${digits}` : "";

  return { cleanNumber, formattedDisplay, isCellPhone, isValid };
}

/**
 * Mensagem do SDR para o dia selecionado.
 * REGRA CENTRAL: é exatamente o texto salvo no plano do lead. Nenhuma IA, nenhum modelo local, nenhuma reescrita.
 * Se o dia não tem mensagem (tarefa, sem mensagem ou lead sem plano), o texto é vazio.
 */
export function generateSdrFirstApproachMessage({ lead, dayNumber = 1 }: SdrProspectingConfig): GeneratedSdrMessage {
  const sdrData = getSdrMessageFromPlan(lead, dayNumber);
  const body = sdrData.hasMessage ? sdrData.message : "";

  const { cleanNumber, isCellPhone } = sanitizeBrazilianPhoneNumber(lead.whatsapp_number || lead.telefone);

  return {
    text: body,
    targetPhone: cleanNumber || null,
    whatsappUrl: cleanNumber && body ? `https://wa.me/${cleanNumber}?text=${encodeURIComponent(body)}` : null,
    isValidMobile: isCellPhone,
    isFromPlan: Boolean(body),
    dayNumber,
  };
}

/**
 * Atualiza o status do lead no Supabase mantendo o isolamento de user_id do assinante.
 *
 * REGRAS DE INTEGRIDADE COMERCIAL:
 * 1. 'sem_resposta' NÃO é opt-out nem perdido: mantém status 'em_contato'.
 * 2. 'descartado' representa falta de fit/interesse, sem ser opt-out legal.
 * 3. 'recusou_optout' registra opt-out explícito e definitivo no histórico do lead.
 */
export async function updateSdrProspectingStatus({
  leadId,
  status,
  notes,
}: {
  leadId: string;
  status: SdrProspectingStatus;
  notes?: string;
  approachMessage?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await getSupabaseClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.user) {
      return { success: false, error: "Usuário não autenticado ou sessão expirada." };
    }

    const userId = sessionData.session.user.id;
    const nowIso = new Date().toISOString();

    let dbStatus = "novo";
    let statusDescription = status as string;

    if (status === "abertura_iniciada") {
      dbStatus = "abertura_iniciada";
    } else if (status === "contato_realizado") {
      dbStatus = "em_contato";
    } else if (status === "respondeu") {
      dbStatus = "respondeu";
    } else if (status === "interessado") {
      dbStatus = "qualificacao";
    } else if (status === "reuniao_marcada") {
      dbStatus = "negociacao";
    } else if (status === "sem_resposta") {
      // sem_resposta NÃO é perdido nem opt-out. O lead permanece em contato/aguardando follow-up
      dbStatus = "em_contato";
      statusDescription = "sem_resposta (aguardando retorno)";
    } else if (status === "descartado") {
      dbStatus = "perdido";
      statusDescription = "descartado (sem fit comercial)";
    } else if (status === "recusou_optout") {
      dbStatus = "perdido";
      statusDescription = "opt_out (recusa de contato registrada - bloqueio permanente)";
    }

    // Busca notas existentes para anexar histórico
    const { data: existingLead, error: fetchErr } = await supabase
      .from("leads")
      .select("notas")
      .eq("id", leadId)
      .eq("user_id", userId)
      .single();

    if (fetchErr) {
      return { success: false, error: `Lead não encontrado ou não pertence a este usuário: ${fetchErr.message}` };
    }

    const currentNotes = existingLead?.notas || "";
    const logEntry = `\n[SDR WhatsApp - ${nowIso.slice(0, 10)}] Status: ${statusDescription}${notes ? ` - ${notes}` : ""}`;
    const newNotes = currentNotes ? `${currentNotes}${logEntry}` : logEntry.trim();

    const { error: updateError } = await supabase
      .from("leads")
      .update({
        status: dbStatus,
        notas: newNotes,
        updated_at: nowIso,
      })
      .eq("id", leadId)
      .eq("user_id", userId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido ao atualizar status.";
    return { success: false, error: errorMsg };
  }
}

export {
  getSdrMessageFromPlan,
  hasExplicitOptOut,
  resolveLeadHistoryStage,
};
