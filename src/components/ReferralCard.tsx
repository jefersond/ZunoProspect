import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Copy, CheckCircle2, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export function ReferralCard() {
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [indicacoesAtuais, setIndicacoesAtuais] = useState(0);
  const [buscasSaldo, setBuscasSaldo] = useState(0);

  useEffect(() => {
    async function loadReferralData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('referral_code, buscas_saldo')
        .eq('id', user.id)
        .single();
        
      if (data && !error) {
        setReferralCode(data.referral_code);
        setBuscasSaldo(data.buscas_saldo || 0);
      }

      // Count referrals
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by', user.id);
        
      setIndicacoesAtuais(count || 0);
    }
    loadReferralData();
  }, []);
  
  const indicacoesMeta = 5;
  const progressPercent = Math.min((indicacoesAtuais / indicacoesMeta) * 100, 100);
  
  const referralLink = referralCode 
    ? `https://zunoprospect.com.br/auth?ref=${referralCode}` 
    : "Gerando link único...";

  const handleCopyLink = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <Card className="shadow-lg border-emerald-500/20 bg-gradient-to-br from-zinc-950 to-zinc-900 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-32 bg-emerald-500/10 blur-[100px] pointer-events-none rounded-full" />
      
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-emerald-400" />
          <CardTitle className="text-xl text-white">Ganhe Buscas Grátis</CardTitle>
        </div>
        <CardDescription className="text-zinc-400 text-base">
          Indique o Zuno Prospect para um parceiro e ganhe <strong>100 buscas adicionais grátis na mesma hora.</strong>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6 relative z-10">
        {/* Progresso de Indicações */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-zinc-400">
            <span>Progresso da Meta Mensal (Saldo Atual: {buscasSaldo} buscas)</span>
            <span className="font-medium text-emerald-400">{indicacoesAtuais} / {indicacoesMeta} indicações</span>
          </div>
          <Progress value={progressPercent} className="h-2 bg-zinc-800" />
        </div>

        {/* Link de Indicação */}
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-zinc-300 font-mono text-sm w-full truncate">
            {referralLink}
          </div>
          <Button 
            onClick={handleCopyLink}
            className={`w-full sm:w-auto px-6 py-6 transition-all ${
              copied 
                ? "bg-emerald-500 hover:bg-emerald-600 text-white" 
                : "bg-teal-500 hover:bg-teal-600 text-white shadow-[0_0_15px_rgba(20,184,166,0.2)]"
            }`}
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Copiado!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" /> Copiar meu link
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
