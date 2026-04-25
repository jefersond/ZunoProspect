import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle2, Gift, Users, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
        .from("profiles")
        .select("referral_code, buscas_saldo")
        .eq("id", user.id)
        .single();

      if (data && !error) {
        setReferralCode(data.referral_code);
        setBuscasSaldo(data.buscas_saldo || 0);
      }

      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("referred_by", user.id);

      setIndicacoesAtuais(count || 0);
    }
    loadReferralData();
  }, []);

  const referralLink = referralCode
    ? `https://zunopropect.com.br/auth?ref=${referralCode}`
    : "Gerando seu link...";

  const handleCopyLink = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="relative rounded-2xl overflow-hidden">
      {/* Borda gradiente */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500/40 via-purple-500/30 to-teal-500/40 p-[1px]">
        <div className="h-full w-full rounded-2xl bg-zinc-950/90" />
      </div>

      {/* Brilhos de fundo */}
      <div className="absolute top-0 left-1/4 w-64 h-64 bg-indigo-600/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-purple-600/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative z-10 p-6 md:p-8">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">

          {/* Ícone decorativo */}
          <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Gift className="w-7 h-7 text-indigo-400" />
          </div>

          {/* Texto principal */}
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-white">🎁 Indique e Ganhe</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
                <Sparkles className="w-3 h-3" /> Novo
              </span>
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-xl">
              Indique o Zuno Prospect para um parceiro e ganhe{" "}
              <span className="text-indigo-300 font-semibold">100 buscas adicionais grátis</span>{" "}
              na mesma hora.
            </p>

            {/* Estatísticas rápidas */}
            <div className="flex items-center gap-4 pt-1">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-zinc-300 font-medium">{indicacoesAtuais}</span>
                <span>indicações feitas</span>
              </div>
              <div className="w-px h-3 bg-white/10" />
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-zinc-300 font-medium">{buscasSaldo}</span>
                <span>buscas disponíveis</span>
              </div>
            </div>
          </div>

          {/* Área do link + botão */}
          <div className="w-full lg:w-auto flex flex-col sm:flex-row lg:flex-col gap-2 flex-shrink-0 lg:min-w-[280px]">
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-zinc-400 font-mono text-xs truncate">
              {referralLink}
            </div>
            <Button
              onClick={handleCopyLink}
              disabled={!referralCode}
              className={`w-full sm:w-auto lg:w-full gap-2 font-semibold py-5 rounded-xl transition-all duration-300 ${
                copied
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.35)]"
                  : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-[0_0_25px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:scale-[1.02]"
              }`}
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Link Copiado! ✅
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar Link de Indicação
                </>
              )}
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
