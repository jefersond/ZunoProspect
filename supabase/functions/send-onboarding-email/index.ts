import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate tracking pixel URL with optional test_id for A/B tracking
const generateTrackingPixel = (userId: string, emailType: string, testId?: string): string => {
  let trackingUrl = `${SUPABASE_URL}/functions/v1/track-email-open?uid=${encodeURIComponent(userId)}&type=${encodeURIComponent(emailType)}`;
  if (testId) {
    trackingUrl += `&test_id=${encodeURIComponent(testId)}`;
  }
  return `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="" />`;
};

// Delay helper to respect Resend rate limit (max 2 req/sec)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const RATE_LIMIT_DELAY = 600; // 600ms between emails to stay under 2/sec limit

// Coupon banner HTML
const generateCouponBanner = (): string => `
  <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
    <p style="color: #ffffff; font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">
      🎁 Cupom exclusivo para você
    </p>
    <p style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px; font-family: monospace; letter-spacing: 3px;">
      ZUNO10
    </p>
    <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 0;">
      <strong>10% de desconto</strong> em qualquer plano!
    </p>
  </div>
`;

// A/B Test variant interface
interface ABTestVariant {
  id: string;
  email_type: string;
  variant: string;
  name: string;
  subject: string;
  template_html: string;
  weight: number;
}

// Select A/B test variant based on weights
const selectABVariant = async (supabase: any, emailType: string): Promise<ABTestVariant | null> => {
  try {
    const { data: variants, error } = await supabase
      .from('email_ab_tests')
      .select('*')
      .eq('email_type', emailType)
      .eq('is_active', true);
    
    if (error || !variants || variants.length === 0) {
      return null; // No A/B test active, use default template
    }
    
    // Calculate total weight
    const totalWeight = variants.reduce((sum: number, v: ABTestVariant) => sum + v.weight, 0);
    
    // Generate random number between 0 and totalWeight
    const random = Math.random() * totalWeight;
    
    // Select variant based on cumulative weight
    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight;
      if (random <= cumulative) {
        return variant;
      }
    }
    
    return variants[0]; // Fallback to first variant
  } catch (err) {
    console.error(`Error selecting A/B variant for ${emailType}:`, err);
    return null;
  }
};

// Record A/B test result
const recordABResult = async (
  supabase: any,
  testId: string,
  userId: string,
  variantSent: string
): Promise<void> => {
  try {
    await supabase.from('email_ab_results').insert({
      test_id: testId,
      user_id: userId,
      variant_sent: variantSent,
      sent_at: new Date().toISOString(),
    });
    console.log(`Recorded A/B result: test_id=${testId}, user_id=${userId}, variant=${variantSent}`);
  } catch (err) {
    console.error('Error recording A/B result:', err);
  }
};

// Apply template variables
const applyTemplateVariables = (
  template: string,
  nome: string,
  userId: string,
  emailType: string,
  leadsUsed?: number,
  savedCount?: number,
  testId?: string
): string => {
  let html = template
    .replace(/\{\{nome\}\}/g, nome ? nome.split(' ')[0] : 'Usuário')
    .replace(/\{\{leads_used\}\}/g, String(leadsUsed || 0))
    .replace(/\{\{saved_count\}\}/g, String(savedCount || 0));
  
  // Ensure tracking pixel is present
  if (!html.includes('track-email-open')) {
    // Add tracking pixel before closing body tag
    const trackingPixel = generateTrackingPixel(userId, emailType, testId);
    html = html.replace('</body>', `${trackingPixel}</body>`);
  }
  
  return html;
};

interface UserToOnboard {
  user_id: string;
  email: string;
  nome_completo: string | null;
  leads_used: number;
  saved_leads_count?: number;
}

