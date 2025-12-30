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
}

const generateEmailHtml = (nome: string) => `
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

    // Find users who:
    // 1. Registered more than 24 hours ago
    // 2. Have 0 leads used
    // 3. Haven't received onboarding email yet
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: usersToEmail, error: queryError } = await supabase
      .from('user_subscriptions')
      .select(`
        user_id,
        leads_used_this_month,
        profiles!inner(nome_completo)
      `)
      .eq('leads_used_this_month', 0)
      .not('user_id', 'in', `(SELECT user_id FROM onboarding_emails_sent WHERE email_type = 'first_24h')`);

    if (queryError) {
      console.error("Error querying users:", queryError);
      throw queryError;
    }

    console.log(`Found ${usersToEmail?.length || 0} potential users to email`);

    // Get user emails from auth.users (need to query separately)
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error("Error fetching auth users:", authError);
      throw authError;
    }

    // Create a map of user_id to email
    const userEmailMap = new Map<string, string>();
    authUsers.users.forEach(user => {
      userEmailMap.set(user.id, user.email || '');
    });

    // Filter users who registered more than 24h ago
    const eligibleUsers: UserToOnboard[] = [];
    
    for (const subscription of usersToEmail || []) {
      const authUser = authUsers.users.find(u => u.id === subscription.user_id);
      
      if (!authUser || !authUser.email) continue;
      
      // Check if user registered more than 24h ago
      const createdAt = new Date(authUser.created_at);
      const now = new Date();
      const hoursSinceRegistration = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceRegistration >= 24) {
        // Check if already sent email
        const { data: existingEmail } = await supabase
          .from('onboarding_emails_sent')
          .select('id')
          .eq('user_id', subscription.user_id)
          .eq('email_type', 'first_24h')
          .single();
        
        if (!existingEmail) {
          eligibleUsers.push({
            user_id: subscription.user_id,
            email: authUser.email,
            nome_completo: (subscription.profiles as any)?.nome_completo || null,
          });
        }
      }
    }

    console.log(`${eligibleUsers.length} users eligible for onboarding email`);

    let emailsSent = 0;
    let errors: string[] = [];

    // Send emails
    for (const user of eligibleUsers) {
      try {
        console.log(`Sending onboarding email to ${user.email}...`);
        
        const emailResponse = await resend.emails.send({
          from: "Zuno Prospect <noreply@zunoprospect.com.br>",
          to: [user.email],
          subject: "🔍 Seus 30 leads gratuitos estão esperando!",
          html: generateEmailHtml(user.nome_completo || ''),
        });

        if (emailResponse.error) {
          console.error(`Error sending to ${user.email}:`, emailResponse.error);
          errors.push(`${user.email}: ${emailResponse.error.message}`);
          continue;
        }

        // Record that we sent the email
        const { error: insertError } = await supabase
          .from('onboarding_emails_sent')
          .insert({
            user_id: user.user_id,
            email_type: 'first_24h',
          });

        if (insertError) {
          console.error(`Error recording email sent for ${user.email}:`, insertError);
        }

        emailsSent++;
        console.log(`Successfully sent email to ${user.email}`);
        
      } catch (emailError: any) {
        console.error(`Error processing ${user.email}:`, emailError);
        errors.push(`${user.email}: ${emailError.message}`);
      }
    }

    const result = {
      success: true,
      emailsSent,
      totalEligible: eligibleUsers.length,
      errors: errors.length > 0 ? errors : undefined,
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
