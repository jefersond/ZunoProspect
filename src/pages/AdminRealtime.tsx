import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Clock, CreditCard, Filter, MousePointerClick, Search, ShoppingCart, UserPlus, Users, XCircle, Brain, Terminal, AlertTriangle, ChevronRight, ChevronDown, CheckCircle2, Target, ArrowUpRight, ArrowDownRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/config/admin";
import { AppHeader } from "@/components/AppHeader";
import { normalizeCreativeName, CREATIVE_NAME_MAP } from "@/lib/creativeMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type AppEvent = {
  id: string;
  user_id: string | null;
  email: string | null;
  user_email?: string | null;
  anonymous_id: string | null;
  session_id: string | null;
  event_type: string;
  event_name: string | null;
  page_url: string | null;
  path: string | null;
  pathname: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  ref: string | null;
  offer: string | null;
  first_touch: Record<string, unknown> | null;
  last_touch: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  event_data: Record<string, unknown> | null;
  is_internal_event: boolean | null;
  event_source_type: string | null;
  created_at: string;
};

type AdminUserSummary = {
  id: string;
  email: string;
  plan_name: string;
  leads_limit: number;
  leads_used_this_month: number;
  ai_limit: number;
  ai_used_this_month: number;
};

type SegmentKey =
  | "all"
  | "searched_no_ai"
  | "ai_limit_reached_no_upgrade"
  | "ai_used_no_checkout"
  | "checkout_abandoned"
  | "hot_free_users"
  | "first_ai_cta_seen_no_click";

const rangeHours = {
  "1h": 1,
  "24h": 24,
  "7d": 24 * 7,
};

const funnelSteps = [
  { key: "page_view", label: "PageView" },
  { key: "cta_clicked", label: "CTA Click" },
  { key: "signup_completed", label: "Cadastro" },
  { key: "first_search_completed", label: "Primeira busca" },
  { key: "upgrade_clicked", label: "Upgrade click" },
  { key: "checkout_started", label: "Checkout iniciado" },
  { key: "purchase_completed", label: "Compra" },
];

function eventKey(event: AppEvent) {
  return event.event_name || event.event_type;
}

