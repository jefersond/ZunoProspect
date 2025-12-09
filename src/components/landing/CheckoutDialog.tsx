import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle2, QrCode, CreditCard, Copy, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plano } from "./data";
import { trackInitiateCheckout, trackAddPaymentInfo, trackPurchase } from "@/lib/metaPixel";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plano: Plano | null;
  isAnual: boolean;
}

export function CheckoutDialog({ open, onOpenChange, plano, isAnual }: CheckoutDialogProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "qrcode" | "confirmed">("form");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [cpf, setCpf] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [metodoPagamento, setMetodoPagamento] = useState<"pix" | "cartao">("pix");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [pixData, setPixData] = useState<{
    paymentId: string;
    pixCopiaECola: string;
    qrCodeBase64: string;
    vencimento: string;
  } | null>(null);
  const hasTrackedCheckout = useRef(false);

  // Track InitiateCheckout when dialog opens
  useEffect(() => {
    if (open && plano && !hasTrackedCheckout.current) {
      hasTrackedCheckout.current = true;
      const preco = isAnual ? plano.precoAnual : plano.precoMensal;
      trackInitiateCheckout({
        value: preco,
        currency: 'BRL',
        content_name: plano.nome,
        content_category: isAnual ? 'Annual' : 'Monthly',
        num_items: 1
      });
    }
    if (!open) {
      hasTrackedCheckout.current = false;
    }
  }, [open, plano, isAnual]);

  // Track AddPaymentInfo when payment method changes
  const handlePaymentMethodChange = (value: "pix" | "cartao") => {
    setMetodoPagamento(value);
    trackAddPaymentInfo({
      content_category: value === 'pix' ? 'PIX' : 'Credit Card',
      currency: 'BRL',
      value: plano ? (isAnual ? plano.precoAnual : plano.precoMensal) : 0
    });
  };

  const passwordValidation = {
    minLength: senha.length >= 8,
    hasUppercase: /[A-Z]/.test(senha),
    hasLowercase: /[a-z]/.test(senha),
    hasNumber: /[0-9]/.test(senha),
  };
  const passwordStrength = Object.values(passwordValidation).filter(Boolean).length;
  
  const getPasswordStrengthLabel = () => {
    if (passwordStrength === 0) return "";
    if (passwordStrength <= 2) return "Fraca";
    if (passwordStrength === 3) return "Média";
    return "Forte";
  };
  
  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 2) return "bg-red-500";
    if (passwordStrength === 3) return "bg-yellow-500";
    return "bg-emerald-500";
  };

  useEffect(() => {
    if (step !== "qrcode" || !pixData?.paymentId || !plano) return;
    const currentPreco = isAnual ? plano.precoAnual : plano.precoMensal;
    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-pix-payment", {
          body: { paymentId: pixData.paymentId }
        });
        if (error) return;
        if (data?.confirmed) {
          // Track Purchase event
          trackPurchase({
            value: currentPreco,
            currency: 'BRL',
            content_name: plano.nome,
            content_type: 'subscription',
            num_items: 1
          });
          setStep("confirmed");
          clearInterval(interval);
          toast.success("Pagamento confirmado!");
          setTimeout(() => handleClose(), 2000);
        }
      } catch (err) {
        console.error("Error in payment check:", err);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [step, pixData?.paymentId, plano, isAnual]);

  if (!plano) return null;

  const preco = isAnual ? plano.precoAnual : plano.precoMensal;
  const periodo = isAnual ? "/ano" : "/mês";
  const economia = isAnual ? Math.round((plano.precoMensal * 12 - plano.precoAnual) / (plano.precoMensal * 12) * 100) : 0;

  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    return cleaned.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const formatWhatsapp = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").replace(/(-\d{4})\d+?$/, "$1");
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 16);
    return cleaned.replace(/(\d{4})/g, "$1 ").trim();
  };

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 4);
    if (cleaned.length >= 2) return cleaned.slice(0, 2) + "/" + cleaned.slice(2);
    return cleaned;
  };

  const validateAndCreateAccount = async (): Promise<boolean> => {
    if (!senha || senha.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres");
      return false;
    }
    if (passwordStrength < 3) {
      toast.error("A senha deve conter letras maiúsculas, minúsculas e números");
      return false;
    }
    if (senha !== confirmarSenha) {
      toast.error("As senhas não coincidem");
      return false;
    }

    const redirectUrl = `${window.location.origin}/prospeccao`;
    const { error: authError } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: nome }
      }
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        toast.error("Este email já está cadastrado", { description: "Faça login ou use outro email." });
      } else {
        toast.error("Erro ao criar conta", { description: authError.message });
      }
      return false;
    }
    return true;
  };

  const handleGeneratePix = async () => {
    if (!nome.trim()) { toast.error("Informe seu nome completo"); return; }
    if (!email.trim()) { toast.error("Informe seu email"); return; }
    if (!cpf || cpf.replace(/\D/g, "").length < 11) { toast.error("Informe um CPF válido"); return; }
    if (!whatsapp || whatsapp.replace(/\D/g, "").length < 10) { toast.error("Informe um WhatsApp válido"); return; }

    setIsProcessing(true);
    try {
      const accountCreated = await validateAndCreateAccount();
      if (!accountCreated) { setIsProcessing(false); return; }

      const { data, error } = await supabase.functions.invoke("create-pix-asaas", {
        body: { plano: plano.nome, isAnual, customerName: nome, customerCpf: cpf, customerEmail: email, customerWhatsapp: whatsapp }
      });
      if (error) throw error;
      if (data?.success) {
        setPixData({ paymentId: data.paymentId, pixCopiaECola: data.pixCopiaECola, qrCodeBase64: data.qrCodeBase64, vencimento: data.vencimento });
        setStep("qrcode");
        toast.success("Conta criada e QR Code PIX gerado!");
      } else {
        throw new Error(data?.error || "Erro ao gerar PIX");
      }
    } catch (error: any) {
      toast.error("Erro ao gerar PIX", { description: error.message || "Tente novamente mais tarde." });
    } finally {
      setIsProcessing(false);
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
      const { data, error } = await supabase.functions.invoke("check-pix-payment", { body: { paymentId: pixData.paymentId } });
      if (error) throw error;
      if (data?.confirmed) {
        // Track Purchase event
        trackPurchase({
          value: preco,
          currency: 'BRL',
          content_name: plano?.nome || 'Plan',
          content_type: 'subscription',
          num_items: 1
        });
        setStep("confirmed");
        toast.success("Pagamento confirmado!");
        setTimeout(() => handleClose(), 2000);
      } else {
        toast.info("Pagamento ainda não confirmado", { description: "Aguarde alguns segundos após efetuar o pagamento." });
      }
    } catch {
      toast.error("Erro ao verificar pagamento");
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !email) { toast.error("Preencha todos os campos obrigatórios"); return; }
    if (metodoPagamento === "pix") { await handleGeneratePix(); return; }
    if (metodoPagamento === "cartao" && (!cardNumber || !cardExpiry || !cardCvv)) { toast.error("Preencha todos os dados do cartão"); return; }
    
    setIsProcessing(true);
    try {
      const accountCreated = await validateAndCreateAccount();
      if (!accountCreated) { setIsProcessing(false); return; }
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Track Purchase event for card payment
      trackPurchase({
        value: preco,
        currency: 'BRL',
        content_name: plano?.nome || 'Plan',
        content_type: 'subscription',
        num_items: 1
      });
      setStep("confirmed");
      toast.success("Conta criada e pagamento processado!");
      setTimeout(() => navigate("/prospeccao"), 2000);
    } catch (error: any) {
      toast.error("Erro ao processar pagamento", { description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setStep("form");
      setPixData(null);
      setNome(""); setEmail(""); setSenha(""); setConfirmarSenha("");
      setCpf(""); setWhatsapp(""); setCardNumber(""); setCardExpiry(""); setCardCvv("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "confirmed" ? (
              <><CheckCircle2 className="h-5 w-5 text-emerald-500" />Pagamento Confirmado</>
            ) : step === "qrcode" ? (
              <><QrCode className="h-5 w-5 text-primary" />Pagamento via PIX</>
            ) : (
              <>Checkout - Plano {plano.nome}</>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === "confirmed" && "Sua assinatura foi ativada com sucesso!"}
            {step === "qrcode" && "Escaneie o QR Code ou copie o código para pagar."}
            {step === "form" && (plano.gratuito ? "Crie sua conta gratuita" : `R$ ${preco}${periodo}${isAnual && economia > 0 ? ` (${economia}% de desconto)` : ""}`)}
          </DialogDescription>
        </DialogHeader>

        {step === "confirmed" && (
          <div className="py-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-emerald-500">Pagamento Confirmado!</h3>
              <p className="text-sm text-muted-foreground mt-1">Sua assinatura foi ativada com sucesso.</p>
            </div>
          </div>
        )}

        {step === "qrcode" && pixData && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-lg">
                <img src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code PIX" className="w-48 h-48" />
              </div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">R$ {preco.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground mt-1">Vencimento: {new Date(pixData.vencimento).toLocaleDateString("pt-BR")}</p>
            </div>
            <div className="space-y-2">
              <Label>PIX Copia e Cola</Label>
              <div className="flex gap-2">
                <Input value={pixData.pixCopiaECola} readOnly className="text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopyPix}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={handleCheckPayment} disabled={isChecking}>
              {isChecking ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verificando...</> : <><RefreshCw className="h-4 w-4 mr-2" />Verificar Pagamento</>}
            </Button>
            <p className="text-xs text-center text-muted-foreground">O pagamento será verificado automaticamente a cada 5 segundos.</p>
          </div>
        )}

        {step === "form" && (
          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Dados pessoais</h4>
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo *</Label>
                <Input id="nome" placeholder="Seu nome completo" value={nome} onChange={e => setNome(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha">Senha *</Label>
                <Input id="senha" type="password" placeholder="Mínimo 8 caracteres" value={senha} onChange={e => setSenha(e.target.value)} required />
                {senha && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full transition-all ${getPasswordStrengthColor()}`} style={{ width: `${(passwordStrength / 4) * 100}%` }} />
                      </div>
                      <span className={`text-xs font-medium ${passwordStrength <= 2 ? "text-red-500" : passwordStrength === 3 ? "text-yellow-500" : "text-emerald-500"}`}>{getPasswordStrengthLabel()}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                      <span className={passwordValidation.minLength ? "text-emerald-500" : ""}>• 8+ caracteres</span>
                      <span className={passwordValidation.hasUppercase ? "text-emerald-500" : ""}>• Letra maiúscula</span>
                      <span className={passwordValidation.hasLowercase ? "text-emerald-500" : ""}>• Letra minúscula</span>
                      <span className={passwordValidation.hasNumber ? "text-emerald-500" : ""}>• Número</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmarSenha">Confirmar senha *</Label>
                <Input id="confirmarSenha" type="password" placeholder="Repita a senha" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} required />
                {confirmarSenha && senha !== confirmarSenha && <p className="text-xs text-red-500">As senhas não coincidem</p>}
              </div>
            </div>

            {!plano.gratuito && (
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Forma de pagamento</h4>
                <RadioGroup value={metodoPagamento} onValueChange={value => handlePaymentMethodChange(value as "pix" | "cartao")} className="grid grid-cols-2 gap-4">
                  <div>
                    <RadioGroupItem value="pix" id="pix" className="peer sr-only" />
                    <Label htmlFor="pix" className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer">
                      <QrCode className="h-6 w-6" /><span className="font-medium">PIX</span><span className="text-xs text-muted-foreground">Aprovação imediata</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="cartao" id="cartao" className="peer sr-only" />
                    <Label htmlFor="cartao" className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer">
                      <CreditCard className="h-6 w-6" /><span className="font-medium">Cartão</span><span className="text-xs text-muted-foreground">Crédito ou débito</span>
                    </Label>
                  </div>
                </RadioGroup>

                {metodoPagamento === "cartao" && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="cardNumber">Número do cartão</Label>
                      <Input id="cardNumber" placeholder="0000 0000 0000 0000" value={cardNumber} onChange={e => setCardNumber(formatCardNumber(e.target.value))} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cardExpiry">Validade</Label>
                        <Input id="cardExpiry" placeholder="MM/AA" value={cardExpiry} onChange={e => setCardExpiry(formatExpiry(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cardCvv">CVV</Label>
                        <Input id="cardCvv" placeholder="123" maxLength={4} value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} />
                      </div>
                    </div>
                  </div>
                )}

                {metodoPagamento === "pix" && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="cpf">CPF *</Label>
                      <Input id="cpf" placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(formatCPF(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp">WhatsApp *</Label>
                      <Input id="whatsapp" placeholder="(11) 99999-9999" value={whatsapp} onChange={e => setWhatsapp(formatWhatsapp(e.target.value))} maxLength={15} />
                    </div>
                    <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
                      <p className="text-sm text-muted-foreground">O QR Code PIX será exibido na tela para pagamento imediato.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="p-4 bg-secondary/30 rounded-lg border border-border/50">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total</span>
                <span className="text-2xl font-bold">{plano.gratuito ? "Grátis" : `R$ ${preco}`}</span>
              </div>
              {isAnual && !plano.gratuito && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  Você economiza R$ {plano.precoMensal * 12 - plano.precoAnual} por ano!
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isProcessing}>
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</>
              ) : plano.gratuito ? "Criar conta gratuita" : metodoPagamento === "pix" ? "Gerar QR Code PIX" : "Finalizar pagamento"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
