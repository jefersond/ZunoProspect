import { useState, useEffect } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { isPaymentRecoveryRequired, ZUNO_SUPPORT_WHATSAPP } from "@/utils/subscriptionHelpers";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/tracking";
import { AlertCircle, ArrowRight, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function PaymentRecoveryBanner() {
  const { subscription } = useSubscription();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isRecoveryNeeded = isPaymentRecoveryRequired(subscription, null);

  useEffect(() => {
    if (isRecoveryNeeded) {
      trackEvent("Payment_Recovery_Banner_Shown", {
        plan_name: subscription?.plan_name,
        subscription_status: subscription?.status || subscription?.subscription_status,
        payment_status: subscription?.payment_status,
      });
    }
  }, [isRecoveryNeeded, subscription?.plan_name]);

  if (!isRecoveryNeeded) return null;

  const handleUpdatePayment = async () => {
    try {
      setLoading(true);
      trackEvent("Payment_Update_Clicked", {
        plan_name: subscription?.plan_name,
        subscription_status: subscription?.status || subscription?.subscription_status,
        hosted_invoice_url_exists: !!subscription?.hosted_invoice_url,
        source: "banner",
      });

      // Prioridade 1: se hosted_invoice_url existe, abrir
      if (subscription?.hosted_invoice_url) {
        window.open(subscription.hosted_invoice_url, "_blank");
        setLoading(false);
        return;
      }

      // Prioridade 2: chamar Edge Function create-customer-portal-session
      const { data, error } = await supabase.functions.invoke("create-customer-portal-session");
      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("URL do portal não encontrada.");
      }
    } catch (err: any) {
      console.error("Erro ao abrir portal do Stripe:", err);
      toast({
        title: "Erro ao abrir o portal",
        description: err.message || "Por favor, tente novamente em alguns instantes ou contate o suporte.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSupportClick = () => {
    trackEvent("Payment_Support_Clicked", {
      plan_name: subscription?.plan_name,
      source: "banner",
    });
    
    const message = encodeURIComponent(
      "Olá! Meu teste da Zuno terminou, mas o pagamento não foi concluído. Preciso de ajuda para regularizar."
    );
    window.open(`https://wa.me/${ZUNO_SUPPORT_WHATSAPP}?text=${message}`, "_blank");
  };

  return (
    <div className="mb-6 rounded-xl border border-amber-900/30 bg-amber-950/10 p-5 text-zinc-200 shadow-md backdrop-blur-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-950/40 text-amber-400">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-400">Pagamento não concluído</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Seu teste da Zuno terminou, mas não conseguimos concluir o pagamento da sua assinatura.
              <br />
              Isso pode acontecer por limite, cartão virtual, bloqueio do banco ou dados do cartão.
              <br />
              Para continuar usando a Zuno, atualize o pagamento ou tente novamente.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 self-end md:self-auto">
          <button
            onClick={handleUpdatePayment}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-[#10d98a] px-4 py-2.5 text-xs font-bold text-[#0b0f0e] transition-all hover:scale-[1.02] hover:bg-[#0dbb76] disabled:opacity-50"
          >
            {loading ? "Carregando..." : "Atualizar pagamento"}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleSupportClick}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2.5 text-xs font-bold text-zinc-300 transition-all hover:bg-zinc-800"
          >
            <Phone className="h-3.5 w-3.5" />
            Falar com suporte
          </button>
        </div>
      </div>
    </div>
  );
}
