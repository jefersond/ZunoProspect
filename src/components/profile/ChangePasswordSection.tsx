import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Eye, EyeOff, Check, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const ChangePasswordSection = () => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Password validation
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const validCriteria = [hasMinLength, hasUpperCase, hasLowerCase, hasNumber].filter(Boolean).length;
  const passwordStrength = (validCriteria / 4) * 100;

  const getStrengthLabel = () => {
    if (passwordStrength === 100) return { label: "Forte", color: "text-green-600" };
    if (passwordStrength >= 75) return { label: "Boa", color: "text-emerald-500" };
    if (passwordStrength >= 50) return { label: "Média", color: "text-amber-500" };
    if (passwordStrength >= 25) return { label: "Fraca", color: "text-orange-500" };
    return { label: "Muito fraca", color: "text-destructive" };
  };

  const getProgressColor = () => {
    if (passwordStrength === 100) return "bg-green-600";
    if (passwordStrength >= 75) return "bg-emerald-500";
    if (passwordStrength >= 50) return "bg-amber-500";
    if (passwordStrength >= 25) return "bg-orange-500";
    return "bg-destructive";
  };

  const isFormValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!isFormValid) {
      toast({
        variant: "destructive",
        title: "Senha inválida",
        description: "Por favor, atenda todos os requisitos de senha.",
      });
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast({
        title: "Senha alterada com sucesso!",
        description: "Sua nova senha já está ativa.",
      });

      // Clear fields
      setPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao alterar senha",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const ValidationItem = ({ valid, text }: { valid: boolean; text: string }) => (
    <div className={`flex items-center gap-2 text-sm ${valid ? "text-green-600" : "text-muted-foreground"}`}>
      {valid ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      <span>{text}</span>
    </div>
  );

  const strengthInfo = getStrengthLabel();

  return (
    <Card className="shadow-lg mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          Alterar Senha
        </CardTitle>
        <CardDescription>
          Atualize sua senha de acesso
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="new_password">Nova Senha</Label>
            <div className="relative">
              <Input
                id="new_password"
                type={showPassword ? "text" : "password"}
                placeholder="Digite sua nova senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {password.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Força da senha:</span>
                    <span className={strengthInfo.color}>{strengthInfo.label}</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getProgressColor()}`}
                      style={{ width: `${passwordStrength}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <ValidationItem valid={hasMinLength} text="Mínimo 8 caracteres" />
                  <ValidationItem valid={hasUpperCase} text="Uma letra maiúscula" />
                  <ValidationItem valid={hasLowerCase} text="Uma letra minúscula" />
                  <ValidationItem valid={hasNumber} text="Um número" />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirmar Nova Senha</Label>
            <div className="relative">
              <Input
                id="confirm_password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirme sua nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <X className="h-4 w-4" />
                As senhas não coincidem
              </p>
            )}
            {passwordsMatch && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <Check className="h-4 w-4" />
                As senhas coincidem
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-emerald-600 text-white shadow-sm shadow-emerald-950/20 hover:bg-emerald-500"
            disabled={saving || !isFormValid}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Alterando...
              </>
            ) : (
              "Alterar Senha"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ChangePasswordSection;
