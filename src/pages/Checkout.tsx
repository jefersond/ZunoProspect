import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, Loader2, Eye, EyeOff, ArrowLeft, Check, Sparkles, Building2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { trackInitiateCheckout, trackAddPaymentInfo } from "@/lib/metaPixel";
import { getKiwifyCheckoutUrl } from "@/config/kiwifyLinks";

// Dados dos planos
const PLANOS = {
  pro: {
    nome: "Pro",
    precoMensal: 97,
    precoAnual: 970,
    gratuito: false,
    icon: Sparkles,
    popular: true,
    features: [
      "100 leads/mês",
      "Análise IA completa",
      "Plano 7 dias por lead",
      "Detecção de sinais digitais",
      "Exportar para Excel",
    ],
  },
  agencia: {
    nome: "Agência",
    precoMensal: 247,
    precoAnual: 2470,
    gratuito: false,
    icon: Building2,
    popular: false,
    features: [
      "Leads ilimitados",
      "Tudo do Pro +",
      "API de integração",
      "Relatórios avançados",
      "Suporte prioritário",
    ],
  },
};

type PlanoKey = "pro" | "agencia";

export default function Checkout() {
  const [searchParams] = useSearchParams();
  
  // Get params from URL
  const planoParam = searchParams.get("plano")?.toLowerCase() as PlanoKey | null;
  const anualParam = searchParams.get("anual");
  
  // State for selected plan - default to URL param or "pro"
  const [selectedPlano, setSelectedPlano] = useState<PlanoKey>(
    planoParam && PLANOS[planoParam] ? planoParam : "pro"
  );
  
  const plano = PLANOS[selectedPlano];
  
  const [isAnual, setIsAnual] = useState(anualParam === "true");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const hasTrackedCheckout = useRef(false);

  // Track InitiateCheckout on mount
  useEffect(() => {
    if (!hasTrackedCheckout.current) {
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
  }, []);

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

  // Plan selector component
  const PlanSelector = () => (
    <div className="grid grid-cols-2 gap-3 mb-6">
      {(Object.entries(PLANOS) as [PlanoKey, typeof PLANOS.pro][]).map(([key, plan]) => {
        const isSelected = selectedPlano === key;
        const Icon = plan.icon;
        const planPreco = isAnual ? plan.precoAnual : plan.precoMensal;
        const planPeriodo = isAnual ? "/ano" : "/mês";
        
        return (
          <button
            key={key}
            type="button"
            onClick={() => setSelectedPlano(key)}
            disabled={isProcessing}
            className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
              isSelected 
                ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/20" 
                : "border-border hover:border-muted-foreground/50 bg-card"
            } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {plan.popular && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-semibold rounded-full whitespace-nowrap">
                Mais popular
              </span>
            )}
            
            {isSelected && (
              <div className="absolute top-2 right-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
            )}
            
            <Icon className={`h-8 w-8 mb-2 ${isSelected ? "text-emerald-500" : "text-muted-foreground"}`} />
            <span className="font-bold text-lg">{plan.nome}</span>
            <span className={`text-xl font-bold mt-1 ${isSelected ? "text-emerald-500" : "text-foreground"}`}>
              R$ {planPreco}
              <span className="text-sm font-normal text-muted-foreground">{planPeriodo}</span>
            </span>
            
            <ul className="mt-3 space-y-1 text-left w-full">
              {plan.features.slice(0, 3).map((feature, i) => (
                <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Check className={`h-3 w-3 flex-shrink-0 ${isSelected ? "text-emerald-500" : "text-muted-foreground"}`} />
                  <span className="truncate">{feature}</span>
                </li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );

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
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Escolha seu plano e finalize</CardTitle>
            <CardDescription>Compare os planos e selecione o ideal para você</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Plan Selector */}
              <PlanSelector />
              
              {/* Toggle Mensal/Anual */}
              <div className="flex items-center justify-center gap-3 p-3 bg-muted/50 rounded-lg">
                <span className={`text-sm ${!isAnual ? "font-semibold" : "text-muted-foreground"}`}>Mensal</span>
                <Switch checked={isAnual} onCheckedChange={setIsAnual} disabled={isProcessing} />
                <span className={`text-sm ${isAnual ? "font-semibold" : "text-muted-foreground"}`}>
                  Anual <span className="text-emerald-500 text-xs">({economia}% OFF)</span>
                </span>
              </div>

              {/* Resumo do plano */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Plano {plano.nome}</span>
                  <span className="font-bold text-lg text-emerald-500">R$ {preco}{periodo}</span>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
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

              {/* Submit Button */}
              <div className="space-y-3 pt-2">
                <Button 
                  type="submit" 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base" 
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-5 w-5 mr-2" />
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
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