const generateFirstEmailHtml = (nome: string, userId: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seus concorrentes já estão prospectando - e você?</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                🚀 Zuno Prospect
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">
                Prospecção Inteligente com IA
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">
                ${nome ? `${nome.split(' ')[0]}, enquanto você lê isso...` : 'Enquanto você lê isso...'} ⏰
              </h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                <strong>Seus concorrentes estão fechando negócios</strong> com leads que você poderia ter encontrado primeiro.
                Você tem <strong>30 leads gratuitos</strong> parados na sua conta — empresas reais, com <strong>WhatsApp, Instagram e email</strong> prontos para contato.
              </p>
              
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #f59e0b;">
                <p style="color: #92400e; font-size: 16px; margin: 0; font-weight: 600;">
                  💡 Pense nisso: cada dia sem prospectar é um cliente que vai para outro.
                </p>
              </div>
              
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 18px;">
                  ✨ Em 30 segundos você pode:
                </h3>
                <ul style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>Encontrar donos de negócios com <strong>WhatsApp, Instagram e email</strong> prontos</li>
                  <li>Descobrir quem realmente precisa do seu serviço (a IA te mostra)</li>
                  <li>Receber um roteiro personalizado de como abordar cada lead</li>
                  <li>Saber exatamente o que falar no primeiro contato</li>
                </ul>
              </div>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                <strong>Não precisa de experiência.</strong> É só escolher sua cidade, digitar o nicho (ex: "academias", "clínicas") 
                e deixar a IA trabalhar. Simples assim.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://zunoprospect.com.br/prospeccao" 
                       style="display: inline-block; background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(139, 92, 246, 0.4);">
                      🔍 Encontrar Meus Primeiros Leads Agora
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 30px 0 0;">
                Seus 30 leads gratuitos não expiram. Mas seus concorrentes não esperam.
              </p>
              
              ${generateCouponBanner()}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">
                Você recebeu este email porque se cadastrou no Zuno Prospect.<br>
                Caso não queira receber mais emails, responda com "Cancelar".
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 15px 0 0; text-align: center;">
                © 2024 Zuno Prospect. Todos os direitos reservados.
              </p>
              ${generateTrackingPixel(userId, 'first_24h')}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const generateSaveLeadsEmailHtml = (nome: string, leadsUsed: number, userId: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Você encontrou ${leadsUsed} leads... mas onde eles foram?</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                💾 Zuno Prospect
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">
                Não perca seus melhores leads
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">
                ${nome ? `${nome.split(' ')[0]}, você encontrou ${leadsUsed} leads ótimos...` : `Você encontrou ${leadsUsed} leads ótimos...`} 🎯
              </h2>
              
              <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 8px; padding: 20px; margin: 0 0 25px; border-left: 4px solid #ef4444;">
                <p style="color: #991b1b; font-size: 16px; margin: 0; font-weight: 600;">
                  ⚠️ Problema: Sem salvar, você perde acesso a eles para sempre.
                </p>
                <p style="color: #b91c1c; font-size: 14px; margin: 10px 0 0;">
                  Aquele lead perfeito que você viu ontem? Pode ser impossível encontrá-lo de novo.
                </p>
              </div>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Cada lead que você encontrou tem <strong>WhatsApp, Instagram e email</strong> — informações valiosas 
                que você investiu tempo para conseguir. <strong>Não deixe isso ir embora.</strong>
              </p>
              
              <div style="background-color: #ecfdf5; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #10B981;">
                <h3 style="color: #065f46; margin: 0 0 15px; font-size: 18px;">
                  ✅ Quando você salva um lead, você pode:
                </h3>
                <ul style="color: #047857; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li><strong>Acessar a qualquer momento</strong> — todos os contatos (WhatsApp, Instagram, email) em um só lugar</li>
                  <li><strong>Acompanhar o status</strong> — prospectado, em negociação, fechado</li>
                  <li><strong>Organizar por prioridade</strong> — foque nos leads que mais interessam</li>
                  <li><strong>Exportar para Excel</strong> — trabalhe offline quando precisar</li>
                </ul>
              </div>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                <strong>Leva 1 segundo:</strong> clique no ❤️ em qualquer lead para salvá-lo.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://zunoprospect.com.br/prospeccao" 
                       style="display: inline-block; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
                      🔍 Buscar e Salvar Meus Leads
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 30px 0 0;">
                Leads organizados = mais vendas fechadas. Simples assim.
              </p>
              
              ${generateCouponBanner()}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">
                Você recebeu este email porque se cadastrou no Zuno Prospect.<br>
                Caso não queira receber mais emails, responda com "Cancelar".
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 15px 0 0; text-align: center;">
                © 2024 Zuno Prospect. Todos os direitos reservados.
              </p>
              ${generateTrackingPixel(userId, 'used_not_saved')}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const generateAIAnalysisEmailHtml = (nome: string, savedLeadsCount: number, userId: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Você está abordando seus leads no escuro?</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                🤖 Zuno Prospect
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">
                Pare de adivinhar, comece a saber
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">
                ${nome ? `${nome.split(' ')[0]}, você tem ${savedLeadsCount} leads salvos...` : `Você tem ${savedLeadsCount} leads salvos...`} 🎯
              </h2>
              
              <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 8px; padding: 20px; margin: 0 0 25px; border-left: 4px solid #ef4444;">
                <p style="color: #991b1b; font-size: 16px; margin: 0; font-weight: 600;">
                  ❓ Mas você sabe quais deles realmente vão comprar?
                </p>
                <p style="color: #b91c1c; font-size: 14px; margin: 10px 0 0;">
                  Sem a IA, você está investindo tempo igual em leads de 20% e leads de 90% de chance de fechar.
                </p>
              </div>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                A <strong>Análise de IA</strong> te mostra exatamente quem vale seu tempo — e te dá o roteiro perfeito 
                para abordar cada lead no <strong>WhatsApp, Instagram ou email</strong>.
              </p>
              
              <div style="background-color: #fffbeb; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #F59E0B;">
                <h3 style="color: #92400e; margin: 0 0 15px; font-size: 18px;">
                  🧠 O que a IA revela sobre cada lead:
                </h3>
                <ul style="color: #b45309; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li><strong>Score de 0-100%</strong> — esse lead vai comprar ou é perda de tempo?</li>
                  <li><strong>Diagnóstico completo</strong> — pontos fortes e fracos do negócio</li>
                  <li><strong>Roteiro pronto</strong> — exatamente o que falar no primeiro contato</li>
                  <li><strong>Canal ideal</strong> — WhatsApp, Instagram ou email: qual converte mais para esse lead</li>
                </ul>
              </div>
              
              <div style="background-color: #f0fdf4; border-radius: 8px; padding: 15px; margin: 25px 0; text-align: center;">
                <p style="color: #166534; font-size: 16px; margin: 0; font-weight: 600;">
                  💡 Resultado: você foca nos leads certos e fecha mais negócios em menos tempo.
                </p>
              </div>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://zunoprospect.com.br/leads-salvos" 
                       style="display: inline-block; background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);">
                      🤖 Analisar Meus ${savedLeadsCount} Leads Agora
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 30px 0 0;">
                Leva segundos. Economiza horas de ligações perdidas.
              </p>
              
              ${generateCouponBanner()}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">
                Você recebeu este email porque se cadastrou no Zuno Prospect.<br>
                Caso não queira receber mais emails, responda com "Cancelar".
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 15px 0 0; text-align: center;">
                © 2024 Zuno Prospect. Todos os direitos reservados.
              </p>
              ${generateTrackingPixel(userId, 'saved_no_ai')}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const generateInactiveEmailHtml = (nome: string, daysSinceLastActivity: number, userId: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${daysSinceLastActivity} dias. Quantos clientes seus concorrentes fecharam?</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #EC4899 0%, #BE185D 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                ⏰ Zuno Prospect
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">
                O tempo não para — seus concorrentes também não
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">
                ${nome ? `${nome.split(' ')[0]}, ${daysSinceLastActivity} dias.` : `${daysSinceLastActivity} dias.`} ⏳
              </h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 10px;">
                <strong>Quantos clientes seus concorrentes fecharam nesse tempo?</strong>
              </p>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Enquanto você estava fora, dezenas de novos negócios abriram na sua região — 
                todos com <strong>WhatsApp, Instagram e email</strong> prontos para contato.
              </p>
              
              <div style="background-color: #fdf2f8; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #EC4899;">
                <h3 style="color: #9d174d; margin: 0 0 15px; font-size: 18px;">
                  🚨 O que você está perdendo agora mesmo:
                </h3>
                <ul style="color: #be185d; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li><strong>Empresas novas</strong> precisando do seu serviço AGORA</li>
                  <li><strong>Leads quentes</strong> com WhatsApp, Instagram e email prontos para contato</li>
                  <li><strong>Oportunidades exclusivas</strong> que seu concorrente pode pegar primeiro</li>
                  <li><strong>Negócios de alta conversão</strong> passando despercebidos</li>
                </ul>
              </div>
              
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 8px; padding: 15px; margin: 25px 0; text-align: center;">
                <p style="color: #92400e; font-size: 16px; margin: 0; font-weight: 600;">
                  ⚡ Leva 30 segundos. Pode render o cliente do mês.
                </p>
              </div>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://zunoprospect.com.br/prospeccao" 
                       style="display: inline-block; background: linear-gradient(135deg, #EC4899 0%, #BE185D 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(236, 72, 153, 0.4);">
                      🔍 Ver Quem Abriu na Minha Região
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 30px 0 0;">
                Volte a prospectar. Seus concorrentes nunca pararam.
              </p>
              
              ${generateCouponBanner()}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">
                Você recebeu este email porque se cadastrou no Zuno Prospect.<br>
                Caso não queira receber mais emails, responda com "Cancelar".
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 15px 0 0; text-align: center;">
                © 2024 Zuno Prospect. Todos os direitos reservados.
              </p>
              ${generateTrackingPixel(userId, 'inactive_7d')}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const generateUpgradeEmailHtml = (nome: string, leadsUsed: number, leadsLimit: number, userId: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Você está limitado a ${leadsLimit} leads/mês. Seus concorrentes não.</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                ⚡ Zuno Prospect
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">
                Hora de escalar sua prospecção
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">
                ${nome ? `${nome.split(' ')[0]}, você está` : 'Você está'} limitado. Seus concorrentes não. 📊
              </h2>
              
              <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 8px; padding: 20px; margin: 0 0 25px; border-left: 4px solid #ef4444;">
                <p style="color: #991b1b; font-size: 16px; margin: 0; font-weight: 600;">
                  📉 A matemática é simples:
                </p>
                <p style="color: #b91c1c; font-size: 14px; margin: 10px 0 0;">
                  Com ${leadsLimit} leads/mês, você precisa fechar 1 a cada ${Math.round(leadsLimit / 3)} contatos só para cobrir o custo do seu tempo.
                  <strong>Com 200 leads, você tem 6x mais chances de encontrar clientes ideais.</strong>
                </p>
              </div>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Você já usou <strong>${leadsUsed} de ${leadsLimit} leads</strong>. Quando acabar, fica parado esperando 
                o próximo mês — enquanto <strong>seus concorrentes continuam fechando negócios</strong>.
              </p>
              
              <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #3B82F6;">
                <h3 style="color: #1e40af; margin: 0 0 15px; font-size: 18px;">
                  🚀 O que você ganha com o PRO:
                </h3>
                <ul style="color: #1d4ed8; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li><strong>200 leads/mês</strong> = 6x mais oportunidades de fechar negócios</li>
                  <li><strong>Dados completos</strong>: CNPJ, responsável, WhatsApp, Instagram, email</li>
                  <li><strong>IA ilimitada</strong>: saiba quem vale seu tempo antes de ligar</li>
                  <li><strong>Exportação Excel</strong>: trabalhe offline, organize do seu jeito</li>
                </ul>
              </div>
              
              <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
                <p style="color: #166534; font-size: 14px; margin: 0 0 10px;">
                  💰 Faça as contas:
                </p>
                <p style="color: #166534; font-size: 18px; margin: 0; font-weight: 700;">
                  Se você fechar 1 cliente a mais por mês, o plano JÁ SE PAGOU.
                </p>
                <p style="color: #15803d; font-size: 14px; margin: 10px 0 0;">
                  R$ 97/mês = menos de <strong>R$ 3,30 por dia</strong>
                </p>
              </div>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://zunoprospect.com.br/precos" 
                       style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
                      🚀 Desbloquear 200 Leads/Mês Agora
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 30px 0 0;">
                O melhor investimento é aquele que traz retorno. O PRO traz.
              </p>
              
              ${generateCouponBanner()}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">
                Você recebeu este email porque se cadastrou no Zuno Prospect.<br>
                Caso não queira receber mais emails, responda com "Cancelar".
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 15px 0 0; text-align: center;">
                © 2024 Zuno Prospect. Todos os direitos reservados.
              </p>
              ${generateTrackingPixel(userId, 'never_upgraded')}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting onboarding email job...");
    
    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get user emails from auth.users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error("Error fetching auth users:", authError);
      throw authError;
    }

    let totalEmailsSent = 0;
    let allErrors: string[] = [];

    // =============================================
    // EMAIL 1: First 24h - Users who haven't used leads
    // =============================================
    console.log("Processing first_24h emails...");
    
    const { data: usersNoLeads, error: queryError1 } = await supabase
      .from('user_subscriptions')
      .select(`
        user_id,
        leads_used_this_month,
        profiles!inner(nome_completo)
      `)
      .eq('leads_used_this_month', 0);

    if (queryError1) {
      console.error("Error querying users for first_24h:", queryError1);
    } else {
      const eligibleFirst24h: UserToOnboard[] = [];
      
      for (const subscription of usersNoLeads || []) {
        const authUser = authUsers.users.find(u => u.id === subscription.user_id);
        if (!authUser || !authUser.email) continue;
        
        const createdAt = new Date(authUser.created_at);
        const now = new Date();
        const hoursSinceRegistration = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceRegistration >= 24) {
          const { data: existingEmail } = await supabase
            .from('onboarding_emails_sent')
            .select('id')
            .eq('user_id', subscription.user_id)
            .eq('email_type', 'first_24h')
            .single();
          
          if (!existingEmail) {
            eligibleFirst24h.push({
              user_id: subscription.user_id,
              email: authUser.email,
              nome_completo: (subscription.profiles as any)?.nome_completo || null,
              leads_used: 0,
            });
          }
        }
      }

      console.log(`${eligibleFirst24h.length} users eligible for first_24h email`);

      // Check for A/B test variant
      const abVariantFirst24h = await selectABVariant(supabase, 'first_24h');
      if (abVariantFirst24h) {
        console.log(`Using A/B variant ${abVariantFirst24h.variant} for first_24h`);
      }

      for (const user of eligibleFirst24h) {
        try {
          let emailSubject: string;
          let emailHtml: string;
          
          if (abVariantFirst24h) {
            // Use A/B test template
            emailSubject = abVariantFirst24h.subject;
            emailHtml = applyTemplateVariables(
              abVariantFirst24h.template_html,
              user.nome_completo || '',
              user.user_id,
              'first_24h',
              user.leads_used,
              undefined,
              abVariantFirst24h.id
            );
          } else {
            // Use default template
            emailSubject = "🔍 Seus concorrentes já estão prospectando - e você?";
            emailHtml = generateFirstEmailHtml(user.nome_completo || '', user.user_id);
          }
          
          const emailResponse = await resend.emails.send({
            from: "Zuno Prospect <noreply@zunoprospect.com.br>",
            to: [user.email],
            subject: emailSubject,
            html: emailHtml,
          });

          if (emailResponse.error) {
            allErrors.push(`first_24h - ${user.email}: ${emailResponse.error.message}`);
            continue;
          }

          await supabase.from('onboarding_emails_sent').insert({
            user_id: user.user_id,
            email_type: 'first_24h',
          });

          // Record A/B test result if using variant
          if (abVariantFirst24h) {
            await recordABResult(supabase, abVariantFirst24h.id, user.user_id, abVariantFirst24h.variant);
          }

          totalEmailsSent++;
          console.log(`Sent first_24h email to ${user.email}${abVariantFirst24h ? ` (variant ${abVariantFirst24h.variant})` : ''}`);
          await delay(RATE_LIMIT_DELAY); // Rate limit protection
        } catch (emailError: any) {
          allErrors.push(`first_24h - ${user.email}: ${emailError.message}`);
        }
      }
    }

    // =============================================
    // EMAIL 2: Used leads but haven't saved any
    // =============================================
    console.log("Processing used_not_saved emails...");
    
    const { data: usersWithLeads, error: queryError2 } = await supabase
      .from('user_subscriptions')
      .select(`
        user_id,
        leads_used_this_month,
        profiles!inner(nome_completo)
      `)
      .gt('leads_used_this_month', 0);

    if (queryError2) {
      console.error("Error querying users for used_not_saved:", queryError2);
    } else {
      const eligibleUsedNotSaved: UserToOnboard[] = [];
      
      for (const subscription of usersWithLeads || []) {
        const authUser = authUsers.users.find(u => u.id === subscription.user_id);
        if (!authUser || !authUser.email) continue;
        
        // Check if user registered more than 48h ago (give them time to save)
        const createdAt = new Date(authUser.created_at);
        const now = new Date();
        const hoursSinceRegistration = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceRegistration >= 48) {
          // Check if already sent this email type
          const { data: existingEmail } = await supabase
            .from('onboarding_emails_sent')
            .select('id')
            .eq('user_id', subscription.user_id)
            .eq('email_type', 'used_not_saved')
            .single();
          
          if (!existingEmail) {
            // Check if user has any saved leads
            const { count: savedLeadsCount } = await supabase
              .from('leads')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', subscription.user_id)
              .eq('salvo', true);
            
            if (savedLeadsCount === 0) {
              eligibleUsedNotSaved.push({
                user_id: subscription.user_id,
                email: authUser.email,
                nome_completo: (subscription.profiles as any)?.nome_completo || null,
                leads_used: subscription.leads_used_this_month,
              });
            }
          }
        }
      }

      console.log(`${eligibleUsedNotSaved.length} users eligible for used_not_saved email`);

      for (const user of eligibleUsedNotSaved) {
        try {
          const emailResponse = await resend.emails.send({
            from: "Zuno Prospect <noreply@zunoprospect.com.br>",
            to: [user.email],
            subject: "💡 Dica: Salve seus melhores leads para não perdê-los!",
            html: generateSaveLeadsEmailHtml(user.nome_completo || '', user.leads_used, user.user_id),
          });

          if (emailResponse.error) {
            allErrors.push(`used_not_saved - ${user.email}: ${emailResponse.error.message}`);
            continue;
          }

          await supabase.from('onboarding_emails_sent').insert({
            user_id: user.user_id,
            email_type: 'used_not_saved',
          });

          totalEmailsSent++;
          console.log(`Sent used_not_saved email to ${user.email}`);
          await delay(RATE_LIMIT_DELAY); // Rate limit protection
        } catch (emailError: any) {
          allErrors.push(`used_not_saved - ${user.email}: ${emailError.message}`);
        }
      }
    }

    // =============================================
    // EMAIL 3: Saved leads but haven't used AI analysis
    // =============================================
    console.log("Processing saved_no_ai emails...");
    
    // Get users who have saved leads
    const { data: usersWithSavedLeads, error: queryError3 } = await supabase
      .from('leads')
      .select('user_id')
      .eq('salvo', true)
      .is('ai_analise_gerada_em', null);

    if (queryError3) {
      console.error("Error querying users for saved_no_ai:", queryError3);
    } else {
      // Get unique user IDs with saved leads but no AI analysis
      const userIdsWithSavedNoAI = [...new Set((usersWithSavedLeads || []).map(l => l.user_id))];
      
      const eligibleSavedNoAI: UserToOnboard[] = [];
      
      for (const userId of userIdsWithSavedNoAI) {
        const authUser = authUsers.users.find(u => u.id === userId);
        if (!authUser || !authUser.email) continue;
        
        // Check if user registered more than 72h ago
        const createdAt = new Date(authUser.created_at);
        const now = new Date();
        const hoursSinceRegistration = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceRegistration >= 72) {
          // Check if already sent this email type
          const { data: existingEmail } = await supabase
            .from('onboarding_emails_sent')
            .select('id')
            .eq('user_id', userId)
            .eq('email_type', 'saved_no_ai')
            .single();
          
          if (!existingEmail) {
            // Check if user has ANY leads with AI analysis
            const { count: aiLeadsCount } = await supabase
              .from('leads')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', userId)
              .not('ai_analise_gerada_em', 'is', null);
            
            // Only send if user has zero AI-analyzed leads
            if (aiLeadsCount === 0) {
              // Get count of saved leads for the email
              const { count: savedCount } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('salvo', true);
              
              // Get profile info
              const { data: profile } = await supabase
                .from('profiles')
                .select('nome_completo')
                .eq('id', userId)
                .single();
              
              eligibleSavedNoAI.push({
                user_id: userId,
                email: authUser.email,
                nome_completo: profile?.nome_completo || null,
                leads_used: 0,
                saved_leads_count: savedCount || 0,
              });
            }
          }
        }
      }

      console.log(`${eligibleSavedNoAI.length} users eligible for saved_no_ai email`);

      for (const user of eligibleSavedNoAI) {
        try {
          const emailResponse = await resend.emails.send({
            from: "Zuno Prospect <noreply@zunoprospect.com.br>",
            to: [user.email],
            subject: "🤖 Você está perdendo o poder da IA nos seus leads!",
            html: generateAIAnalysisEmailHtml(user.nome_completo || '', user.saved_leads_count || 0, user.user_id),
          });

          if (emailResponse.error) {
            allErrors.push(`saved_no_ai - ${user.email}: ${emailResponse.error.message}`);
            continue;
          }

          await supabase.from('onboarding_emails_sent').insert({
            user_id: user.user_id,
            email_type: 'saved_no_ai',
          });

          totalEmailsSent++;
          console.log(`Sent saved_no_ai email to ${user.email}`);
          await delay(RATE_LIMIT_DELAY); // Rate limit protection
        } catch (emailError: any) {
          allErrors.push(`saved_no_ai - ${user.email}: ${emailError.message}`);
        }
      }
    }

    // =============================================
    // EMAIL 4: Inactive users (7+ days)
    // =============================================
    console.log("Processing inactive_7d emails...");
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Get all users and check their last activity
    const eligibleInactive: UserToOnboard[] = [];
    
    for (const authUser of authUsers.users) {
      if (!authUser.email) continue;
      
      // Check last sign in
      const lastSignIn = authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at) : null;
      const now = new Date();
      
      // Skip if user signed in recently (within 7 days)
      if (lastSignIn && lastSignIn > sevenDaysAgo) continue;
      
      // Calculate days since last activity
      const daysSinceActivity = lastSignIn 
        ? Math.floor((now.getTime() - lastSignIn.getTime()) / (1000 * 60 * 60 * 24))
        : 7;
      
      // Only send to users inactive for 7+ days
      if (daysSinceActivity >= 7) {
        // Check if already sent this email type
        const { data: existingEmail } = await supabase
          .from('onboarding_emails_sent')
          .select('id')
          .eq('user_id', authUser.id)
          .eq('email_type', 'inactive_7d')
          .single();
        
        if (!existingEmail) {
          // Get profile info
          const { data: profile } = await supabase
            .from('profiles')
            .select('nome_completo')
            .eq('id', authUser.id)
            .single();
          
          eligibleInactive.push({
            user_id: authUser.id,
            email: authUser.email,
            nome_completo: profile?.nome_completo || null,
            leads_used: daysSinceActivity,
          });
        }
      }
    }

    console.log(`${eligibleInactive.length} users eligible for inactive_7d email`);

    for (const user of eligibleInactive) {
      try {
        const emailResponse = await resend.emails.send({
          from: "Zuno Prospect <noreply@zunoprospect.com.br>",
          to: [user.email],
          subject: "💜 Sentimos sua falta no Zuno Prospect!",
          html: generateInactiveEmailHtml(user.nome_completo || '', user.leads_used, user.user_id),
        });

        if (emailResponse.error) {
          allErrors.push(`inactive_7d - ${user.email}: ${emailResponse.error.message}`);
          continue;
        }

        await supabase.from('onboarding_emails_sent').insert({
          user_id: user.user_id,
          email_type: 'inactive_7d',
        });

        totalEmailsSent++;
        console.log(`Sent inactive_7d email to ${user.email}`);
        await delay(RATE_LIMIT_DELAY); // Rate limit protection
      } catch (emailError: any) {
        allErrors.push(`inactive_7d - ${user.email}: ${emailError.message}`);
      }
    }

    // =============================================
    // EMAIL 5: Users on starter plan who haven't upgraded
    // =============================================
    console.log("Processing never_upgraded emails...");
    
    const { data: starterUsers, error: queryError5 } = await supabase
      .from('user_subscriptions')
      .select(`
        user_id,
        plan_name,
        leads_used_this_month,
        leads_limit,
        profiles!inner(nome_completo)
      `)
      .eq('plan_name', 'starter')
      .gt('leads_used_this_month', 15); // At least used half of their free leads

    if (queryError5) {
      console.error("Error querying users for never_upgraded:", queryError5);
    } else {
      const eligibleNeverUpgraded: UserToOnboard[] = [];
      
      for (const subscription of starterUsers || []) {
        const authUser = authUsers.users.find(u => u.id === subscription.user_id);
        if (!authUser || !authUser.email) continue;
        
        // Check if user registered more than 14 days ago
        const createdAt = new Date(authUser.created_at);
        const now = new Date();
        const daysSinceRegistration = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceRegistration >= 14) {
          // Check if already sent this email type
          const { data: existingEmail } = await supabase
            .from('onboarding_emails_sent')
            .select('id')
            .eq('user_id', subscription.user_id)
            .eq('email_type', 'never_upgraded')
            .single();
          
          if (!existingEmail) {
            eligibleNeverUpgraded.push({
              user_id: subscription.user_id,
              email: authUser.email,
              nome_completo: (subscription.profiles as any)?.nome_completo || null,
              leads_used: subscription.leads_used_this_month,
              saved_leads_count: subscription.leads_limit,
            });
          }
        }
      }

      console.log(`${eligibleNeverUpgraded.length} users eligible for never_upgraded email`);

      for (const user of eligibleNeverUpgraded) {
        try {
          const emailResponse = await resend.emails.send({
            from: "Zuno Prospect <noreply@zunoprospect.com.br>",
            to: [user.email],
            subject: "⚡ Desbloqueie mais leads e recursos PRO!",
            html: generateUpgradeEmailHtml(user.nome_completo || '', user.leads_used, user.saved_leads_count || 30, user.user_id),
          });

          if (emailResponse.error) {
            allErrors.push(`never_upgraded - ${user.email}: ${emailResponse.error.message}`);
            continue;
          }

          await supabase.from('onboarding_emails_sent').insert({
            user_id: user.user_id,
            email_type: 'never_upgraded',
          });

          totalEmailsSent++;
          console.log(`Sent never_upgraded email to ${user.email}`);
          await delay(RATE_LIMIT_DELAY); // Rate limit protection
        } catch (emailError: any) {
          allErrors.push(`never_upgraded - ${user.email}: ${emailError.message}`);
        }
      }
    }

    const result = {
      success: true,
      emailsSent: totalEmailsSent,
      errors: allErrors.length > 0 ? allErrors : undefined,
      timestamp: new Date().toISOString(),
    };

    console.log("Onboarding email job completed:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in send-onboarding-email function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
