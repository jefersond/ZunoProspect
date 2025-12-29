import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CheckCircle2, Crown, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getKiwifyCheckoutUrl } from "@/config/kiwifyLinks";
import { PLANOS, PLANO_AGENCIA, type Plano } from "@/components/landing/data";

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanName?: string; // Nome do plano atual do usuário
}

export const UpgradePlanDialog = ({ open, onOpenChange, currentPlanName }: UpgradePlanDialogProps) => {
  const [isAnual, setIsAnual] = useState(false);

  // Define a ordem dos planos para comparação
  const planOrder: Record<string, number> = {
    starter: 0,
    pro: 1, // Inclui Iniciante (100 leads) e Pro (200 leads)
    agencia: 2,
  };

  const currentPlanLevel = planOrder[currentPlanName || 'starter'] ?? 0;
  
  // Filtra planos pagos que são superiores ao plano atual
  // Se o usuário é Pro, só mostra Agência
  const PLANOS_UPGRADE = PLANOS.filter((p) => {
    if (p.gratuito) return false;
    // Mapeia nome do plano para o nome no banco
    const planNameMap: Record<string, string> = {
      'Iniciante': 'pro',
      'Pro': 'pro',
    };
    const dbPlanName = planNameMap[p.nome] || p.nome.toLowerCase();
    const planLevel = planOrder[dbPlanName] ?? 0;
    return planLevel > currentPlanLevel;
  });

  // Verifica se deve mostrar o card Agência (só se o plano atual for menor que agência)
  const showAgenciaCard = currentPlanLevel < 2;

  const handleSelectPlano = (plano: Plano) => {
    const checkoutUrl = getKiwifyCheckoutUrl(plano.nome, isAnual);
    toast.success("Redirecionando para o pagamento...");
    window.open(checkoutUrl, "_blank");
    onOpenChange(false);
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
            Escolha o plano ideal para escalar sua prospecção.
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
              const precoMensal = isAnual ? Math.round(plano.precoAnual / 12) : plano.precoMensal;

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
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-3xl font-bold">R$ {precoMensal}</span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>
                    {isAnual && (
                      <p className="text-xs text-muted-foreground mt-1">
                        cobrado R$ {plano.precoAnual} por ano
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
                    onClick={() => handleSelectPlano(plano)}
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

              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-bold">
                  R$ {isAnual ? Math.round(PLANO_AGENCIA.precoAnual / 12) : PLANO_AGENCIA.precoMensal}
                </span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              {isAnual && (
                <p className="text-xs text-muted-foreground">
                  cobrado R$ {PLANO_AGENCIA.precoAnual} por ano
                </p>
              )}

              <Button
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleSelectPlano(PLANO_AGENCIA)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
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
