import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Progress } from "@/components/ui/progress";
import { z } from "zod";
import { trackLead, trackCompleteRegistration, trackMetaCustomEvent, trackOnce } from "@/lib/metaPixel";
import { getAuthRedirectBaseUrl } from "@/lib/authRedirect";
import { Logo } from "@/components/Logo";
import { appendReferralToPath, getCurrentReferralCode, saveReferralCode } from "@/lib/referral";
import { trackEvent } from "@/lib/analytics";

const authInputClass =
  "h-11 rounded-lg border-border/80 bg-card/70 shadow-sm transition-colors placeholder:text-muted-foreground/70 hover:border-muted-foreground/40 focus-visible:border-emerald-500/60 focus-visible:ring-2 focus-visible:ring-emerald-500/25 focus-visible:ring-offset-0";
const authPrimaryButtonClass =
  "h-11 rounded-lg bg-emerald-600 text-white shadow-sm shadow-emerald-950/20 hover:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/35 focus-visible:ring-offset-0";
const authSecondaryButtonClass =
  "h-11 rounded-lg border border-border/80 bg-card/70 shadow-sm hover:border-muted-foreground/40 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-emerald-500/25 focus-visible:ring-offset-0";
const authIconButtonClass =
  "absolute inset-y-1 right-1 flex w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25";

