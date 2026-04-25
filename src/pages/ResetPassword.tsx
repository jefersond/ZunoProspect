import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Progress } from "@/components/ui/progress";
import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "A senha deve ter no mínimo 8 caracteres")
  .regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiúscula")
  .regex(/[a-z]/, "A senha deve conter pelo menos uma letra minúscula")
  .regex(/[0-9]/, "A senha deve conter pelo menos um número");

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
  });

  useEffect(() => {
    // Check if user has a valid recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast({
          variant: "destructive",
          title: "Link inválido ou expirado",
          description: "Por favor, solicite um novo link de recuperação de senha.",
        });
        navigate("/auth");
      }
    });
  }, [navigate, toast]);

  const validatePasswordStrength = (password: string) => {
    setPasswordValidation({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
    });
  };

  const getPasswordStrength = () => {
    const checks = Object.values(passwordValidation).filter(Boolean).length;
    return (checks / 4) * 100;
  };

  const getPasswordStrengthLabel = () => {
    const strength = getPasswordStrength();
    if (strength === 0) return "";
    if (strength <= 25) return "Muito fraca";
    if (strength <= 50) return "Fraca";
    if (strength <= 75) return "Média";
    return "Forte";
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    // Validação de senha
    const passwordValidationResult = passwordSchema.safeParse(password);
    if (!passwordValidationResult.success) {
      toast({
        variant: "destructive",
        title: "Senha fraca",
        description: passwordValidationResult.error.errors[0].message,
      });
      setLoading(false);
      return;
    }

    // Validação de confirmação de senha
    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Senhas não coincidem",
        description: "A senha e a confirmação devem ser iguais",
      });
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao redefinir senha",
        description: error.message.includes("different from the old")
          ? "A nova senha deve ser diferente da senha atual."
          : error.message,
      });
    } else {
      toast({
        title: "Senha redefinida com sucesso!",
        description: "Você será redirecionado para a página de prospecção.",
      });
      setTimeout(() => {
        navigate("/prospeccao");
      }, 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-primary/5 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Redefinir Senha
          </CardTitle>
          <CardDescription className="text-center">
            Digite sua nova senha abaixo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
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

              {password && (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-muted-foreground">
                      Força da senha:
                    </span>
                    <span
                      className={`font-medium ${
                        getPasswordStrength() <= 50
                          ? "text-destructive"
                          : getPasswordStrength() <= 75
                            ? "text-yellow-500"
                            : "text-green-500"
                      }`}
                    >
                      {getPasswordStrengthLabel()}
                    </span>
                  </div>
                  <Progress value={getPasswordStrength()} className="h-2" />

                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      {passwordValidation.minLength ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span
                        className={
                          passwordValidation.minLength
                            ? "text-green-500"
                            : "text-muted-foreground"
                        }
                      >
                        Mínimo de 8 caracteres
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {passwordValidation.hasUppercase ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span
                        className={
                          passwordValidation.hasUppercase
                            ? "text-green-500"
                            : "text-muted-foreground"
                        }
                      >
                        Uma letra maiúscula
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {passwordValidation.hasLowercase ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span
                        className={
                          passwordValidation.hasLowercase
                            ? "text-green-500"
                            : "text-muted-foreground"
                        }
                      >
                        Uma letra minúscula
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {passwordValidation.hasNumber ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span
                        className={
                          passwordValidation.hasNumber
                            ? "text-green-500"
                            : "text-muted-foreground"
                        }
                      >
                        Um número
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  As senhas não coincidem
                </p>
              )}
              {confirmPassword && password === confirmPassword && (
                <p className="text-sm text-green-500 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  As senhas coincidem
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redefinindo senha...
                </>
              ) : (
                "Redefinir senha"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
