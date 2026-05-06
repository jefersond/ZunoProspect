import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Crown, ExternalLink } from "lucide-react";
import { PLANOS, PLANO_AGENCIA, LEAD_QUANTITIES, type Plano } from "@/components/landing/data";
import { useLeadPricing } from "@/hooks/useLeadPricing";
import { createStripeCheckout } from "@/services/stripeCheckout";

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanName?: string; // Nome do plano atual do usuário
}

export const UpgradePlanDialog = ({ open, onOpenChange, currentPlanName }: UpgradePlanDialogProps) => {
  const [isAnual, setIsAnual] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Record<string, number>>({
    starter: 300,
    pro: 800,
    agencia: 2000,
  });
  const { calculatePrice, getDisplayPrice } = useLeadPricing();

  // Define a ordem dos planos para comparação
  const planOrder: Record<string, number> = {
    starter: 0,
    iniciante: 1,
    pro: 2,
    agencia: 3,
  };

  const currentPlanLevel = planOrder[currentPlanName || 'starter'] ?? 0;
  
  // Filtra planos pagos que são superiores ao plano atual
  const PLANOS_UPGRADE = PLANOS.filter((p) => {
    if (p.gratuito) return false;
    const planLevel = planOrder[p.planKey] ?? 0;
    return planLevel > currentPlanLevel;
  });

  // Verifica se deve mostrar o card Agência (só se o plano atual for menor que agência)
  const showAgenciaCard = currentPlanLevel < 3;

  const planosExibicao = [...PLANOS_UPGRADE];
  if (showAgenciaCard) {
    planosExibicao.push(PLANO_AGENCIA);
  }

  const handleLeadsChange = (planKey: string, value: string) => {
    setSelectedLeads(prev => ({ ...prev, [planKey]: parseInt(value) }));
  };

  const [isProcessing, setIsProcessing] = useState(false);

  const handleSelectPlano = async (plano: Plano, leadsQty: number) => {
    setIsProcessing(true);
    try {
      const price = calculatePrice(plano.planKey, leadsQty, isAnual);
      if (!plano || !Number.isFinite(price) || Number.isNaN(price)) {
        throw new Error("Preço inválido para o plano selecionado.");
      }

      toast.loading("Gerando link de pagamento seguro...");

      const data = await createStripeCheckout({
        selectedPlan: plano,
        leadsQuantity: leadsQty,
        billingCycle: isAnual ? "annual" : "monthly",
        price,
      });

      toast.dismiss();
      
      toast.success("Redirecionando para o pagamento...");
      window.location.href = data.url;
      onOpenChange(false);
      
    } catch (error: any) {
      toast.dismiss();
      toast.error("Erro ao processar upgrade", { description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Crown className="h-5 w-5 text-primary" />
            Fazer Upgrade do Plano
          </DialogTitle>
          <DialogDescription>
            Escolha o plano e a quantidade de leads ideal para escalar sua prospecção.
          </DialogDescription>
        </DialogHeader>

        {/* Toggle Mensal/Anual */}
        <div className="flex items-center justify-center gap-4 py-4">
          <span className={`text-sm font-medium ${!isAnual ? "text-foreground" : "text-muted-foreground"}`}>
            Mensal
          </span>
          <Switch
            checked={isAnual}
            onCheckedChange={setIsAnual}
            className="data-[state=checked]:bg-primary"
          />
          <span className={`text-sm font-medium ${isAnual ? "text-foreground" : "text-muted-foreground"}`}>
            Anual
          </span>
          {isAnual && (
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
              Economize 17%
            </Badge>
          )}
        </div>

        {/* Grid de Planos Dinâmico */}
        {planosExibicao.length > 0 && (
          <div className={`grid ${planosExibicao.length === 1 ? 'md:grid-cols-1 max-w-md mx-auto' : planosExibicao.length === 2 ? 'md:grid-cols-2 max-w-3xl mx-auto' : 'lg:grid-cols-3 md:grid-cols-2'} gap-6 py-4 items-stretch`}>
            {planosExibicao.map((plano, index) => {
              const leadsQty = plano.leadsLimit;
              const precoMensal = getDisplayPrice(plano.planKey, leadsQty, isAnual);
              const precoTotal = calculatePrice(plano.planKey, leadsQty, isAnual);

              return (
                <Card
                  key={index}
                  className={`relative p-6 flex flex-col transition-all h-full ${
                    plano.destaque
                      ? "border-2 border-primary shadow-xl ring-1 ring-primary/20 bg-card"
                      : plano.planKey === 'agencia'
                      ? "border border-primary/40 bg-gradient-to-b from-primary/5 to-transparent"
                      : "border border-border/50 bg-background/60"
                  }`}
                >
                  {plano.destaque && (
                    <div className="absolute -top-3 left-0 right-0 flex justify-center">
                      <Badge className="px-3 py-1 text-[10px] sm:text-xs shadow-md bg-primary text-primary-foreground font-semibold tracking-wider uppercase">
                        Mais popular
                      </Badge>
                    </div>
                  )}

                  <div className="flex-1 flex flex-col">
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-bold mb-1">{plano.nome}</h3>
                      <p className="text-sm text-muted-foreground mb-4 h-10">{plano.descricao}</p>
                      
                      {/* Lead Quantity Selector */}
                      <div className="mb-4">
                        <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm font-medium">
                          {plano.leadsLimit.toLocaleString('pt-BR')} leads/mês + {plano.aiLimit} análises com IA
                        </div>
                      </div>

                      <div className="flex items-baseline justify-center gap-1 mb-1">
                        <span className="text-3xl font-bold tracking-tight">R$ {precoMensal}</span>
                        <span className="text-sm text-muted-foreground">/mês</span>
                      </div>
                      {isAnual ? (
                        <p className="text-xs text-muted-foreground h-4">
                          cobrado R$ {precoTotal.toLocaleString('pt-BR')} por ano
                        </p>
                      ) : (
                        <p className="text-xs text-transparent h-4 select-none">-</p>
                      )}
                    </div>

                    <ul className="space-y-3 mb-6 flex-1">
                      {plano.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground text-sm leading-tight">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    className={`w-full mt-auto ${plano.destaque || plano.planKey === 'agencia' ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md" : ""}`}
                    variant={plano.destaque || plano.planKey === 'agencia' ? "default" : "outline"}
                    onClick={() => handleSelectPlano(plano, leadsQty)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    {plano.cta}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-center text-muted-foreground">
            Você será redirecionado para a página de pagamento segura.
            <br />
            Aceita PIX e cartão de crédito.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
