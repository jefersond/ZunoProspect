import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, Loader2, Eye, EyeOff, ArrowLeft, Check, Sparkles, Building2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { getAttributionParams, trackCompleteRegistration, trackInitiateCheckout, trackAddPaymentInfo, trackMetaCustomEvent } from "@/lib/metaPixel";
import { getAuthRedirectBaseUrl } from "@/lib/authRedirect";
import { createStripeCheckout } from "@/services/stripeCheckout";
import { getFunnelContext } from "@/lib/funnelContext";
import { PLANS, normalizePlanId } from "@/config/plans";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentReferralCode, saveReferralCode } from "@/lib/referral";
import { trackEvent } from "@/lib/analytics";

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

// Dados dos planos
const PLANOS = {
  starter: {
    nome: PLANS.starter.displayName,
    precoMensal: PLANS.starter.monthlyPrice,
    precoAnual: PLANS.starter.annualPrice,
    leadsLimit: PLANS.starter.leadsLimit,
    aiLimit: PLANS.starter.aiLimit,
    gratuito: false,
    icon: Sparkles,
    popular: false,
    features: [
      "300 leads/mês",
      "30 análises com IA/mês",
      "CRM: salvar + status + anotações",
      "Templates de mensagem",
    ],
  },
  pro: {
    nome: PLANS.pro.displayName,
    precoMensal: PLANS.pro.monthlyPrice,
    precoAnual: PLANS.pro.annualPrice,
    leadsLimit: PLANS.pro.leadsLimit,
    aiLimit: PLANS.pro.aiLimit,
    gratuito: false,
    icon: Sparkles,
    popular: true,
    features: [
      "800 leads/mês",
      "100 análises com IA/mês",
      "Plano 7 dias por lead",
      "Detecção de sinais digitais",
      "Exportar para Excel",
    ],
  },
  agencia: {
    nome: PLANS.agency.displayName,
    precoMensal: PLANS.agency.monthlyPrice,
    precoAnual: PLANS.agency.annualPrice,
    leadsLimit: PLANS.agency.leadsLimit,
    aiLimit: PLANS.agency.aiLimit,
    gratuito: false,
    icon: Building2,
    popular: false,
    features: [
      "2.000 leads/mês",
      "300 análises com IA/mês",
      "Tudo do Pro +",
      "API de integração",
      "Relatórios avançados",
      "Suporte prioritário",
    ],
  },
};

