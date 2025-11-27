import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CheckCircle2, CreditCard, QrCode, Crown, Zap } from "lucide-react";
import { toast } from "sonner";

// Limites de leads por plano
const PLAN_LIMITS: Record<string, number> = {
  starter: 10,
  pro: 100,
  agencia: -1, // Ilimitado
};

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
  const [selectedPlano, setSelectedPlano] = useState<typeof PLANOS[0] | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  // Checkout state
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [metodoPagamento, setMetodoPagamento] = useState<"pix" | "cartao">("pix");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const formatCardNumber = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    const groups = numbers.match(/.{1,4}/g);
    return groups ? groups.join(" ").slice(0, 19) : "";
  };

  const formatExpiry = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}`;
  };

  const handleSelectPlano = (plano: typeof PLANOS[0]) => {
    setSelectedPlano(plano);
    setShowCheckout(true);
  };

  const handleBack = () => {
    setShowCheckout(false);
    setSelectedPlano(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome || !email || !cpf) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (metodoPagamento === "cartao" && (!cardNumber || !cardExpiry || !cardCvv)) {
      toast.error("Preencha os dados do cartão");
      return;
    }

    setIsProcessing(true);
    
    try {
      // Simula processamento de pagamento
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Obtém o usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      // Atualiza a assinatura no banco
      const planName = selectedPlano?.nome.toLowerCase() === 'agência' ? 'agencia' : selectedPlano?.nome.toLowerCase();
      const leadsLimit = PLAN_LIMITS[planName || 'starter'] || 10;

      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          plan_name: planName,
          leads_limit: leadsLimit,
          is_annual: isAnual,
          billing_period_start: new Date().toISOString(),
          billing_period_end: new Date(Date.now() + (isAnual ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setIsProcessing(false);
      onOpenChange(false);
      setShowCheckout(false);
      setSelectedPlano(null);
      
      toast.success(`Upgrade para ${selectedPlano?.nome} realizado!`, {
        description: metodoPagamento === "pix" 
          ? "Você receberá o QR Code PIX por e-mail." 
          : "Pagamento processado com sucesso!",
      });

      // Recarrega a página para atualizar os dados
      window.location.reload();
    } catch (error: any) {
      console.error("Erro ao processar upgrade:", error);
      toast.error("Erro ao processar upgrade", {
        description: error.message,
      });
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setShowCheckout(false);
    setSelectedPlano(null);
  };

  if (!showCheckout) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Crown className="h-5 w-5 text-primary" />
              Fazer Upgrade do Plano
            </DialogTitle>
            <DialogDescription>
              Escolha o plano ideal para escalar sua prospecção
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

          <div className="grid md:grid-cols-2 gap-6 py-4">
            {PLANOS.map((plano, index) => {
              const preco = isAnual ? plano.precoAnual : plano.precoMensal;
              const precoMensal = isAnual ? Math.round(plano.precoAnual / 12) : plano.precoMensal;

              return (
                <Card
                  key={index}
                  className={`relative p-6 flex flex-col cursor-pointer transition-all hover:shadow-lg ${
                    plano.destaque
                      ? "border-2 border-primary shadow-md"
                      : "border border-border/50"
                  }`}
                  onClick={() => handleSelectPlano(plano)}
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

                  <Button
                    className="w-full"
                    variant={plano.destaque ? "default" : "outline"}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Selecionar {plano.nome}
                  </Button>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Checkout form
  const preco = isAnual ? selectedPlano!.precoAnual : selectedPlano!.precoMensal;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Upgrade para {selectedPlano?.nome}
          </DialogTitle>
          <DialogDescription>
            {isAnual ? "Assinatura anual" : "Assinatura mensal"} - R$ {preco}{isAnual ? "/ano" : "/mês"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados pessoais */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome"
                placeholder="Seu nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                maxLength={14}
                required
              />
            </div>
          </div>

          {/* Forma de pagamento */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Forma de pagamento
            </h4>

            <RadioGroup
              value={metodoPagamento}
              onValueChange={(value) => setMetodoPagamento(value as "pix" | "cartao")}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem value="pix" id="upgrade-pix" className="peer sr-only" />
                <Label
                  htmlFor="upgrade-pix"
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <QrCode className="h-6 w-6" />
                  <span className="font-medium">PIX</span>
                  <span className="text-xs text-muted-foreground">Aprovação imediata</span>
                </Label>
              </div>

              <div>
                <RadioGroupItem value="cartao" id="upgrade-cartao" className="peer sr-only" />
                <Label
                  htmlFor="upgrade-cartao"
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <CreditCard className="h-6 w-6" />
                  <span className="font-medium">Cartão</span>
                  <span className="text-xs text-muted-foreground">Crédito ou débito</span>
                </Label>
              </div>
            </RadioGroup>

            {/* Campos do cartão */}
            {metodoPagamento === "cartao" && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="upgrade-cardNumber">Número do cartão</Label>
                  <Input
                    id="upgrade-cardNumber"
                    placeholder="0000 0000 0000 0000"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="upgrade-cardExpiry">Validade</Label>
                    <Input
                      id="upgrade-cardExpiry"
                      placeholder="MM/AA"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="upgrade-cardCvv">CVV</Label>
                    <Input
                      id="upgrade-cardCvv"
                      placeholder="123"
                      maxLength={4}
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Info PIX */}
            {metodoPagamento === "pix" && (
              <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground">
                  Após confirmar, você receberá um QR Code PIX para pagamento. A aprovação é instantânea.
                </p>
              </div>
            )}
          </div>

          {/* Resumo */}
          <div className="p-4 bg-secondary/30 rounded-lg border border-border/50">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total</span>
              <span className="text-2xl font-bold">R$ {preco}</span>
            </div>
            {isAnual && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                Você economiza R$ {selectedPlano!.precoMensal * 12 - selectedPlano!.precoAnual} por ano!
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
              Voltar
            </Button>
            <Button type="submit" className="flex-1" disabled={isProcessing}>
              {isProcessing
                ? "Processando..."
                : metodoPagamento === "pix"
                ? "Gerar QR Code PIX"
                : "Finalizar pagamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