// Google Icon Component
const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);
const passwordSchema = z.string().min(8, "A senha deve ter no mínimo 8 caracteres").regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiúscula").regex(/[a-z]/, "A senha deve conter pelo menos uma letra minúscula").regex(/[0-9]/, "A senha deve conter pelo menos um número");
const emailSchema = z.string().email("Email inválido");
const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    toast
  } = useToast();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [signupPassword, setSignupPassword] = useState("");
  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get("tab") === "signup" ? "signup" : "login");
  const [showPassword, setShowPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('rememberMe') !== 'false';
  });
  const [signupStartedTracked, setSignupStartedTracked] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false
  });
  const selectedPlan = searchParams.get("plan") || searchParams.get("plano");
  const selectedLeads = searchParams.get("leadsQty") || searchParams.get("leads") || "100";
  const isAnualParam = searchParams.get("anual") || searchParams.get("isAnual") || "false";
  const referralCode = getCurrentReferralCode(searchParams);

  const checkoutTarget = selectedPlan
    ? appendReferralToPath(`/checkout?plano=${encodeURIComponent(selectedPlan)}&anual=${encodeURIComponent(isAnualParam)}&leadsQty=${encodeURIComponent(selectedLeads)}`, referralCode)
    : null;

  const storePendingCheckout = () => {
    if (!selectedPlan) return;
    localStorage.setItem("checkout_pending", JSON.stringify({
      plano: selectedPlan,
      isAnual: isAnualParam === "true",
      leadsQty: Number(selectedLeads) || 100,
      referralCode,
    }));
  };

  const redirectAfterAuth = () => {
    const pendingCheckout = localStorage.getItem("checkout_pending");
    if (pendingCheckout) {
      try {
        const pending = JSON.parse(pendingCheckout);
        localStorage.removeItem("checkout_pending");
        navigate(appendReferralToPath(`/checkout?plano=${encodeURIComponent(pending.plano || "pro")}&anual=${encodeURIComponent(String(!!pending.isAnual))}&leadsQty=${encodeURIComponent(String(pending.leadsQty || selectedLeads))}`, pending.referralCode || referralCode), { replace: true });
        return;
      } catch {
        localStorage.removeItem("checkout_pending");
      }
    }

    if (checkoutTarget) {
      navigate(checkoutTarget, { replace: true });
      return;
    }

    const returnTo = searchParams.get("returnTo");
    navigate(returnTo || "/prospeccao", { replace: true });
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "signup") {
      trackEvent("signup_page_viewed", { source: "auth_tab" });
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", value);
    window.history.replaceState({}, "", `${window.location.pathname}?${nextParams.toString()}`);
  };

  // Handle Google OAuth login
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    trackEvent(activeTab === "signup" ? "signup_started" : "login_started", { method: "google", plan_id: selectedPlan || null });
    
    try {
      const referralCode = searchParams.get("ref");
      saveReferralCode(referralCode || getCurrentReferralCode(searchParams));
      storePendingCheckout();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          }
        }
      });
      
      if (error) {
        throw error;
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro inesperado",
        description: err.message || "Não foi possível iniciar o login com Google. Tente novamente."
      });
      trackEvent("auth_error", { method: "google", error: err.message || "google_login_failed" });
      setGoogleLoading(false);
    }
  };

  // Read tab from URL params and handle OAuth errors
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "signup" || tab === "login") {
      setActiveTab(tab);
      if (tab === "signup") {
        trackEvent("signup_page_viewed", { source: "auth_url" });
      }
    }

    // Limpar checkout pendente do localStorage caso acesse autenticação sem plano explícito
    if (!selectedPlan) {
      localStorage.removeItem("checkout_pending");
    }

    // Handle OAuth error responses
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    
    if (error) {
      let errorMessage = "Ocorreu um erro durante a autenticação.";
      
      if (error === "access_denied") {
        errorMessage = "Acesso negado. Você cancelou o login ou não autorizou o acesso.";
      } else if (error === "invalid_request" || error === "server_error") {
        errorMessage = "Erro de configuração do servidor. Tente novamente mais tarde.";
      } else if (errorDescription) {
        // Use the description from the provider if available
        errorMessage = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
      }
      
      toast({
        variant: "destructive",
        title: "Erro no login com Google",
        description: errorMessage
      });
      trackEvent("auth_error", { method: "google", error: errorMessage });
      
      // Clean up the URL by removing error params
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams, toast]);

  // Redirect authenticated users - check for pending checkout first
  useEffect(() => {
    // Set up auth state listener to catch OAuth redirects
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Only process on sign-in events
        if (event === 'SIGNED_IN' && session) {
          trackEvent(activeTab === "signup" ? "signup_completed" : "login_completed", { method: "google", plan_id: selectedPlan || null });
          trackOnce(`meta_login_google_${session.user.id}`, () => {
            trackMetaCustomEvent("Login_Completed", { method: "google" });
          });
          setTimeout(() => {
            redirectAfterAuth();
          }, 0);
        }
      }
    );

    // Also check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        redirectAfterAuth();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast, checkoutTarget]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailValidation = emailSchema.safeParse(forgotEmail);
    if (!emailValidation.success) {
      toast({
        variant: "destructive",
        title: "Email inválido",
        description: emailValidation.error.errors[0].message
      });
      return;
    }

    setLoading(true);
    const redirectBase = getAuthRedirectBaseUrl();
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      // Usamos um endpoint de callback dedicado para garantir que o app processe o retorno
      // (seja via hash ou via ?code=...)
      redirectTo: `${redirectBase}/auth/callback`,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao enviar email",
        description: error.message
      });
    } else {
      setResetEmailSent(true);
      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha."
      });
    }
    setLoading(false);
  };

  const validatePasswordStrength = (password: string) => {
    setPasswordValidation({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password)
    });
  };
  const getPasswordStrength = () => {
    const checks = Object.values(passwordValidation).filter(Boolean).length;
    return checks / 4 * 100;
  };
  const getPasswordStrengthLabel = () => {
    const strength = getPasswordStrength();
    if (strength === 0) return "";
    if (strength <= 25) return "Muito fraca";
    if (strength <= 50) return "Fraca";
    if (strength <= 75) return "Média";
    return "Forte";
  };
  const getPasswordStrengthColor = () => {
    const strength = getPasswordStrength();
    if (strength <= 25) return "bg-destructive";
    if (strength <= 50) return "bg-yellow-500";
    if (strength <= 75) return "bg-blue-500";
    return "bg-green-500";
  };
  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    trackEvent("signup_started", { method: "email", plan_id: selectedPlan || null });
    trackMetaCustomEvent("Signup_Started", {
      method: "email",
      source: selectedPlan ? "checkout" : "landing_or_app",
    });
    const formData = new FormData(e.currentTarget);
    const fullName = formData.get("fullName") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const whatsapp = formData.get("whatsapp") as string;

    // Track Lead event when user attempts signup
    trackLead({
      content_name: 'Free Signup',
      content_category: 'Registration'
    });

    // Validação de nome
    if (!fullName || fullName.trim().length < 3) {
      toast({
        variant: "destructive",
        title: "Nome inválido",
        description: "O nome deve ter pelo menos 3 caracteres"
      });
      trackEvent("auth_error", { method: "email", error: "invalid_name" });
      setLoading(false);
      return;
    }

    // Validação de email
    const emailValidation = emailSchema.safeParse(email);
    if (!emailValidation.success) {
      toast({
        variant: "destructive",
        title: "Email inválido",
        description: emailValidation.error.errors[0].message
      });
      trackEvent("auth_error", { method: "email", error: "invalid_email" });
      setLoading(false);
      return;
    }

    // Validação de senha
    const passwordValidation = passwordSchema.safeParse(password);
    if (!passwordValidation.success) {
      toast({
        variant: "destructive",
        title: "Senha fraca",
        description: passwordValidation.error.errors[0].message
      });
      trackEvent("auth_error", { method: "email", error: "weak_password" });
      setLoading(false);
      return;
    }

    const redirectBase = getAuthRedirectBaseUrl();
    storePendingCheckout();
    console.log("Auth action:", activeTab);
    console.log("referral code:", referralCode ? "presente" : "ausente");
    console.info("[Auth] submit", {
      activeTab,
      action: "signUp",
      hasSelectedPlan: !!selectedPlan,
      selectedPlan,
      url: window.location.pathname + window.location.search,
    });
    const {
      data,
      error
    } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${redirectBase}/auth`,
        data: {
          full_name: fullName,
          whatsapp: whatsapp,
          selected_plan: selectedPlan || null,
          referred_by_code: referralCode || null
        }
      }
    });
    console.log("signUp session exists:", !!data.session);
    if (error) {
      // Traduzir erros comuns do Supabase
      let errorMessage = error.message;
      if (error.message.includes("User already registered") || error.message.includes("already exists")) {
        errorMessage = "Este email já está cadastrado. Tente fazer login ou use outro email.";
      } else if (error.message.includes("Invalid email")) {
        errorMessage = "Email inválido. Verifique o formato do email.";
      } else if (error.message.includes("Password")) {
        errorMessage = "Senha inválida. A senha deve ter pelo menos 8 caracteres.";
      }
      
      toast({
        variant: "destructive",
        title: "Erro ao criar conta",
        description: errorMessage
      });
      trackEvent("auth_error", { method: "email", error: errorMessage });
    } else {
      // Track CompleteRegistration event
      trackCompleteRegistration({
        method: "email",
        source: selectedPlan ? "checkout" : "landing_or_app",
      });
      if (referralCode) {
        trackMetaCustomEvent("Referral_Signup_Completed", {
          has_ref: true,
          ref_source: "url",
        });
      }
      trackEvent("signup_completed", { method: "email", has_session: Boolean(data.session), plan_id: selectedPlan || null });
      
      // Verificar se já existe sessão (auto-confirm ativado)
      if (data.session) {
        toast({
          title: "Bem-vindo ao Zuno Prospect!",
          description: "Sua conta foi criada com sucesso."
        });
        // Login automático - redireciona direto para o app
        redirectAfterAuth();
      } else {
        // Fallback caso auto-confirm esteja desativado
        toast({
          title: "Conta criada com sucesso!",
          description: "Conta criada. Verifique seu e-mail para confirmar o acesso."
        });
        setSignupPassword("");
        handleTabChange("login");
      }
    }
    setLoading(false);
  };
  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    trackEvent("login_started", { method: "email" });
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // Validação básica de email
    const emailValidation = emailSchema.safeParse(email);
    if (!emailValidation.success) {
      toast({
        variant: "destructive",
        title: "Email inválido",
        description: emailValidation.error.errors[0].message
      });
      trackEvent("auth_error", { method: "email", error: "invalid_email" });
      setLoading(false);
      return;
    }
    
    // Armazenar preferência de "lembrar-me"
    localStorage.setItem('rememberMe', rememberMe.toString());
    storePendingCheckout();
    console.info("[Auth] submit", {
      activeTab,
      action: "signInWithPassword",
      hasSelectedPlan: !!selectedPlan,
      selectedPlan,
      url: window.location.pathname + window.location.search,
    });
    
    const {
      data,
      error
    } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao entrar",
        description: "Email ou senha incorretos. Verifique suas credenciais."
      });
      trackEvent("auth_error", { method: "email", error: "invalid_credentials" });
    } else if (data.session) {
      trackMetaCustomEvent("Login_Completed", { method: "email" });
      trackEvent("login_completed", { method: "email" });
      // Se "lembrar-me" estiver desmarcado, configurar logout ao fechar o navegador
      if (!rememberMe) {
        sessionStorage.setItem('logoutOnClose', 'true');
      }
      redirectAfterAuth();
    }
    setLoading(false);
  };
  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-primary/5 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <Card className="w-full max-w-md rounded-2xl border border-border/80 bg-card/85 shadow-2xl shadow-black/20 backdrop-blur-md">
        <CardHeader className="space-y-4 pb-5">
          <div className="flex justify-center mb-2">
            <Logo className="scale-125" />
          </div>
          <CardDescription className="text-center font-medium">
            Sistema profissional de geração de leads
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid h-12 w-full grid-cols-2 rounded-xl border border-border/80 bg-muted/25 p-1 shadow-inner shadow-black/10 mb-6">
              <TabsTrigger 
                value="login" 
                className="h-10 rounded-lg border border-transparent text-muted-foreground transition-all hover:bg-muted/40 hover:text-foreground data-[state=active]:border-border/80 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Login
              </TabsTrigger>
              <TabsTrigger 
                value="signup" 
                className="h-10 rounded-lg border border-transparent text-muted-foreground transition-all hover:bg-muted/40 hover:text-foreground data-[state=active]:border-border/80 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                Cadastrar
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              {showForgotPassword ? (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmailSent(false);
                      setForgotEmail("");
                    }}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-border/70 bg-card/60 px-3 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar ao login
                  </button>
                  
                  {resetEmailSent ? (
                    <div className="text-center space-y-4 py-4">
                      <div className="flex justify-center">
                        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                          <CheckCircle2 className="h-6 w-6 text-green-500" />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-semibold">Email enviado!</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Verifique sua caixa de entrada em <strong>{forgotEmail}</strong> para redefinir sua senha.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div className="text-center mb-4">
                        <h3 className="font-semibold">Esqueceu sua senha?</h3>
                        <p className="text-sm text-muted-foreground">
                          Digite seu email para receber um link de recuperação.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email">Email</Label>
                        <Input
                          id="forgot-email"
                          type="email"
                          placeholder="seu@email.com"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          required
                          className={authInputClass}
                        />
                      </div>
                      <Button type="submit" className={`w-full ${authPrimaryButtonClass}`} disabled={loading}>
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          "Enviar link de recuperação"
                        )}
                      </Button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input id="login-email" name="email" type="email" placeholder="seu@email.com" required className={authInputClass} />
                    </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Senha</Label>
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="rounded-md px-1.5 py-1 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                    <div className="relative">
                      <Input 
                        id="login-password" 
                        name="password" 
                        type={showLoginPassword ? "text" : "password"} 
                        placeholder="••••••••" 
                        required 
                        className={`${authInputClass} pr-12`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className={authIconButtonClass}
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="remember-me"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-border bg-card text-emerald-600 focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-0"
                    />
                    <Label htmlFor="remember-me" className="text-sm font-normal cursor-pointer">
                      Lembrar-me neste dispositivo
                    </Label>
                  </div>
                    <Button type="submit" className={`w-full ${authPrimaryButtonClass}`} disabled={loading}>
                      {loading ? <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Entrando...
                        </> : "Entrar"}
                    </Button>
                  </form>
                  
                  {/* Separador */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/80" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-3 text-muted-foreground">
                        ou continue com
                      </span>
                    </div>
                  </div>

                  {/* Botão Google */}
                  <Button 
                    type="button" 
                    variant="outline" 
                    className={`w-full ${authSecondaryButtonClass}`} 
                    onClick={handleGoogleLogin}
                    disabled={googleLoading}
                  >
                    {googleLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <GoogleIcon />
                    )}
                    <span className="ml-2">Continuar com Google</span>
                  </Button>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="signup">
              <div className="space-y-4">
                {referralCode && (
                  <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm leading-5 text-muted-foreground">
                    <span className="font-medium text-foreground">Voce esta entrando por um convite.</span>{" "}
                    A indicacao sera registrada, mas o bonus do indicador so sera liberado se voce assinar um plano.
                  </div>
                )}
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-fullname">Nome Completo</Label>
                    <Input id="signup-fullname" name="fullName" type="text" placeholder="Seu nome completo" required minLength={3} className={authInputClass} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-whatsapp">WhatsApp</Label>
                    <Input id="signup-whatsapp" name="whatsapp" type="tel" placeholder="Ex: (11) 99999-9999" required className={authInputClass} />
                  </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" name="email" type="email" placeholder="seu@email.com" required className={authInputClass} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <div className="relative">
                    <Input 
                      id="signup-password" 
                      name="password" 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      required 
                      value={signupPassword} 
                      onChange={e => {
                        if (!signupStartedTracked) {
                          setSignupStartedTracked(true);
                          trackEvent("signup_started", { method: "email", source: "password_input", plan_id: selectedPlan || null });
                        }
                        setSignupPassword(e.target.value);
                        validatePasswordStrength(e.target.value);
                      }}
                      className={`${authInputClass} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={authIconButtonClass}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  
                  {signupPassword && <div className="space-y-2 mt-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-muted-foreground">
                          Força da senha:
                        </span>
                        <span className={`font-medium ${getPasswordStrength() <= 50 ? "text-destructive" : getPasswordStrength() <= 75 ? "text-yellow-500" : "text-green-500"}`}>
                          {getPasswordStrengthLabel()}
                        </span>
                      </div>
                      <Progress value={getPasswordStrength()} className="h-2" />
                      
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          {passwordValidation.minLength ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                          <span className={passwordValidation.minLength ? "text-green-500" : "text-muted-foreground"}>
                            Mínimo de 8 caracteres
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {passwordValidation.hasUppercase ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                          <span className={passwordValidation.hasUppercase ? "text-green-500" : "text-muted-foreground"}>
                            Uma letra maiúscula
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {passwordValidation.hasLowercase ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                          <span className={passwordValidation.hasLowercase ? "text-green-500" : "text-muted-foreground"}>
                            Uma letra minúscula
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {passwordValidation.hasNumber ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                          <span className={passwordValidation.hasNumber ? "text-green-500" : "text-muted-foreground"}>
                            Um número
                          </span>
                        </div>
                      </div>
                    </div>}
                </div>
                  <Button type="submit" className={`w-full ${authPrimaryButtonClass}`} disabled={loading}>
                    {loading ? <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando conta...
                      </> : "Criar conta"}
                  </Button>
                </form>
                
                {/* Separador */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/80" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-3 text-muted-foreground">
                      ou continue com
                    </span>
                  </div>
                </div>

                {/* Botão Google */}
                <Button 
                  type="button" 
                  variant="outline" 
                  className={`w-full ${authSecondaryButtonClass}`} 
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                >
                  {googleLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <GoogleIcon />
                  )}
                  <span className="ml-2">Continuar com Google</span>
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>;
};
export default Auth;
