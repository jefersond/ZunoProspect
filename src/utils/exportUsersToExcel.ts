import * as XLSX from "xlsx";

export interface UserExportData {
  id: string;
  email: string;
  phone?: string;
  nome_completo: string;
  empresa: string;
  avatar_url?: string;
  plan_name: string;
  plan_status?: string;
  leads_limit: number;
  leads_used_this_month: number;
  leads_available_total?: number;
  ai_limit?: number;
  ai_used_this_month?: number;
  ai_available?: number;
  referral_code?: string;
  referred_by?: string | null;
  referred_by_email?: string;
  referral_count?: number;
  referral_pending_count?: number;
  referral_rewarded_count?: number;
  referral_rejected_count?: number;
  referral_bonus_available?: number;
  referral_bonus_earned?: number;
  email_confirmed?: boolean;
  auth_provider?: string;
  is_admin?: boolean;
  is_annual: boolean;
  usa_addon: boolean;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

const getPlanDisplayName = (planName: string): string => {
  const planNames: Record<string, string> = {
    free: "Free",
    starter: "Starter",
    iniciante: "Iniciante",
    pro: "Pro",
    agencia: "Agencia",
  };
  return planNames[planName] || planName;
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : "-";

export const exportUsersToExcel = (users: UserExportData[]) => {
  const excelData = users.map((user) => ({
    Email: user.email,
    Nome: user.nome_completo || "-",
    Empresa: user.empresa || "-",
    Telefone: user.phone || "-",
    Plano: getPlanDisplayName(user.plan_name),
    "Status Plano": user.plan_status || "-",
    "Leads Usados": user.leads_used_this_month,
    "Limite de Leads": user.leads_limit,
    "Leads Disponiveis": user.leads_available_total ?? "-",
    "IA Usada": user.ai_used_this_month ?? "-",
    "Limite IA": user.ai_limit ?? "-",
    "IA Disponivel": user.ai_available ?? "-",
    "Codigo Indicacao": user.referral_code || "-",
    "Indicado Por": user.referred_by_email || "-",
    "Indicacoes Pendentes": user.referral_pending_count ?? 0,
    "Indicacoes Convertidas": user.referral_rewarded_count ?? user.referral_count ?? 0,
    "Indicacoes Rejeitadas": user.referral_rejected_count ?? 0,
    "Bonus Disponivel": user.referral_bonus_available ?? 0,
    "Bonus Gerado": user.referral_bonus_earned ?? 0,
    "Email Confirmado": user.email_confirmed ? "Sim" : "Nao",
    Provider: user.auth_provider || "-",
    Admin: user.is_admin ? "Sim" : "Nao",
    "Plano Anual": user.is_annual ? "Sim" : "Nao",
    "Add-on EUA": user.usa_addon ? "Sim" : "Nao",
    "Stripe Customer": user.stripe_customer_id || "-",
    "Stripe Subscription": user.stripe_subscription_id || "-",
    "Data Cadastro": formatDate(user.created_at),
    "Ultimo Acesso": formatDate(user.last_sign_in_at),
    "Inicio Periodo": formatDate(user.billing_period_start),
    "Fim Periodo": formatDate(user.billing_period_end),
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Usuarios");

  worksheet["!cols"] = [
    { wch: 35 },
    { wch: 25 },
    { wch: 25 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 18 },
    { wch: 35 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 24 },
    { wch: 24 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
  ];

  const timestamp = new Date().toISOString().split("T")[0];
  const fileName = `usuarios_${timestamp}.xlsx`;
  XLSX.writeFile(workbook, fileName);

  return fileName;
};
