import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, QrCode, CreditCard, Copy, Loader2, RefreshCw, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { trackInitiateCheckout, trackAddPaymentInfo, trackPurchase } from "@/lib/metaPixel";

// Dados dos planos
const PLANOS = {
  pro: {
    nome: "Pro",
    precoMensal: 97,
    precoAnual: 970,
    gratuito: false,
  },
  agencia: {
    nome: "Agência",
    precoMensal: 247,
    precoAnual: 2470,
    gratuito: false,
  },
};

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Get params from URL
  const planoParam = searchParams.get("plano")?.toLowerCase() as "pro" | "agencia" | null;
  const anualParam = searchParams.get("anual");
  
  // Validate plan
  const plano = planoParam && PLANOS[planoParam] ? PLANOS[planoParam] : null;
  
  const [isAnual, setIsAnual] = useState(anualParam === "true");
  const [step, setStep] = useState<"form" | "qrcode" | "confirmed">("form");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [cpf, setCpf] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [metodoPagamento, setMetodoPagamento] = useState<"pix" | "cartao">("pix");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [pixData, setPixData] = useState<{
    paymentId: string;
    pixCopiaECola: string;
    qrCodeBase64: string;
    vencimento: string;
  } | null>(null);
  const hasTrackedCheckout = useRef(false);

  // Redirect if invalid plan
  useEffect(() => {
    if (!plano) {
      navigate("/#precos");
    }
  }, [plano, navigate]);

  // Track InitiateCheckout on mount
  useEffect(() => {
    if (plano && !hasTrackedCheckout.current) {
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
  }, [plano, isAnual]);

  // Track AddPaymentInfo when payment method changes
  const handlePaymentMethodChange = (value: "pix" | "cartao") => {
    setMetodoPagamento(value);
    if (plano) {
      trackAddPaymentInfo({
        content_category: value === 'pix' ? 'PIX' : 'Credit Card',
        currency: 'BRL',
        value: isAnual ? plano.precoAnual : plano.precoMensal
      });
    }
  };

  // Poll for PIX payment confirmation
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
          setTimeout(() => navigate("/prospeccao"), 2000);
        }
      } catch (err) {
        console.error("Error in payment check:", err);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [step, pixData?.paymentId, plano, isAnual, navigate]);

  if (!plano) return null;

  const preco = isAnual ? plano.precoAnual : plano.precoMensal;
  const periodo = isAnual ? "/ano" : "/mês";
  const economia = isAnual ? Math.round((plano.precoMensal * 12 - plano.precoAnual) / (plano.precoMensal * 12) * 100) : 0;

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

  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    return cleaned.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const formatWhatsapp = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").replace(/(-\d{4})\d+?$/, "$1");
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
        trackPurchase({
          value: preco,
          currency: 'BRL',
          content_name: plano.nome,
          content_type: 'subscription',
          num_items: 1
        });
        setStep("confirmed");
        toast.success("Pagamento confirmado!");
        setTimeout(() => navigate("/prospeccao"), 2000);
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
    
    setIsProcessing(true);
    try {
      const accountCreated = await validateAndCreateAccount();
      if (!accountCreated) { setIsProcessing(false); return; }
      
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plano: plano.nome, isAnual }
      });
      
      if (error) throw error;
      
      if (data?.url) {
        toast.success("Redirecionando para o pagamento...");
        window.location.href = data.url;
      } else {
        throw new Error("URL de checkout não retornada");
      }
    } catch (error: any) {
      toast.error("Erro ao processar pagamento", { description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link to="/">
            <Logo />
          </Link>
          <Link to="/#precos" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Voltar para planos
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-xl">
              {step === "confirmed" ? (
                <><CheckCircle2 className="h-5 w-5 text-emerald-500" />Pagamento Confirmado</>
              ) : step === "qrcode" ? (
                <><QrCode className="h-5 w-5 text-primary" />Pagamento via PIX</>
              ) : (
                <>Checkout - Plano {plano.nome}</>
              )}
            </CardTitle>
            <CardDescription>
              {step === "confirmed" && "Sua assinatura foi ativada com sucesso!"}
              {step === "qrcode" && "Escaneie o QR Code ou copie o código para pagar."}
              {step === "form" && `R$ ${preco}${periodo}${isAnual && economia > 0 ? ` (${economia}% de desconto)` : ""}`}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {step === "confirmed" && (
              <div className="py-8 text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-emerald-500">Pagamento Confirmado!</h3>
                  <p className="text-sm text-muted-foreground mt-1">Redirecionando para a aplicação...</p>
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
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Toggle Mensal/Anual */}
                <div className="flex items-center justify-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <span className={`text-sm ${!isAnual ? "font-semibold" : "text-muted-foreground"}`}>Mensal</span>
                  <Switch checked={isAnual} onCheckedChange={setIsAnual} />
                  <span className={`text-sm ${isAnual ? "font-semibold" : "text-muted-foreground"}`}>
                    Anual <span className="text-emerald-500 text-xs">({economia}% OFF)</span>
                  </span>
                </div>

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
                    <div className="relative">
                      <Input 
                        id="senha" 
                        type={showPassword ? "text" : "password"} 
                        placeholder="Mínimo 8 caracteres" 
                        value={senha} 
                        onChange={e => setSenha(e.target.value)} 
                        className="pr-10"
                        required 
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
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
                </div>

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
                    <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
                      <p className="text-sm text-muted-foreground text-center">
                        Você será redirecionado para o checkout seguro do Stripe após criar sua conta.
                      </p>
                    </div>
                  )}

                  {metodoPagamento === "pix" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="cpf">CPF *</Label>
                        <Input id="cpf" placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(formatCPF(e.target.value))} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="whatsapp">WhatsApp *</Label>
                        <Input id="whatsapp" placeholder="(00) 00000-0000" value={whatsapp} onChange={e => setWhatsapp(formatWhatsapp(e.target.value))} required />
                      </div>
                    </div>
                  )}
                </div>

                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-base font-semibold" disabled={isProcessing}>
                  {isProcessing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</>
                  ) : metodoPagamento === "pix" ? (
                    "Gerar QR Code PIX"
                  ) : (
                    "Continuar para Pagamento"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
