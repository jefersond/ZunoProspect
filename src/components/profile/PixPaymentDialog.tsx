import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CheckCircle2, Copy, Loader2, QrCode, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface PixPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plano: string;
  isAnual: boolean;
  valor: number;
  onPaymentConfirmed: () => void;
}

export const PixPaymentDialog = ({
  open,
  onOpenChange,
  plano,
  isAnual,
  valor,
  onPaymentConfirmed,
}: PixPaymentDialogProps) => {
  const [step, setStep] = useState<"form" | "qrcode" | "confirmed">("form");
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerCpf, setCpf] = useState("");
  const [pixData, setPixData] = useState<{
    paymentId: string;
    pixCopiaECola: string;
    qrCodeBase64: string;
    vencimento: string;
  } | null>(null);

  // Poll para verificar pagamento
  useEffect(() => {
    if (step !== "qrcode" || !pixData?.paymentId) return;

    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-pix-payment", {
          body: { paymentId: pixData.paymentId },
        });

        if (error) {
          console.error("Error checking payment:", error);
          return;
        }

        if (data?.confirmed) {
          setStep("confirmed");
          clearInterval(interval);
          toast.success("Pagamento confirmado!");
          setTimeout(() => {
            onPaymentConfirmed();
            onOpenChange(false);
          }, 2000);
        }
      } catch (err) {
        console.error("Error in payment check:", err);
      }
    }, 5000); // Verificar a cada 5 segundos

    return () => clearInterval(interval);
  }, [step, pixData?.paymentId, onPaymentConfirmed, onOpenChange]);

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})/, "$1-$2")
        .replace(/(-\d{2})\d+?$/, "$1");
    }
    return numbers
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  };

  const handleGeneratePix = async () => {
    if (!customerName.trim()) {
      toast.error("Informe seu nome completo");
      return;
    }
    if (!customerCpf || customerCpf.replace(/\D/g, "").length < 11) {
      toast.error("Informe um CPF válido");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-pix-asaas", {
        body: {
          plano,
          isAnual,
          customerName,
          customerCpf,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setPixData({
          paymentId: data.paymentId,
          pixCopiaECola: data.pixCopiaECola,
          qrCodeBase64: data.qrCodeBase64,
          vencimento: data.vencimento,
        });
        setStep("qrcode");
        toast.success("QR Code PIX gerado com sucesso!");
      } else {
        throw new Error(data?.error || "Erro ao gerar PIX");
      }
    } catch (error: any) {
      console.error("Error generating PIX:", error);
      toast.error("Erro ao gerar PIX", {
        description: error.message || "Tente novamente mais tarde.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (pixData?.pixCopiaECola) {
      navigator.clipboard.writeText(pixData.pixCopiaECola);
      toast.success("Código PIX copiado!");
    }
  };

  const handleCheckPayment = async () => {
    if (!pixData?.paymentId) return;
    
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-pix-payment", {
        body: { paymentId: pixData.paymentId },
      });

      if (error) throw error;

      if (data?.confirmed) {
        setStep("confirmed");
        toast.success("Pagamento confirmado!");
        setTimeout(() => {
          onPaymentConfirmed();
          onOpenChange(false);
        }, 2000);
      } else {
        toast.info("Pagamento ainda não confirmado", {
          description: "Aguarde alguns segundos após efetuar o pagamento.",
        });
      }
    } catch (error: any) {
      toast.error("Erro ao verificar pagamento");
    } finally {
      setIsChecking(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setStep("form");
      setPixData(null);
      setCustomerName("");
      setCpf("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Pagamento via PIX
          </DialogTitle>
          <DialogDescription>
            {step === "form" && "Preencha seus dados para gerar o QR Code PIX."}
            {step === "qrcode" && "Escaneie o QR Code ou copie o código para pagar."}
            {step === "confirmed" && "Seu pagamento foi confirmado!"}
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Plano selecionado</p>
              <p className="text-lg font-bold">{plano} {isAnual ? "Anual" : "Mensal"}</p>
              <p className="text-2xl font-bold text-primary">R$ {valor.toLocaleString("pt-BR")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input
                id="name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={customerCpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleGeneratePix}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando PIX...
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4 mr-2" />
                  Gerar QR Code PIX
                </>
              )}
            </Button>
          </div>
        )}

        {step === "qrcode" && pixData && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-lg">
                <img
                  src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                  alt="QR Code PIX"
                  className="w-48 h-48"
                />
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">R$ {valor.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Vencimento: {new Date(pixData.vencimento).toLocaleDateString("pt-BR")}
              </p>
            </div>

            <div className="space-y-2">
              <Label>PIX Copia e Cola</Label>
              <div className="flex gap-2">
                <Input
                  value={pixData.pixCopiaECola}
                  readOnly
                  className="text-xs"
                />
                <Button variant="outline" size="icon" onClick={handleCopyPix}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleCheckPayment}
              disabled={isChecking}
            >
              {isChecking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Verificar Pagamento
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              O pagamento será verificado automaticamente a cada 5 segundos.
            </p>
          </div>
        )}

        {step === "confirmed" && (
          <div className="py-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-emerald-500">Pagamento Confirmado!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Sua assinatura foi ativada com sucesso.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
