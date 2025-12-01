import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { CheckCircle2, Crown, Loader2, CreditCard, QrCode } from "lucide-react";
import { toast } from "sonner";
import { PixPaymentDialog } from "./PixPaymentDialog";

// Planos disponíveis para upgrade
const PLANOS = [
  {
    nome: "Pro",
    precoMensal: 97,
    precoAnual: 970,
    descricao: "Para freelancers e profissionais",
    destaque: true,
    features: [
      "Até 100 leads por mês",
      "Análise completa com IA",
      "Plano de 7 dias personalizado",
      "Diagnóstico de sinais digitais",
      "Exportação ilimitada",
      "Suporte prioritário",
    ],
  },
  {
    nome: "Agência",
    precoMensal: 247,
    precoAnual: 2470,
    descricao: "Para agências e times",
    destaque: false,
    features: [
      "Leads ilimitados",
      "Tudo do plano Pro",
      "Múltiplos usuários",
      "API de integração",
      "Relatórios avançados",
      "Gerente de sucesso dedicado",
    ],
  },
];

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UpgradePlanDialog = ({ open, onOpenChange }: UpgradePlanDialogProps) => {
  const [isAnual, setIsAnual] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "pix" | null>(null);
  const [selectedPlano, setSelectedPlano] = useState<typeof PLANOS[0] | null>(null);
  const [showPixDialog, setShowPixDialog] = useState(false);

  const handleSelectPlano = async (plano: typeof PLANOS[0], method: "card" | "pix") => {
    if (method === "pix") {
      setSelectedPlano(plano);
      setShowPixDialog(true);
      return;
    }
    setIsProcessing(plano.nome);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          plano: plano.nome,
          isAnual,
        },
      });

      if (error) throw error;
      
      if (data?.url) {
        // Abrir checkout do Stripe em nova aba
        window.open(data.url, '_blank');
        onOpenChange(false);
        toast.success("Checkout aberto em nova aba", {
          description: "Complete o pagamento na página do Stripe.",
        });
      } else {
        throw new Error("URL de checkout não retornada");
      }
    } catch (error: any) {
      console.error("Erro ao criar checkout:", error);
      toast.error("Erro ao iniciar checkout", {
        description: error.message || "Tente novamente mais tarde.",
      });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
            disabled={!!isProcessing}
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

        <div className="grid md:grid-cols-2 gap-6 py-4">
          {PLANOS.map((plano, index) => {
            const preco = isAnual ? plano.precoAnual : plano.precoMensal;
            const precoMensal = isAnual ? Math.round(plano.precoAnual / 12) : plano.precoMensal;
            const isLoading = isProcessing === plano.nome;

            return (
              <Card
                key={index}
                className={`relative p-6 flex flex-col transition-all ${
                  plano.destaque
                    ? "border-2 border-primary shadow-md"
                    : "border border-border/50"
                } ${isProcessing && !isLoading ? "opacity-50" : ""}`}
              >
                {plano.destaque && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="px-3 py-0.5 text-xs shadow">Recomendado</Badge>
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
                      cobrado R$ {preco} por ano
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

                <div className="space-y-2">
                  <Button
                    className="w-full"
                    variant={plano.destaque ? "default" : "outline"}
                    disabled={!!isProcessing}
                    onClick={() => handleSelectPlano(plano, "card")}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Cartão de Crédito
                      </>
                    )}
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={!!isProcessing}
                    onClick={() => handleSelectPlano(plano, "pix")}
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    Pagar com PIX
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <CreditCard className="h-3 w-3" />
            <span>Stripe</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <QrCode className="h-3 w-3" />
            <span>Asaas PIX</span>
          </div>
        </div>
      </DialogContent>

      {selectedPlano && (
        <PixPaymentDialog
          open={showPixDialog}
          onOpenChange={setShowPixDialog}
          plano={selectedPlano.nome}
          isAnual={isAnual}
          valor={isAnual ? selectedPlano.precoAnual : selectedPlano.precoMensal}
          onPaymentConfirmed={() => {
            onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
};
