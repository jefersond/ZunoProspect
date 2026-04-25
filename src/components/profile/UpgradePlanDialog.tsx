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
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, Crown, ExternalLink, Sparkles } from "lucide-react";
import { PLANOS, PLANO_AGENCIA, LEAD_QUANTITIES, type Plano } from "@/components/landing/data";
import { useLeadPricing } from "@/hooks/useLeadPricing";

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanName?: string; // Nome do plano atual do usuário
}

export const UpgradePlanDialog = ({ open, onOpenChange, currentPlanName }: UpgradePlanDialogProps) => {
  const [isAnual, setIsAnual] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Record<string, number>>({
    starter: 100,
    pro: 100,
    agencia: 100,
  });
  const { calculatePrice, getDisplayPrice } = useLeadPricing();

  // Define a ordem dos planos para comparação
  const planOrder: Record<string, number> = {
    starter: 0,
    pro: 1,
    agencia: 2,
  };

  const currentPlanLevel = planOrder[currentPlanName || 'starter'] ?? 0;
  
  // Filtra planos pagos que são superiores ao plano atual
  const PLANOS_UPGRADE = PLANOS.filter((p) => {
    if (p.gratuito) return false;
    const planLevel = planOrder[p.planKey] ?? 0;
    return planLevel > currentPlanLevel;
  });

  // Verifica se deve mostrar o card Agência (só se o plano atual for menor que agência)
  const showAgenciaCard = currentPlanLevel < 2;

  const handleLeadsChange = (planKey: string, value: string) => {
    setSelectedLeads(prev => ({ ...prev, [planKey]: parseInt(value) }));
  };

  const [isProcessing, setIsProcessing] = useState(false);

  const handleSelectPlano = async (plano: Plano, leadsQty: number) => {
    setIsProcessing(true);
    try {
      toast.loading("Gerando link de pagamento seguro...");

      const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
        body: {
          planKey: plano.planKey,
          leadsQty: leadsQty,
          isAnual
        }
      });

      toast.dismiss();

      if (error || !data?.url) {
        throw new Error("Falha ao gerar link de pagamento.");
      }
      
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

  const agenciaLeads = selectedLeads.agencia;
  const agenciaPrecoMensal = getDisplayPrice('agencia', agenciaLeads, isAnual);
  const agenciaPrecoTotal = calculatePrice('agencia', agenciaLeads, isAnual);

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

        {/* Grid de Planos (Iniciante + Pro) - só mostra se houver planos disponíveis */}
        {PLANOS_UPGRADE.length > 0 && (
          <div className={`grid ${PLANOS_UPGRADE.length === 1 ? 'md:grid-cols-1 max-w-md mx-auto' : 'md:grid-cols-2'} gap-4 py-4`}>
            {PLANOS_UPGRADE.map((plano, index) => {
              const leadsQty = selectedLeads[plano.planKey];
              const precoMensal = getDisplayPrice(plano.planKey, leadsQty, isAnual);
              const precoTotal = calculatePrice(plano.planKey, leadsQty, isAnual);

              return (
                <Card
                  key={index}
                  className={`relative p-6 flex flex-col transition-all ${
                    plano.destaque
                      ? "border-2 border-primary shadow-md"
                      : "border border-border/50"
                  }`}
                >
                  {plano.destaque && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="px-3 py-0.5 text-xs shadow bg-primary text-primary-foreground">
                        Mais popular
                      </Badge>
                    </div>
                  )}

                  <div className="text-center mb-4">
                    <h3 className="text-lg font-bold mb-1">{plano.nome}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{plano.descricao}</p>
                    
                    {/* Lead Quantity Selector */}
                    <div className="mb-3">
                      <Select 
                        value={leadsQty.toString()} 
                        onValueChange={(v) => handleLeadsChange(plano.planKey, v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_QUANTITIES.map((qty) => (
                            <SelectItem key={qty} value={qty.toString()}>
                              {qty.toLocaleString('pt-BR')} leads/mês
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-3xl font-bold">R$ {precoMensal}</span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>
                    {isAnual && (
                      <p className="text-xs text-muted-foreground mt-1">
                        cobrado R$ {precoTotal.toLocaleString('pt-BR')} por ano
                      </p>
                    )}
                  </div>

                  <ul className="space-y-2 mb-6 flex-1">
                    {plano.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`w-full ${plano.destaque ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                    variant={plano.destaque ? "default" : "outline"}
                    onClick={() => handleSelectPlano(plano, leadsQty)}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {plano.cta}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}

        {/* Card Especial Agência - só mostra se o plano atual for menor que agência */}
        {showAgenciaCard && (
        <Card className="relative p-6 border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/10">
          <div className="absolute -top-3 left-4">
            <Badge className="px-3 py-0.5 text-xs shadow bg-primary/90 text-primary-foreground">
              <Sparkles className="h-3 w-3 mr-1" />
              Para Agências
            </Badge>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-2">
            <div>
              <h3 className="text-xl font-bold mb-1">{PLANO_AGENCIA.nome}</h3>
              <p className="text-sm text-muted-foreground mb-4">{PLANO_AGENCIA.descricao}</p>

              {/* Lead Quantity Selector */}
              <div className="mb-4">
                <Select 
                  value={agenciaLeads.toString()} 
                  onValueChange={(v) => handleLeadsChange('agencia', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_QUANTITIES.map((qty) => (
                      <SelectItem key={qty} value={qty.toString()}>
                        {qty.toLocaleString('pt-BR')} leads/mês
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-bold">R$ {agenciaPrecoMensal}</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              {isAnual && (
                <p className="text-xs text-muted-foreground">
                  cobrado R$ {agenciaPrecoTotal.toLocaleString('pt-BR')} por ano
                </p>
              )}

              <Button
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleSelectPlano(PLANO_AGENCIA, agenciaLeads)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                {PLANO_AGENCIA.cta}
              </Button>
            </div>

            <ul className="grid grid-cols-1 gap-2">
              {PLANO_AGENCIA.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        )}

        <p className="text-xs text-center text-muted-foreground pt-2 border-t">
          Você será redirecionado para a página de pagamento segura.
          <br />
          Aceita PIX e cartão de crédito.
        </p>
      </DialogContent>
    </Dialog>
  );
};
