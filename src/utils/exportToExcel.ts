import * as XLSX from 'xlsx';
import type { LeadProspeccao } from '@/types/lead';

export const exportLeadsToExcel = (leads: LeadProspeccao[]) => {
  // Formata os dados para o Excel
  const excelData = leads.map((lead) => {
    const baseData: any = {
      // Dados básicos
      'ID': lead.id,
      'Place ID': lead.placeId || '',
      'Nome': lead.nome,
      'Telefone': lead.telefone || '',
      'WhatsApp Link': lead.whatsapp_link || '',
      'Website': lead.website || '',
      'Instagram': lead.instagram_url || '',
      'Instagram Context': lead.instagram_context || '',
      'Endereço': lead.endereco || '',
      'Cidade': lead.cidade,
      'Nicho': lead.nicho,
      'Foco': lead.foco,
      
      // Dados CNPJ
      'CNPJ': lead.cnpj || '',
      'Razão Social': lead.razao_social || '',
      'Telefone CNPJ': lead.cnpj_telefone || '',
      'Email CNPJ': lead.cnpj_email || '',
      'Situação Cadastral': lead.situacao_cadastral || '',
      'Porte Empresa': lead.porte_empresa || '',
      'CNAE Principal': lead.cnae_principal || '',
      
      // Dados da busca
      'Proximidade Ativa': lead.proximidadeAtiva ? 'Sim' : 'Não',
      'Raio (km)': lead.raioKm || '',
      
      // Sinais digitais
      'WhatsApp no Site': lead.sinais.has_whatsapp_on_site ? 'Sim' : 'Não',
      'Meta Pixel': lead.sinais.has_meta_pixel ? 'Sim' : 'Não',
      'Google Analytics': lead.sinais.has_gtag ? 'Sim' : 'Não',
      'Google Tag Manager': lead.sinais.has_gtm ? 'Sim' : 'Não',
      
      // Análise de IA
      'Probabilidade de Conversão (%)': lead.probabilidade_conversao || 0,
      'Diagnóstico': lead.diagnostico_bullets.join(' ; '),
      
      // Dados adicionais
      'Rating': lead.rating || '',
      'Total Reviews': lead.total_reviews || '',
      'Status': lead.status,
      'Criado em': new Date(lead.created_at).toLocaleString('pt-BR'),
      'IA Gerada em': lead.ai_analise_gerada_em 
        ? new Date(lead.ai_analise_gerada_em).toLocaleString('pt-BR') 
        : '',
    };

    // Adiciona plano de prospecção (7 dias)
    lead.plano_prospecao_7dias.forEach((dia) => {
      const diaNum = dia.dia;
      baseData[`Dia ${diaNum} - Canal`] = dia.canal;
      baseData[`Dia ${diaNum} - Mensagem`] = dia.mensagem;
      baseData[`Dia ${diaNum} - Objeção`] = dia.objecao_provavel;
      baseData[`Dia ${diaNum} - Resposta`] = dia.resposta_sugerida;
      baseData[`Dia ${diaNum} - CTA`] = dia.cta;
    });

    return baseData;
  });

  // Cria o workbook e worksheet
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

  // Ajusta largura das colunas
  const maxWidth = 50;
  const minWidth = 10;
  const colWidths = Object.keys(excelData[0] || {}).map((key) => {
    const maxLength = Math.max(
      key.length,
      ...excelData.map((row) => String(row[key] || '').length)
    );
    return { wch: Math.min(Math.max(maxLength + 2, minWidth), maxWidth) };
  });
  worksheet['!cols'] = colWidths;

  // Gera o arquivo e faz download
  const timestamp = new Date().toISOString().split('T')[0];
  const fileName = `leads_prospeccao_${timestamp}.xlsx`;
  XLSX.writeFile(workbook, fileName);

  return fileName;
};
