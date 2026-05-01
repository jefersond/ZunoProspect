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
import { trackLead, trackCompleteRegistration, trackAddPaymentInfo } from "@/lib/metaPixel";
import { getAuthRedirectBaseUrl } from "@/lib/authRedirect";
import { getKiwifyCheckoutUrl } from "@/config/kiwifyLinks";
import { Logo } from "@/components/Logo";

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
  const [activeTab, setActiveTab] = useState<string>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('rememberMe') !== 'false';
  });
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false
  });

  // Handle Google OAuth login
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    
    try {
      const referralCode = searchParams.get("ref");
      if (referralCode) {
        localStorage.setItem("pending_referral", referralCode);
      }

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
      setGoogleLoading(false);
    }
  };

  // Read tab from URL params and handle OAuth errors
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "signup" || tab === "login") {
      setActiveTab(tab);
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
      
      // Clean up the URL by removing error params
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams, toast]);

  // Redirect authenticated users - check for pending checkout first
  useEffect(() => {
    // Helper function to process pending checkout
    const processPendingCheckout = (session: { user: { email?: string | null; user_metadata?: { full_name?: string; name?: string } } }) => {
      const pendingCheckout = localStorage.getItem('checkout_pending');
      if (pendingCheckout) {
        try {
          const { plano, isAnual } = JSON.parse(pendingCheckout);
          localStorage.removeItem('checkout_pending');
          
          const userEmail = session.user.email || '';
          const userName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';
          
          // Track payment info
          trackAddPaymentInfo({
            content_category: 'Kiwify',
            currency: 'BRL',
            value: 0
          });

          // Generate Kiwify checkout URL and redirect
          const checkoutUrl = getKiwifyCheckoutUrl(plano, isAnual, userEmail, userName);
          
          toast({
            title: "Logado com Google!",
            description: "Redirecionando para o pagamento..."
          });
          
          // Use setTimeout(0) to avoid Supabase auth deadlock
          setTimeout(() => {
            window.location.href = checkoutUrl;
          }, 0);
          return true;
        } catch (e) {
          localStorage.removeItem('checkout_pending');
        }
      }
      return false;
    };

    // Set up auth state listener to catch OAuth redirects
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Only process on sign-in events
        if (event === 'SIGNED_IN' && session) {
          // Check for pending checkout
          if (processPendingCheckout(session)) {
            return;
          }
          
          // Default: redirect to prospeccao (defer to avoid deadlock)
          setTimeout(() => {
            navigate("/prospeccao");
          }, 0);
        }
      }
    );

    // Also check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Check for pending checkout
        if (processPendingCheckout(session)) {
          return;
        }
        
        navigate("/prospeccao");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

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
    const formData = new FormData(e.currentTarget);
    const fullName = formData.get("fullName") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

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
      setLoading(false);
      return;
    }

    const redirectBase = getAuthRedirectBaseUrl();
    const {
      data,
      error
    } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: {
          full_name: fullName,
          referred_by_code: searchParams.get("ref") || null
        }
      }
    });
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
    } else {
      // Track CompleteRegistration event
      trackCompleteRegistration({
        content_name: 'Free Account',
        status: 'success'
      });
      
      // Verificar se já existe sessão (auto-confirm ativado)
      if (data.session) {
        toast({
          title: "Bem-vindo ao Zuno Propect!",
          description: "Sua conta foi criada com sucesso."
        });
        // Login automático - redireciona direto para o app
        navigate("/prospeccao");
      } else {
        // Fallback caso auto-confirm esteja desativado
        toast({
          title: "Conta criada com sucesso!",
          description: "Verifique seu email para confirmar a conta."
        });
        setSignupPassword("");
        setActiveTab("login");
      }
    }
    setLoading(false);
  };
  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
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
      setLoading(false);
      return;
    }
    
    // Armazenar preferência de "lembrar-me"
    localStorage.setItem('rememberMe', rememberMe.toString());
    
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
    } else if (data.session) {
      // Se "lembrar-me" estiver desmarcado, configurar logout ao fechar o navegador
      if (!rememberMe) {
        sessionStorage.setItem('logoutOnClose', 'true');
      }
      navigate("/prospeccao");
    }
    setLoading(false);
  };
  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-primary/5 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <Card className="w-full max-w-md shadow-lg border-primary/20 bg-background/50 backdrop-blur-sm">
        <CardHeader className="space-y-4">
          <div className="flex justify-center mb-2">
            <Logo className="scale-125" />
          </div>
          <CardDescription className="text-center font-medium">
            Sistema profissional de geração de leads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50 p-1">
              <TabsTrigger 
                value="login" 
                className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
              >
                Login
              </TabsTrigger>
              <TabsTrigger 
                value="signup" 
                className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
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
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={loading}>
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
                      <Input id="login-email" name="email" type="email" placeholder="seu@email.com" required />
                    </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Senha</Label>
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-sm text-primary hover:underline"
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
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
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
                      className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    />
                    <Label htmlFor="remember-me" className="text-sm font-normal cursor-pointer">
                      Lembrar-me neste dispositivo
                    </Label>
                  </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Entrando...
                        </> : "Entrar"}
                    </Button>
                  </form>
                  
                  {/* Separador */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        ou continue com
                      </span>
                    </div>
                  </div>

                  {/* Botão Google */}
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full" 
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
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-fullname">Nome Completo</Label>
                    <Input id="signup-fullname" name="fullName" type="text" placeholder="Seu nome completo" required minLength={3} />
                  </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" name="email" type="email" placeholder="seu@email.com" required />
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
                        setSignupPassword(e.target.value);
                        validatePasswordStrength(e.target.value);
                      }}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
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
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando conta...
                      </> : "Criar conta"}
                  </Button>
                </form>
                
                {/* Separador */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      ou continue com
                    </span>
                  </div>
                </div>

                {/* Botão Google */}
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full" 
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