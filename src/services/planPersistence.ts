import type { PlanoProspeccaoDia } from "@/types/lead";

export interface DayEdit {
  dia: number;
  mensagem: string;
  assunto_email?: string;
  editedAt: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);

const patchDay = (day: Record<string, unknown>, edit: DayEdit) => ({
  ...day,
  mensagem: edit.mensagem,
  ...(edit.assunto_email !== undefined ? { assunto_email: edit.assunto_email } : {}),
  is_custom_edited: true,
  edited_at: edit.editedAt,
});

/**
 * Aplica a edição manual de UM dia sobre o plano salvo, sem regenerar nada e sem tocar nos outros dias.
 * Preserva o formato salvo (array legado ou objeto da análise com diagnostico, history, etc.).
 * `fallbackDays` só é usado se o plano salvo não tiver a lista de dias no formato esperado.
 */
export function applyDayEdit(previousPayload: unknown, edit: DayEdit, fallbackDays: PlanoProspeccaoDia[] = []): unknown {
  const edited = (days: unknown[]) => days.map((d) => (isRecord(d) && Number(d.dia) === edit.dia ? patchDay(d, edit) : d));

  if (Array.isArray(previousPayload) && previousPayload.some((d) => isRecord(d) && Number(d.dia) === edit.dia)) {
    return edited(previousPayload);
  }
  if (isRecord(previousPayload) && Array.isArray(previousPayload.plano_prospeccao_7dias)
    && previousPayload.plano_prospeccao_7dias.some((d) => isRecord(d) && Number(d.dia) === edit.dia)) {
    return { ...previousPayload, plano_prospeccao_7dias: edited(previousPayload.plano_prospeccao_7dias) };
  }
  // Formato antigo sem lista de dias: grava a lista exibida ao assinante, alterando só o dia editado.
  const base = edited(fallbackDays as unknown[]);
  return isRecord(previousPayload) ? { ...previousPayload, plano_prospeccao_7dias: base } : base;
}

type LeadsClient = {
  from: (table: "leads") => {
    select: (cols: string) => { eq: (col: string, value: string) => { single: () => Promise<{ data: { plano_prospeccao: unknown } | null; error: { message: string } | null }> } };
    update: (values: Record<string, unknown>) => { eq: (col: string, value: string) => Promise<{ error: { message: string } | null }> };
  };
};

export async function savePlanDayEdit(client: LeadsClient, leadId: string, edit: DayEdit, fallbackDays: PlanoProspeccaoDia[]): Promise<void> {
  const { data, error } = await client.from("leads").select("plano_prospeccao").eq("id", leadId).single();
  if (error) throw new Error(error.message);
  const next = applyDayEdit(data?.plano_prospeccao, edit, fallbackDays);
  const { error: updateError } = await client.from("leads").update({ plano_prospeccao: next, updated_at: edit.editedAt }).eq("id", leadId);
  if (updateError) throw new Error(updateError.message);
}
