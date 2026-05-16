import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, UserPlus, Gift, ArrowRight, Share2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export function ReferralSection() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleCopyLink = () => {
    if (!user?.id) return;
    const link = `https://zunoprospect.com.br/?ref=${user.id}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!", {
      description: "Agora é só compartilhar com seus amigos e parceiros.",
    });
  };

  const handleSignup = () => {
    navigate("/auth?tab=signup");
  };

  return (
    <section id="referral-section" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <Badge variant="outline" className="mb-4 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
            Programa de Indicação
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">
            Indique o Zuno e ganhe buscas extras
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Compartilhe seu link com parceiros, clientes ou amigos que também precisam prospectar. Quando alguém indicado por você assinar qualquer plano do Zuno, você recebe 100 buscas extras para usar na sua prospecção.
          </p>
          
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-6 py-3 text-emerald-400 font-medium">
            <Gift className="h-5 w-5" />
            <span>+100 buscas extras por cada indicação que virar assinante</span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
          <Card className="bg-zinc-950/50 border-border/50 p-8 text-center relative overflow-hidden group">
            <div className="mx-auto w-14 h-14 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 text-blue-400 border border-blue-500/20">
              <Share2 className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-semibold mb-3">1. Compartilhe seu link</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Copie seu link de indicação dentro da sua conta e envie para quem pode aproveitar o Zuno.
            </p>
          </Card>

          <Card className="bg-zinc-950/50 border-border/50 p-8 text-center relative overflow-hidden group">
            <div className="mx-auto w-14 h-14 bg-purple-500/10 rounded-full flex items-center justify-center mb-6 text-purple-400 border border-purple-500/20">
              <UserPlus className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-semibold mb-3">2. A pessoa assina um plano</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              O indicado pode testar o Zuno e, quando assinar qualquer plano pago, a indicação é validada.
            </p>
          </Card>

          <Card className="bg-zinc-950/50 border-border/50 p-8 text-center relative overflow-hidden group">
            <div className="mx-auto w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-semibold mb-3">3. Você ganha 100 buscas extras</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Assim que o pagamento for confirmado, o bônus entra automaticamente no seu saldo.
            </p>
          </Card>
        </div>

        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm text-muted-foreground mb-8 bg-secondary/30 py-3 px-4 rounded-lg inline-block border border-border/40">
            O bônus é liberado somente quando a pessoa indicada assina um plano pago. Cadastros gratuitos ficam como indicação pendente.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-white w-full sm:w-auto h-14 px-8 text-base font-medium" onClick={handleCopyLink}>
                <Copy className="mr-2 h-5 w-5" />
                Copiar meu link de indicação
              </Button>
            ) : (
              <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-white w-full sm:w-auto h-14 px-8 text-base font-medium" onClick={handleSignup}>
                Criar conta e começar a indicar
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            )}
            <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-base" onClick={() => document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })}>
              Ver como funciona
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
