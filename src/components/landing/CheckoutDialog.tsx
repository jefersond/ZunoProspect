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
import { getKiwifyCheckoutUrl } from "@/config/kiwifyLinks";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plano: Plano | null;
  isAnual: boolean;
}

export function CheckoutDialog({ open, onOpenChange, plano, isAnual }: CheckoutDialogProps) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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
        content_category: 'Kiwify',
        currency: 'BRL',
        value: preco
      });

      // Gerar URL do checkout Kiwify
      const checkoutUrl = getKiwifyCheckoutUrl(plano.nome, isAnual, email, nome);
      
      toast.success("Conta criada! Redirecionando para o pagamento...");
      
      // Redirecionar para Kiwify
      window.location.href = checkoutUrl;
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao processar", { description: errorMessage });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setNome(""); 
      setEmail(""); 
      setSenha(""); 
      setShowPassword(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Checkout - Plano {plano.nome}</DialogTitle>
          <DialogDescription>
            {plano.gratuito 
              ? "Crie sua conta gratuita" 
              : `R$ ${preco}${periodo}${isAnual && economia > 0 ? ` (${economia}% de desconto)` : ""}`
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Dados pessoais</h4>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo *</Label>
              <Input 
                id="nome" 
                placeholder="Seu nome completo" 
                value={nome} 
                onChange={e => setNome(e.target.value)} 
                required 
                disabled={isProcessing}
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
                disabled={isProcessing}
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
                  disabled={isProcessing}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isProcessing}
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
              <span className="font-medium">Plano {plano.nome}</span>
              <span className="font-bold text-lg">R$ {preco}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isAnual ? "Cobrança anual" : "Cobrança mensal"} • Cancele quando quiser
            </p>
          </div>

          <div className="space-y-3">
            <Button 
              type="submit" 
              className="w-full bg-emerald-600 hover:bg-emerald-700" 
              disabled={isProcessing}
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
      </DialogContent>
    </Dialog>
  );
}
