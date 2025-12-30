import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserToOnboard {
  user_id: string;
  email: string;
  nome_completo: string | null;
  leads_used: number;
  saved_leads_count?: number;
}

const generateFirstEmailHtml = (nome: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comece a prospectar agora!</title>
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
                Olá${nome ? `, ${nome.split(' ')[0]}` : ''}! 👋
              </h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Notamos que você criou sua conta no <strong>Zuno Prospect</strong>, mas ainda não fez sua primeira busca de leads. 
                Você tem <strong>30 leads gratuitos</strong> esperando por você!
              </p>
              
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 18px;">
                  ✨ O que você pode fazer agora:
                </h3>
                <ul style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>Buscar empresas em qualquer cidade do Brasil</li>
                  <li>Encontrar leads qualificados com WhatsApp e email</li>
                  <li>Receber análise de IA sobre cada lead</li>
                  <li>Gerar planos de abordagem personalizados</li>
                </ul>
              </div>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                É super simples: basta escolher uma cidade, um nicho (ex: "restaurantes", "clínicas") 
                e clicar em buscar. Em segundos você terá uma lista de leads prontos para prospectar!
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://zunoprospect.com.br/prospeccao" 
                       style="display: inline-block; background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(139, 92, 246, 0.4);">
                      🔍 Fazer Minha Primeira Busca
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 30px 0 0;">
                Seus 30 leads gratuitos não expiram. Use quando quiser!
              </p>
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
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const generateSaveLeadsEmailHtml = (nome: string, leadsUsed: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dica: Salve seus melhores leads!</title>
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
                Dica para maximizar sua prospecção
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">
                Parabéns${nome ? `, ${nome.split(' ')[0]}` : ''}! 🎉
              </h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Você já prospectou <strong>${leadsUsed} leads</strong> - isso é ótimo! Mas notamos que você ainda não 
                <strong>salvou nenhum lead</strong> como favorito.
              </p>
              
              <div style="background-color: #ecfdf5; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #10B981;">
                <h3 style="color: #065f46; margin: 0 0 15px; font-size: 18px;">
                  💡 Por que salvar leads?
                </h3>
                <ul style="color: #047857; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>Acesse rapidamente seus melhores prospects</li>
                  <li>Organize seu pipeline de vendas</li>
                  <li>Acompanhe o status de cada negociação</li>
                  <li>Exporte para Excel quando precisar</li>
                </ul>
              </div>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                <strong>Como salvar um lead:</strong> Após buscar leads, clique no ícone de coração ❤️ ou no botão 
                "Salvar" em cada card. Seus leads salvos ficam organizados na aba <strong>"Leads Salvos"</strong>.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://zunoprospect.com.br/leads-salvos" 
                       style="display: inline-block; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
                      📂 Ver Meus Leads Salvos
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 30px 0 0;">
                Organize seus prospects e feche mais negócios!
              </p>
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
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const generateAIAnalysisEmailHtml = (nome: string, savedLeadsCount: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Descubra o poder da Análise de IA!</title>
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
                Potencialize sua prospecção com IA
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">
                ${nome ? `${nome.split(' ')[0]}, você` : 'Você'} já salvou ${savedLeadsCount} lead${savedLeadsCount > 1 ? 's' : ''}! 🎯
              </h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Mas você sabia que pode usar nossa <strong>Inteligência Artificial</strong> para analisar cada lead 
                e criar planos de abordagem personalizados?
              </p>
              
              <div style="background-color: #fffbeb; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #F59E0B;">
                <h3 style="color: #92400e; margin: 0 0 15px; font-size: 18px;">
                  🤖 O que a Análise de IA faz:
                </h3>
                <ul style="color: #b45309; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li><strong>Diagnóstico completo</strong> - Identifica pontos fortes e fracos do lead</li>
                  <li><strong>Probabilidade de conversão</strong> - Score de 0-100% baseado em sinais digitais</li>
                  <li><strong>Plano de abordagem</strong> - Roteiro personalizado para primeiro contato</li>
                  <li><strong>Sugestões de pitch</strong> - Argumentos sob medida para cada lead</li>
                </ul>
              </div>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                <strong>Como usar:</strong> Abra qualquer lead salvo e clique no botão <strong>"Analisar com IA"</strong>. 
                Em segundos você terá um diagnóstico completo e um plano de ação pronto para usar!
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://zunoprospect.com.br/leads-salvos" 
                       style="display: inline-block; background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);">
                      🧠 Analisar Meus Leads com IA
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 30px 0 0;">
                Prospecção mais inteligente = mais vendas fechadas!
              </p>
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

      for (const user of eligibleFirst24h) {
        try {
          const emailResponse = await resend.emails.send({
            from: "Zuno Prospect <noreply@zunoprospect.com.br>",
            to: [user.email],
            subject: "🔍 Seus 30 leads gratuitos estão esperando!",
            html: generateFirstEmailHtml(user.nome_completo || ''),
          });

          if (emailResponse.error) {
            allErrors.push(`first_24h - ${user.email}: ${emailResponse.error.message}`);
            continue;
          }

          await supabase.from('onboarding_emails_sent').insert({
            user_id: user.user_id,
            email_type: 'first_24h',
          });

          totalEmailsSent++;
          console.log(`Sent first_24h email to ${user.email}`);
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
            html: generateSaveLeadsEmailHtml(user.nome_completo || '', user.leads_used),
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
            html: generateAIAnalysisEmailHtml(user.nome_completo || '', user.saved_leads_count || 0),
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
        } catch (emailError: any) {
          allErrors.push(`saved_no_ai - ${user.email}: ${emailError.message}`);
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
