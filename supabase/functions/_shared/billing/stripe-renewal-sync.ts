export interface StripePeriodBounds {
  periodStartIso: string;
  periodEndIso: string;
  source: "subscription_root" | "subscription_item" | "invoice_line" | "fallback";
}

export interface ExistingSubscriptionUsageState {
  leads_used_this_month?: number | null;
  ai_used_this_month?: number | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  subscription_status?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  last_payment_succeeded_at?: string | null;
  last_payment_failed_at?: string | null;
  latest_invoice_id?: string | null;
  hosted_invoice_url?: string | null;
}

export interface UsageTransitionResult {
  leadsUsed: number;
  aiUsed: number;
  resetForNewCycle: boolean;
}

export interface IdempotencyClaimResult {
  acquired: boolean;
  duplicate: boolean;
  errorMessage?: string;
}

export interface PaymentEventsInsertClient {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: { code?: string; message?: string } | null }>;
    delete: () => {
      eq: (col: string, val: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => PromiseLike<{ error: { message?: string } | null }>;
        };
      };
    };
  };
}

function asStripeId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") {
    const trimmed = ((value as { id: string }).id || "").trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

export function unixSecondsToIso(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Canonical lock key for a paid Stripe invoice so that `invoice.paid` and
 * `invoice.payment_succeeded` (even arriving concurrently with distinct evt_ IDs)
 * contend on the same UNIQUE (provider, provider_event_id) index in payment_events.
 */
export function buildInvoicePaidIdempotencyKey(invoiceId: string): string {
  const normalized = String(invoiceId || "").trim();
  if (!normalized) {
    throw new Error("invoiceId is required to build idempotency key");
  }
  return `invoice_paid:${normalized}`;
}

/**
 * Atomically acquires an idempotency claim in public.payment_events using
 * the UNIQUE index on (provider, provider_event_id).
 * Under concurrent delivery, PostgreSQL guarantees only one caller receives
 * acquired=true while all others receive code 23505 -> acquired=false, duplicate=true.
 */
export async function tryAcquireStripeIdempotencyClaim(
  supabaseAdmin: PaymentEventsInsertClient,
  params: {
    providerEventId: string;
    eventType: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    amount?: number | null;
    currency?: string | null;
    eventData?: Record<string, unknown>;
  },
): Promise<IdempotencyClaimResult> {
  const { error } = await supabaseAdmin.from("payment_events").insert({
    provider: "stripe",
    provider_event_id: params.providerEventId,
    event_type: params.eventType,
    status: "processing",
    stripe_customer_id: params.stripeCustomerId ?? null,
    stripe_subscription_id: params.stripeSubscriptionId ?? null,
    amount: params.amount ?? null,
    currency: params.currency ?? null,
    event_data: params.eventData ?? {},
  });

  if (!error) {
    return { acquired: true, duplicate: false };
  }

  if (error.code === "23505" || /duplicate key/i.test(error.message || "")) {
    return { acquired: false, duplicate: true };
  }

  return { acquired: false, duplicate: false, errorMessage: error.message || "unknown_claim_error" };
}

/**
 * Releases an in-flight `processing` claim if webhook execution throws before completion,
 * allowing Stripe's automatic retry to process the event cleanly.
 */
export async function releaseStripeIdempotencyClaim(
  supabaseAdmin: PaymentEventsInsertClient,
  providerEventId: string,
): Promise<void> {
  try {
    await supabaseAdmin
      .from("payment_events")
      .delete()
      .eq("provider", "stripe")
      .eq("provider_event_id", providerEventId)
      .eq("status", "processing");
  } catch {
    // Best-effort cleanup; never mask the original webhook error
  }
}

/**
 * Extracts the Stripe Subscription ID from an Invoice object across both
 * classic API versions (invoice.subscription) and Stripe API 2025-03-31.basil+
 * (invoice.parent.subscription_details.subscription / invoice line parent).
 */
export function extractSubscriptionIdFromInvoice(invoice: Record<string, unknown> | null | undefined): string | null {
  if (!invoice || typeof invoice !== "object") return null;

  const direct = asStripeId(invoice.subscription);
  if (direct) return direct;

  const parent = invoice.parent as Record<string, unknown> | undefined;
  const parentSubDetails = parent?.subscription_details as Record<string, unknown> | undefined;
  const fromParent = asStripeId(parentSubDetails?.subscription);
  if (fromParent) return fromParent;

  const lines = (invoice.lines as { data?: Array<Record<string, unknown>> } | undefined)?.data;
  if (Array.isArray(lines)) {
    for (const line of lines) {
      const lineSub = asStripeId(line?.subscription);
      if (lineSub) return lineSub;

      const lineParent = line?.parent as Record<string, unknown> | undefined;
      const itemSubDetails = lineParent?.subscription_item_details as Record<string, unknown> | undefined;
      const fromLineParent = asStripeId(itemSubDetails?.subscription);
      if (fromLineParent) return fromLineParent;
    }
  }

  return null;
}

/**
 * Safely extracts current_period_start and current_period_end ISO strings
 * across classic Stripe API versions and Stripe API 2025-03-31.basil+ (item-level periods).
 * Never throws RangeError on missing or NaN timestamps.
 */
export function extractSubscriptionPeriod(
  subscription: Record<string, unknown> | null | undefined,
  options?: {
    invoice?: Record<string, unknown> | null;
    billingCycle?: string | null;
    now?: Date;
  },
): StripePeriodBounds {
  const now = options?.now ?? new Date();
  const billingCycle = String(options?.billingCycle || "monthly").toLowerCase();

  const rootStart = unixSecondsToIso(subscription?.current_period_start);
  const rootEnd = unixSecondsToIso(subscription?.current_period_end);
  if (rootStart && rootEnd) {
    return { periodStartIso: rootStart, periodEndIso: rootEnd, source: "subscription_root" };
  }

  const items = ((subscription?.items as { data?: Array<Record<string, unknown>> } | undefined)?.data) ?? [];
  for (const item of items) {
    const itemStart = unixSecondsToIso(item?.current_period_start);
    const itemEnd = unixSecondsToIso(item?.current_period_end);
    if (itemStart && itemEnd) {
      return { periodStartIso: itemStart, periodEndIso: itemEnd, source: "subscription_item" };
    }
  }

  const invoiceLines = ((options?.invoice?.lines as { data?: Array<Record<string, unknown>> } | undefined)?.data) ?? [];
  for (const line of invoiceLines) {
    const period = line?.period as Record<string, unknown> | undefined;
    const lineStart = unixSecondsToIso(period?.start);
    const lineEnd = unixSecondsToIso(period?.end);
    if (lineStart && lineEnd && lineEnd > lineStart) {
      return { periodStartIso: lineStart, periodEndIso: lineEnd, source: "invoice_line" };
    }
  }

  const fallbackStart = rootStart ?? now.toISOString();
  const fallbackEndDate = new Date(fallbackStart);
  if (billingCycle === "yearly" || billingCycle === "annual" || billingCycle === "year") {
    fallbackEndDate.setFullYear(fallbackEndDate.getFullYear() + 1);
  } else {
    fallbackEndDate.setMonth(fallbackEndDate.getMonth() + 1);
  }
  return {
    periodStartIso: fallbackStart,
    periodEndIso: rootEnd ?? fallbackEndDate.toISOString(),
    source: "fallback",
  };
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

/**
 * Detects an out-of-order webhook carrying an older billing period start
 * than the one already stored for the same subscription.
 */
export function isPeriodRegression(
  existingSub: ExistingSubscriptionUsageState | null | undefined,
  nextPeriodStartIso: string,
  nextSubscriptionId?: string | null,
): boolean {
  if (!existingSub?.current_period_start) return false;
  const sameSubscription =
    !existingSub.stripe_subscription_id ||
    !nextSubscriptionId ||
    existingSub.stripe_subscription_id === nextSubscriptionId;
  if (!sameSubscription) return false;

  const prevStartMs = Date.parse(existingSub.current_period_start);
  const nextStartMs = Date.parse(nextPeriodStartIso);
  if (!Number.isFinite(prevStartMs) || !Number.isFinite(nextStartMs)) return false;

  return nextStartMs + ONE_MINUTE_MS < prevStartMs;
}

/**
 * Determines monthly usage counters on subscription sync/renewal.
 * Resets usage to 0 only once per paid cycle, when an active subscription
 * advances into a genuinely newer billing period (> 24h after previous
 * current_period_start), guaranteeing idempotency on replays, concurrent
 * invoice/subscription deliveries, and out-of-order webhooks.
 */
export function computeUsageForPeriodTransition(
  existingSub: ExistingSubscriptionUsageState | null | undefined,
  nextPeriodStartIso: string,
  nextStatus: string,
  nextSubscriptionId?: string | null,
): UsageTransitionResult {
  const currentLeads = existingSub?.leads_used_this_month ?? 0;
  const currentAi = existingSub?.ai_used_this_month ?? 0;
  const normalizedStatus = String(nextStatus || "").toLowerCase();

  if (normalizedStatus !== "active") {
    return { leadsUsed: currentLeads, aiUsed: currentAi, resetForNewCycle: false };
  }

  if (isPeriodRegression(existingSub, nextPeriodStartIso, nextSubscriptionId)) {
    return { leadsUsed: currentLeads, aiUsed: currentAi, resetForNewCycle: false };
  }

  const prevStartMs = existingSub?.current_period_start ? Date.parse(existingSub.current_period_start) : NaN;
  const nextStartMs = Date.parse(nextPeriodStartIso);
  const sameSubscription =
    !existingSub?.stripe_subscription_id ||
    !nextSubscriptionId ||
    existingSub.stripe_subscription_id === nextSubscriptionId;

  if (
    sameSubscription &&
    Number.isFinite(prevStartMs) &&
    Number.isFinite(nextStartMs) &&
    nextStartMs - prevStartMs > ONE_DAY_MS
  ) {
    return { leadsUsed: 0, aiUsed: 0, resetForNewCycle: true };
  }

  return { leadsUsed: currentLeads, aiUsed: currentAi, resetForNewCycle: false };
}

const SUBSCRIPTION_STATUS_PRIORITY: Record<string, number> = {
  active: 1,
  trialing: 2,
  past_due: 3,
  incomplete: 4,
  paused: 5,
  unpaid: 6,
  canceled: 7,
  cancelled: 7,
  incomplete_expired: 8,
};

/**
 * Selects the most authoritative Stripe subscription for a customer.
 * Keeps `past_due` subscriptions above canceled ones so temporary billing retries
 * never trigger a destructive downgrade to Free during check-subscription.
 */
export function selectBestStripeSubscription<T extends { status?: string | null; created?: number | null }>(
  subscriptions: T[],
): T | null {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) return null;

  const manageable = subscriptions.filter((sub) => {
    const st = String(sub.status || "").toLowerCase();
    return st === "active" || st === "trialing" || st === "past_due";
  });

  if (manageable.length === 0) return null;

  return [...manageable].sort((a, b) => {
    const pa = SUBSCRIPTION_STATUS_PRIORITY[String(a.status || "").toLowerCase()] ?? 99;
    const pb = SUBSCRIPTION_STATUS_PRIORITY[String(b.status || "").toLowerCase()] ?? 99;
    if (pa !== pb) return pa - pb;
    return (b.created ?? 0) - (a.created ?? 0);
  })[0];
}

export function shouldAutoHealStripeSubscription(
  sub: {
    billing_provider?: string | null;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    subscription_status?: string | null;
    status?: string | null;
    trial_end?: string | null;
    current_period_end?: string | null;
  } | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!sub) return false;
  const provider = sub.billing_provider || (sub.stripe_customer_id || sub.stripe_subscription_id ? "stripe" : null);
  if (provider !== "stripe") return false;

  const normalizedStatus = String(sub.subscription_status ?? sub.status ?? "").toLowerCase();
  const nowMs = now.getTime();

  if (normalizedStatus === "trialing" && sub.trial_end) {
    const trialEndMs = Date.parse(sub.trial_end);
    return Number.isFinite(trialEndMs) && trialEndMs < nowMs;
  }

  if ((normalizedStatus === "active" || normalizedStatus === "past_due") && sub.current_period_end) {
    const periodEndMs = Date.parse(sub.current_period_end);
    return Number.isFinite(periodEndMs) && periodEndMs < nowMs;
  }

  return false;
}