type PlanoKey = "starter" | "pro" | "agencia";

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  // Get params from URL
  const normalizedPlanParam = normalizePlanId(searchParams.get("plano"));
  const planoParam = (normalizedPlanParam === "agency" ? "agencia" : normalizedPlanParam) as PlanoKey | null;
  const anualParam = searchParams.get("anual") || "false";
  const leadsQtyParam = Number(searchParams.get("leadsQty") || "0");
  const googleAuth = searchParams.get("google_auth");
  const referralCode = getCurrentReferralCode(searchParams);
  
  // State for selected plan - default to URL param or "pro"
  const [selectedPlano, setSelectedPlano] = useState<PlanoKey>(
    planoParam && PLANOS[planoParam] ? planoParam : "pro"
  );
  
  const plano = PLANOS[selectedPlano];
  
  const [isAnual] = useState(anualParam === "true");
  const selectedLeadsQty = plano.leadsLimit;
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGoogleProcessing, setIsGoogleProcessing] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  // Note: OAuth callback is now handled by /auth page which checks for checkout_pending
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;

      setHasSession(true);
      setEmail(session.user.email || "");
      setNome(session.user.user_metadata?.full_name || session.user.user_metadata?.name || "");
    });
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

  const handleGoogleSignIn = async () => {
    setIsGoogleProcessing(true);
    try {
      // Store checkout info in localStorage for after OAuth redirect
      localStorage.setItem('checkout_pending', JSON.stringify({
        plano: selectedPlano,
        isAnual,
        leadsQty: selectedLeadsQty,
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
        localStorage.removeItem('checkout_pending');
        toast.error("Erro ao entrar com Google", { description: error.message });
        setIsGoogleProcessing(false);
      }
    } catch (error) {
      localStorage.removeItem('checkout_pending');
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao processar", { description: errorMessage });
      setIsGoogleProcessing(false);
    }
  };

  const validateAndCreateAccount = async (): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      return true;
    }

    if (!senha || senha.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres");
      return false;
    }
    if (passwordStrength < 3) {
      toast.error("A senha deve conter letras maiúsculas, minúsculas e números");
      return false;
    }

    const redirectBase = getAuthRedirectBaseUrl();
    console.log("Auth action:", "checkout-signup");
    console.log("referral code:", referralCode ? "presente" : "ausente");
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        emailRedirectTo: `${redirectBase}/auth`,
        data: {
          full_name: nome,
          selected_plan: selectedPlano,
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

    trackCompleteRegistration({
      method: "email",
      source: "checkout",
    });
    if (referralCode) {
      trackMetaCustomEvent("Referral_Signup_Completed", {
        has_ref: true,
        ref_source: "url",
      });
    }
    setHasSession(true);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast.error("Informe seu nome completo"); return; }
    if (!email.trim()) { toast.error("Informe seu email"); return; }
    if (!hasSession && !senha.trim()) { toast.error("Informe uma senha para criar sua conta"); return; }
    
    setIsProcessing(true);
    try {
      const accountCreated = await validateAndCreateAccount();
      if (!accountCreated) { setIsProcessing(false); return; }
      
      // Track payment info
      const trackingPlanId = selectedPlano === "agencia" ? "agency" : selectedPlano;
      trackMetaCustomEvent("Plan_Selected", {
        plan_id: trackingPlanId,
        plan_name: plano.nome,
        value: plano.precoMensal,
        currency: "BRL",
      });
      trackAddPaymentInfo({
        content_category: 'Stripe',
        currency: 'BRL',
        value: preco
      });

      toast.loading(hasSession ? "Gerando link de pagamento seguro..." : "Conta criada! Gerando link de pagamento seguro...");

      // Chamar Edge Function do Stripe
      const data = await createStripeCheckout({
        selectedPlan: { nome: plano.nome, planKey: selectedPlano },
        billingCycle: isAnual ? "annual" : "monthly",
        authUserFromHook: user,
      });

      const funnelContext = await getFunnelContext(null, "checkout_page");
      trackEvent("checkout_started", {
        ...funnelContext,
        plan_id: trackingPlanId,
        plan_name: plano.nome,
        value: plano.precoMensal,
        currency: "BRL",
        billing_cycle: isAnual ? "annual" : "monthly",
        location: "checkout_page",
        source: "checkout_page",
        stripe_session_id: data.sessionId || null,
        content_name: `Zuno Propect ${plano.nome}`,
      });
      trackInitiateCheckout({
        content_name: `Zuno Propect ${plano.nome}`,
        content_category: "subscription",
        plan_id: trackingPlanId,
        plan_name: plano.nome,
        value: plano.precoMensal,
        currency: "BRL",
      });
      const attribution = getAttributionParams();
      if ((attribution.offer === "founder_pro" || attribution.utm_campaign === "founder") && trackingPlanId === "pro") {
        trackMetaCustomEvent("Founder_Offer_Checkout", {
          offer: "founder_pro",
          plan_id: "pro",
          value: 47,
          currency: "BRL",
        });
      }

      toast.dismiss();
      
      toast.success("Redirecionando para o pagamento seguro...");
      window.location.href = data.url;
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      const status = typeof error === "object" && error !== null && "status" in error ? (error as { status?: number }).status : undefined;
      toast.error(status === 401 ? "Sessão expirada. Faça login novamente." : "Não foi possível iniciar o pagamento", {
        description: status === 401 ? errorMessage : "Tente novamente.",
      });
      trackMetaCustomEvent("Checkout_Failed", {
        plan_id: selectedPlano === "agencia" ? "agency" : selectedPlano,
        error_message: errorMessage,
      });
      getFunnelContext(null, "checkout_page").then((funnelContext) => {
        trackEvent("checkout_failed", {
          ...funnelContext,
          plan_id: selectedPlano === "agencia" ? "agency" : selectedPlano,
          source: "checkout_page",
          error_message_safe: errorMessage,
          error: errorMessage,
        });
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const isAnyProcessing = isProcessing || isGoogleProcessing;

  // Plan selector component
  const PlanSelector = () => (
    <div className="grid grid-cols-1 gap-3 mb-6 sm:grid-cols-3">
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
            disabled={isAnyProcessing}
            className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
              isSelected 
                ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/20" 
                : "border-border hover:border-muted-foreground/50 bg-card"
            } ${isAnyProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
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
            <div className="space-y-5">
              {/* Plan Selector */}
              <PlanSelector />
              
              <div className="flex items-center justify-center gap-3 p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-semibold">{isAnual ? "Cobrança anual" : "Cobrança mensal"}</span>
              </div>

              {/* Resumo do plano */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Plano {plano.nome}</span>
                  <span className="font-bold text-lg text-emerald-500">R$ {preco}{periodo}</span>
                </div>
              </div>

              {/* Google Sign In Button */}
              {!hasSession && <div className="space-y-3">
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
              </div>}

              {/* Divider */}
              {!hasSession && <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    ou cadastre com email
                  </span>
                </div>
              </div>}

              {/* Form Fields */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {referralCode && !hasSession && (
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
                      disabled={isAnyProcessing || hasSession}
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
                      disabled={isAnyProcessing || hasSession}
                    />
                  </div>
                  {!hasSession && <div className="space-y-2">
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
                  </div>}
                </div>

                {/* Submit Button */}
                <div className="space-y-3 pt-2">
                  <Button 
                    type="submit" 
                    className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base" 
                    disabled={isAnyProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-5 w-5 mr-2" />
                        {hasSession ? "Ir para pagamento" : "Criar conta e pagar"}
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
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
