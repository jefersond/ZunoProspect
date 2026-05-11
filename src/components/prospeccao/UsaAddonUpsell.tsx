import { Globe, Sparkles, MapPin, MessageCircle, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ADDONS } from "@/config/addons";
import { createStripeAddonCheckout } from "@/services/stripeAddonCheckout";
import { useSubscription } from "@/hooks/useSubscription";

interface UsaAddonUpsellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail?: string;
  userName?: string;
}

export function UsaAddonUpsell({
  open,
  onOpenChange,
}: UsaAddonUpsellProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();
  const { subscription, isAdmin, hasUsaAddon } = useSubscription();
  const addon = ADDONS.us_prospecting;
  const normalizedPlan = String(subscription?.plan_name || "free").toLowerCase();
  const hasPaidPlan = isAdmin || ["starter", "iniciante", "pro", "agency", "agencia"].includes(normalizedPlan);

  const handleActivate = async () => {
    if (isAdmin || hasUsaAddon) {
      onOpenChange(false);
      return;
    }

    if (!hasPaidPlan) {
      toast.error("Este complemento está disponível apenas para usuários com plano ativo.");
      navigate("/precos");
      onOpenChange(false);
      return;
    }

    setIsProcessing(true);
    try {
      toast.loading("Gerando checkout do complemento...");
      const data = await createStripeAddonCheckout({ addonId: addon.id });
      toast.dismiss();
      window.location.href = data.url;
      onOpenChange(false);
    } catch (error: any) {
      toast.dismiss();
      toast.error(error?.status === 403
        ? "Este complemento está disponível apenas para usuários com plano ativo."
        : "Não foi possível iniciar o pagamento", {
        description: error?.status === 403 ? "Escolha um plano para ativar a prospecção nos EUA." : "Tente novamente.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const benefits = [
    "Busca em todos os 50 estados dos EUA + DC",
    "Análise detalhada em português",
    "Plano de prospecção e CTA adaptados para inglês",
    "Mensagens prontas para abordar leads americanos",
    "Mesma análise com IA do Zuno Propect",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">
              {addon.name}
            </DialogTitle>
          </div>
          <DialogDescription className="text-base">
            Prospecção nos EUA é um complemento opcional para planos ativos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <span>+R$ {addon.monthlyPrice}/mês</span>
          </div>

          <ul className="space-y-2">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Busque leads em cidades como Miami, New York, Los Angeles e mais.
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
            <MessageCircle className="h-5 w-5 text-blue-500" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Mensagens prontas em inglês para abordagem direta.
            </span>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleActivate} className="w-full" size="lg" disabled={isProcessing}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
            {hasPaidPlan ? "Ativar complemento" : "Escolher plano"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Agora não
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
