import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Copy, CheckCircle2, Gift, Users, Sparkles, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseAny = supabase as any;

export function ReferralCard() {
  const { subscription, isAdmin } = useSubscription();
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [indicacoesAtuais, setIndicacoesAtuais] = useState(0);
  const [bonusIndicacaoSaldo, setBonusIndicacaoSaldo] = useState(0);

  useEffect(() => {
    async function loadReferralData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabaseAny
          .from("profiles")
          .select("referral_code, buscas_saldo")
          .eq("id", user.id)
          .single();

        if (data) {
          setReferralCode(data.referral_code ?? null);
          setBonusIndicacaoSaldo(data.buscas_saldo ?? 0);
        }

        const { count } = await supabaseAny
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("referred_by", user.id);

        setIndicacoesAtuais(count ?? 0);
      } catch {
        // Colunas ainda não migradas: o card renderiza com valores padrão.
      }
    }
    loadReferralData();
  }, []);

  const buscasExtrasDisponiveis = indicacoesAtuais > 0 ? bonusIndicacaoSaldo : 0;
  const leadsTotais = isAdmin ? "Ilimitado" : (subscription?.leads_remaining ?? 0);

  const referralLink = referralCode
    ? `https://zunopropect.com.br/auth?ref=${referralCode}`
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
                  Convide parceiros para usar o Zuno Prospect e receba buscas extras quando eles entrarem.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-background/40 p-4">
              <p className="text-sm text-muted-foreground">
                Cada indicação válida adiciona{" "}
                <span className="font-medium text-foreground">100 buscas extras</span>{" "}
                ao seu saldo bônus. Seu saldo total de leads é atualizado separadamente.
              </p>
            </div>

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/50">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-semibold leading-none text-foreground">{indicacoesAtuais}</p>
                  <p className="mt-1 text-xs text-muted-foreground">indicações feitas</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/50">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-semibold leading-none text-foreground">{buscasExtrasDisponiveis}</p>
                  <p className="mt-1 text-xs text-muted-foreground">buscas extras disponíveis</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/50">
                  <Database className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-semibold leading-none text-foreground">{leadsTotais}</p>
                  <p className="mt-1 text-xs text-muted-foreground">leads disponíveis totais</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/50 bg-background/40 p-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Link de indicação</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Compartilhe este link com quem pode aproveitar o Zuno Prospect.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
                <Input
                  value={referralLink}
                  readOnly
                  className="h-10 flex-1 truncate font-mono text-xs text-muted-foreground"
                  aria-label="Link de indicação"
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
                      Copiar link de indicação
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
