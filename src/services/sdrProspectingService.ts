import type { LeadProspeccao } from "@/types/lead";

// Carregamento dinâmico para evitar falhas em ambientes de teste sem variáveis do Supabase
async function getSupabaseClient() {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
}

export type SdrApproachStyle = "consultivo" | "direto" | "exemplo_pratico";

export type SdrProspectingStatus =
  | "preparado"
  | "abertura_iniciada"
  | "contato_realizado"
  | "respondeu"
  | "interessado"
  | "reuniao_marcada"
  | "sem_resposta"
  | "descartado";

export interface SdrProspectingConfig {
  lead: Partial<LeadProspeccao>;
  userServiceName?: string;
  style?: SdrApproachStyle;
  customNotes?: string;
}

export interface GeneratedSdrMessage {
  text: string;
  style: SdrApproachStyle;
  targetPhone: string | null;
  whatsappUrl: string | null;
  isValidMobile: boolean;
  usedSignals: {
    hasWebsite: boolean;
    hasReviews: boolean;
    rating: number | null;
    reviewsCount: number | null;
    hasPixel: boolean;
    city: string;
    niche: string;
  };
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
 * Gera a mensagem contextual de primeira abordagem do SDR (Zuno Propect).
 * NUNCA inventa problemas não observáveis, dados falsos ou promessas exageradas.
 * Ancorada 100% nos fatos reais da empresa (cidade, nicho, presença web, avaliações).
 */
export function generateSdrFirstApproachMessage({
  lead,
  userServiceName = "gestão de tráfego e presença digital",
  style = "consultivo",
}: SdrProspectingConfig): GeneratedSdrMessage {
  const companyName = lead.nome ? lead.nome.trim() : "Olá";
  const city = lead.cidade ? lead.cidade.trim() : "";
  const niche = lead.nicho ? lead.nicho.trim().toLowerCase() : "empresas da região";
  const service = userServiceName.trim() || "prospecção e anúncios locais";

  // Identificação dos sinais reais observáveis
  const hasWebsite = Boolean(lead.website && lead.website.trim().length > 4);
  const reviewsCount = typeof lead.total_reviews === "number" ? lead.total_reviews : null;
  const rating = typeof lead.rating === "number" ? lead.rating : null;
  const hasReviews = Boolean(reviewsCount && reviewsCount > 0);
  const hasPixel = Boolean(lead.sinais?.has_meta_pixel || lead.sinais?.has_gtag);

  // Sanitização de telefone
  const rawPhone = lead.whatsapp_number || lead.telefone;
  const { cleanNumber, isCellPhone, isValid } = sanitizeBrazilianPhoneNumber(rawPhone);

  const cityPhrase = city ? ` em ${city}` : "";

  let body = "";

  if (style === "direto") {
    // Estilo Direto: Curto, respeitoso, objetivo (ideal para secretárias/atendimento comercial)
    let signalLine = "";
    if (hasWebsite) {
      signalLine = `Vi o site e a presença de vocês${cityPhrase}.`;
    } else if (hasReviews) {
      signalLine = `Vi a boa reputação de vocês no Google${cityPhrase} (${reviewsCount} avaliações).`;
    } else {
      signalLine = `Localizei a empresa de vocês aqui${cityPhrase}.`;
    }

    body = `Oi, ${companyName}! Tudo bem?

${signalLine} Atuo com ${service} para ${niche}.

Quem é a pessoa responsável pelo comercial ou marketing aí na empresa? Gostaria de compartilhar uma demonstração rápida de 1 minuto sobre como captar mais clientes da região.

Se preferirem não receber contato, sem problemas.`;
  } else if (style === "exemplo_pratico") {
    // Estilo Exemplo Prático: Focado em demonstrar trabalho sem pitch agressivo
    let contextLine = "";
    if (hasWebsite && hasPixel) {
      contextLine = `Vi que vocês já têm site com estrutura digital${cityPhrase}.`;
    } else if (hasWebsite) {
      contextLine = `Vi que vocês têm site ativo${cityPhrase}, mas parece haver espaço para atrair mais clientes buscando por ${niche} no Google.`;
    } else {
      contextLine = `Mapeei a atuação de vocês${cityPhrase} no segmento de ${niche}.`;
    }

    body = `Olá, pessoal da ${companyName}!

${contextLine}

Trabalho com ${service} e montei um exemplo prático de 1 minuto mostrando como negócios locais do seu segmento podem gerar novas conversas comerciais toda semana.

Faz sentido eu compartilhar essa demonstração curta por aqui com vocês?`;
  } else {
    // Estilo Consultivo (Padrão): Abordagem natural, consultiva e de alto valor
    let observation = "";
    if (hasReviews && reviewsCount && reviewsCount >= 10 && rating) {
      observation = `Vi que vocês têm uma ótima reputação no Google (${rating} estrelas em ${reviewsCount} avaliações)${cityPhrase}.`;
    } else if (hasWebsite) {
      observation = `Encontrei o site e os canais de atendimento de vocês${cityPhrase}.`;
    } else {
      observation = `Vi a atuação de vocês no mercado de ${niche}${cityPhrase}.`;
    }

    body = `Oi, ${companyName}! Tudo bem?

${observation}

Ajudo negócios locais com ${service} a estruturar uma rotina previsível de atração de clientes da própria cidade.

Se fizer sentido para o momento de vocês, posso te mandar um vídeo de aproximadamente um minuto mostrando como funciona na prática?

Se não tiverem interesse agora, sem problema nenhum.`;
  }

  // Gera URL codificada do WhatsApp do próprio assinante
  const whatsappUrl = cleanNumber
    ? `https://wa.me/${cleanNumber}?text=${encodeURIComponent(body)}`
    : null;

  return {
    text: body,
    style,
    targetPhone: cleanNumber || null,
    whatsappUrl,
    isValidMobile: isCellPhone,
    usedSignals: {
      hasWebsite,
      hasReviews,
      rating,
      reviewsCount,
      hasPixel,
      city,
      niche,
    },
  };
}

/**
 * Atualiza o status do lead no Supabase mantendo o isolamento de user_id do assinante.
 * Nunca marca "enviado" de forma automática; registra "abertura_iniciada" no clique
 * e status finais somente após a confirmação manual do assinante.
 */
export async function updateSdrProspectingStatus({
  leadId,
  status,
  notes,
  approachMessage,
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

    // Mapeamento semântico para a coluna 'status' da tabela leads
    let dbStatus = "novo";
    if (status === "abertura_iniciada") dbStatus = "abertura_iniciada";
    else if (status === "contato_realizado") dbStatus = "em_contato";
    else if (status === "respondeu") dbStatus = "respondeu";
    else if (status === "interessado") dbStatus = "qualificacao";
    else if (status === "reuniao_marcada") dbStatus = "negociacao";
    else if (status === "sem_resposta" || status === "descartado") dbStatus = "perdido";

    // Busca notas existentes para anexar histórico se aplicável
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
    const logEntry = `\n[SDR WhatsApp - ${nowIso.slice(0, 10)}] Status: ${status}${notes ? ` - ${notes}` : ""}`;
    const newNotes = currentNotes ? `${currentNotes}${logEntry}` : logEntry.trim();

    // Atualização com escopo estrito de user_id (RLS enforced)
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
  } catch (err: any) {
    return { success: false, error: err.message || "Erro desconhecido ao atualizar status." };
  }
}
