import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle2, Loader2, Eye, EyeOff, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plano } from "./data";
import { trackInitiateCheckout, trackAddPaymentInfo } from "@/lib/metaPixel";
import { getAuthRedirectBaseUrl } from "@/lib/authRedirect";
import { useLeadPricing } from "@/hooks/useLeadPricing";
import { createStripeCheckout } from "@/services/stripeCheckout";
import { getCurrentReferralCode, saveReferralCode } from "@/lib/referral";

// Google Icon Component
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plano: Plano | null;
  isAnual: boolean;
  selectedLeads?: number;
}

export function CheckoutDialog({ open, onOpenChange, plano, isAnual, selectedLeads = 100 }: CheckoutDialogProps) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGoogleProcessing, setIsGoogleProcessing] = useState(false);
  const hasTrackedCheckout = useRef(false);
  const { calculatePrice, getDisplayPrice } = useLeadPricing();
  const referralCode = getCurrentReferralCode(window.location.search);

  // Track InitiateCheckout when dialog opens
  useEffect(() => {
    if (open && plano && !hasTrackedCheckout.current) {
      hasTrackedCheckout.current = true;
      const packageLeads = plano.leadsLimit || selectedLeads;
      const preco = calculatePrice(plano.planKey, packageLeads, isAnual);
      trackInitiateCheckout({
        value: preco,
        currency: 'BRL',
        content_name: `${plano.nome} - ${packageLeads} leads`,
        content_category: isAnual ? 'Annual' : 'Monthly',
        num_items: 1
      });
    }
    if (!open) {
      hasTrackedCheckout.current = false;
    }
  }, [open, plano, isAnual, selectedLeads, calculatePrice]);

  if (!plano) return null;

  const packageLeads = plano.leadsLimit || selectedLeads;
  const preco = calculatePrice(plano.planKey, packageLeads, isAnual);
  const precoMensal = getDisplayPrice(plano.planKey, packageLeads, isAnual);
  const periodo = isAnual ? "/ano" : "/mês";
  const economia = isAnual ? 17 : 0; // Fixed 17% discount on annual

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

  const handleGoogleSignIn = async () => {
    setIsGoogleProcessing(true);
    try {
      // Store checkout info in localStorage for after OAuth redirect
      localStorage.setItem('checkout_pending', JSON.stringify({
        plano: plano.nome,
        planKey: plano.planKey,
        selectedLeads: packageLeads,
        isAnual,
        referralCode,
      }));
      saveReferralCode(referralCode);

      const redirectBase = getAuthRedirectBaseUrl();
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${redirectBase}/auth`,
        }
      });

      if (error) {
        toast.error("Erro ao entrar com Google", { description: error.message });
        setIsGoogleProcessing(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao processar", { description: errorMessage });
      setIsGoogleProcessing(false);
    }
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

    const redirectBase = getAuthRedirectBaseUrl();
    console.log("Auth action:", "checkout-dialog-signup");
    console.log("referral code:", referralCode ? "presente" : "ausente");
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        emailRedirectTo: `${redirectBase}/auth`,
        data: {
          full_name: nome,
          selected_plan: plano.planKey,
          referred_by_code: referralCode || null,
        }
      }
    });
    console.log("signUp session exists:", !!data.session);

    if (authError) {
      if (authError.message.includes("already registered")) {
        toast.error("Este email já está cadastrado", { description: "Faça login ou use outro email." });
      } else {
        toast.error("Erro ao criar conta", { description: authError.message });
      }
      return false;
    }
    if (!data.session) {
      toast.info("Conta criada. Verifique seu e-mail para confirmar o acesso.", {
        description: "Depois de confirmar, entre novamente para finalizar o pagamento."
      });
      setSenha("");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast.error("Informe seu nome completo"); return; }
    if (!email.trim()) { toast.error("Informe seu email"); return; }

    setIsProcessing(true);
    try {
      // Criar conta no Supabase
      const accountCreated = await validateAndCreateAccount();
      if (!accountCreated) { setIsProcessing(false); return; }

      // Track payment info
      trackAddPaymentInfo({
        content_category: 'Stripe',
        currency: 'BRL',
        value: preco
      });

      toast.loading("Conta criada! Gerando link de pagamento...");

      // Gerar URL do checkout via Stripe Edge Function
      const data = await createStripeCheckout({
        selectedPlan: plano,
        billingCycle: "monthly",
      });

      toast.dismiss();
      
      toast.success("Redirecionando para o pagamento seguro...");
      
      // Redirecionar para Checkout Stripe
      window.location.href = data.url;
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao processar", { description: errorMessage });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing && !isGoogleProcessing) {
      setNome(""); 
      setEmail(""); 
      setSenha(""); 
      setShowPassword(false);
      onOpenChange(false);
    }
  };

  const isAnyProcessing = isProcessing || isGoogleProcessing;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto scrollbar-zuno">
        <DialogHeader>
          <DialogTitle>Checkout - Plano {plano.nome}</DialogTitle>
          <DialogDescription>
            {selectedLeads.toLocaleString('pt-BR')} leads/mês • R$ {isAnual ? precoMensal : preco}{periodo}{isAnual && economia > 0 ? ` (${economia}% de desconto)` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Google Sign In Button */}
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 gap-3 text-base font-medium border-2 hover:bg-muted/50"
              onClick={handleGoogleSignIn}
              disabled={isAnyProcessing}
            >
              {isGoogleProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <GoogleIcon />
                  Entrar com Google e pagar
                </>
              )}
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                ou cadastre com email
              </span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {referralCode && (
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm leading-5 text-muted-foreground">
                <span className="font-medium text-foreground">Voce esta entrando por um convite.</span>{" "}
                A indicacao sera registrada, mas o bonus do indicador so sera liberado se voce assinar um plano.
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo *</Label>
                <Input 
                  id="nome" 
                  placeholder="Seu nome completo" 
                  value={nome} 
                  onChange={e => setNome(e.target.value)} 
                  required 
                  disabled={isAnyProcessing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="seu@email.com" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                  disabled={isAnyProcessing}
                />
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
                    disabled={isAnyProcessing}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={isAnyProcessing}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {senha && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${getPasswordStrengthColor()}`} 
                          style={{ width: `${(passwordStrength / 4) * 100}%` }} 
                        />
                      </div>
                      <span className={`text-xs font-medium ${
                        passwordStrength <= 2 ? "text-red-500" : 
                        passwordStrength === 3 ? "text-yellow-500" : "text-emerald-500"
                      }`}>
                        {getPasswordStrengthLabel()}
                      </span>
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

            {/* Resumo do plano */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-medium">Plano {plano.nome}</span>
                  <p className="text-xs text-muted-foreground">{selectedLeads.toLocaleString('pt-BR')} leads/mês</p>
                </div>
                <span className="font-bold text-lg">R$ {preco.toLocaleString('pt-BR')}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {isAnual ? "Cobrança anual" : "Cobrança mensal"} • Cancele quando quiser
              </p>
            </div>

            <div className="space-y-3">
              <Button 
                type="submit" 
                className="w-full bg-emerald-600 hover:bg-emerald-700" 
                disabled={isAnyProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Criar conta e pagar
                  </>
                )}
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                Você será redirecionado para a página de pagamento segura.
                <br />
                Aceita PIX, cartão de crédito e boleto.
              </p>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
