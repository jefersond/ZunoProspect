import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Users, Clock, TrendingUp, RefreshCw, MailOpen, Percent, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EmailStats {
  email_type: string;
  sent: number;
  opened: number;
}

interface RecentEmail {
  id: string;
  user_id: string;
  email_type: string;
  sent_at: string;
  opened_at: string | null;
}

const EMAIL_TYPE_LABELS: Record<string, { label: string; color: string; description: string; subject: string }> = {
  first_24h: {
    label: "Primeira busca",
    color: "#8B5CF6",
    description: "Usuários que não fizeram busca em 24h",
    subject: "🚀 Seus 30 leads gratuitos estão esperando!",
  },
  used_not_saved: {
    label: "Salvar leads",
    color: "#10B981",
    description: "Usou leads mas não salvou nenhum",
    subject: "💾 Dica: Salve seus melhores leads!",
  },
  saved_no_ai: {
    label: "Análise IA",
    color: "#F59E0B",
    description: "Salvou leads mas não usou IA",
    subject: "🤖 Você sabia? IA pode analisar seus leads!",
  },
  inactive_7d: {
    label: "Reengajamento",
    color: "#EC4899",
    description: "Usuários inativos há 7+ dias",
    subject: "💜 Sentimos sua falta no Zuno Prospect!",
  },
  never_upgraded: {
    label: "Upgrade",
    color: "#3B82F6",
    description: "Nunca fizeram upgrade do plano",
    subject: "⚡ Desbloqueie todo o potencial do Zuno Prospect!",
  },
};

// Email templates for preview
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

