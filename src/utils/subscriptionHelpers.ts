import { SubscriptionInfo } from "@/hooks/useSubscription";
import { UsageInfo } from "@/hooks/useUsage";

export interface ProfileInfo {
  id?: string;
  subscription_status?: string | null;
  payment_status?: string | null;
  plan_id?: string | null;
  current_plan?: string | null;
}

export const ZUNO_SUPPORT_WHATSAPP = "553298511685";

export function isPaymentRecoveryRequired(
  subscription: SubscriptionInfo | UsageInfo | null | undefined,
  profile: ProfileInfo | null | undefined
): boolean {
  if (!subscription) return false;

  const status = (subscription.status || subscription.subscription_status || profile?.subscription_status || "").toLowerCase();
  const paymentStatus = (subscription.payment_status || profile?.payment_status || "").toLowerCase();

  // 1. subscription.status = "past_due" ou subscription_status = "past_due"
  if (status === "past_due" || status === "unpaid") {
    return true;
  }

  // 2. payment_status = "failed" ou "requires_payment_method"
  if (paymentStatus === "failed" || paymentStatus === "requires_payment_method") {
    return true;
  }

  // 3. latest_invoice.amount_remaining > 0 ou hosted_invoice_url existe
  if ((subscription as any).amount_remaining > 0 || (subscription as any).hosted_invoice_url) {
    if (paymentStatus === "failed" || paymentStatus === "requires_payment_method" || status === "past_due" || status === "unpaid") {
      return true;
    }
  }

  // 4. trial_end < now() e assinatura não virou active (e não é free/admin)
  const plan = (subscription.plan_name || "").toLowerCase();
  if (plan !== "free" && plan !== "admin") {
    const trialEndStr = (subscription as any).trial_end;
    if (trialEndStr) {
      const trialEnd = new Date(trialEndStr);
      if (trialEnd < new Date() && status !== "active") {
        return true;
      }
    }
  }

  return false;
}

export function canUsePaidFeatures(
  profile: ProfileInfo | null | undefined,
  subscription: SubscriptionInfo | UsageInfo | null | undefined
): boolean {
  // Se isAdmin = true: permitir
  const isAdmin = subscription?.is_admin || subscription?.plan_name === "admin" || profile?.plan_id === "admin";
  if (isAdmin) {
    return true;
  }

  // Se o pagamento estiver vencido/falhado: bloquear
  if (isPaymentRecoveryRequired(subscription, profile)) {
    return false;
  }

  // Se trialing: permitir, desde que trial ainda esteja válido
  const status = (subscription?.status || subscription?.subscription_status || profile?.subscription_status || "").toLowerCase();
  if (status === "trialing") {
    const trialEndStr = (subscription as any)?.trial_end;
    if (trialEndStr) {
      const trialEnd = new Date(trialEndStr);
      if (trialEnd < new Date()) {
        return false;
      }
    }
    return true;
  }

  return true;
}
