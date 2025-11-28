import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Progress } from "@/components/ui/progress";
import { z } from "zod";
const passwordSchema = z.string().min(8, "A senha deve ter no mínimo 8 caracteres").regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiúscula").regex(/[a-z]/, "A senha deve conter pelo menos uma letra minúscula").regex(/[0-9]/, "A senha deve conter pelo menos um número");
const emailSchema = z.string().email("Email inválido");
const Auth = () => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [loading, setLoading] = useState(false);
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false
  });
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

    // Validação de confirmação de senha
    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Senhas não coincidem",
        description: "A senha e a confirmação devem ser iguais"
      });
      setLoading(false);
      return;
    }
    const {
      data,
      error
    } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: fullName
        }
      }
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao criar conta",
        description: error.message
      });
    } else {
      toast({
        title: "Conta criada com sucesso!",
        description: "Você já pode fazer login."
      });
      // Limpar campos
      setSignupPassword("");
      setConfirmPassword("");
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
    const {
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
    } else {
      navigate("/prospeccao");
    }
    setLoading(false);
  };
  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-primary/5 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Zuno Propect</CardTitle>
          <CardDescription className="text-center">
            Sistema profissional de geração de leads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Cadastro</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" name="email" type="email" placeholder="seu@email.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input id="login-password" name="password" type="password" placeholder="••••••••" required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </> : "Entrar"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
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
                  <Input id="signup-password" name="password" type="password" placeholder="••••••••" required value={signupPassword} onChange={e => {
                  setSignupPassword(e.target.value);
                  validatePasswordStrength(e.target.value);
                }} />
                  
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
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password">Confirmar Senha</Label>
                  <Input id="signup-confirm-password" name="confirmPassword" type="password" placeholder="••••••••" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                  {confirmPassword && signupPassword !== confirmPassword && <p className="text-sm text-destructive flex items-center gap-1">
                      <XCircle className="h-4 w-4" />
                      As senhas não coincidem
                    </p>}
                  {confirmPassword && signupPassword === confirmPassword && <p className="text-sm text-green-500 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      As senhas coincidem
                    </p>}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando conta...
                    </> : "Criar conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>;
};
export default Auth;