const EMAIL_TEMPLATES: Record<string, (nome: string, param?: number) => string> = {
  first_24h: (nome: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">🚀 Zuno Prospect</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Prospecção Inteligente com IA</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">Olá${nome ? `, ${nome}` : ''}! 👋</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Notamos que você criou sua conta no <strong>Zuno Prospect</strong>, mas ainda não fez sua primeira busca de leads. 
                Você tem <strong>30 leads gratuitos</strong> esperando por você!
              </p>
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 18px;">✨ O que você pode fazer agora:</h3>
                <ul style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>Buscar empresas em qualquer cidade do Brasil</li>
                  <li>Encontrar leads qualificados com WhatsApp, Instagram e email</li>
                  <li>Receber análise de IA sobre cada lead</li>
                  <li>Gerar planos de abordagem personalizados</li>
                </ul>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://zunoprospect.com.br/prospeccao" style="display: inline-block; background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      🔍 Fazer Minha Primeira Busca
                    </a>
                  </td>
                </tr>
              </table>
              ${generateCouponBanner()}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">
                Você recebeu este email porque se cadastrou no Zuno Prospect.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`,
  used_not_saved: (nome: string, leadsUsed?: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">💾 Zuno Prospect</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Dica para maximizar sua prospecção</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">Parabéns${nome ? `, ${nome}` : ''}! 🎉</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Você já prospectou <strong>${leadsUsed || 15} leads</strong> - isso é ótimo! Mas notamos que você ainda não 
                <strong>salvou nenhum lead</strong> como favorito.
              </p>
              <div style="background-color: #ecfdf5; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #10B981;">
                <h3 style="color: #065f46; margin: 0 0 15px; font-size: 18px;">💡 Por que salvar leads?</h3>
                <ul style="color: #047857; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>Acesse rapidamente seus melhores prospects</li>
                  <li>Organize seu pipeline de vendas</li>
                  <li>Acompanhe o status de cada negociação</li>
                </ul>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://zunoprospect.com.br/leads-salvos" style="display: inline-block; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      📂 Ver Meus Leads Salvos
                    </a>
                  </td>
                </tr>
              </table>
              ${generateCouponBanner()}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">
                Você recebeu este email porque se cadastrou no Zuno Prospect.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`,
  saved_no_ai: (nome: string, savedLeads?: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">🤖 Zuno Prospect</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Potencialize sua prospecção com IA</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">${nome ? `${nome}, você` : 'Você'} já salvou ${savedLeads || 5} leads! 🎯</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Mas você sabia que pode usar nossa <strong>Inteligência Artificial</strong> para analisar cada lead 
                e criar planos de abordagem personalizados?
              </p>
              <div style="background-color: #fffbeb; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #F59E0B;">
                <h3 style="color: #92400e; margin: 0 0 15px; font-size: 18px;">🤖 O que a Análise de IA faz:</h3>
                <ul style="color: #b45309; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li><strong>Diagnóstico completo</strong> - Identifica pontos fortes e fracos</li>
                  <li><strong>Probabilidade de conversão</strong> - Score de 0-100%</li>
                  <li><strong>Plano de abordagem</strong> - Roteiro personalizado</li>
                </ul>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://zunoprospect.com.br/leads-salvos" style="display: inline-block; background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      🧠 Analisar Meus Leads com IA
                    </a>
                  </td>
                </tr>
              </table>
              ${generateCouponBanner()}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">
                Você recebeu este email porque se cadastrou no Zuno Prospect.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`,
  inactive_7d: (nome: string, days?: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #EC4899 0%, #BE185D 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">💜 Zuno Prospect</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Sentimos sua falta!</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">Olá${nome ? `, ${nome}` : ''}! 👋</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Notamos que você não acessa o <strong>Zuno Prospect</strong> há ${days || 7} dias. 
                Enquanto isso, novos leads podem estar surgindo na sua região!
              </p>
              <div style="background-color: #fdf2f8; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #EC4899;">
                <h3 style="color: #9d174d; margin: 0 0 15px; font-size: 18px;">🚀 O que você pode estar perdendo:</h3>
                <ul style="color: #be185d; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>Novos negócios abriram na sua região</li>
                  <li>Leads com alta probabilidade de conversão</li>
                  <li>Oportunidades antes da concorrência</li>
                </ul>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://zunoprospect.com.br/prospeccao" style="display: inline-block; background: linear-gradient(135deg, #EC4899 0%, #BE185D 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      🔍 Buscar Novos Leads
                    </a>
                  </td>
                </tr>
              </table>
              ${generateCouponBanner()}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">
                Você recebeu este email porque se cadastrou no Zuno Prospect.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`,
  never_upgraded: (nome: string, leadsUsed?: number) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr><td style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">⚡ Zuno Prospect</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Hora de escalar sua prospecção</p>
          </td></tr>
          <tr><td style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">${nome ? `${nome}, você está` : 'Você está'} limitado. Seus concorrentes não. 📊</h2>
              <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 8px; padding: 20px; margin: 0 0 25px; border-left: 4px solid #ef4444;">
                <p style="color: #991b1b; font-size: 16px; margin: 0; font-weight: 600;">📉 A matemática é simples:</p>
                <p style="color: #b91c1c; font-size: 14px; margin: 10px 0 0;">Com 30 leads/mês, você precisa fechar 1 a cada 10 contatos. <strong>Com 200 leads, você tem 6x mais chances.</strong></p>
              </div>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">Você já usou <strong>${leadsUsed || 25}/30 leads</strong>. Quando acabar, fica parado — enquanto <strong>seus concorrentes continuam fechando</strong>.</p>
              <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #3B82F6;">
                <h3 style="color: #1e40af; margin: 0 0 15px; font-size: 18px;">🚀 O que você ganha com o PRO:</h3>
                <ul style="color: #1d4ed8; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li><strong>200 leads/mês</strong> = 6x mais oportunidades</li>
                  <li><strong>Dados completos</strong>: CNPJ, responsável, WhatsApp, Instagram, email</li>
                  <li><strong>IA ilimitada</strong>: saiba quem vale seu tempo antes de ligar</li>
                </ul>
              </div>
              <div style="background-color: #f0fdf4; border-radius: 8px; padding: 15px; margin: 25px 0; text-align: center;">
                <p style="color: #166534; font-size: 18px; margin: 0; font-weight: 700;">Se você fechar 1 cliente a mais por mês, o plano JÁ SE PAGOU.</p>
                <p style="color: #15803d; font-size: 14px; margin: 10px 0 0;">R$ 97/mês = menos de <strong>R$ 3,30 por dia</strong></p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
                    <a href="https://zunoprospect.com.br/precos" style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">🚀 Desbloquear 200 Leads/Mês</a>
              </td></tr></table>
              ${generateCouponBanner()}
          </td></tr>
          <tr><td style="background-color: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb;"><p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">Você recebeu este email porque se cadastrou no Zuno Prospect.</p></td></tr>
        </table>
    </td></tr>
  </table>
</body>
</html>
`,
};

interface OnboardingEmailsDashboardProps {
  compact?: boolean;
}

export const OnboardingEmailsDashboard = ({ compact = false }: OnboardingEmailsDashboardProps) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<EmailStats[]>([]);
  const [recentEmails, setRecentEmails] = useState<RecentEmail[]>([]);
  const [totalSent, setTotalSent] = useState(0);
  const [totalOpened, setTotalOpened] = useState(0);
  const [todaySent, setTodaySent] = useState(0);
  const [todayOpened, setTodayOpened] = useState(0);
  const [weekSent, setWeekSent] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState<string | null>(null);

  const handlePreview = (emailType: string) => {
    setPreviewType(emailType);
    setPreviewOpen(true);
  };

  const getPreviewHtml = () => {
    if (!previewType || !EMAIL_TEMPLATES[previewType]) return "";
    return EMAIL_TEMPLATES[previewType]("João", 15);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Get all onboarding emails
      const { data: emails, error } = await supabase
        .from("onboarding_emails_sent")
        .select("*")
        .order("sent_at", { ascending: false });

      if (error) throw error;

      // Calculate stats
      const emailsByType: Record<string, { sent: number; opened: number }> = {};
      let todaySentCount = 0;
      let todayOpenedCount = 0;
      let weekSentCount = 0;
      let totalOpenedCount = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      (emails || []).forEach((email) => {
        const type = email.email_type;
        if (!emailsByType[type]) {
          emailsByType[type] = { sent: 0, opened: 0 };
        }
        emailsByType[type].sent++;
        
        if (email.opened_at) {
          emailsByType[type].opened++;
          totalOpenedCount++;
        }

        const sentDate = new Date(email.sent_at);
        if (sentDate >= today) {
          todaySentCount++;
          if (email.opened_at) {
            todayOpenedCount++;
          }
        }
        if (sentDate >= weekAgo) {
          weekSentCount++;
        }
      });

      const statsArray = Object.entries(emailsByType).map(([email_type, counts]) => ({
        email_type,
        sent: counts.sent,
        opened: counts.opened,
      }));

      setStats(statsArray);
      setTotalSent(emails?.length || 0);
      setTotalOpened(totalOpenedCount);
      setTodaySent(todaySentCount);
      setTodayOpened(todayOpenedCount);
      setWeekSent(weekSentCount);
      setRecentEmails((emails || []).slice(0, 10) as RecentEmail[]);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleTriggerOnboarding = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-onboarding-email");
      if (error) throw error;
      console.log("Resultado:", data);
      await loadData();
    } catch (error) {
      console.error("Erro ao disparar onboarding:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0.0";

  const chartData = stats.map((s) => ({
    name: EMAIL_TYPE_LABELS[s.email_type]?.label || s.email_type,
    enviados: s.sent,
    abertos: s.opened,
    fill: EMAIL_TYPE_LABELS[s.email_type]?.color || "#6B7280",
  }));

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Compact version for Profile page
  if (compact) {
    return (
      <div className="space-y-4">
        {/* Compact Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-primary/10 text-center">
            <p className="text-2xl font-bold">{totalSent}</p>
            <p className="text-xs text-muted-foreground">Enviados</p>
          </div>
          <div className="p-3 rounded-lg bg-green-500/10 text-center">
            <p className="text-2xl font-bold">{totalOpened}</p>
            <p className="text-xs text-muted-foreground">Abertos</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 text-center">
            <p className="text-2xl font-bold">{openRate}%</p>
            <p className="text-xs text-muted-foreground">Taxa Abertura</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-center">
            <p className="text-2xl font-bold">{todayOpened}</p>
            <p className="text-xs text-muted-foreground">Abertos Hoje</p>
          </div>
        </div>

        {/* Open Rate by Type */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Taxa por Tipo de Email</p>
          {stats.map((stat) => {
            const rate = stat.sent > 0 ? (stat.opened / stat.sent) * 100 : 0;
            const info = EMAIL_TYPE_LABELS[stat.email_type];
            return (
              <div key={stat.email_type} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{info?.label || stat.email_type}</span>
                  <span className="text-muted-foreground">{rate.toFixed(0)}% ({stat.opened}/{stat.sent})</span>
                </div>
                <Progress value={rate} className="h-2" style={{ 
                  ['--progress-background' as string]: info?.color 
                }} />
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="flex-1">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={handleTriggerOnboarding} disabled={refreshing} className="flex-1">
            <Mail className="h-4 w-4 mr-2" />
            Disparar
          </Button>
        </div>
      </div>
    );
  }

  // Full dashboard
  return (
    <div className="space-y-6">
      {/* Header com ações */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Emails de Onboarding Automáticos</h2>
          <p className="text-sm text-muted-foreground">
            Emails enviados automaticamente baseados no comportamento do usuário
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={handleTriggerOnboarding} disabled={refreshing}>
            <Mail className="h-4 w-4 mr-2" />
            Disparar Agora
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Enviados</p>
                <p className="text-2xl font-bold">{totalSent}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <MailOpen className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Abertos</p>
                <p className="text-2xl font-bold">{totalOpened}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <Percent className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa Abertura</p>
                <p className="text-2xl font-bold">{openRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hoje</p>
                <p className="text-2xl font-bold">{todaySent} / {todayOpened}</p>
                <p className="text-xs text-muted-foreground">enviados / abertos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-purple-500/10">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Última Semana</p>
                <p className="text-2xl font-bold">{weekSent}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Sent vs Opened */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enviados vs Abertos por Tipo</CardTitle>
            <CardDescription>Comparação de envios e aberturas</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="enviados" fill="#6B7280" name="Enviados" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="abertos" fill="#10B981" name="Abertos" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhum email enviado ainda
              </div>
            )}
          </CardContent>
        </Card>

        {/* Open Rate by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Taxa de Abertura por Tipo</CardTitle>
            <CardDescription>Percentual de emails abertos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.length > 0 ? (
              stats.map((stat) => {
                const rate = stat.sent > 0 ? (stat.opened / stat.sent) * 100 : 0;
                const info = EMAIL_TYPE_LABELS[stat.email_type];
                return (
                  <div key={stat.email_type} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{info?.label || stat.email_type}</span>
                      <span className="text-sm text-muted-foreground">
                        {rate.toFixed(1)}% ({stat.opened}/{stat.sent})
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ 
                          width: `${rate}%`,
                          backgroundColor: info?.color || '#6B7280'
                        }} 
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                Nenhum email enviado ainda
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Email Types Description - with Preview Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipos de Email</CardTitle>
          <CardDescription>Clique em "Preview" para visualizar cada template antes de enviar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(EMAIL_TYPE_LABELS).map(([key, info]) => {
              const stat = stats.find((s) => s.email_type === key);
              const rate = stat && stat.sent > 0 ? ((stat.opened / stat.sent) * 100).toFixed(0) : "0";
              return (
                <div
                  key={key}
                  className="p-4 rounded-lg border"
                  style={{ borderLeftColor: info.color, borderLeftWidth: 4 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{info.label}</span>
                    <div className="flex gap-1">
                      <Badge variant="secondary">{stat?.sent || 0} env</Badge>
                      <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
                        {rate}% ab
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{info.description}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground truncate max-w-[180px]" title={info.subject}>
                      Assunto: {info.subject}
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handlePreview(key)}
                      className="shrink-0"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Preview
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Email Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Preview: {previewType && EMAIL_TYPE_LABELS[previewType]?.label}
            </DialogTitle>
            <DialogDescription>
              Assunto: {previewType && EMAIL_TYPE_LABELS[previewType]?.subject}
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="preview">Visualização</TabsTrigger>
              <TabsTrigger value="code">Código HTML</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="mt-4">
              <ScrollArea className="h-[60vh] rounded-lg border bg-muted/30">
                <div 
                  className="p-4"
                  dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                />
              </ScrollArea>
            </TabsContent>
            <TabsContent value="code" className="mt-4">
              <ScrollArea className="h-[60vh] rounded-lg border bg-muted/50">
                <pre className="p-4 text-xs whitespace-pre-wrap break-words font-mono">
                  {getPreviewHtml()}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Recent Emails Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Emails Recentes</CardTitle>
          <CardDescription>Últimos 10 emails de onboarding enviados</CardDescription>
        </CardHeader>
        <CardContent>
          {recentEmails.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Nenhum email enviado ainda</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead>Aberto em</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEmails.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell>
                      <Badge
                        style={{
                          backgroundColor: `${EMAIL_TYPE_LABELS[email.email_type]?.color}20`,
                          color: EMAIL_TYPE_LABELS[email.email_type]?.color,
                          borderColor: EMAIL_TYPE_LABELS[email.email_type]?.color,
                        }}
                        variant="outline"
                      >
                        {EMAIL_TYPE_LABELS[email.email_type]?.label || email.email_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {email.user_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>{formatDate(email.sent_at)}</TableCell>
                    <TableCell>
                      {email.opened_at ? formatDate(email.opened_at) : "-"}
                    </TableCell>
                    <TableCell>
                      {email.opened_at ? (
                        <Badge className="bg-green-500/10 text-green-700 border-green-500/20" variant="outline">
                          <MailOpen className="h-3 w-3 mr-1" />
                          Aberto
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Não aberto
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
