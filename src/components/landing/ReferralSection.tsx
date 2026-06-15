import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight, CheckCircle2, Copy, CreditCard, Gift, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { trackMetaCustomEvent } from "@/lib/metaPixel";

export function ReferralSection() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleCopyLink = () => {
    if (!user?.id) return;
    trackMetaCustomEvent("Referral_CTA_Click", {
      page: "landing",
      location: "referral_section",
    });
    const link = `https://zunopropect.com.br/?ref=${user.id}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!", {
      description: "Agora é só compartilhar com parceiros ou amigos.",
    });
  };

  const handleSignup = () => {
    trackMetaCustomEvent("Referral_CTA_Click", {
      page: "landing",
      location: "referral_section",
    });
    navigate("/auth?tab=signup");
  };

  return (
    <section id="referral-section" className="bg-background py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <Badge variant="outline" className="mb-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            Programa de indicação
          </Badge>
          <h2 className="mb-5 text-3xl font-bold tracking-tight md:text-4xl">
            Indique o Zuno e ganhe buscas extras
          </h2>
          <p className="text-base text-muted-foreground md:text-lg">
            Compartilhe seu link com parceiros ou amigos. Quando uma pessoa indicada por você assinar qualquer plano pago, você recebe 100 buscas extras.
          </p>
        </div>

        <div className="mx-auto mb-10 grid max-w-5xl gap-5 md:grid-cols-3">
          <Card className="rounded-lg border border-border bg-card p-6 text-center text-card-foreground shadow-sm dark:border-white/10 dark:bg-zinc-900/70">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
              <Share2 className="h-7 w-7" />
            </div>
            <h3 className="mb-3 text-xl font-semibold">1. Compartilhe seu link</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Envie seu convite para quem também precisa prospectar.
            </p>
          </Card>

          <Card className="rounded-lg border border-border bg-card p-6 text-center text-card-foreground shadow-sm dark:border-white/10 dark:bg-zinc-900/70">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-purple-200 bg-purple-50 text-purple-600 dark:border-purple-500/20 dark:bg-purple-500/10 dark:text-purple-400">
              <CreditCard className="h-7 w-7" />
            </div>
            <h3 className="mb-3 text-xl font-semibold">2. A pessoa assina um plano</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              A indicação é validada quando o indicado assina qualquer plano pago.
            </p>
          </Card>

          <Card className="rounded-lg border border-border bg-card p-6 text-center text-card-foreground shadow-sm dark:border-white/10 dark:bg-zinc-900/70">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h3 className="mb-3 text-xl font-semibold">3. Você ganha 100 buscas extras</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Após a confirmação do pagamento, o bônus entra automaticamente na sua conta.
            </p>
          </Card>
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-8 inline-flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
            <span>Cadastros gratuitos ficam como indicação pendente e não liberam bônus automaticamente.</span>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            {user ? (
              <Button size="lg" className="h-14 w-full bg-emerald-600 px-8 text-base font-medium text-white hover:bg-emerald-500 sm:w-auto" onClick={handleCopyLink}>
                <Copy className="mr-2 h-5 w-5" />
                Copiar meu link
              </Button>
            ) : (
              <Button size="lg" className="h-14 w-full bg-emerald-600 px-8 text-base font-medium text-white hover:bg-emerald-500 sm:w-auto" asChild>
                <Link 
                  to="/auth?tab=signup"
                  onClick={() => {
                    trackMetaCustomEvent("Referral_CTA_Click", {
                      page: "landing",
                      location: "referral_section",
                    });
                  }}
                >
                  Comece a prospectar agora
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            )}
            <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Gift className="h-4 w-4" />
              +100 buscas por indicação paga
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
