import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Clock3, Copy, Gift, Info, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUsage } from "@/hooks/useUsage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseAny = supabase as any;

export function ReferralCard() {
  const { isAdmin } = useUsage();
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [indicacoesPendentes, setIndicacoesPendentes] = useState(0);
  const [indicacoesConvertidas, setIndicacoesConvertidas] = useState(0);
  const [leadsExtrasGanhos, setLeadsExtrasGanhos] = useState(0);

  useEffect(() => {
    async function loadReferralData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabaseAny.rpc("get_referral_summary", {
          p_user_id: user.id,
        });

        if (error) throw error;

        const summary = data?.[0];
        if (summary) {
          setReferralCode(summary.referral_code ?? null);
          setIndicacoesPendentes(summary.referral_pending_count ?? 0);
          setIndicacoesConvertidas(summary.referral_rewarded_count ?? summary.referral_count ?? 0);
          setLeadsExtrasGanhos(summary.referral_bonus_earned ?? summary.referral_bonus_available ?? 0);
        }
      } catch {
        // Colunas ou RPCs ainda nao migradas: o card renderiza com valores padrao.
      }
    }
    loadReferralData();
  }, []);

  const leadsExtrasDisplay = isAdmin ? "Ilimitado" : leadsExtrasGanhos;

  const referralLink = referralCode
    ? `https://zunopropect.com.br/?ref=${referralCode}`
    : "Gerando seu link...";

  const handleCopyLink = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <Card className="border-border/60 bg-card text-card-foreground shadow-lg">
      <CardContent className="p-5 md:p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] xl:items-center">
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/30">
                <Gift className="h-5 w-5 text-primary" />
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    Indique e Ganhe
                  </h3>
                  <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Referral
                  </span>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Convide parceiros para conhecer o Zuno Propect. Voce ganha bonus quando eles assinarem um plano.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-background/40 p-4">
              <p className="text-sm font-medium text-foreground">
                Ganhe 100 leads extras quando uma pessoa indicada assinar qualquer plano pago.
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Cadastros gratuitos ficam como indicacoes pendentes e nao liberam bonus automaticamente.
              </p>
            </div>

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/50">
                  <Clock3 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-semibold leading-none text-foreground">{indicacoesPendentes}</p>
                  <p className="mt-1 text-xs text-muted-foreground">indicacoes pendentes</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/50">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-semibold leading-none text-foreground">{indicacoesConvertidas}</p>
                  <p className="mt-1 text-xs text-muted-foreground">indicacoes convertidas</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/50">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-semibold leading-none text-foreground">{leadsExtrasDisplay}</p>
                    <span title="Voce so recebe o bonus depois que a pessoa indicada assinar Starter, Pro ou Agency.">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">leads extras ganhos</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/50 bg-background/40 p-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Link de indicacao</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Compartilhe este link com quem pode aproveitar o Zuno Propect. O bonus so e liberado apos assinatura paga.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
                <Input
                  value={referralLink}
                  readOnly
                  className="h-10 flex-1 truncate font-mono text-xs text-muted-foreground"
                  aria-label="Link de indicacao"
                />
                <Button
                  onClick={handleCopyLink}
                  disabled={!referralCode}
                  variant={copied ? "success" : "default"}
                  className="h-10 shrink-0 sm:min-w-[210px] xl:w-full"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Link copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar link de indicacao
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
