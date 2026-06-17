import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight, CheckCircle2, Copy, CreditCard, Gift, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { trackMetaCustomEvent } from "@/lib/metaPixel";
import { trackEvent } from "@/lib/analytics";

export function ReferralSection() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleCopyLink = () => {
    if (!user?.id) return;
    trackEvent("cta_clicked", { cta: "copiar_link_indicacao", location: "referral_section" });
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
    <section id="referral-section" className="bg-[#0b0f0e] py-20 border-b border-[#1f2d29]/40 text-[#f4f4f5]">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <Badge variant="outline" className="mb-4 border-[#1f2d29] text-[#9ca3af] bg-[#111816]/50">
            Programa de indicação
          </Badge>
          <h2 className="mb-5 text-3xl font-extrabold tracking-tight md:text-4xl">
            Indique o Zuno e ganhe buscas extras
          </h2>
          <p className="text-base text-[#9ca3af] md:text-lg">
            Compartilhe seu link com parceiros ou amigos. Quando uma pessoa indicada por você assinar qualquer plano pago, você recebe 100 buscas extras.
          </p>
        </div>

        <div className="mx-auto mb-10 grid max-w-5xl gap-5 md:grid-cols-3">
          <Card className="rounded-xl border border-[#1f2d29] bg-[#111816] p-6 text-center text-[#f4f4f5] shadow-md transition-all hover:border-[#10d98a]/20">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-[#1f2d29] bg-[#0b0f0e] text-[#10d98a]">
              <Share2 className="h-7 w-7" />
            </div>
            <h3 className="mb-3 text-xl font-bold">1. Compartilhe seu link</h3>
            <p className="text-sm leading-6 text-[#9ca3af]">
              Envie seu convite para quem também precisa prospectar.
            </p>
          </Card>

          <Card className="rounded-xl border border-[#1f2d29] bg-[#111816] p-6 text-center text-[#f4f4f5] shadow-md transition-all hover:border-[#10d98a]/20">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-[#1f2d29] bg-[#0b0f0e] text-[#10d98a]">
              <CreditCard className="h-7 w-7" />
            </div>
            <h3 className="mb-3 text-xl font-bold">2. A pessoa assina um plano</h3>
            <p className="text-sm leading-6 text-[#9ca3af]">
              A indicação é validada quando o indicado assina qualquer plano pago.
            </p>
          </Card>

          <Card className="rounded-xl border border-[#1f2d29] bg-[#111816] p-6 text-center text-[#f4f4f5] shadow-md transition-all hover:border-[#10d98a]/20">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-[#1f2d29] bg-[#0b0f0e] text-[#10d98a]">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h3 className="mb-3 text-xl font-bold">3. Você ganha 100 buscas</h3>
            <p className="text-sm leading-6 text-[#9ca3af]">
              Após a confirmação do pagamento, o bônus entra automaticamente na sua conta.
            </p>
          </Card>
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-8 inline-flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>Cadastros gratuitos ficam como indicação pendente e não liberam bônus automaticamente.</span>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            {user ? (
              <Button size="lg" className="h-14 w-full bg-[#10d98a] text-[#0b0f0e] font-bold shadow-[0_0_30px_rgba(16,217,138,0.2)] hover:bg-[#10d98a]/90 sm:w-auto px-8" onClick={handleCopyLink}>
                <Copy className="mr-2 h-5 w-5" />
                Copiar meu link
              </Button>
            ) : (
              <Button size="lg" className="h-14 w-full bg-[#10d98a] text-[#0b0f0e] font-bold shadow-[0_0_30px_rgba(16,217,138,0.2)] hover:bg-[#10d98a]/90 sm:w-auto px-8" asChild>
                <Link 
                  to="/auth?tab=signup"
                  onClick={() => {
                    trackEvent("cta_clicked", { cta: "comecar_gratis", location: "referral_section" });
                    trackMetaCustomEvent("Referral_CTA_Click", {
                      page: "landing",
                      location: "referral_section",
                    });
                  }}
                >
                  Começar teste grátis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            )}
            <div className="inline-flex items-center gap-2 rounded-lg border border-[#10d98a]/20 bg-[#10d98a]/5 px-4 py-3 text-sm font-bold text-[#10d98a]">
              <Gift className="h-4 w-4" />
              +100 buscas por indicação paga
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