function normalizeAppEvent(event: AppEvent): AppEvent {
  return {
    ...event,
    is_internal_event: event.is_internal_event ?? false,
    event_source_type: event.event_source_type || "unknown",
  };
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function eventDetails(event: AppEvent) {
  const data = event.metadata || event.event_data || {};
  const parts = [
    data.cta ? `cta: ${data.cta}` : null,
    data.plan_id ? `plano: ${data.plan_id}` : null,
    data.city ? `cidade: ${data.city}` : null,
    data.niche ? `nicho: ${data.niche}` : null,
    data.returned_quantity !== undefined ? `retorno: ${data.returned_quantity}` : null,
    data.leads_count !== undefined ? `leads: ${data.leads_count}` : null,
    data.error || data.error_message ? `erro: ${data.error || data.error_message}` : null,
  ].filter(Boolean);
  return parts.join(" | ") || event.event_name || event.event_type || "-";
}

function identity(event: AppEvent) {
  return event.email || event.user_email || event.anonymous_id || event.user_id || "anonimo";
}

function metadata(event: AppEvent) {
  return event.metadata || event.event_data || {};
}

function hasEvent(list: AppEvent[], names: string[]) {
  return list.some((event) => names.includes(eventKey(event)));
}

function eventCount(list: AppEvent[], names: string[]) {
  return list.filter((event) => names.includes(eventKey(event))).length;
}

function sourceBadge(event: AppEvent) {
  if (event.is_internal_event) return "interno/teste";
  if (event.event_source_type && event.event_source_type !== "unknown") return event.event_source_type;
  if (!event.utm_source && !event.utm_campaign && !event.utm_content) return "sem UTM";
  return "real";
}

interface AiFailureClassification {
  type: "api_error" | "timeout" | "no_balance" | "duplicate_event" | "multiple_clicks" | "recovered" | "unknown";
  label: string;
  severity: "low" | "medium" | "high";
  explanation: string;
}

function classifyAiFailure(event: any, eventsForSameLead: any[]): AiFailureClassification {
  const meta = event.metadata || event.event_data || {};
  const errMsg = (meta.error_message || meta.error || "").toLowerCase();
  const errCode = String(meta.error_code || meta.code || "").toLowerCase();
  
  const eventTime = new Date(event.created_at).getTime();
  const leadId = meta.lead_id || meta.leadId;
  
  // 1. Detectar se houve sucesso em até 2 minutos após esta falha para o mesmo lead
  const successEvent = eventsForSameLead.find(e => {
    const isSuccess = ["AI_Analysis_Completed", "First_AI_Analysis_Completed", "ai_analysis_completed"].includes(eventKey(e));
    const sameLead = (metadata(e).lead_id || metadata(e).leadId) === leadId && leadId;
    if (!isSuccess || !sameLead) return false;
    
    const diffSeconds = (new Date(e.created_at).getTime() - eventTime) / 1000;
    return diffSeconds > 0 && diffSeconds <= 120;
  });
  
  if (successEvent) {
    const diffSecs = Math.round((new Date(successEvent.created_at).getTime() - eventTime) / 1000);
    return {
      type: "recovered",
      label: "Falha recuperada",
      severity: "low",
      explanation: `Sucesso ${diffSecs}s pós falha.`
    };
  }

  // 2. Detectar se houve sucesso depois de 2 minutos para o mesmo lead
  const successLateEvent = eventsForSameLead.find(e => {
    const isSuccess = ["AI_Analysis_Completed", "First_AI_Analysis_Completed", "ai_analysis_completed"].includes(eventKey(e));
    const sameLead = (metadata(e).lead_id || metadata(e).leadId) === leadId && leadId;
    if (!isSuccess || !sameLead) return false;
    
    const diffSeconds = (new Date(e.created_at).getTime() - eventTime) / 1000;
    return diffSeconds > 120;
  });
  
  if (successLateEvent) {
    return {
      type: "recovered",
      label: "Sucesso posterior",
      severity: "low",
      explanation: "Sucesso posterior (> 2 min)."
    };
  }

  // 3. Detectar se houve evento idêntico de erro em menos de 5 segundos (duplicidade)
  const duplicateEvent = eventsForSameLead.find(e => {
    if (e.id === event.id) return false;
    const isFailed = ["AI_Analysis_Failed", "ai_analysis_failed"].includes(eventKey(e));
    const sameLead = (metadata(e).lead_id || metadata(e).leadId) === leadId && leadId;
    if (!isFailed || !sameLead) return false;
    
    const sameMsg = (metadata(e).error_message || metadata(e).error || "") === (meta.error_message || meta.error || "");
    const diffSeconds = Math.abs((new Date(e.created_at).getTime() - eventTime) / 1000);
    return sameMsg && diffSeconds <= 5;
  });
  
  if (duplicateEvent) {
    return {
      type: "duplicate_event",
      label: "Possível duplicação",
      severity: "low",
      explanation: "Falha duplicada detectada em menos de 5 segundos."
    };
  }

  // 4. Detectar múltiplos cliques concorrentes em menos de 5 segundos
  const multipleClicks = eventsForSameLead.find(e => {
    if (e.id === event.id) return false;
    const isFailed = ["AI_Analysis_Failed", "ai_analysis_failed"].includes(eventKey(e));
    const sameLead = (metadata(e).lead_id || metadata(e).leadId) === leadId && leadId;
    if (!isFailed || !sameLead) return false;
    
    const diffSeconds = Math.abs((new Date(e.created_at).getTime() - eventTime) / 1000);
    return diffSeconds <= 5;
  });
  
  if (multipleClicks) {
    return {
      type: "multiple_clicks",
      label: "Múltiplos cliques",
      severity: "medium",
      explanation: "Tentativas concorrentes enviadas em poucos segundos."
    };
  }

  // 5. Detectar sem saldo
  const isNoBalance = errMsg.includes("limite") || errMsg.includes("saldo") || errMsg.includes("crédito") || 
                      errCode.includes("limit") || errCode === "402" || meta.ai_available_before === 0;
  if (isNoBalance) {
    return {
      type: "no_balance",
      label: "Sem saldo de IA",
      severity: "medium",
      explanation: "Usuário não possui saldo de créditos ou bateu o limite grátis."
    };
  }

  // 6. Detectar timeouts
  const isTimeout = errMsg.includes("timeout") || errMsg.includes("aborted") || errMsg.includes("deadline") || 
                    errMsg.includes("gateway") || errMsg.includes("demorou") || errCode.includes("timeout");
  if (isTimeout) {
    return {
      type: "timeout",
      label: "Timeout de API",
      severity: "high",
      explanation: "A Edge Function ou provedor estouraram o tempo limite de resposta."
    };
  }

  // 7. Erros de rede ou API Gemini
  const isApiError = errMsg.includes("api") || errMsg.includes("gemini") || errMsg.includes("model") || 
                     errMsg.includes("fetch") || errMsg.includes("network") || errCode !== "";
  if (isApiError) {
    return {
      type: "api_error",
      label: "Falha real de API",
      severity: "high",
      explanation: "O provedor Gemini ou o backend retornaram erro técnico na execução."
    };
  }

  return {
    type: "unknown",
    label: "Erro desconhecido",
    severity: "medium",
    explanation: meta.error_message || meta.error || "Código do erro não categorizado no helper."
  };
}

function percent(part: number, total: number) {
  return total ? `${Math.round((part / total) * 100)}%` : "0%";
}

export default function AdminRealtime() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [range, setRange] = useState<keyof typeof rangeHours>("24h");
  const [eventType, setEventType] = useState("all");
  const [segment, setSegment] = useState<SegmentKey>("all");
  const [abandonmentHours, setAbandonmentHours] = useState("2");
  const [searchTerm, setSearchTerm] = useState("");
  const [utmSource, setUtmSource] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmContent, setUtmContent] = useState("");
  const [internalFilter, setInternalFilter] = useState("exclude");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [journeyViewMode, setJourneyViewMode] = useState<"compact" | "failures" | "raw">("compact");

  const sinceIso = useMemo(() => {
    const date = new Date();
    date.setHours(date.getHours() - rangeHours[range]);
    return date.toISOString();
  }, [range]);

  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const usersByEmail = useMemo(() => new Map(users.map((user) => [user.email?.toLowerCase(), user])), [users]);

  useEffect(() => {
    const verifyAdmin = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth?tab=login");
        return;
      }

      const { data: adminCheck } = await supabase.rpc("is_admin", { _user_id: user.id });
      if (!adminCheck && !isAdminEmail(user.email)) {
        toast({
          variant: "destructive",
          title: "Acesso restrito",
          description: "Esta pagina e exclusiva para administradores.",
        });
        navigate("/prospeccao");
        return;
      }

      setIsAdmin(true);
    };

    verifyAdmin();
  }, [navigate, toast]);

  useEffect(() => {
    if (!isAdmin) return;

    const loadUsers = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke("admin-get-users", {
        body: { action: "list" },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });

      if (error) {
        console.warn("Erro ao carregar usuarios para segmentos:", error.message);
        return;
      }

      setUsers((data?.users || []) as AdminUserSummary[]);
    };

    loadUsers();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const loadEvents = async () => {
      setLoading(true);
      let query = (supabase as any)
        .from("app_events")
        .select("*")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (internalFilter === "exclude") query = query.or("is_internal_event.eq.false,is_internal_event.is.null");
      if (internalFilter === "only") query = query.eq("is_internal_event", true);
      if (eventType !== "all") query = query.eq("event_name", eventType);
      if (utmSource.trim()) query = query.ilike("utm_source", `%${utmSource.trim()}%`);
      if (utmCampaign.trim()) query = query.ilike("utm_campaign", `%${utmCampaign.trim()}%`);
      if (utmContent.trim()) {
        const searchVal = utmContent.trim();
        const matchingRawIds = Object.entries(CREATIVE_NAME_MAP)
          .filter(([raw, friendly]) => friendly.toLowerCase().includes(searchVal.toLowerCase()))
          .map(([raw]) => raw);
        
        if (matchingRawIds.length > 0) {
          const conditions = [`utm_content.ilike.%${searchVal}%`];
          matchingRawIds.forEach(id => {
            conditions.push(`utm_content.eq.${id}`);
          });
          query = query.or(conditions.join(','));
        } else {
          query = query.ilike("utm_content", `%${searchVal}%`);
        }
      }

      const { data, error } = await query;
      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao carregar eventos",
          description: error.message,
        });
      } else {
        setEvents(((data || []) as AppEvent[]).map(normalizeAppEvent));
      }
      setLoading(false);
    };

    loadEvents();

    const channel = supabase
      .channel("admin-app-events")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "app_events" }, (payload) => {
        const event = normalizeAppEvent(payload.new as AppEvent);
        if (new Date(event.created_at).toISOString() < sinceIso) return;
        if (internalFilter === "exclude" && event.is_internal_event === true) return;
        if (internalFilter === "only" && event.is_internal_event !== true) return;
        setEvents((current) => [event, ...current].slice(0, 1000));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventType, isAdmin, sinceIso, toast, utmCampaign, utmContent, utmSource, internalFilter]);

  const filteredEvents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return events;
    const matchedUserIds = users
      .filter((user) => user.email?.toLowerCase().includes(term))
      .map((user) => user.id);
    return events.filter((event) => {
      return [
        event.email,
        event.user_email,
        event.anonymous_id,
        event.session_id,
        event.user_id,
        eventKey(event),
        event.pathname,
        event.utm_source,
        event.utm_campaign,
        event.utm_content,
        normalizeCreativeName(event.utm_content),
        JSON.stringify(event.metadata || event.event_data || {}),
      ].concat(matchedUserIds.includes(event.user_id || "") ? [event.user_id] : [])
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [events, searchTerm, users]);

  const metrics = useMemo(() => {
    const uniqueVisitors = new Set(filteredEvents.map((event) => event.anonymous_id || event.user_id).filter(Boolean));
    const count = (type: string) => filteredEvents.filter((event) => eventKey(event) === type).length;
    const pageViews = count("page_view");
    const signups = count("signup_completed");
    const firstSearches = count("first_search_completed");

    return {
      visitors: uniqueVisitors.size,
      signups,
      firstSearches,
      checkouts: count("checkout_started"),
      purchases: count("purchase_completed"),
      pageToSignup: pageViews ? Math.round((signups / pageViews) * 100) : 0,
      signupToSearch: signups ? Math.round((firstSearches / signups) * 100) : 0,
    };
  }, [filteredEvents]);

  const funnel = useMemo(() => {
    return funnelSteps.map((step, index) => {
      const count = filteredEvents.filter((event) => eventKey(event) === step.key).length;
      const previous = index > 0 ? filteredEvents.filter((event) => eventKey(event) === funnelSteps[index - 1].key).length : count;
      return {
        ...step,
        count,
        conversion: index === 0 || previous === 0 ? 100 : Math.round((count / previous) * 100),
      };
    });
  }, [filteredEvents]);

  const eventTypes = useMemo(() => {
    return Array.from(new Set(events.map(eventKey))).sort();
  }, [events]);

  const creativeSummary = useMemo(() => {
    const grouped = new Map<string, { events: AppEvent[], originals: Set<string> }>();

    filteredEvents.forEach((event) => {
      const rawCreative = event.utm_content || "sem_utm_content";
      const creative = normalizeCreativeName(rawCreative);
      const group = grouped.get(creative) || { events: [], originals: new Set() };
      group.events.push(event);
      if (rawCreative !== "sem_utm_content" && rawCreative !== creative) {
        group.originals.add(rawCreative);
      } else if (rawCreative !== "sem_utm_content" && rawCreative === creative) {
        // also add if it matches exactly, just so we know what was stored
        group.originals.add(rawCreative);
      }
      grouped.set(creative, group);
    });

    return Array.from(grouped.entries())
      .map(([creative, { events: list, originals }]) => {
        const count = (name: string) => list.filter((event) => eventKey(event) === name).length;
        const pageViews = count("page_view");
        const ctaClicks = count("cta_clicked");
        const signups = count("signup_completed");
        const firstSearches = count("first_search_completed");

        return {
          creative,
          pageViews,
          ctaClicks,
          pageToCta: percent(ctaClicks, pageViews),
          signups,
          ctaToSignup: percent(signups, ctaClicks),
          firstSearches,
          signupToSearch: percent(firstSearches, signups),
          upgradeClicks: count("upgrade_clicked"),
          checkouts: count("checkout_started"),
          purchases: count("purchase_completed"),
          originals: Array.from(originals).join(", ") || "-",
        };
      })
      .sort((a, b) => b.pageViews - a.pageViews);
  }, [filteredEvents]);

  const segmentRows = useMemo(() => {
    const grouped = new Map<string, AppEvent[]>();
    const resolveKey = (event: AppEvent) => event.user_id || event.email || event.user_email || event.anonymous_id || event.session_id || event.id;

    filteredEvents.forEach((event) => {
      const key = resolveKey(event);
      grouped.set(key, [...(grouped.get(key) || []), event]);
    });

    const cutoff = Date.now() - Number(abandonmentHours || 2) * 60 * 60 * 1000;

    return Array.from(grouped.entries())
      .map(([key, list]) => {
        const sorted = [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const last = sorted[sorted.length - 1];
        const user = (last.user_id && usersById.get(last.user_id)) || usersByEmail.get((last.email || last.user_email || "").toLowerCase());
        const plan = String(user?.plan_name || metadata(last).user_plan || "unknown").toLowerCase();
        const leadsUsed = Number(user?.leads_used_this_month ?? metadata(last).leads_used ?? 0);
        const leadsLimit = Number(user?.leads_limit ?? metadata(last).leads_limit ?? 0);
        const aiUsed = Number(user?.ai_used_this_month ?? metadata(last).ai_used ?? 0);
        const aiLimit = Number(user?.ai_limit ?? metadata(last).ai_limit ?? 0);
        const checkoutStarted = sorted.filter((event) => ["checkout_started", "InitiateCheckout"].includes(eventKey(event)));
        const purchaseDone = hasEvent(sorted, ["purchase_completed", "Purchase"]);
        const hasSearchCompleted = hasEvent(sorted, ["search_completed", "first_search_completed"]);
        const hasAiCompleted = hasEvent(sorted, ["ai_analysis_completed", "First_AI_Analysis_Completed", "first_ai_analysis_completed"]);
        const hasUpgrade = hasEvent(sorted, ["upgrade_clicked", "Upgrade_Click_Before_AI", "Upgrade_Click_After_AI"]);
        const lastCheckout = checkoutStarted[checkoutStarted.length - 1];
        const matchesSegment =
          segment === "all" ||
          (segment === "searched_no_ai" && hasSearchCompleted && !hasAiCompleted) ||
          (segment === "ai_limit_reached_no_upgrade" && plan === "free" && aiUsed >= 3 && !purchaseDone) ||
          (segment === "ai_used_no_checkout" && hasAiCompleted && checkoutStarted.length === 0) ||
          (segment === "checkout_abandoned" && checkoutStarted.length > 0 && !purchaseDone && new Date(lastCheckout.created_at).getTime() <= cutoff) ||
          (segment === "hot_free_users" && plan === "free" && eventCount(sorted, ["search_completed"]) >= 2 && hasAiCompleted && !purchaseDone) ||
          (segment === "first_ai_cta_seen_no_click" && hasEvent(sorted, ["First_AI_CTA_Shown"]) && !hasEvent(sorted, ["First_AI_CTA_Clicked"]));

        return {
          key,
          matchesSegment,
          email: user?.email || last.email || last.user_email || "-",
          plan,
          leadsUsage: leadsLimit ? `${leadsUsed}/${leadsLimit}` : String(leadsUsed || "-"),
          aiUsage: aiLimit ? `${aiUsed}/${aiLimit}` : String(aiUsed || "-"),
          lastEvent: eventKey(last),
          lastAt: last.created_at,
          utmContent: normalizeCreativeName(last.utm_content),
          eventSource: sourceBadge(last),
          journeyKey: user?.email || last.email || last.user_email || last.user_id || last.session_id || last.anonymous_id || key,
          counts: {
            searches: eventCount(sorted, ["search_completed"]),
            ai: eventCount(sorted, ["ai_analysis_completed"]),
            upgrades: eventCount(sorted, ["upgrade_clicked", "Upgrade_Click_Before_AI", "Upgrade_Click_After_AI"]),
            checkouts: checkoutStarted.length,
            purchases: eventCount(sorted, ["purchase_completed", "Purchase"]),
          },
          checkoutStartedAt: lastCheckout ? formatTime(lastCheckout.created_at) : null,
          checkoutUtmSource: lastCheckout?.utm_source || null,
          checkoutUtmCampaign: lastCheckout?.utm_campaign || null,
          sessionId: lastCheckout?.session_id || null,
          isAbandoned: checkoutStarted.length > 0 && !purchaseDone,
        };
      })
      .filter((row) => row.matchesSegment)
      .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
      .slice(0, 100);
  }, [abandonmentHours, filteredEvents, segment, usersByEmail, usersById]);

  const selectedJourney = useMemo(() => {
    if (!selectedSession) return [];
    const selected = selectedSession.toLowerCase();
    const matchedUser = usersByEmail.get(selected);
    return events
      .filter((event) => {
        return (
          event.session_id === selectedSession ||
          event.anonymous_id === selectedSession ||
          event.user_id === selectedSession ||
          event.email?.toLowerCase() === selected ||
          event.user_email?.toLowerCase() === selected ||
          (matchedUser?.id && event.user_id === matchedUser.id)
        );
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [events, selectedSession, usersByEmail]);

  const selectedJourneySummary = useMemo(() => {
    if (selectedJourney.length === 0) return null;
    
    // Encontrar último evento para extrair informações do usuário
    const sorted = [...selectedJourney].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const last = sorted[sorted.length - 1];
    
    // Obter dados do usuário no Supabase se disponíveis
    const user = (last.user_id && usersById.get(last.user_id)) || usersByEmail.get((last.email || last.user_email || "").toLowerCase());
    const email = user?.email || last.email || last.user_email || "-";
    const plan = String(user?.plan_name || metadata(last).user_plan || "unknown").toLowerCase();
    
    // UTMs e Origem do tráfego
    const firstWithUtm = sorted.find(e => e.utm_source);
    const utmSourceVal = firstWithUtm?.utm_source || last.utm_source || null;
    const utmCampaignVal = firstWithUtm?.utm_campaign || last.utm_campaign || null;
    const utmContentVal = firstWithUtm?.utm_content || last.utm_content || null;
    
    // Normalizar criativo
    const creativeNameVal = utmContentVal ? normalizeCreativeName(utmContentVal) : null;
    
    // Origem do tráfego badge
    const trafficSource = sourceBadge(last);
    
    // Contadores
    const countSearches = eventCount(sorted, ["search_completed", "first_search_completed"]);
    const countIaStarted = eventCount(sorted, ["AI_Analysis_Started", "First_AI_Analysis_Started", "ai_analysis_started"]);
    const countIaCompleted = eventCount(sorted, ["AI_Analysis_Completed", "First_AI_Analysis_Completed", "ai_analysis_completed"]);
    
    const totalUpgradeClicks = eventCount(sorted, ["upgrade_clicked", "Upgrade_Click_Before_AI", "Upgrade_Click_After_AI", "Upgrade_Click_After_Limit"]);
    const checkoutStarted = sorted.filter((event) => ["checkout_started", "InitiateCheckout"].includes(eventKey(event)));
    const countCheckouts = checkoutStarted.length;
    const purchaseDone = hasEvent(sorted, ["purchase_completed", "Purchase"]);
    const countPurchases = purchaseDone ? 1 : 0;
    
    // Telemetria detalhada de Falhas de IA com Reclassificação Inteligente de Saldo (Zuno Real Formula)
    let countIaBlockedByLimit = 0;
    let countIaRealFailures = 0;
    let countIaRecovered = 0;
    let countIaDuplicates = 0;
    let countIaAttemptsAfterLimit = 0;
    
    const limitEvents: AppEvent[] = [];
    
    sorted.forEach((e) => {
      const key = eventKey(e);
      const isNewBlock = ["AI_Analysis_Blocked_By_Limit", "ai_analysis_blocked_by_limit"].includes(key);
      let isOldBlock = false;
      let cl = null;
      
      if (["AI_Analysis_Failed", "ai_analysis_failed"].includes(key)) {
        cl = classifyAiFailure(e, sorted);
        if (cl.type === "no_balance") {
          isOldBlock = true;
        }
      }
      
      if (isNewBlock || isOldBlock) {
        countIaBlockedByLimit++;
        
        // Detectar se é uma tentativa repetida após limite (intervalo < 5s com mesmo lead e mesmo erro de limite)
        const metaE = metadata(e);
        const leadIdE = metaE.lead_id || metaE.leadId || "";
        const msgE = (metaE.error_message || metaE.error || metaE.reason || "").toLowerCase();
        const timeE = new Date(e.created_at).getTime();
        
        const isRepeated = limitEvents.some(prev => {
          const metaPrev = metadata(prev);
          const leadIdPrev = metaPrev.lead_id || metaPrev.leadId || "";
          const msgPrev = (metaPrev.error_message || metaPrev.error || metaPrev.reason || "").toLowerCase();
          const timePrev = new Date(prev.created_at).getTime();
          
          const sameLead = leadIdE === leadIdPrev && leadIdE !== "";
          const sameMsg = msgE === msgPrev || (msgE.includes("limite") && msgPrev.includes("limite"));
          const diffSecs = Math.abs(timeE - timePrev) / 1000;
          
          return sameLead && sameMsg && diffSecs < 5;
        });
        
        if (isRepeated) {
          countIaAttemptsAfterLimit++;
        }
        
        limitEvents.push(e);
      } else if (["AI_Analysis_Failed", "ai_analysis_failed"].includes(key)) {
        if (!cl) cl = classifyAiFailure(e, sorted);
        if (cl.type === "recovered") {
          countIaRecovered++;
        } else if (cl.type === "duplicate_event" || cl.type === "multiple_clicks") {
          countIaDuplicates++;
        } else {
          countIaRealFailures++;
        }
      }
    });

    // A taxa de falha real deve ser calculada assim: Falhas reais / (Falhas reais + IA sucesso) * 100
    let failureRate = 0;
    const totalTentaReal = countIaRealFailures + countIaCompleted;
    if (totalTentaReal > 0) {
      failureRate = Math.round((countIaRealFailures / totalTentaReal) * 100);
    }
    
    // Alertas comportamentais de alta intenção comercial e marketing
    const alerts: string[] = [];
    
    if (countIaBlockedByLimit > 0) {
      alerts.push("Usuário atingiu o limite de IA e tentou continuar usando.");
    }
    
    if (countIaBlockedByLimit >= 3) {
      alerts.push("Alta intenção após limite: múltiplas tentativas de usar IA sem saldo.");
    }
    
    if (countIaAttemptsAfterLimit > 0) {
      alerts.push("Tentativas repetidas após limite. Verificar se o botão estava desabilitado corretamente.");
    }
    
    const isCheckoutAbandoned = countCheckouts > 0 && !purchaseDone;
    if (isCheckoutAbandoned && countIaBlockedByLimit > 0) {
      alerts.push("Alta intenção detectada.");
      alerts.push("Verificar se o CTA de upgrade após limite está claro.");
    }
    
    if (utmSourceVal && utmSourceVal.toLowerCase() !== "direct" && utmSourceVal.toLowerCase() !== "organic") {
      alerts.push("Veio de tráfego pago: avaliar criativo/campanha.");
    }

    // Datas de atividades
    const firstActiveAt = sorted[0].created_at;
    const lastActiveAt = last.created_at;
    
    // Diagnóstico de Gargalos Automático
    let bottleneck = {
      label: "Processando jornada...",
      color: "bg-slate-550/10 text-slate-400 border-slate-550/20",
      description: "Carregando dados comportamentais..."
    };
    
    if (purchaseDone) {
      bottleneck = {
        label: "Ativado & Convertido (Sucesso)",
        color: "bg-emerald-500/10 text-[#10d98a] border-emerald-500/30",
        description: "O lead completou toda a jornada, realizou busca, IA e comprou o plano!"
      };
    } else if (isCheckoutAbandoned) {
      if (countIaBlockedByLimit > 0) {
        bottleneck = {
          label: "Checkout abandonado",
          color: "bg-amber-500/10 text-amber-400 border-amber-500/20 font-bold",
          description: "Checkout abandonado. Usuário atingiu limite de IA, tentou continuar usando (alta intenção detectada) e iniciou o checkout, mas desistiu antes de pagar."
        };
      } else if (countIaRealFailures >= 3 || failureRate >= 30) {
        bottleneck = {
          label: "Checkout abandonado + Falhas técnicas de IA",
          color: "bg-rose-500/15 text-rose-400 border-rose-500/30 font-bold animate-pulse",
          description: "O usuário tentou iniciar o checkout, mas enfrentou falhas técnicas consecutivas na IA, abalando a confiança."
        };
      } else {
        bottleneck = {
          label: "Objeção comercial no checkout (Preço / Valor)",
          color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          description: "O lead iniciou o checkout mas desistiu. Provavelmente objeção comercial (preço) ou abandono comum."
        };
      }
    } else if (countIaBlockedByLimit >= 3) {
      bottleneck = {
        label: "Alta intenção após limite de IA",
        color: "bg-violet-500/15 text-violet-400 border-violet-500/30 font-bold animate-pulse",
        description: "O lead atingiu o limite grátis de IA e tentou gerar análises repetidas vezes sem créditos, demonstrando altíssimo interesse comercial."
      };
    } else if (countIaBlockedByLimit > 0) {
      bottleneck = {
        label: "Limite da IA atingido",
        color: "bg-violet-500/10 text-violet-400 border-violet-500/20",
        description: "O lead usou as análises de IA grátis e atingiu o limite do plano grátis (Aha Moment)."
      };
    } else if (countIaRealFailures >= 3 && countIaCompleted === 0) {
      bottleneck = {
        label: "Bloqueio Técnico Crítico (IA não funciona)",
        color: "bg-red-500/15 text-red-400 border-red-500/25 font-bold",
        description: "O usuário tentou gerar abordagens com IA por 3+ vezes e teve apenas falhas. Não experimentou o valor do produto."
      };
    } else if (countIaCompleted > 0 && totalUpgradeClicks > 0) {
      bottleneck = {
        label: "Interesse em Upgrade sem checkout",
        color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        description: "O lead usou a IA com sucesso, clicou em botões de Upgrade, mas não iniciou o preenchimento dos dados de pagamento."
      };
    } else if (countIaCompleted > 0) {
      bottleneck = {
        label: "AHA Moment! Usou IA mas não iniciou compra",
        color: "bg-teal-500/10 text-teal-400 border-teal-500/20",
        description: "O lead ativou a IA e recebeu o relatório, mas ainda não demonstrou intenção de compra ou upgrade."
      };
    } else if (countSearches > 0) {
      bottleneck = {
        label: "Buscou leads, mas não ativou a IA",
        color: "bg-sky-500/10 text-sky-400 border-sky-500/20",
        description: "O lead realizou buscas e visualizou as empresas, mas não clicou no CTA para gerar a abordagem consultiva com IA."
      };
    } else {
      bottleneck = {
        label: "Cadastrado frio (Sem buscas)",
        color: "bg-slate-550/10 text-slate-400 border-slate-550/20",
        description: "O usuário criou a conta mas não efetuou nenhuma busca ou navegação profunda no app de prospecção."
      };
    }

    // Extrair atribuição detalhada do profile do usuário (Multi-Touch Attribution)
    const firstUtmSource = user?.first_utm_source || null;
    const firstUtmMedium = user?.first_utm_medium || null;
    const firstUtmCampaign = user?.first_utm_campaign || null;
    const firstUtmContent = user?.first_utm_content || null;
    const firstReferrer = user?.first_referrer || null;
    const firstLandingPage = user?.first_landing_page || null;
    const firstSeenAt = user?.first_seen_at || null;
    const firstEventSourceType = user?.first_event_source_type || null;
    const firstCreativeName = user?.first_creative_name || null;

    const lastUtmSource = user?.last_utm_source || null;
    const lastUtmMedium = user?.last_utm_medium || null;
    const lastUtmCampaign = user?.last_utm_campaign || null;
    const lastUtmContent = user?.last_utm_content || null;
    const lastReferrer = user?.last_referrer || null;
    const lastLandingPage = user?.last_landing_page || null;
    const lastSeenAt = user?.last_seen_at || null;
    const lastEventSourceType = user?.last_event_source_type || null;
    const lastCreativeName = user?.last_creative_name || null;

    // Calcular Diagnóstico Automático de Atribuição
    let attributionDiagnostic = "Origem inicial desconhecida. Verificar tracking.";
    
    if (firstEventSourceType) {
      const firstPaid = firstEventSourceType === "paid";
      const lastPaid = lastEventSourceType === "paid";
      const lastDirect = lastEventSourceType === "direct";
      
      if (firstPaid && lastDirect) {
        attributionDiagnostic = "Compra direta com possível influência anterior de campanha.";
      } else if (firstPaid && lastPaid && firstUtmCampaign !== lastUtmCampaign) {
        attributionDiagnostic = "Compra por campanha recente, mas primeira origem foi outra campanha.";
      } else if (firstEventSourceType === "direct" && lastPaid) {
        attributionDiagnostic = "Usuário entrou direto inicialmente e converteu após campanha.";
      } else if (firstUtmCampaign === lastUtmCampaign && firstUtmSource === lastUtmSource) {
        attributionDiagnostic = "Origem consistente.";
      } else {
        attributionDiagnostic = "Origem consistente com variações de canais.";
      }
    } else if (utmSourceVal) {
      attributionDiagnostic = "Origem detectada por UTM do evento. Sincronização do perfil pendente.";
    }
    
    return {
      email,
      plan,
      utmSource: utmSourceVal,
      utmCampaign: utmCampaignVal,
      utmContent: utmContentVal,
      creativeName: creativeNameVal,
      trafficSource,
      firstActiveAt,
      lastActiveAt,
      bottleneck,
      failureRate,
      alerts,
      firstTouch: {
        utmSource: firstUtmSource,
        utmMedium: firstUtmMedium,
        utmCampaign: firstUtmCampaign,
        utmContent: firstUtmContent,
        referrer: firstReferrer,
        landingPage: firstLandingPage,
        seenAt: firstSeenAt,
        eventSourceType: firstEventSourceType,
        creativeName: firstCreativeName,
      },
      lastTouch: {
        utmSource: lastUtmSource,
        utmMedium: lastUtmMedium,
        utmCampaign: lastUtmCampaign,
        utmContent: lastUtmContent,
        referrer: lastReferrer,
        landingPage: lastLandingPage,
        seenAt: lastSeenAt,
        eventSourceType: lastEventSourceType,
        creativeName: lastCreativeName,
      },
      attributionDiagnostic,
      counts: {
        searches: countSearches,
        iaStarted: countIaStarted,
        iaCompleted: countIaCompleted,
        iaFailed: countIaBlockedByLimit + countIaRealFailures + countIaRecovered + countIaDuplicates,
        iaFailedReal: countIaRealFailures,
        iaFailedRecovered: countIaRecovered,
        iaFailedDuplicates: countIaDuplicates,
        iaBlockedByLimit: countIaBlockedByLimit,
        iaAttemptsAfterLimit: countIaAttemptsAfterLimit,
        upgrades: totalUpgradeClicks,
        checkouts: countCheckouts,
        purchases: countPurchases
      }
    };
  }, [selectedJourney, usersById, usersByEmail, selectedSession]);

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader isAdmin />
      <main className="container mx-auto space-y-6 px-4 py-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Atividade ao vivo</h1>
            <p className="text-sm text-muted-foreground">Eventos internos do funil em tempo real, com UTMs e criativos.</p>
          </div>
          <Badge variant="outline" className="w-fit gap-2">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            {loading ? "Sincronizando" : "Ao vivo"}
          </Badge>
        </div>

        {events.some(e => e.utm_content === "sem_utm_content" || !e.utm_content) && internalFilter === "exclude" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
            <strong>Aviso:</strong> Eventos sem UTM podem ser tráfego direto, orgânico, link interno ou teste. Verifique referrer, session_id e event_source_type antes de analisar campanha.
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          {[
            { label: "Visitantes", value: metrics.visitors, icon: Users },
            { label: "Cadastros", value: metrics.signups, icon: UserPlus },
            { label: "Primeiras buscas", value: metrics.firstSearches, icon: Search },
            { label: "Checkouts", value: metrics.checkouts, icon: ShoppingCart },
            { label: "Compras", value: metrics.purchases, icon: CreditCard },
            { label: "PV -> Cadastro", value: `${metrics.pageToSignup}%`, icon: MousePointerClick },
            { label: "Cadastro -> Busca", value: `${metrics.signupToSearch}%`, icon: Filter },
          ].map((metric) => (
            <Card key={metric.label} className="rounded-lg">
              <CardContent className="flex items-center gap-3 p-4">
                <metric.icon className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className="text-xl font-semibold">{metric.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Funil</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
              {funnel.map((step) => (
                <div key={step.key} className="rounded-lg border border-border/70 p-4">
                  <p className="text-xs text-muted-foreground">{step.label}</p>
                  <p className="mt-1 text-2xl font-bold">{step.count}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{step.conversion}% da etapa anterior</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardContent className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
            <Select value={range} onValueChange={(value) => setRange(value as keyof typeof rangeHours)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Ultima 1h</SelectItem>
                <SelectItem value="24h">Ultimas 24h</SelectItem>
                <SelectItem value="7d">Ultimos 7 dias</SelectItem>
              </SelectContent>
            </Select>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger>
                <SelectValue placeholder="Evento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os eventos</SelectItem>
                {eventTypes.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={internalFilter} onValueChange={setInternalFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Eventos internos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exclude">Excluir internos</SelectItem>
                <SelectItem value="only">Somente internos</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={segment} onValueChange={(value) => setSegment(value as SegmentKey)}>
              <SelectTrigger>
                <SelectValue placeholder="Segmento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os segmentos</SelectItem>
                <SelectItem value="searched_no_ai">Buscou, sem IA</SelectItem>
                <SelectItem value="ai_limit_reached_no_upgrade">Limite IA atingido, sem Upgrade</SelectItem>
                <SelectItem value="ai_used_no_checkout">Usou IA, sem Checkout</SelectItem>
                <SelectItem value="checkout_abandoned">Checkout abandonado</SelectItem>
                <SelectItem value="hot_free_users">Usuários Free Quentes</SelectItem>
                <SelectItem value="first_ai_cta_seen_no_click">Viu CTA IA, sem clicar</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Abandono X horas" value={abandonmentHours} onChange={(event) => setAbandonmentHours(event.target.value)} />
            <Input placeholder="Email, usuario, sessao ou evento" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
            <Input placeholder="UTM source" value={utmSource} onChange={(event) => setUtmSource(event.target.value)} />
            <Input placeholder="Campanha UTM" value={utmCampaign} onChange={(event) => setUtmCampaign(event.target.value)} />
            <Input placeholder="Criativo / utm_content" value={utmContent} onChange={(event) => setUtmContent(event.target.value)} />
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Segmentos e recuperacao</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>IA</TableHead>
                  <TableHead>Eventos-chave</TableHead>
                  <TableHead>Ultimo evento</TableHead>
                  <TableHead>Criativo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Jornada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segmentRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="max-w-[220px] truncate">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{row.email}</span>
                        {row.isAbandoned && (
                          <div className="mt-1 flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 w-fit px-1.5 py-0.5 rounded border border-amber-500/20">
                            <Clock className="h-2.5 w-2.5 animate-pulse text-amber-500" />
                            Checkout Abandonado
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{row.plan}</TableCell>
                    <TableCell>{row.leadsUsage}</TableCell>
                    <TableCell>{row.aiUsage}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex flex-col gap-1">
                        <div>
                          buscas {row.counts.searches} / IA {row.counts.ai} / upgrades {row.counts.upgrades} / checkouts {row.counts.checkouts} / compras {row.counts.purchases}
                        </div>
                        {row.isAbandoned && row.checkoutStartedAt && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="font-medium">Iniciado: {row.checkoutStartedAt}</span>
                            {row.checkoutUtmSource && (
                              <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5">
                                src: {row.checkoutUtmSource}
                              </Badge>
                            )}
                            {row.checkoutUtmCampaign && (
                              <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5">
                                cmp: {row.checkoutUtmCampaign}
                              </Badge>
                            )}
                            {row.sessionId && (
                              <span className="text-muted-foreground/60 text-[9px]">
                                Sessão: {row.sessionId.substring(0, 8)}...
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{row.lastEvent}</TableCell>
                    <TableCell>{row.utmContent || "-"}</TableCell>
                    <TableCell>{row.eventSource}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => setSelectedSession(row.journeyKey)}>
                        Ver jornada
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {segmentRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum usuario encontrado para o segmento atual.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Resumo por criativo</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Criativo</TableHead>
                  <TableHead>utm_content original</TableHead>
                  <TableHead>PageViews</TableHead>
                  <TableHead>CTA Clicks</TableHead>
                  <TableHead>PV &gt; CTA</TableHead>
                  <TableHead>Cadastros</TableHead>
                  <TableHead>CTA &gt; Cadastro</TableHead>
                  <TableHead>Primeiras buscas</TableHead>
                  <TableHead>Cadastro &gt; Busca</TableHead>
                  <TableHead>Upgrade clicks</TableHead>
                  <TableHead>Checkouts</TableHead>
                  <TableHead>Compras</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creativeSummary.map((row) => (
                  <TableRow key={row.creative}>
                    <TableCell className="font-medium">{row.creative}</TableCell>
                    <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground" title={row.originals}>{row.originals}</TableCell>
                    <TableCell>{row.pageViews}</TableCell>
                    <TableCell>{row.ctaClicks}</TableCell>
                    <TableCell>{row.pageToCta}</TableCell>
                    <TableCell>{row.signups}</TableCell>
                    <TableCell>{row.ctaToSignup}</TableCell>
                    <TableCell>{row.firstSearches}</TableCell>
                    <TableCell>{row.signupToSearch}</TableCell>
                    <TableCell>{row.upgradeClicks}</TableCell>
                    <TableCell>{row.checkouts}</TableCell>
                    <TableCell>{row.purchases}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Eventos recentes</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Horario</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Email ou anonimo</TableHead>
                  <TableHead>Pagina</TableHead>
                  <TableHead>Detalhe</TableHead>
                  <TableHead>Origem/UTM</TableHead>
                  <TableHead>Dispositivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap text-xs"><Clock className="mr-1 inline h-3 w-3" />{formatTime(event.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{eventKey(event)}</Badge>
                      {event.is_internal_event && (
                        <Badge variant="outline" className="ml-2 border-amber-500/50 text-amber-500 text-[10px] h-5">teste</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        className="max-w-[240px] truncate text-left text-primary underline-offset-4 hover:underline"
                        onClick={() => setSelectedSession(event.email || event.user_email || event.user_id || event.session_id || event.anonymous_id)}
                      >
                        {identity(event)}
                      </button>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">{event.pathname || event.path || "-"}</TableCell>
                    <TableCell className="max-w-[320px] truncate">{eventDetails(event)}</TableCell>
                    <TableCell className="max-w-[280px] truncate">
                      {[event.utm_source, event.utm_medium, event.utm_campaign, normalizeCreativeName(event.utm_content)].filter(Boolean).join(" / ") || "-"}
                      {event.utm_content && event.utm_content !== normalizeCreativeName(event.utm_content) && (
                        <span className="block text-[10px] text-muted-foreground">Original: {event.utm_content}</span>
                      )}
                      {event.event_source_type && event.event_source_type !== "unknown" && (
                        <span className="block text-[10px] text-muted-foreground uppercase mt-0.5">{event.event_source_type}</span>
                      )}
                    </TableCell>
                    <TableCell>{[event.device_type, event.browser, event.os].filter(Boolean).join(" / ") || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      <Sheet open={Boolean(selectedSession)} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-4xl bg-[#0b0f0e] border-l border-emerald-500/20 text-slate-100 shadow-2xl p-6">
          <SheetHeader className="border-b border-slate-800 pb-4 mb-5">
            <SheetTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#10d98a]" />
              Resumo Executivo da Jornada
            </SheetTitle>
            <SheetDescription className="text-slate-400 font-mono text-xs break-all">{selectedSession}</SheetDescription>
          </SheetHeader>

          {selectedJourneySummary && (
            <div className="space-y-6">
              {/* Painel do Resumo Executivo */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#111816] rounded-xl border border-emerald-500/10 p-4 space-y-2 md:col-span-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-450 mb-3 flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    Identificação & Perfil Comercial
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <p><span className="text-slate-500 font-medium">E-mail:</span> <span className="text-slate-200 font-bold break-all">{selectedJourneySummary.email}</span></p>
                    <p>
                      <span className="text-slate-500 font-medium">Plano Atual:</span>{' '}
                      <Badge className={`text-[10px] py-0.5 px-2 font-bold uppercase ${
                        selectedJourneySummary.plan === "free" ? "bg-slate-800 text-slate-300 border-slate-700" :
                        selectedJourneySummary.plan === "starter" ? "bg-emerald-500/15 text-[#10d98a] border-emerald-500/30" :
                        selectedJourneySummary.plan === "pro" ? "bg-blue-500/15 text-blue-400 border-blue-500/30" :
                        "bg-violet-500/15 text-violet-400 border-violet-500/30"
                      }`}>{selectedJourneySummary.plan}</Badge>
                    </p>
                    <p><span className="text-slate-500 font-medium">Origem do Tráfego:</span> <span className="font-semibold text-slate-200">{selectedJourneySummary.trafficSource}</span></p>
                    <p><span className="text-slate-500 font-medium">Criativo da Campanha:</span> <span className="font-semibold text-[#10d98a]" title={selectedJourneySummary.utmContent || ""}>{selectedJourneySummary.creativeName || "Nenhum criativo (Tráfego Orgânico/Direto)"}</span></p>
                    <p className="sm:col-span-2"><span className="text-slate-500 font-medium">UTM UTM Source / Campaign:</span> <span className="font-mono text-[11px] text-slate-450">{selectedJourneySummary.utmSource || "-"} / {selectedJourneySummary.utmCampaign || "-"}</span></p>
                    <p><span className="text-slate-500 font-medium">Primeiro Acesso:</span> <span className="font-mono text-slate-350">{formatTime(selectedJourneySummary.firstActiveAt)}</span></p>
                    <p><span className="text-slate-500 font-medium">Última Atividade:</span> <span className="font-mono text-slate-350">{formatTime(selectedJourneySummary.lastActiveAt)}</span></p>
                  </div>
                </div>

                {/* Card de Diagnóstico do Funil */}
                <div className={`rounded-xl border p-4 flex flex-col justify-between space-y-3 ${selectedJourneySummary.bottleneck.color}`}>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">Diagnóstico do Funil</span>
                    <h4 className="font-bold text-sm mt-1.5 leading-snug">{selectedJourneySummary.bottleneck.label}</h4>
                    <p className="text-[11px] mt-1.5 opacity-90 leading-relaxed">{selectedJourneySummary.bottleneck.description}</p>
                    {selectedJourneySummary.alerts && selectedJourneySummary.alerts.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-current/20 pt-2.5">
                        {selectedJourneySummary.alerts.map((alert, aIdx) => (
                          <div key={aIdx} className="flex items-start gap-1 text-[10px] leading-relaxed opacity-95">
                            <span className="shrink-0">⚠️</span>
                            <span>{alert}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] font-semibold opacity-70 font-mono flex items-center gap-1.5 pt-1.5 border-t border-current/10 mt-1">
                    <Clock className="h-3 w-3" />
                    Telemetria de Ativação
                  </div>
                </div>
              </div>

              {/* Atribuição de Origem Multitoque (First & Last Touch) */}
              <div className="bg-[#111816] rounded-xl border border-emerald-500/10 p-4 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-450 flex items-center gap-1.5 border-b border-slate-800/80 pb-2">
                  <Target className="h-4 w-4" />
                  Atribuição de Origem Multitoque (First & Last Touch)
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* First Touch */}
                  <div className="bg-slate-950/40 rounded-lg border border-slate-800/80 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#10d98a] flex items-center gap-1">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        PRIMEIRO CONTATO (First Touch)
                      </span>
                      {selectedJourneySummary.firstTouch.eventSourceType && (
                        <Badge variant="outline" className="text-[9px] uppercase px-1.5 h-4.5 border-emerald-500/30 text-[#10d98a] bg-emerald-500/5">
                          {selectedJourneySummary.firstTouch.eventSourceType}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <p><span className="text-slate-500 font-medium">Origem (Source):</span> <span className="font-semibold text-slate-200">{selectedJourneySummary.firstTouch.utmSource || "-"}</span></p>
                      <p><span className="text-slate-500 font-medium">Meio (Medium):</span> <span className="font-semibold text-slate-200">{selectedJourneySummary.firstTouch.utmMedium || "-"}</span></p>
                      <p><span className="text-slate-500 font-medium">Campanha:</span> <span className="font-semibold text-slate-200">{selectedJourneySummary.firstTouch.utmCampaign || "-"}</span></p>
                      <p><span className="text-slate-500 font-medium">Criativo (Content):</span> <span className="font-semibold text-[#10d98a]">{selectedJourneySummary.firstTouch.creativeName || selectedJourneySummary.firstTouch.utmContent || "-"}</span></p>
                      {selectedJourneySummary.firstTouch.referrer && (
                        <p><span className="text-slate-500 font-medium">Referenciador:</span> <span className="text-slate-400 break-all text-[10px] font-mono block mt-0.5" title={selectedJourneySummary.firstTouch.referrer}>{selectedJourneySummary.firstTouch.referrer}</span></p>
                      )}
                      {selectedJourneySummary.firstTouch.landingPage && (
                        <p><span className="text-slate-500 font-medium">LP Entrada:</span> <span className="text-slate-400 break-all text-[10px] font-mono block mt-0.5" title={selectedJourneySummary.firstTouch.landingPage}>{selectedJourneySummary.firstTouch.landingPage}</span></p>
                      )}
                      {selectedJourneySummary.firstTouch.seenAt && (
                        <p><span className="text-slate-500 font-medium">Data/Hora:</span> <span className="font-mono text-slate-350">{formatTime(selectedJourneySummary.firstTouch.seenAt)}</span></p>
                      )}
                    </div>
                  </div>

                  {/* Last Touch */}
                  <div className="bg-slate-950/40 rounded-lg border border-slate-800/80 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#10d98a] flex items-center gap-1">
                        <ArrowDownRight className="h-3.5 w-3.5" />
                        CONTATO MAIS RECENTE (Last Touch)
                      </span>
                      {selectedJourneySummary.lastTouch.eventSourceType && (
                        <Badge variant="outline" className="text-[9px] uppercase px-1.5 h-4.5 border-emerald-500/30 text-[#10d98a] bg-emerald-500/5">
                          {selectedJourneySummary.lastTouch.eventSourceType}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <p><span className="text-slate-500 font-medium">Origem (Source):</span> <span className="font-semibold text-slate-200">{selectedJourneySummary.lastTouch.utmSource || "-"}</span></p>
                      <p><span className="text-slate-500 font-medium">Meio (Medium):</span> <span className="font-semibold text-slate-200">{selectedJourneySummary.lastTouch.utmMedium || "-"}</span></p>
                      <p><span className="text-slate-500 font-medium">Campanha:</span> <span className="font-semibold text-slate-200">{selectedJourneySummary.lastTouch.utmCampaign || "-"}</span></p>
                      <p><span className="text-slate-500 font-medium">Criativo (Content):</span> <span className="font-semibold text-[#10d98a]">{selectedJourneySummary.lastTouch.creativeName || selectedJourneySummary.lastTouch.utmContent || "-"}</span></p>
                      {selectedJourneySummary.lastTouch.referrer && (
                        <p><span className="text-slate-500 font-medium">Referenciador:</span> <span className="text-slate-400 break-all text-[10px] font-mono block mt-0.5" title={selectedJourneySummary.lastTouch.referrer}>{selectedJourneySummary.lastTouch.referrer}</span></p>
                      )}
                      {selectedJourneySummary.lastTouch.landingPage && (
                        <p><span className="text-slate-500 font-medium">LP Entrada:</span> <span className="text-slate-400 break-all text-[10px] font-mono block mt-0.5" title={selectedJourneySummary.lastTouch.landingPage}>{selectedJourneySummary.lastTouch.landingPage}</span></p>
                      )}
                      {selectedJourneySummary.lastTouch.seenAt && (
                        <p><span className="text-slate-500 font-medium">Data/Hora:</span> <span className="font-mono text-slate-350">{formatTime(selectedJourneySummary.lastTouch.seenAt)}</span></p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Diagnóstico de Atribuição */}
                <div className="bg-[#10d98a]/5 border border-[#10d98a]/20 rounded-lg p-3 flex items-start gap-2.5">
                  <div className="p-1 rounded bg-[#10d98a]/10 text-[#10d98a] shrink-0 mt-0.5">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#10d98a] uppercase tracking-wider block">Diagnóstico de Inteligência</span>
                    <p className="text-xs font-semibold text-slate-200 mt-1">{selectedJourneySummary.attributionDiagnostic}</p>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                      A Zuno cruza as origens de primeiro e último toque em tempo real para decifrar a jornada exata do cliente de ponta a ponta.
                    </p>
                  </div>
                </div>
              </div>

              {/* Grade de Estatísticas e Contadores */}
              <div className="bg-[#111816] rounded-xl border border-slate-800/80 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  Métricas de Conversão e Sucesso Real
                </h3>
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: "Buscas", val: selectedJourneySummary.counts.searches, color: "text-sky-400" },
                    { label: "IA Iniciadas", val: selectedJourneySummary.counts.iaStarted, color: "text-violet-400" },
                    { label: "IA Sucesso", val: selectedJourneySummary.counts.iaCompleted, color: "text-[#10d98a] font-bold" },
                    { label: "Bloqueios Limite", val: selectedJourneySummary.counts.iaBlockedByLimit, color: "text-violet-400 font-bold" },
                    { label: "Tentativas Repetidas", val: selectedJourneySummary.counts.iaAttemptsAfterLimit, color: "text-orange-400 font-semibold" },
                    { label: "Falhas Totais", val: selectedJourneySummary.counts.iaFailed, color: "text-red-400/50" },
                    { label: "Falhas Reais", val: selectedJourneySummary.counts.iaFailedReal, color: "text-red-450 font-bold" },
                    { label: "Recuperadas", val: selectedJourneySummary.counts.iaFailedRecovered, color: "text-[#10d98a] font-semibold" },
                    { label: "Duplicadas", val: selectedJourneySummary.counts.iaFailedDuplicates, color: "text-amber-400/80" },
                    { label: "Taxa Falha Real", val: `${selectedJourneySummary.failureRate}%`, color: selectedJourneySummary.failureRate >= 30 ? "text-rose-500 font-bold animate-pulse" : "text-slate-300" },
                    { label: "Upgrades Clicks", val: selectedJourneySummary.counts.upgrades, color: "text-indigo-400" },
                    { label: "Checkouts", val: selectedJourneySummary.counts.checkouts, color: "text-amber-500" },
                    { label: "Compras", val: selectedJourneySummary.counts.purchases, color: selectedJourneySummary.counts.purchases > 0 ? "text-[#10d98a] font-bold" : "text-slate-400" }
                  ].map((stat, sIdx) => (
                    <div key={stat.label} className="bg-slate-900/40 border border-slate-800 px-3 py-1.5 rounded-lg text-center flex-grow sm:flex-grow-0">
                      <span className="text-[10px] text-slate-500 block font-semibold">{stat.label}</span>
                      <span className={`text-sm font-bold block mt-0.5 ${stat.color}`}>{stat.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Controle de Abas Customizado */}
              <div className="flex border-b border-slate-800/80 pb-px mb-1">
                {[
                  { id: "compact", label: "Linha do Tempo", icon: Clock },
                  { id: "failures", label: "Falhas de IA por Lead", icon: Brain, isNew: selectedJourneySummary.counts.iaFailed > 0 },
                  { id: "raw", label: "Eventos Brutos", icon: Terminal }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = journeyViewMode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setJourneyViewMode(tab.id as any)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all duration-200 relative ${
                        isActive
                          ? "border-[#10d98a] text-[#10d98a] bg-emerald-500/5"
                          : "border-transparent text-slate-450 hover:text-slate-200"
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${isActive ? "text-[#10d98a]" : "text-slate-450"}`} />
                      {tab.label}
                      {tab.isNew && tab.id === "failures" && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Renderização Condicional da Aba Selecionada */}
              {journeyViewMode === "failures" ? (() => {
                const iaEvents = selectedJourney.filter(e => 
                  ["AI_Analysis_Started", "First_AI_Analysis_Started", 
                   "AI_Analysis_Completed", "First_AI_Analysis_Completed", "ai_analysis_completed", 
                   "AI_Analysis_Failed", "ai_analysis_failed"].includes(eventKey(e))
                );

                const leadsGroup: Record<string, {
                  leadId: string;
                  leadName: string;
                  attempts: any[];
                  failures: any[];
                  successes: any[];
                  started: any[];
                  firstFailureAt: string | null;
                  lastSuccessAt: string | null;
                  deductedCredit: boolean;
                }> = {};

                iaEvents.forEach(e => {
                  const meta = metadata(e) || {};
                  const leadId = meta.lead_id || meta.leadId || "";
                  const leadName = meta.lead_name || meta.leadName || "";
                  
                  const fallbackKey = leadId || (leadName ? `name_${leadName}` : "unknown_lead");
                  
                  if (!leadsGroup[fallbackKey]) {
                    leadsGroup[fallbackKey] = {
                      leadId: leadId || "não informado",
                      leadName: leadName || "Não informado",
                      attempts: [],
                      failures: [],
                      successes: [],
                      started: [],
                      firstFailureAt: null,
                      lastSuccessAt: null,
                      deductedCredit: false
                    };
                  }
                  
                  const group = leadsGroup[fallbackKey];
                  group.attempts.push(e);
                  
                  const key = eventKey(e);
                  if (["AI_Analysis_Failed", "ai_analysis_failed"].includes(key)) {
                    group.failures.push(e);
                    if (!group.firstFailureAt) {
                      group.firstFailureAt = e.created_at;
                    }
                    const aiUsedAfter = Number(meta.ai_used_after || 0);
                    const aiUsedBefore = Number(meta.ai_used_before || 0);
                    if (meta.deducted_credit === true || aiUsedAfter > aiUsedBefore) {
                      group.deductedCredit = true;
                    }
                  } else if (["AI_Analysis_Completed", "First_AI_Analysis_Completed", "ai_analysis_completed"].includes(key)) {
                    group.successes.push(e);
                    group.lastSuccessAt = e.created_at;
                  } else if (["AI_Analysis_Started", "First_AI_Analysis_Started"].includes(key)) {
                    group.started.push(e);
                  }
                });

                const groupedLeadsList = Object.values(leadsGroup).filter(g => g.failures.length > 0);

                return (
                  <div className="space-y-4 pt-1">
                    <div className="p-3.5 bg-slate-900/30 rounded-xl border border-slate-800/60 text-xs text-slate-400 space-y-1">
                      <p className="font-semibold text-slate-200">Painel de Auditoria de Falhas de IA por Lead</p>
                      <p>Rastreia de forma atômica erros de API, timeouts, múltiplas tentativas e auditoria automática de créditos.</p>
                      <p className="mt-1">Leads com falhas técnicas: <span className="font-bold text-[#10d98a]">{groupedLeadsList.length}</span></p>
                    </div>

                    {groupedLeadsList.length === 0 ? (
                      <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-8 text-xs text-slate-400 text-center flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-6 w-6 text-[#10d98a] shrink-0" />
                        Nenhuma falha técnica de IA registrada para este usuário!
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {groupedLeadsList.map((g, idx) => {
                          const hasRecovery = g.successes.length > 0;
                          
                          let hasDuplication = false;
                          let hasMultipleClicks = false;
                          
                          g.failures.forEach(f => {
                            const cl = classifyAiFailure(f, selectedJourney);
                            if (cl.type === "duplicate_event") hasDuplication = true;
                            if (cl.type === "multiple_clicks") hasMultipleClicks = true;
                          });

                          let statusLabel = "Falha Não Recuperada";
                          let statusColor = "bg-red-500/10 text-red-400 border-red-500/25";
                          
                          if (hasRecovery) {
                            const firstFailTime = new Date(g.firstFailureAt!).getTime();
                            const recoverySuccess = g.successes.find(s => {
                              const diffSecs = (new Date(s.created_at).getTime() - firstFailTime) / 1000;
                              return diffSecs > 0 && diffSecs <= 120;
                            });
                            
                            if (recoverySuccess) {
                              const diff = Math.round((new Date(recoverySuccess.created_at).getTime() - firstFailTime) / 1000);
                              statusLabel = `Falha recuperada (${diff}s após)`;
                              statusColor = "bg-emerald-500/15 text-[#10d98a] border-emerald-500/30 font-bold";
                            } else {
                              statusLabel = "Sucesso posterior (> 2min)";
                              statusColor = "bg-teal-500/10 text-teal-400 border-teal-500/20";
                            }
                          } else if (hasDuplication) {
                            statusLabel = "Possível duplicação";
                            statusColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                          } else if (hasMultipleClicks) {
                            statusLabel = "Múltiplos cliques";
                            statusColor = "bg-violet-500/10 text-violet-400 border-violet-500/20";
                          }

                          return (
                            <div key={idx} className="rounded-xl border border-slate-800/80 bg-slate-950/20 p-4 shadow-sm space-y-4 hover:border-slate-800 hover:bg-slate-950/40 transition-all">
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/60 pb-3 mb-0.5">
                                <div>
                                  <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                                    <Brain className="h-4 w-4 text-violet-405" />
                                    {g.leadName}
                                  </h4>
                                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {g.leadId}</p>
                                </div>
                                <div className="flex flex-wrap gap-1.5 items-center">
                                  <Badge variant="outline" className={`text-[9px] px-2 py-0.5 uppercase tracking-wider font-bold ${statusColor}`}>
                                    {statusLabel}
                                  </Badge>
                                  {g.deductedCredit && (
                                    <Badge className="bg-red-500/20 text-red-400 border border-red-500/40 text-[9px] font-bold uppercase animate-pulse">
                                      Desconto Indevido
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-[10.5px] text-slate-400">
                                <div className="bg-slate-900/30 p-2 rounded-lg border border-slate-800/40">
                                  <span className="text-slate-500 block">Tentativas</span>
                                  <span className="font-bold text-slate-200 text-xs">{g.attempts.length}</span>
                                </div>
                                <div className="bg-slate-900/30 p-2 rounded-lg border border-slate-800/40">
                                  <span className="text-slate-500 block">Falhas IA</span>
                                  <span className="font-bold text-red-400 text-xs">{g.failures.length}</span>
                                </div>
                                <div className="bg-slate-900/30 p-2 rounded-lg border border-slate-800/40">
                                  <span className="text-slate-500 block">Sucessos IA</span>
                                  <span className="font-bold text-emerald-400 text-xs">{g.successes.length}</span>
                                </div>
                                <div className="bg-slate-900/30 p-2 rounded-lg border border-slate-800/40">
                                  <span className="text-slate-500 block">Primeira Falha</span>
                                  <span className="font-mono text-slate-350 text-[10px]">{g.firstFailureAt ? formatTime(g.firstFailureAt) : "-"}</span>
                                </div>
                                <div className="bg-slate-900/30 p-2 rounded-lg border border-slate-800/40">
                                  <span className="text-slate-500 block">Último Sucesso</span>
                                  <span className="font-mono text-slate-350 text-[10px]">{g.lastSuccessAt ? formatTime(g.lastSuccessAt) : "-"}</span>
                                </div>
                              </div>

                              {g.deductedCredit && (
                                <div className="flex items-center gap-1.5 text-[10px] text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/25 animate-pulse">
                                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                                  <span className="font-bold">Desconto Indevido de Créditos:</span> Evento com falha técnica sofreu débito indevido. O administrador deve creditar saldo para o usuário manualmente.
                                </div>
                              )}

                              <details className="mt-2 rounded-lg bg-[#080c0b] border border-slate-800/80 p-3 text-xs text-slate-400">
                                <summary className="cursor-pointer font-bold text-slate-300 hover:text-slate-200 transition-colors list-none select-none flex items-center gap-1">
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform details-open:rotate-90" />
                                  Detalhes Técnicos da Linha de Erros ({g.failures.length} eventos)
                                </summary>
                                <div className="mt-4 space-y-4 border-l-2 border-slate-800/60 pl-3 ml-1.5">
                                  {g.failures.map((f, fIdx) => {
                                    const cl = classifyAiFailure(f, selectedJourney);
                                    const isDeducted = metadata(f).deducted_credit === true || 
                                                       (metadata(f).ai_used_after !== undefined && 
                                                        metadata(f).ai_used_before !== undefined && 
                                                        Number(metadata(f).ai_used_after) > Number(metadata(f).ai_used_before));
                                    
                                    return (
                                      <div key={fIdx} className="space-y-2 relative">
                                        <div className="absolute -left-[19.5px] top-1.5 h-2 w-2 rounded-full bg-red-500 border border-[#0b0f0e]" />
                                        <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800/20 pb-1.5">
                                          <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-bold">
                                            {cl.label}
                                          </Badge>
                                          <span className="text-[10px] text-slate-500 font-mono">{formatTime(f.created_at)}</span>
                                        </div>
                                        <p className="text-[11px] text-slate-300 font-mono bg-black/60 p-2.5 rounded border border-slate-800 max-h-24 overflow-y-auto break-words whitespace-pre-wrap">{metadata(f).error_message || metadata(f).error || "Nenhum log de erro fornecido pelo backend"}</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] text-slate-550">
                                          {metadata(f).error_code && <p><span className="text-slate-500 font-medium">Código do Erro:</span> <span className="font-mono text-slate-300">{String(metadata(f).error_code)}</span></p>}
                                          {metadata(f).error_type && <p><span className="text-slate-500 font-medium">Tipo de Erro:</span> <span className="font-mono text-slate-300">{String(metadata(f).error_type)}</span></p>}
                                          <p><span className="text-slate-500 font-medium">Duração:</span> <span className="text-slate-300">{metadata(f).duration_ms !== undefined ? `${metadata(f).duration_ms} ms` : "não informado"}</span></p>
                                          <p><span className="text-slate-500 font-medium">Tentativas (Retries):</span> <span className="text-slate-300">{metadata(f).retry_count !== undefined ? metadata(f).retry_count : "não informado"}</span></p>
                                          {metadata(f).request_id && <p className="sm:col-span-2"><span className="text-slate-500 font-mono font-medium">Request ID:</span> <span className="font-mono text-slate-300 break-all">{String(metadata(f).request_id)}</span></p>}
                                          <p className="sm:col-span-2"><span className="text-slate-500 font-medium">Crédito Descontado:</span> <span className={isDeducted ? "text-red-400 font-bold" : "text-slate-400"}>{isDeducted ? "Sim (ANOMALIA DE DADO)" : "Não (Correto)"}</span></p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </details>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })() : journeyViewMode === "compact" ? (() => {
                // Lógica de agrupamento para a Timeline Compacta
                const compactEvents = [];
                let currentGroup = null;

                selectedJourney.forEach((e) => {
                  const key = eventKey(e);
                  const isKey = ["search_completed", "ai_analysis_completed", "AI_Analysis_Failed", "ai_analysis_failed", "upgrade_clicked", "checkout_started", "purchase_completed", "Purchase", "First_AI_CTA_Shown", "First_AI_CTA_Clicked", "AI_Analysis_Duplicate_Click_Prevented"].includes(key);
                  
                  if (isKey) {
                    if (currentGroup) {
                      compactEvents.push(currentGroup);
                      currentGroup = null;
                    }
                    compactEvents.push({ event: e, count: 1, list: [e], isKey: true });
                  } else {
                    if (currentGroup && eventKey(currentGroup.event) === key) {
                      currentGroup.count++;
                      currentGroup.list.push(e);
                    } else {
                      if (currentGroup) {
                        compactEvents.push(currentGroup);
                      }
                      currentGroup = { event: e, count: 1, list: [e], isKey: false };
                    }
                  }
                });
                if (currentGroup) {
                  compactEvents.push(currentGroup);
                }

                return (
                  <div className="space-y-3 pt-1">
                    {compactEvents.map((g, idx) => {
                      const e = g.event;
                      const key = eventKey(e);
                      
                      const isNewBlock = ["AI_Analysis_Blocked_By_Limit", "ai_analysis_blocked_by_limit"].includes(key);
                      const isOldBlock = ["AI_Analysis_Failed", "ai_analysis_failed"].includes(key) && classifyAiFailure(e, selectedJourney).type === "no_balance";
                      const isBlockedLimit = isNewBlock || isOldBlock;
                      
                      const isFailed = ["AI_Analysis_Failed", "ai_analysis_failed"].includes(key) && !isBlockedLimit;
                      const isPrevented = key === "AI_Analysis_Duplicate_Click_Prevented";

                      return (
                        <div key={idx} className={`rounded-xl border p-4 transition-all ${
                          isFailed ? "border-red-500/20 bg-red-500/5" :
                          isBlockedLimit ? "border-violet-500/20 bg-violet-500/5 shadow-md shadow-violet-950/10" :
                          isPrevented ? "border-violet-500/20 bg-violet-500/5" :
                          g.isKey ? "border-[#10d98a]/20 bg-emerald-500/[0.02]" :
                          "border-slate-800 bg-[#111816]/40 text-slate-400"
                        }`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={
                                isFailed ? "bg-red-500/20 text-red-400 border-red-500/30 font-bold" :
                                isBlockedLimit ? "bg-violet-500/25 text-violet-400 border-violet-500/30 font-bold uppercase tracking-wider" :
                                isPrevented ? "bg-violet-500/20 text-violet-400 border-violet-500/30 font-bold" :
                                g.isKey ? "bg-[#10d98a]/15 text-[#10d98a] border-emerald-500/30" :
                                "bg-slate-800 text-slate-350 border-slate-700"
                              }>{isBlockedLimit ? "Bloqueio por limite" : key}</Badge>
                              <Badge variant="outline" className="border-slate-800 text-slate-450">{sourceBadge(e)}</Badge>
                              
                              {g.count > 1 && (
                                <Badge className="bg-emerald-500/10 text-[#10d98a] border-emerald-500/20 text-[10px] font-bold">
                                  repetido {g.count}x
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-slate-450 font-mono">{formatTime(e.created_at)}</span>
                          </div>

                          {/* Bloco Detalhado se for Falha de IA */}
                          {isFailed && (() => {
                            const cl = classifyAiFailure(e, selectedJourney);
                            const eventTime = new Date(e.created_at).getTime();
                            const leadId = metadata(e).lead_id || metadata(e).leadId;
                            
                            const successEventAfter = selectedJourney.find(evt => {
                              const isSuccess = ["AI_Analysis_Completed", "First_AI_Analysis_Completed", "ai_analysis_completed"].includes(eventKey(evt));
                              const sameLead = (metadata(evt).lead_id || metadata(evt).leadId) === leadId && leadId;
                              if (!isSuccess || !sameLead) return false;
                              const diffSeconds = (new Date(evt.created_at).getTime() - eventTime) / 1000;
                              return diffSeconds > 0 && diffSeconds <= 120;
                            });
                            
                            const isDeducted = metadata(e).deducted_credit === true || 
                                               (metadata(e).ai_used_after !== undefined && 
                                                metadata(e).ai_used_before !== undefined && 
                                                Number(metadata(e).ai_used_after) > Number(metadata(e).ai_used_before));

                            return (
                              <div className="mt-3.5 pt-3 border-t border-red-500/10 space-y-3 text-[11px] text-slate-300">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-bold text-red-400 flex items-center gap-1.5 text-xs">
                                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                                    Falha técnica na IA: {cl.label}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {successEventAfter && (
                                      <Badge className="bg-[#10d98a]/15 text-[#10d98a] border-emerald-500/30 text-[9px] font-bold">
                                        Falha Recuperada com Sucesso
                                      </Badge>
                                    )}
                                    <Badge variant="outline" className={`text-[9px] font-bold h-5 ${
                                      isDeducted 
                                        ? "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse font-extrabold" 
                                        : "bg-emerald-500/10 text-[#10d98a] border-emerald-500/20"
                                    }`}>
                                      Consumiu crédito: {isDeducted ? "Sim (CRÍTICO)" : "Não"}
                                    </Badge>
                                  </div>
                                </div>

                                <p className="bg-black/50 p-2.5 rounded border border-slate-800 font-mono text-[10.5px] text-red-400 break-words whitespace-pre-wrap">{metadata(e).error_message || metadata(e).error || "Não informado"}</p>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] text-slate-450 border-t border-slate-800/30 pt-2.5">
                                  {metadata(e).error_code && <p><span className="text-slate-500 font-medium">Error Code:</span> <span className="font-mono text-slate-300">{String(metadata(e).error_code)}</span></p>}
                                  {metadata(e).error_type && <p><span className="text-slate-500 font-medium">Error Type:</span> <span className="font-mono text-slate-300">{String(metadata(e).error_type)}</span></p>}
                                  <p><span className="text-slate-500 font-medium">Lead Afetado:</span> <span className="font-semibold text-slate-300">{String(metadata(e).lead_name || metadata(e).leadName || "Não informado")}</span></p>
                                  <p><span className="text-slate-500 font-medium">Lead ID:</span> <span className="font-mono text-slate-350 text-[9px]">{String(metadata(e).lead_id || "Não informado")}</span></p>
                                  <p><span className="text-slate-500 font-medium">Créditos IA (Antes/Depois):</span> <span className="text-slate-300">{String(metadata(e).ai_available_before !== undefined ? metadata(e).ai_available_before : "-")} &gt; {String(metadata(e).ai_available_after !== undefined ? metadata(e).ai_available_after : "-")}</span></p>
                                  <p><span className="text-slate-500 font-medium">Tempo de Resposta:</span> <span className="text-slate-300">{metadata(e).duration_ms !== undefined ? `${metadata(e).duration_ms} ms` : "não medido"}</span></p>
                                  <p><span className="text-slate-500 font-medium">Tentativas de Conexão:</span> <span className="text-slate-300">{metadata(e).retry_count !== undefined ? metadata(e).retry_count : "não informado"}</span></p>
                                  {metadata(e).request_id && <p className="sm:col-span-2"><span className="text-slate-500 font-mono font-medium">Request ID:</span> <span className="font-mono text-slate-300 break-all">{String(metadata(e).request_id)}</span></p>}
                                </div>

                                {isDeducted && (
                                  <div className="flex items-center gap-1.5 text-[9.5px] text-red-400 font-bold bg-red-500/15 p-2 rounded border border-red-500/30 animate-pulse">
                                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                    Atenção: Crédito do plano foi debitado indevidamente nesta falha.
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Bloco Detalhado se for Bloqueio por Limite */}
                          {isBlockedLimit && (() => {
                            return (
                              <div className="mt-3.5 pt-3 border-t border-violet-500/10 space-y-3 text-[11px] text-slate-300">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-bold text-violet-400 flex items-center gap-1.5 text-xs">
                                    <Lock className="h-4 w-4 text-violet-500 shrink-0" />
                                    Bloqueio por Limite de IA
                                  </span>
                                  <Badge variant="outline" className="bg-emerald-500/10 text-[#10d98a] border-emerald-500/20 text-[9px] font-bold">
                                    Consumiu crédito: Não
                                  </Badge>
                                </div>
                                
                                {isOldBlock && (
                                  <div className="text-[10px] text-amber-500 bg-amber-500/10 p-2.5 rounded border border-amber-500/20">
                                    ⚠️ Evento antigo registrado como falha, mas reclassificado como bloqueio por limite.
                                  </div>
                                )}

                                <p className="bg-black/50 p-2.5 rounded border border-slate-800 font-mono text-[10.5px] text-slate-400 break-words whitespace-pre-wrap">
                                  {metadata(e).error_message || metadata(e).error || "Limite de IA atingido"}
                                </p>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] text-slate-450 border-t border-slate-800/30 pt-2.5">
                                  <p><span className="text-slate-500 font-medium">Plano do Usuário:</span> <span className="font-semibold text-slate-300">{String(metadata(e).user_plan || "free")}</span></p>
                                  <p><span className="text-slate-500 font-medium">Lead Afetado:</span> <span className="font-semibold text-slate-300">{String(metadata(e).lead_name || metadata(e).leadName || "Não informado")}</span></p>
                                  <p><span className="text-slate-500 font-medium">Lead ID:</span> <span className="font-mono text-slate-350 text-[9px]">{String(metadata(e).lead_id || "Não informado")}</span></p>
                                  <p><span className="text-slate-500 font-medium">Créditos Usados / Limite:</span> <span className="text-slate-300">{String(metadata(e).ai_used !== undefined ? metadata(e).ai_used : "-")} / {String(metadata(e).ai_limit !== undefined ? metadata(e).ai_limit : "-")}</span></p>
                                  <p><span className="text-slate-500 font-medium">Créditos Disponíveis:</span> <span className="text-slate-300">{String(metadata(e).ai_available !== undefined ? metadata(e).ai_available : "0")}</span></p>
                                  <p><span className="text-slate-500 font-medium">Bloqueado antes da API:</span> <span className="text-slate-300">{metadata(e).blocked_before_ai_call !== false ? "Sim (Correto)" : "Não"}</span></p>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Bloco Detalhado se for Duplicado Prevenido */}
                          {isPrevented && (
                            <div className="mt-3.5 pt-3 border-t border-violet-500/10 space-y-1.5 text-[11px] text-slate-300">
                              <span className="font-bold text-violet-400 flex items-center gap-1.5 text-xs">
                                <AlertTriangle className="h-4 w-4 text-violet-500 shrink-0" />
                                Bloqueio de Clique Concorrente (Sucesso)
                              </span>
                              <p className="text-slate-400 leading-relaxed text-[10.5px]">O sistema identificou cliques duplos síncronos redundantes no botão de IA para o lead <span className="font-bold text-slate-200">{String(metadata(e).lead_name)}</span> e preveniu chamadas duplicadas adicionais com sucesso absoluto, preservando a estabilidade e os créditos do usuário.</p>
                            </div>
                          )}

                          {/* Dados da URL e detalhes de outros eventos */}
                          {!isFailed && !isPrevented && (
                            <div className="mt-3 space-y-2.5 text-xs">
                              <div className="grid gap-2 md:grid-cols-2 text-[10.5px] text-slate-450">
                                <p><span className="text-slate-500 font-medium">page_url:</span> <span className="text-slate-350 break-all">{e.page_url || "-"}</span></p>
                                <p><span className="text-slate-500 font-medium">path:</span> <span className="text-slate-350 break-all">{e.pathname || e.path || "-"}</span></p>
                                <p><span className="text-slate-500 font-medium">creative:</span> <span className="text-slate-350">{normalizeCreativeName(e.utm_content) || "-"}</span></p>
                                <p><span className="text-slate-500 font-medium">utm:</span> <span className="text-slate-350 font-mono text-[9.5px]">{[e.utm_source, e.utm_medium, e.utm_campaign, e.utm_content].filter(Boolean).join(" / ") || "-"}</span></p>
                              </div>
                              <p className="text-[11px] font-medium text-slate-300 bg-slate-900/30 p-2 rounded border border-slate-800/40 leading-relaxed">{eventDetails(e)}</p>
                            </div>
                          )}

                          {/* Accordion expandível para JSON de metadados se count > 1 */}
                          {g.count > 1 && (
                            <details className="mt-3 rounded-lg bg-slate-900/40 p-2 text-xs border border-slate-800/40">
                              <summary className="cursor-pointer font-bold text-slate-400 hover:text-slate-300 select-none">
                                Ver timestamps de todas as ocorrências ({g.count})
                              </summary>
                              <div className="mt-2 space-y-1.5 pl-2 font-mono text-[10px] text-slate-500">
                                {g.list.map((item, itemIdx) => (
                                  <p key={itemIdx}>{itemIdx + 1}. Ocorrido às: <span className="text-slate-400">{formatTime(item.created_at)}</span></p>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })() : (
                /* Aba: Eventos Brutos (Visualizador Completo) */
                <div className="space-y-3 pt-1">
                  {selectedJourney.map((event) => (
                    <div key={event.id} className="rounded-xl border border-slate-800 bg-[#111816]/30 p-4 text-xs text-slate-400 space-y-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-slate-800 text-slate-300 border-slate-700">{eventKey(event)}</Badge>
                          <Badge variant="outline" className="border-slate-850 text-slate-450">{sourceBadge(event)}</Badge>
                          {event.event_type && event.event_type !== event.event_name && (
                            <Badge variant="secondary">{event.event_type}</Badge>
                          )}
                        </div>
                        <span className="text-xs text-slate-450 font-mono">{formatTime(event.created_at)}</span>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2 text-[10.5px]">
                        <p><span className="text-slate-500 font-medium">page_url:</span> <span className="text-slate-300 break-all">{event.page_url || "-"}</span></p>
                        <p><span className="text-slate-500 font-medium">path:</span> <span className="text-slate-300 break-all">{event.pathname || event.path || "-"}</span></p>
                        <p><span className="text-slate-500 font-medium">referrer:</span> <span className="text-slate-300 break-all">{event.referrer || "-"}</span></p>
                        <p><span className="text-slate-500 font-medium">creative:</span> <span className="text-[#10d98a]">{normalizeCreativeName(event.utm_content) || "-"}</span></p>
                        <p><span className="text-slate-500 font-medium">utm:</span> <span className="text-slate-300 font-mono">{[event.utm_source, event.utm_medium, event.utm_campaign, event.utm_content].filter(Boolean).join(" / ") || "-"}</span></p>
                        <p><span className="text-slate-500 font-medium">session_id:</span> <span className="text-slate-300 font-mono text-[9px] break-all">{event.session_id || "-"}</span></p>
                        <p><span className="text-slate-500 font-medium">anonymous_id:</span> <span className="text-slate-300 font-mono text-[9px] break-all">{event.anonymous_id || "-"}</span></p>
                        <p><span className="text-slate-500 font-medium">user_id/email:</span> <span className="text-slate-300 font-mono text-[9px] break-all">{event.user_email || event.email || event.user_id || "-"}</span></p>
                      </div>
                      <p className="text-[11px] font-medium text-slate-300 bg-slate-900/30 p-2.5 rounded border border-slate-805 leading-relaxed">{eventDetails(event)}</p>
                      <details className="rounded-lg bg-black/40 border border-slate-805 p-2.5 text-xs text-slate-400">
                        <summary className="cursor-pointer font-bold text-slate-400 hover:text-slate-300 select-none">Metadata JSON Completo</summary>
                        <pre className="mt-2.5 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-[10px] bg-slate-950 p-3 rounded border border-slate-900">
                          {JSON.stringify(metadata(event), null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                  {selectedJourney.length === 0 && (
                    <p className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-6 text-xs text-slate-400 text-center">
                      Nenhum evento encontrado para este email, usuário, sessão ou anonymous_id no período carregado.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
