import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ADMIN_EMAILS = new Set(["jeferson.zanotell@gmail.com", "jefeson.zanotell@gmail.com"]);

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ADMIN-GET-USERS] ${step}${detailsStr}`);
};

const normalizePlan = (plan?: string | null) => {
  const value = (plan || "free").toLowerCase();
  if (value === "agency") return "agencia";
  return value;
};

const numberOrZero = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const getProvider = (authUser: any) => {
  const providers = authUser.app_metadata?.providers;
  if (Array.isArray(providers) && providers.length > 0) return providers.join(", ");
  const identities = authUser.identities;
  if (Array.isArray(identities) && identities.length > 0) {
    return identities.map((identity) => identity.provider).filter(Boolean).join(", ");
  }
  return authUser.app_metadata?.provider || "email";
};

const normalizeReferralStatus = (referral: any) => {
  const status = String(referral?.status || "").toLowerCase();
  if (status === "rewarded" || status === "rejected" || status === "pending") return status;
  if (status === "approved") return "pending";
  return numberOrZero(referral?.bonus_searches) > 0 && referral?.paid_at ? "rewarded" : "pending";
};

const safeSelect = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  table: string,
  queryBuilder: (table: any) => any,
  fallback: unknown[] = [],
) => {
  const { data, error } = await queryBuilder(supabaseAdmin.from(table));
  if (error) {
    logStep(`Optional table/query unavailable: ${table}`, { error: error.message });
    return fallback;
  }
  return data || fallback;
};

const buildUserSummary = (
  authUser: any,
  profile: any = {},
  subscription: any = {},
  userReferrals: any[] = [],
  receivedReferral: any = null,
  emailById = new Map<string, string>(),
  userAddons: any[] = [],
) => {
  const planName = normalizePlan(subscription.plan_name);
  const leadsLimit = numberOrZero(subscription.leads_limit || (planName === "free" ? 20 : 0));
  const leadsUsed = numberOrZero(subscription.leads_used_this_month);
  const aiLimit = numberOrZero(subscription.ai_limit || (planName === "free" ? 3 : 0));
  const aiUsed = numberOrZero(subscription.ai_used_this_month);
  const referralBonusAvailable = numberOrZero(profile.buscas_saldo);
  const rewardedReferrals = userReferrals.filter((referral) => normalizeReferralStatus(referral) === "rewarded");
  const pendingReferrals = userReferrals.filter((referral) => normalizeReferralStatus(referral) === "pending");
  const rejectedReferrals = userReferrals.filter((referral) => normalizeReferralStatus(referral) === "rejected");
  const hasUsaAddon =
    Boolean(subscription.usa_addon) ||
    userAddons.some((addon) => addon.addon_type === "usa_prospecting" && addon.status === "active");
  const userIsAdmin = ADMIN_EMAILS.has((authUser.email || "").toLowerCase());

  return {
    id: authUser.id,
    email: authUser.email || "",
    phone: authUser.phone || profile.telefone || "",
    nome_completo: profile.nome_completo || authUser.user_metadata?.full_name || authUser.user_metadata?.name || "",
    empresa: profile.empresa || "",
    avatar_url: profile.avatar_url || authUser.user_metadata?.avatar_url || "",
    plan_name: planName,
    plan_status: subscription.status || subscription.subscription_status || "active",
    leads_limit: userIsAdmin ? 999999 : leadsLimit,
    leads_used_this_month: userIsAdmin ? 0 : leadsUsed,
    leads_available_total: userIsAdmin ? 999999 : Math.max(leadsLimit - leadsUsed, 0) + referralBonusAvailable,
    ai_limit: userIsAdmin ? 999999 : aiLimit,
    ai_used_this_month: userIsAdmin ? 0 : aiUsed,
    ai_available: userIsAdmin ? 999999 : Math.max(aiLimit - aiUsed, 0),
    referral_code: profile.referral_code || "",
    referred_by: profile.referred_by || receivedReferral?.referrer_user_id || null,
    referred_by_email: profile.referred_by
      ? emailById.get(profile.referred_by) || ""
      : receivedReferral?.referrer_user_id
        ? emailById.get(receivedReferral.referrer_user_id) || ""
        : "",
    referral_count: rewardedReferrals.length,
    referral_pending_count: pendingReferrals.length,
    referral_rewarded_count: rewardedReferrals.length,
    referral_rejected_count: rejectedReferrals.length,
    referral_bonus_available: userIsAdmin ? 999999 : referralBonusAvailable,
    referral_bonus_earned: rewardedReferrals.reduce((sum, referral) => sum + numberOrZero(referral.bonus_searches), 0),
    email_confirmed: Boolean(authUser.email_confirmed_at || authUser.confirmed_at),
    auth_provider: getProvider(authUser),
    is_admin: userIsAdmin,
    is_annual: Boolean(subscription.is_annual),
    usa_addon: hasUsaAddon,
    stripe_customer_id: subscription.stripe_customer_id || subscription.customer_id || null,
    stripe_subscription_id: subscription.stripe_subscription_id || subscription.subscription_id || null,
    billing_period_start: subscription.billing_period_start || null,
    billing_period_end: subscription.billing_period_end || null,
    created_at: authUser.created_at,
    last_sign_in_at: authUser.last_sign_in_at,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting admin-get-users function");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      logStep("Missing required env vars", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRole: Boolean(supabaseServiceKey),
      });
      return jsonResponse(
        {
          error: "Configuração incompleta da Edge Function.",
          details: "Verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas secrets do Supabase.",
        },
        500,
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Não autorizado", details: "Header Authorization ausente." }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      logStep("User verification failed", { error: userError?.message });
      return jsonResponse({ error: "Usuário não encontrado", details: userError?.message }, 401);
    }

    const normalizedEmail = user.email?.trim().toLowerCase() || "";
    const { data: rpcIsAdmin, error: adminError } = await supabaseAdmin.rpc("is_admin", { _user_id: user.id });
    const isAdmin = Boolean(rpcIsAdmin || ADMIN_EMAILS.has(normalizedEmail));

    if (adminError) {
      logStep("Admin RPC failed, using email fallback", { error: adminError.message, email: normalizedEmail });
    }

    if (!isAdmin) {
      logStep("User is not admin", { userId: user.id, email: normalizedEmail });
      return jsonResponse({ error: "Acesso negado", details: "Usuário não é administrador." }, 403);
    }

    const url = new URL(req.url);
    let body: Record<string, unknown> = {};
    if (req.method !== "GET") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }
    const query = String(body.q || url.searchParams.get("q") || "").trim().toLowerCase();
    const planFilter = String(body.plan || url.searchParams.get("plan") || "all").trim().toLowerCase();
    const action = String(body.action || url.searchParams.get("action") || "list");
    const detailUserId = String(body.userId || url.searchParams.get("userId") || "");

    logStep("Admin verified, fetching auth users");

    const authUsers: any[] = [];
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) {
        logStep("Error fetching auth users", { error: error.message });
        return jsonResponse({ error: "Erro ao listar usuários do Auth.", details: error.message }, 500);
      }

      authUsers.push(...(data.users || []));
      if (!data.users || data.users.length < 1000) break;
    }

    const [{ data: profiles, error: profilesError }, { data: subscriptions, error: subsError }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*"),
      supabaseAdmin.from("user_subscriptions").select("*"),
    ]);

    if (profilesError) {
      return jsonResponse({ error: "Erro ao carregar perfis.", details: profilesError.message }, 500);
    }

    if (subsError) {
      return jsonResponse({ error: "Erro ao carregar planos/uso.", details: subsError.message }, 500);
    }

    const { data: referrals, error: referralsError } = await supabaseAdmin.from("referrals").select("*");
    if (referralsError) {
      logStep("Referrals table unavailable", { error: referralsError.message });
    }

    const { data: addons, error: addonsError } = await supabaseAdmin.from("user_addons").select("*");
    if (addonsError) {
      logStep("User addons table unavailable", { error: addonsError.message });
    }

    const profilesMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
    const subscriptionsMap = new Map((subscriptions || []).map((subscription: any) => [subscription.user_id, subscription]));
    const addonsByUser = new Map<string, any[]>();
    for (const addon of addons || []) {
      const list = addonsByUser.get(addon.user_id) || [];
      list.push(addon);
      addonsByUser.set(addon.user_id, list);
    }

    const referralsMade = new Map<string, any[]>();
    const referralsReceived = new Map<string, any>();
    for (const referral of referrals || []) {
      const made = referralsMade.get(referral.referrer_user_id) || [];
      made.push(referral);
      referralsMade.set(referral.referrer_user_id, made);
      referralsReceived.set(referral.referred_user_id, referral);
    }

    const emailById = new Map(authUsers.map((authUser) => [authUser.id, authUser.email || ""]));

    if (action === "detail") {
      if (!detailUserId) {
        return jsonResponse({ error: "Usuario nao informado.", details: "Envie userId para carregar detalhes." }, 400);
      }

      const authUser = authUsers.find((candidate) => candidate.id === detailUserId);
      if (!authUser) {
        return jsonResponse({ error: "Usuario nao encontrado.", details: detailUserId }, 404);
      }

      const profile: any = profilesMap.get(detailUserId) || {};
      const subscription: any = subscriptionsMap.get(detailUserId) || {};
      const userReferrals = referralsMade.get(detailUserId) || [];
      const receivedReferral = referralsReceived.get(detailUserId);
      const userAddons = addonsByUser.get(detailUserId) || [];
      const summary = buildUserSummary(
        authUser,
        profile,
        subscription,
        userReferrals,
        receivedReferral,
        emailById,
        userAddons,
      );

      const leads = await safeSelect(
        supabaseAdmin,
        "leads",
        (table) =>
          table
            .select(
              "id,nome,cidade,nicho,foco,status,salvo,rating,total_reviews,created_at,updated_at,ai_analise_gerada_em,search_run_id,website,instagram_url,whatsapp_number,telefone",
            )
            .eq("user_id", detailUserId)
            .order("created_at", { ascending: false })
            .limit(50),
      );

      const interactions = await safeSelect(
        supabaseAdmin,
        "interacoes",
        (table) =>
          table
            .select("id,tipo,conteudo,data_interacao,lead_id,created_at")
            .eq("user_id", detailUserId)
            .order("data_interacao", { ascending: false })
            .limit(50),
      );

      const emailLogs = await safeSelect(
        supabaseAdmin,
        "email_logs",
        (table) =>
          table
            .select("id,campaign_id,email_type,subject,status,sent_at,opened_at,clicked_at,created_at")
            .or(`user_id.eq.${detailUserId},recipient_email.eq.${summary.email}`)
            .order("created_at", { ascending: false })
            .limit(25),
      );

      const emailEvents = await safeSelect(
        supabaseAdmin,
        "email_events",
        (table) =>
          table
            .select("id,event_type,email_type,campaign_id,metadata,created_at")
            .or(`user_id.eq.${detailUserId},email.eq.${summary.email}`)
            .order("created_at", { ascending: false })
            .limit(25),
      );

      const userEvents = await safeSelect(
        supabaseAdmin,
        "app_events",
        (table) =>
          table
            .select("id,event_type,event_data,ip_address,user_agent,created_at")
            .eq("user_id", detailUserId)
            .order("created_at", { ascending: false })
            .limit(50),
      );

      const searchLogs = await safeSelect(
        supabaseAdmin,
        "search_logs",
        (table) =>
          table
            .select("*")
            .eq("user_id", detailUserId)
            .order("created_at", { ascending: false })
            .limit(50),
      );

      const paymentEvents = await safeSelect(
        supabaseAdmin,
        "payment_events",
        (table) =>
          table
            .select("*")
            .eq("user_id", detailUserId)
            .order("created_at", { ascending: false })
            .limit(50),
      );

      const outboundReferrals = userReferrals.map((referral) => ({
        ...referral,
        status: normalizeReferralStatus(referral),
        referred_email: emailById.get(referral.referred_user_id) || "",
      }));

      const inboundReferral = receivedReferral
        ? {
            ...receivedReferral,
            referrer_email: emailById.get(receivedReferral.referrer_user_id) || "",
          }
        : null;

      const leadRows = leads as any[];
      const aiAnalyses = leadRows
        .filter((lead) => Boolean(lead.ai_analise_gerada_em))
        .map((lead) => ({
          lead_id: lead.id,
          lead_name: lead.nome,
          city: lead.cidade,
          niche: lead.nicho,
          model: "Gemini Flash",
          status: "completed",
          created_at: lead.ai_analise_gerada_em,
        }));

      return jsonResponse({
        user: summary,
        detail: {
          auth: {
            id: authUser.id,
            email: authUser.email,
            phone: authUser.phone,
            provider: summary.auth_provider,
            email_confirmed_at: authUser.email_confirmed_at || authUser.confirmed_at || null,
            created_at: authUser.created_at,
            last_sign_in_at: authUser.last_sign_in_at,
            app_metadata: authUser.app_metadata,
            user_metadata: authUser.user_metadata,
          },
          profile,
          subscription,
          addons: userAddons,
          usage: {
            leads_found: leadRows.length,
            leads_saved: leadRows.filter((lead) => Boolean(lead.salvo)).length,
            ai_analyses: aiAnalyses.length,
            interactions: (interactions as any[]).length,
          },
          leads: leadRows,
          interactions,
          referrals: {
            inbound: inboundReferral,
            outbound: outboundReferrals,
          },
          aiAnalyses,
          email: {
            logs: emailLogs,
            events: emailEvents,
          },
          activity: {
            events: userEvents,
            searchLogs,
            paymentEvents,
          },
        },
      });
    }

    const combinedUsers = authUsers.map((authUser) => {
      const profile: any = profilesMap.get(authUser.id) || {};
      const subscription: any = subscriptionsMap.get(authUser.id) || {};
      const userReferrals = referralsMade.get(authUser.id) || [];
      const receivedReferral = referralsReceived.get(authUser.id);
      const userAddons = addonsByUser.get(authUser.id) || [];
      return buildUserSummary(authUser, profile, subscription, userReferrals, receivedReferral, emailById, userAddons);
    });

    const filteredUsers = combinedUsers
      .filter((adminUser) => {
        if (!query) return true;
        return [
          adminUser.email,
          adminUser.nome_completo,
          adminUser.empresa,
          adminUser.referral_code,
          adminUser.referred_by_email,
        ].some((field) => String(field || "").toLowerCase().includes(query));
      })
      .filter((adminUser) => {
        if (planFilter === "all") return true;
        if (planFilter === "admin") return adminUser.is_admin;
        if (planFilter === "referred") return Boolean(adminUser.referred_by);
        if (planFilter === "bonus") return adminUser.referral_bonus_available > 0;
        if (planFilter === "inactive") return !adminUser.last_sign_in_at;
        if (planFilter === "paying") return ["starter", "iniciante", "pro", "agency", "agencia"].includes(adminUser.plan_name);
        return adminUser.plan_name === planFilter;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const stats = {
      total: combinedUsers.length,
      filtered: filteredUsers.length,
      byPlan: {
        free: combinedUsers.filter((adminUser) => adminUser.plan_name === "free").length,
        starter: combinedUsers.filter((adminUser) => adminUser.plan_name === "starter").length,
        iniciante: combinedUsers.filter((adminUser) => adminUser.plan_name === "iniciante").length,
        pro: combinedUsers.filter((adminUser) => adminUser.plan_name === "pro").length,
        agencia: combinedUsers.filter((adminUser) => adminUser.plan_name === "agencia").length,
      },
      annual: combinedUsers.filter((adminUser) => adminUser.is_annual).length,
      withUsaAddon: combinedUsers.filter((adminUser) => adminUser.usa_addon).length,
      admins: combinedUsers.filter((adminUser) => adminUser.is_admin).length,
      confirmed: combinedUsers.filter((adminUser) => adminUser.email_confirmed).length,
      referredUsers: combinedUsers.filter((adminUser) => Boolean(adminUser.referred_by)).length,
      usersWithReferralBonus: combinedUsers.filter((adminUser) => adminUser.referral_bonus_available > 0).length,
      totalReferrals: combinedUsers.reduce((sum, adminUser) => sum + adminUser.referral_count, 0),
      pendingReferrals: combinedUsers.reduce((sum, adminUser) => sum + (adminUser.referral_pending_count || 0), 0),
      rewardedReferrals: combinedUsers.reduce((sum, adminUser) => sum + (adminUser.referral_rewarded_count || 0), 0),
      rejectedReferrals: combinedUsers.reduce((sum, adminUser) => sum + (adminUser.referral_rejected_count || 0), 0),
      totalLeadsUsed: combinedUsers.reduce((sum, adminUser) => sum + adminUser.leads_used_this_month, 0),
      totalAiUsed: combinedUsers.reduce((sum, adminUser) => sum + adminUser.ai_used_this_month, 0),
    };

    logStep("Users combined successfully", { total: combinedUsers.length, filtered: filteredUsers.length });

    return jsonResponse({
      users: filteredUsers,
      stats,
      meta: {
        function: "admin-get-users",
        project: "ihtltqxxlvbsxbiacbpr",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logStep("Error in admin-get-users", { error: error?.message || String(error) });
    return jsonResponse(
      {
        error: "Erro inesperado na Edge Function admin-get-users.",
        details: error?.message || String(error),
      },
      500,
    );
  }
});
