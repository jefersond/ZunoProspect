import * as XLSX from 'xlsx';

export interface UserExportData {
  id: string;
  email: string;
  nome_completo: string;
  empresa: string;
  plan_name: string;
  leads_limit: number;
  leads_used_this_month: number;
  is_annual: boolean;
  usa_addon: boolean;
  billing_period_start: string | null;
  billing_period_end: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

const getPlanDisplayName = (planName: string): string => {
  const planNames: Record<string, string> = {
    starter: 'Starter (Grátis)',
    iniciante: 'Iniciante',
    pro: 'Pro',
    agencia: 'Agência',
  };
  return planNames[planName] || planName;
};

export const exportUsersToExcel = (users: UserExportData[]) => {
  const excelData = users.map((user) => ({
    'Email': user.email,
    'Nome': user.nome_completo || '-',
    'Empresa': user.empresa || '-',
    'Plano': getPlanDisplayName(user.plan_name),
    'Leads Usados': user.leads_used_this_month,
    'Limite de Leads': user.leads_limit,
    'Plano Anual': user.is_annual ? 'Sim' : 'Não',
    'Add-on EUA': user.usa_addon ? 'Sim' : 'Não',
    'Data Cadastro': user.created_at 
      ? new Date(user.created_at).toLocaleDateString('pt-BR') 
      : '-',
    'Último Acesso': user.last_sign_in_at 
      ? new Date(user.last_sign_in_at).toLocaleDateString('pt-BR') 
      : '-',
    'Início Período': user.billing_period_start 
      ? new Date(user.billing_period_start).toLocaleDateString('pt-BR') 
      : '-',
    'Fim Período': user.billing_period_end 
      ? new Date(user.billing_period_end).toLocaleDateString('pt-BR') 
      : '-',
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Usuários');

  // Adjust column widths
  const colWidths = [
    { wch: 35 }, // Email
    { wch: 25 }, // Nome
    { wch: 25 }, // Empresa
    { wch: 15 }, // Plano
    { wch: 12 }, // Leads Usados
    { wch: 14 }, // Limite de Leads
    { wch: 12 }, // Plano Anual
    { wch: 12 }, // Add-on EUA
    { wch: 14 }, // Data Cadastro
    { wch: 14 }, // Último Acesso
    { wch: 14 }, // Início Período
    { wch: 14 }, // Fim Período
  ];
  worksheet['!cols'] = colWidths;

  const timestamp = new Date().toISOString().split('T')[0];
  const fileName = `usuarios_${timestamp}.xlsx`;
  XLSX.writeFile(workbook, fileName);

  return fileName;
};
