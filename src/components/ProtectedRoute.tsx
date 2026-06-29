import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile, profileLoading, refetchProfile } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  const [whatsapp, setWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0f0e]">
        <Loader2 className="h-6 w-6 animate-spin text-[#10d98a]" />
        <span className="ml-2 text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  if (!user) {
    const authParams = new URLSearchParams();
    authParams.set("tab", "signup");
    authParams.set("returnTo", `${location.pathname}${location.search}`);

    if (location.pathname === "/checkout") {
      const currentParams = new URLSearchParams(location.search);
      const plano = currentParams.get("plano") || currentParams.get("plan");
      const anual = currentParams.get("anual") || currentParams.get("isAnual");
      const leadsQty = currentParams.get("leadsQty") || currentParams.get("leads");
      const ref = currentParams.get("ref");

      if (plano) authParams.set("plan", plano);
      if (anual) authParams.set("anual", anual);
      if (leadsQty) authParams.set("leadsQty", leadsQty);
      if (ref) authParams.set("ref", ref);
    }

    return <Navigate to={`/auth?${authParams.toString()}`} replace />;
  }

  // Se o perfil já terminou de carregar, mas não possui WhatsApp preenchido,
  // obriga o preenchimento exibindo um formulário centralizado premium
  if (!profileLoading && profile && !profile.whatsapp) {
    const handleSaveWhatsapp = async (e: React.FormEvent) => {
      e.preventDefault();
      
      const cleanPhone = whatsapp.replace(/\D/g, "");
      if (cleanPhone.length < 10) {
        toast({
          variant: "destructive",
          title: "Número inválido",
          description: "Por favor, insira o WhatsApp com DDD (Ex: 11999999999)",
        });
        return;
      }

      setSaving(true);
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ 
            whatsapp: whatsapp,
            updated_at: new Date().toISOString()
          })
          .eq("id", user.id);

        if (error) throw error;

        toast({
          title: "WhatsApp confirmado!",
          description: "Acesso liberado com sucesso.",
        });
        
        await refetchProfile();
      } catch (err: any) {
        toast({
          variant: "destructive",
          title: "Erro ao salvar",
          description: err.message || "Ocorreu um erro ao salvar seu número.",
        });
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0f0e] p-4">
        <Card className="w-full max-w-md border border-[#1f2d29] bg-[#111816] shadow-2xl text-slate-100">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-full bg-[#10d98a]/10 flex items-center justify-center text-[#10d98a]">
                <Phone className="h-6 w-6" />
              </div>
            </div>
            <CardTitle className="text-xl font-bold text-white">Confirme seu WhatsApp</CardTitle>
            <CardDescription className="text-slate-400">
              Para liberar seu acesso e receber o suporte técnico, precisamos do seu número de WhatsApp de contato.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveWhatsapp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="req-whatsapp" className="text-sm font-medium text-slate-300">WhatsApp de Contato</Label>
                <Input
                  id="req-whatsapp"
                  type="text"
                  placeholder="Ex: (11) 99999-9999"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="h-11 rounded-lg border-[#1f2d29] bg-[#0b0f0e]/50 text-white placeholder:text-slate-500 focus-visible:border-[#10d98a]/60 focus-visible:ring-1 focus-visible:ring-[#10d98a]/20 focus-visible:ring-offset-0"
                />
              </div>
              <Button
                type="submit"
                disabled={saving}
                className="w-full h-11 rounded-lg bg-[#10d98a] text-[#0b0f0e] hover:bg-[#0be690] font-bold shadow-md shadow-[#10d98a]/10"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Confirmar e Acessar"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
