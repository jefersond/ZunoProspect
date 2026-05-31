import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Activity, Clock, CreditCard, Filter, MousePointerClick, Search, 
  ShoppingCart, Users, XCircle, Brain, AlertTriangle, ChevronRight, 
  CheckCircle2, RefreshCw, BarChart3, HelpCircle, ArrowRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/config/admin";
import { AppHeader } from "@/components/AppHeader";
import { AdminLoadingState, AdminErrorState, AdminEmptyState } from "@/components/admin/AdminStates";
import { normalizeCreativeName, CREATIVE_NAME_MAP } from "@/lib/creativeMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  is_internal_event: boolean | null;
  event_source_type: string | null;
  metadata: Record<string, any> | null;
  event_data: Record<string, any> | null;
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

type CheckoutRow = {
  key: string;
  email: string;
  userId: string | null;
  sessionId: string | null;
  planId: string;
  planName: string;
  value: number;
  currency: string;
  eventSource: string;
  utmCampaign: string;
  utmContent: string;
  creativeName: string;
  searchesCount: number;
  aiSuccessCount: number;
  aiFailedCount: number;
  upgradeClicksCount: number;
  checkoutDate: string;
  status: "converted" | "checkout_failed" | "recent" | "abandoned" | "unknown";
  diagnostics: string[];
  priorities: ("crítica" | "técnica" | "alta" | "normal")[];
  hasPurchaseAfter: boolean;
  hasCheckoutFailedAfter: boolean;
  rawCheckoutEvent: AppEvent;
};

const rangeHours = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
};

export default function AdminAbandonedCheckouts() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [range, setRange] = useState<keyof typeof rangeHours>("7d");
  const [statusFilter, setStatusFilter] = useState<string>("abandoned_error"); // abandonado + erro por padrão
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [aiFailedFilter, setAiFailedFilter] = useState<string>("all");
  const [realUsersFilter, setRealUsersFilter] = useState<boolean>(true); // Excluir internos por padrão
  const [searchTerm, setSearchTerm] = useState("");
  const [utmCampaignTerm, setUtmCampaignTerm] = useState("");
  const [utmContentTerm, setUtmContentTerm] = useState("");

  const sinceIso = useMemo(() => {
    const date = new Date();
    date.setHours(date.getHours() - rangeHours[range]);
    return date.toISOString();
  }, [range]);

  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const usersByEmail = useMemo(() => new Map(users.map((user) => [user.email?.toLowerCase(), user])), [users]);

  // 1. Verificar privilégios de Admin
  useEffect(() => {
    const verifyAdmin = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          navigate("/auth?tab=login");
          return;
        }

        // Bypass imediato para o email de admin principal
        if (isAdminEmail(user.email)) {
          setIsAdmin(true);
          return;
        }

        const { data: adminCheck, error: rpcError } = await supabase.rpc("is_admin", { _user_id: user.id });
        if (rpcError) throw rpcError;

        if (!adminCheck) {
          toast({
            variant: "destructive",
            title: "Acesso restrito",
            description: "Esta página é exclusiva para administradores.",
          });
          navigate("/prospeccao");
          return;
        }

        setIsAdmin(true);
      } catch (err: any) {
        console.error("Erro ao verificar privilégios de administrador:", err);
        toast({
          variant: "destructive",
          title: "Erro de conexão",
          description: "Não foi possível verificar seus privilégios de administrador. Tente novamente.",
        });
        setLoading(false); // Desligar o loading para evitar tela preta infinita
      }
    };

    verifyAdmin();
  }, [navigate, toast]);

  // 2. Carregar dados de usuários do SaaS para enriquecimento
  useEffect(() => {
    if (!isAdmin) return;

    const loadUsers = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const { data, error } = await supabase.functions.invoke("admin-get-users", {
          body: { action: "list" },
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        });

        if (error) {
          console.warn("Erro ao carregar usuários:", error.message);
          return;
        }

        setUsers((data?.users || []) as AdminUserSummary[]);
      } catch (err) {
        console.warn("Falha ao invocar RPC de usuários:", err);
      }
    };

    loadUsers();
  }, [isAdmin]);

  // 3. Carregar logs de eventos brutos no Supabase
  const loadEvents = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from("app_events")
        .select("*")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(3000);

      if (fetchErr) {
        throw fetchErr;
      } else {
        setEvents((data || []) as AppEvent[]);
      }
    } catch (err: any) {
      console.error("Erro ao carregar eventos de checkouts:", err);
      setError(err);
      toast({
        variant: "destructive",
        title: "Erro ao carregar eventos",
        description: err.message || "Erro de conexão com o banco de dados.",
      });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, sinceIso, toast]);

  useEffect(() => {
    loadEvents();
  }, [isAdmin, loadEvents]);

  // Auxiliares de Lógica do Funil
  const getEventName = (event: AppEvent) => {
    return event.event_name || event.event_type;
  };

  const getMetadata = (event: AppEvent) => {
    let raw = event.metadata || event.event_data || {};
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = {};
      }
    }
    return (raw && typeof raw === "object") ? raw : {};
  };

  const classifyCheckoutStatus = (userEvents: AppEvent[], checkoutEvent: AppEvent): CheckoutRow["status"] => {
    const checkoutTime = new Date(checkoutEvent.created_at).getTime();
    
    // 1. Procurar compra posterior ao checkout do mesmo usuário
    const hasPurchase = userEvents.some((e) => {
      const isPurchase = ["Purchase", "purchase_completed"].includes(getEventName(e));
      const isLater = new Date(e.created_at).getTime() > checkoutTime;
      return isPurchase && isLater;
    });

    if (hasPurchase) return "converted";

    // 2. Procurar falha técnica de faturamento posterior ao checkout
    const hasFailed = userEvents.some((e) => {
      const isFailed = ["Checkout_Failed", "checkout_failed"].includes(getEventName(e));
      const isLater = new Date(e.created_at).getTime() > checkoutTime;
      return isFailed && isLater;
    });

    if (hasFailed) return "checkout_failed";

    // 3. Janela de tempo de 1 hora
    const diffHours = (Date.now() - checkoutTime) / (1000 * 60 * 60);
    if (diffHours < 1.0) {
      return "recent";
    }

    // 4. Se passou de 1 hora e não comprou nem falhou
    return "abandoned";
  };

  // 4. Processamento dos Dados por Usuário e Classificação
  const checkoutRows = useMemo(() => {
    if (events.length === 0) return [];

    // Agrupar eventos por identificador único do usuário (user_id ou email ou anonymous_id)
    const eventsByUser = new Map<string, AppEvent[]>();
    events.forEach((event) => {
      const userId = event.user_id;
      const email = event.email || event.user_email;
      const anonId = event.anonymous_id || event.session_id;
      
      const key = userId || email?.toLowerCase() || anonId || event.id;
      
      const current = eventsByUser.get(key) || [];
      current.push(event);
      eventsByUser.set(key, current);
    });

    const rows: CheckoutRow[] = [];

    eventsByUser.forEach((userEvents, userKey) => {
      // Ordenar eventos cronologicamente crescente
      const sorted = [...userEvents].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      // Encontrar todos os eventos de checkout iniciado
      const checkouts = sorted.filter((e) =>
        ["InitiateCheckout", "Checkout_Started", "checkout_started"].includes(getEventName(e))
      );

      if (checkouts.length === 0) return;

      // Pegar o checkout iniciado mais recente
      const lastCheckout = checkouts[checkouts.length - 1];
      const checkoutTime = new Date(lastCheckout.created_at).getTime();

      // Computar métricas de comportamento ANTES deste checkout
      const eventsBefore = sorted.filter(
        (e) => new Date(e.created_at).getTime() <= checkoutTime
      );

      const searchesCount = eventsBefore.filter((e) =>
        ["Search_Completed", "search_completed", "first_search_completed"].includes(getEventName(e))
      ).length;

      const aiSuccessCount = eventsBefore.filter((e) =>
        ["AI_Analysis_Completed", "ai_analysis_completed", "First_AI_Analysis_Completed"].includes(getEventName(e))
      ).length;

      const aiFailedCount = eventsBefore.filter((e) =>
        ["AI_Analysis_Failed", "ai_analysis_failed"].includes(getEventName(e))
      ).length;

      const upgradeClicksCount = eventsBefore.filter((e) =>
        ["Upgrade_Click", "upgrade_clicked", "Upgrade_Click_Before_AI", "Upgrade_Click_After_AI", "Upgrade_Click_After_Limit"].includes(getEventName(e))
      ).length;

      // Status do checkout
      const status = classifyCheckoutStatus(sorted, lastCheckout);

      // Detalhes do faturamento / plano
      const meta = getMetadata(lastCheckout);
      
      // Tentar enriquecer via tabela de usuários do Supabase
      const matchedUser = (lastCheckout.user_id && usersById.get(lastCheckout.user_id)) || 
                          (lastCheckout.email && usersByEmail.get(lastCheckout.email.toLowerCase())) ||
                          (lastCheckout.user_email && usersByEmail.get(lastCheckout.user_email.toLowerCase()));

      const planId = String(meta.plan_id || matchedUser?.plan_name || "não informado").toLowerCase();
      const planName = meta.plan_name || matchedUser?.plan_name || "não informado";
      const value = Number(meta.value || (planId === "starter" ? 47 : planId === "pro" ? 97 : planId === "agency" || planId === "agencia" ? 247 : 0));
      const currency = meta.currency || "BRL";

      // UTMs e Criativos
      const utmCampaign = lastCheckout.utm_campaign || meta.utm_campaign || "sem_utm_campaign";
      const utmContent = lastCheckout.utm_content || meta.utm_content || "sem_utm_content";
      const creativeName = lastCheckout.utm_content ? normalizeCreativeName(lastCheckout.utm_content) : "sem_utm_content";
      
      const emailVal = matchedUser?.email || lastCheckout.email || lastCheckout.user_email || "não informado";
      const eventSource = lastCheckout.event_source_type || (lastCheckout.is_internal_event ? "internal_test" : "unknown");

      // Diagnóstico Automático (badges)
      const diagnostics: string[] = [];
      if (status === "abandoned") diagnostics.push("Checkout abandonado");
      if (status === "checkout_failed") diagnostics.push("Checkout falhou");
      if (status === "recent") diagnostics.push("Checkout recente aguardando");

      if (aiFailedCount > 3 || (aiFailedCount > 0 && aiFailedCount >= aiSuccessCount)) {
        diagnostics.push("Alta falha de IA antes");
      }
      
      if (upgradeClicksCount >= 3 || (checkouts.length >= 1 && aiSuccessCount >= 1)) {
        diagnostics.push("Alta intenção");
      }

      const hasFailedEvent = sorted.some((e) => 
        new Date(e.created_at).getTime() > checkoutTime && 
        ["Checkout_Failed", "checkout_failed"].includes(getEventName(e))
      );
      if (hasFailedEvent) {
        diagnostics.push("Possível fricção no Stripe");
      }

      if (aiSuccessCount === 0) {
        diagnostics.push("Chegou ao checkout sem usar IA");
      } else {
        diagnostics.push("Usou IA antes do checkout");
      }

      if (planId === "starter") diagnostics.push("Plano Starter");
      if (planId === "pro") diagnostics.push("Plano Pro");
      if (planId === "agency" || planId === "agencia") diagnostics.push("Plano Agency");
      if (planId === "não informado" || !meta.plan_id) diagnostics.push("Sem plano informado");

      // Prioridade de Ação
      const priorities: CheckoutRow["priorities"] = [];

      // Técnica: Falha crítica ou erro técnico
      const hasAiFailuresCrit = aiFailedCount > 3;
      if (hasAiFailuresCrit || hasFailedEvent) {
        priorities.push("técnica");
      }

      // Crítica: Abandonou, alta intenção e sem compra
      if (status === "abandoned" && upgradeClicksCount >= 3 && aiSuccessCount >= 3) {
        priorities.push("crítica");
      }

      // Alta: Abandonou, vindo de tráfego pago, AHA moment
      const isPaid = eventSource === "paid";
      if (status === "abandoned" && isPaid && (aiSuccessCount >= 1 || upgradeClicksCount >= 1)) {
        priorities.push("alta");
      }

      // Normal: Casos padrão
      if (priorities.length === 0) {
        priorities.push("normal");
      }

      rows.push({
        key: userKey,
        email: emailVal,
        userId: lastCheckout.user_id,
        sessionId: lastCheckout.session_id,
        planId,
        planName,
        value,
        currency,
        eventSource,
        utmCampaign,
        utmContent,
        creativeName,
        searchesCount,
        aiSuccessCount,
        aiFailedCount,
        upgradeClicksCount,
        checkoutDate: lastCheckout.created_at,
        status,
        diagnostics,
        priorities,
        hasPurchaseAfter: sorted.some(e => new Date(e.created_at).getTime() > checkoutTime && ["Purchase", "purchase_completed"].includes(getEventName(e))),
        hasCheckoutFailedAfter: hasFailedEvent,
        rawCheckoutEvent: lastCheckout,
      });
    });

    return rows;
  }, [events, usersByEmail, usersById]);

  // 5. Filtros aplicados aos Checkouts processados
  const filteredCheckoutRows = useMemo(() => {
    return checkoutRows.filter((row) => {
      // Filtro de usuários reais / internos
      if (realUsersFilter && row.rawCheckoutEvent.is_internal_event) return false;

      // Filtro de status
      if (statusFilter === "abandoned_error") {
        if (row.status !== "abandoned" && row.status !== "checkout_failed") return false;
      } else if (statusFilter !== "all" && row.status !== statusFilter) {
        return false;
      }

      // Filtro de plano
      if (planFilter !== "all") {
        if (planFilter === "Starter" && row.planId !== "starter") return false;
        if (planFilter === "Pro" && row.planId !== "pro") return false;
        if (planFilter === "Agency" && row.planId !== "agency" && row.planId !== "agencia") return false;
        if (planFilter === "não_informado" && row.planId !== "não informado") return false;
      }

      // Filtro de origem
      if (sourceFilter !== "all" && row.eventSource !== sourceFilter) return false;

      // Filtro de prioridade
      if (priorityFilter !== "all") {
        if (!row.priorities.includes(priorityFilter as any)) return false;
      }

      // Filtro de falhas de IA
      if (aiFailedFilter !== "all") {
        if (aiFailedFilter === "com_falhas" && row.aiFailedCount === 0) return false;
        if (aiFailedFilter === "falhas_criticas" && row.aiFailedCount <= 3) return false;
        if (aiFailedFilter === "sem_falhas" && row.aiFailedCount > 0) return false;
      }

      // Busca por texto
      const search = searchTerm.trim().toLowerCase();
      if (search) {
        const matches = 
          row.email.toLowerCase().includes(search) ||
          (row.userId && row.userId.toLowerCase().includes(search)) ||
          row.planName.toLowerCase().includes(search) ||
          row.eventSource.toLowerCase().includes(search) ||
          row.diagnostics.some(d => d.toLowerCase().includes(search));
        
        if (!matches) return false;
      }

      // UTM Campaign busca
      const camp = utmCampaignTerm.trim().toLowerCase();
      if (camp && !row.utmCampaign.toLowerCase().includes(camp)) return false;

      // UTM Content busca
      const content = utmContentTerm.trim().toLowerCase();
      if (content && !row.utmContent.toLowerCase().includes(content) && !row.creativeName.toLowerCase().includes(content)) return false;

      return true;
    });
  }, [
    checkoutRows, realUsersFilter, statusFilter, planFilter, sourceFilter, 
    priorityFilter, aiFailedFilter, searchTerm, utmCampaignTerm, utmContentTerm
  ]);

  // 6. Estatísticas Executivas (Cards do Topo)
  const stats = useMemo(() => {
    // Calculados sobre o conjunto total (excluindo apenas os internos de acordo com o filtro)
    const baseRows = checkoutRows.filter((r) => !realUsersFilter || !r.rawCheckoutEvent.is_internal_event);
    
    const totalCheckouts = baseRows.length;
    const abandonados = baseRows.filter(r => r.status === "abandoned").length;
    const falhas = baseRows.filter(r => r.status === "checkout_failed").length;
    const convertidos = baseRows.filter(r => r.status === "converted").length;
    const taxaAbandono = totalCheckouts ? Math.round(((abandonados + falhas) / totalCheckouts) * 100) : 0;

    // Plano mais abandonado
    const planoCount = new Map<string, number>();
    baseRows.filter(r => r.status === "abandoned" || r.status === "checkout_failed").forEach(r => {
      const p = r.planName === "não informado" ? "Não Informado" : r.planName;
      planoCount.set(p, (planoCount.get(p) || 0) + 1);
    });
    let planoMaisAbandonado = "Nenhum";
    let maxPlanoVal = 0;
    planoCount.forEach((v, k) => {
      if (v > maxPlanoVal) {
        maxPlanoVal = v;
        planoMaisAbandonado = k;
      }
    });

    // Criativo mais associado
    const creativeCount = new Map<string, number>();
    baseRows.filter(r => r.status === "abandoned" || r.status === "checkout_failed").forEach(r => {
      const c = r.creativeName === "sem_utm_content" ? "Sem Criativo" : r.creativeName;
      creativeCount.set(c, (creativeCount.get(c) || 0) + 1);
    });
    let creativeMaisAbandonado = "Nenhum";
    let maxCreativeVal = 0;
    creativeCount.forEach((v, k) => {
      if (v > maxCreativeVal) {
        maxCreativeVal = v;
        creativeMaisAbandonado = k;
      }
    });

    const altaFalhaIAUsers = baseRows.filter(r => r.aiFailedCount > 3).length;
    const prioridadeCriticaCount = baseRows.filter(r => r.priorities.includes("crítica")).length;

    return {
      totalCheckouts,
      abandonados,
      falhas,
      convertidos,
      taxaAbandono,
      planoMaisAbandonado,
      creativeMaisAbandonado,
      altaFalhaIAUsers,
      prioridadeCriticaCount
    };
  }, [checkoutRows, realUsersFilter]);

  // 7. Comparação por Plano
  const planosComparison = useMemo(() => {
    const baseRows = checkoutRows.filter((r) => !realUsersFilter || !r.rawCheckoutEvent.is_internal_event);
    const planos = ["starter", "pro", "agency", "não informado"];
    
    return planos.map(p => {
      const label = p === "starter" ? "Starter" : p === "pro" ? "Pro" : p === "agency" ? "Agency" : "Não Informado";
      const rows = baseRows.filter(r => r.planId === p || (p === "agency" && r.planId === "agencia"));
      const checkouts = rows.length;
      const abandonados = rows.filter(r => r.status === "abandoned").length;
      const falhas = rows.filter(r => r.status === "checkout_failed").length;
      const compras = rows.filter(r => r.status === "converted").length;
      const taxa = checkouts ? Math.round(((abandonados + falhas) / checkouts) * 100) : 0;

      return {
        plano: label,
        checkouts,
        abandonados,
        falhas,
        compras,
        taxaAbandono: `${taxa}%`
      };
    });
  }, [checkoutRows, realUsersFilter]);

  // 8. Comparação por Criativo (Top 5)
  const creativesComparison = useMemo(() => {
    const baseRows = checkoutRows.filter((r) => !realUsersFilter || !r.rawCheckoutEvent.is_internal_event);
    const grouped = new Map<string, typeof baseRows>();
    
    baseRows.forEach(r => {
      const key = r.creativeName;
      const current = grouped.get(key) || [];
      current.push(r);
      grouped.set(key, current);
    });

    return Array.from(grouped.entries()).map(([creative, list]) => {
      const checkouts = list.length;
      const abandonados = list.filter(r => r.status === "abandoned" || r.status === "checkout_failed").length;
      const compras = list.filter(r => r.status === "converted").length;
      const totalIaSucesso = list.reduce((acc, r) => acc + r.aiSuccessCount, 0);
      const totalIaFalhas = list.reduce((acc, r) => acc + r.aiFailedCount, 0);
      
      const iaSucessoMedia = checkouts ? (totalIaSucesso / checkouts).toFixed(1) : "0";
      const iaFalhasMedia = checkouts ? (totalIaFalhas / checkouts).toFixed(1) : "0";
      const taxa = checkouts ? Math.round((abandonados / checkouts) * 100) : 0;

      // friendly label for creative name
      const friendlyName = CREATIVE_NAME_MAP[creative] || creative;

      return {
        creative: friendlyName === "sem_utm_content" ? "Sem Criativo / UTM" : friendlyName,
        checkouts,
        abandonados,
        compras,
        iaSucessoMedia,
        iaFalhasMedia,
        taxaAbandono: `${taxa}%`,
        abandonadosNum: abandonados
      };
    })
    .sort((a, b) => b.checkouts - a.checkouts)
    .slice(0, 5);
  }, [checkoutRows, realUsersFilter]);

  // 9. Comparação com Falhas de IA
  const checkoutsWithAiFailures = useMemo(() => {
    const baseRows = checkoutRows.filter((r) => !realUsersFilter || !r.rawCheckoutEvent.is_internal_event);
    const withFailures = baseRows.filter(r => r.aiFailedCount > 0);
    
    const critFailures = withFailures.filter(r => r.aiFailedCount > 3).length;
    const failuresMoreThanSuccess = withFailures.filter(r => r.aiFailedCount > r.aiSuccessCount).length;
    const totalFailures = withFailures.reduce((acc, r) => acc + r.aiFailedCount, 0);
    const meanFailures = withFailures.length ? (totalFailures / withFailures.length).toFixed(1) : "0";

    return {
      totalComFalha: withFailures.length,
      critFailures,
      failuresMoreThanSuccess,
      meanFailures
    };
  }, [checkoutRows, realUsersFilter]);

  // Formatar data local
  const formatDate = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  const getPriorityColor = (prio: CheckoutRow["priorities"][number]) => {
    switch (prio) {
      case "crítica":
        return "bg-red-500/10 text-red-400 border-red-500/30 font-bold";
      case "técnica":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
      case "alta":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  const getStatusColor = (status: CheckoutRow["status"]) => {
    switch (status) {
      case "converted":
        return "bg-emerald-500/10 text-[#10d98a] border-emerald-500/30";
      case "checkout_failed":
        return "bg-red-500/10 text-red-400 border-red-500/30";
      case "recent":
        return "bg-blue-500/10 text-blue-400 border-blue-500/30 animate-pulse";
      default:
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
  };

  const handleVerJornada = (row: CheckoutRow) => {
    // Redireciona para AdminRealtime com a sessão/email ativa
    const searchParam = row.sessionId || row.email || row.userId;
    if (searchParam) {
      navigate(`/admin/realtime?session_id=${searchParam}`);
    } else {
      toast({
        variant: "destructive",
        title: "Dados indisponíveis",
        description: "Não foi possível encontrar um identificador de sessão para este usuário."
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f0e] text-[#f4f4f5] font-sans antialiased">
      <AppHeader isAdmin={isAdmin} />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {loading ? (
          <AdminLoadingState message="Carregando checkouts abandonados..." />
        ) : error ? (
          <AdminErrorState
            title="Erro ao carregar checkouts abandonados"
            description="Não foi possível estabelecer conexão ou ler os logs de faturamento no Supabase. Verifique chaves ou políticas RLS."
            error={error}
            onRetry={loadEvents}
          />
        ) : events.length === 0 ? (
          <AdminEmptyState
            title="Nenhum checkout detectado"
            description="Não foram registrados checkouts iniciados na janela de tempo selecionada."
          />
        ) : (
          <>
            {/* Header e Ações Globais */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-[#1f2d29] pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
              <ShoppingCart className="h-8 w-8 text-[#10d98a]" />
              Checkouts Abandonados
            </h1>
            <p className="text-sm text-[#9ca3af] mt-1">
              Monitore, compare e audite usuários que iniciaram o faturamento mas não concluíram a compra.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={loadEvents}
              disabled={loading}
              className="border-[#1f2d29] bg-[#111816] text-[#f4f4f5] hover:bg-[#1f2d29] hover:text-[#10d98a] gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-[#10d98a]" : ""}`} />
              Atualizar dados
            </Button>

            <Select value={range} onValueChange={(val: any) => setRange(val)}>
              <SelectTrigger className="w-[140px] bg-[#111816] border-[#1f2d29] text-[#f4f4f5]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent className="bg-[#111816] border-[#1f2d29] text-[#f4f4f5]">
                <SelectItem value="24h">Últimas 24h</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 1. Cards de KPIs de Topo */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="bg-[#111816] border-[#1f2d29]">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs text-[#9ca3af]">Checkouts Iniciados</CardDescription>
              <CardTitle className="text-2xl font-black text-slate-100">{stats.totalCheckouts}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[10px] text-[#9ca3af] flex items-center gap-1">
                <Clock className="h-3 w-3 text-[#10d98a]" /> No período selecionado
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#111816] border-[#1f2d29] border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs text-[#9ca3af]">Abandonados (Real)</CardDescription>
              <CardTitle className="text-2xl font-black text-amber-400">{stats.abandonados}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[10px] text-[#9ca3af]">Sem compra e sem falha</div>
            </CardContent>
          </Card>

          <Card className="bg-[#111816] border-[#1f2d29] border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs text-[#9ca3af]">Checkouts com Erro</CardDescription>
              <CardTitle className="text-2xl font-black text-red-400">{stats.falhas}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[10px] text-[#9ca3af]">Com erro/fricção Stripe</div>
            </CardContent>
          </Card>

          <Card className="bg-[#111816] border-[#1f2d29] border-l-4 border-l-[#10d98a]">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs text-[#9ca3af]">Convertidos (Pós-checkout)</CardDescription>
              <CardTitle className="text-2xl font-black text-[#10d98a]">{stats.convertidos}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[10px] text-[#9ca3af]">Finalizaram a assinatura</div>
            </CardContent>
          </Card>

          <Card className="bg-[#111816] border-[#1f2d29] bg-gradient-to-br from-[#111816] to-[#10d98a]/5">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs text-[#9ca3af]">Taxa de Abandono</CardDescription>
              <CardTitle className="text-3xl font-black text-amber-500">{stats.taxaAbandono}%</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[10px] text-[#9ca3af]">Média de desistência de funil</div>
            </CardContent>
          </Card>
        </div>

        {/* Destaques rápidos adicionais */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="bg-[#111816] border border-[#1f2d29] rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#9ca3af]">Plano mais Abandonado</p>
              <h4 className="text-sm font-bold text-slate-100 mt-1">{stats.planoMaisAbandonado}</h4>
            </div>
            <CreditCard className="h-8 w-8 text-amber-500 opacity-60" />
          </div>

          <div className="bg-[#111816] border border-[#1f2d29] rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#9ca3af]">Criativo mais Gargalo</p>
              <h4 className="text-sm font-bold text-slate-100 mt-1 truncate max-w-[160px]">{stats.creativeMaisAbandonado}</h4>
            </div>
            <Activity className="h-8 w-8 text-rose-500 opacity-60" />
          </div>

          <div className="bg-[#111816] border border-[#1f2d29] rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#9ca3af]">Muita Falha de IA antes</p>
              <h4 className="text-sm font-bold text-slate-100 mt-1">{stats.altaFalhaIAUsers} usuários</h4>
            </div>
            <Brain className="h-8 w-8 text-cyan-400 opacity-60" />
          </div>

          <div className="bg-[#111816] border border-[#1f2d29] rounded-lg p-4 flex items-center justify-between border-r-4 border-r-red-600">
            <div>
              <p className="text-xs text-[#9ca3af]">Prioridade Crítica</p>
              <h4 className="text-sm font-bold text-slate-100 mt-1">{stats.prioridadeCriticaCount} leads quentes</h4>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500 opacity-60 animate-pulse" />
          </div>
        </div>

        {/* 2. Filtros e Controles Avançados */}
        <Card className="bg-[#111816] border-[#1f2d29]">
          <CardHeader className="pb-3 border-b border-[#1f2d29] flex flex-row items-center gap-2">
            <Filter className="h-4 w-4 text-[#10d98a]" />
            <CardTitle className="text-sm font-bold">Filtros Avançados de Auditoria</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 grid gap-4 md:grid-cols-4">
            
            {/* Linha 1 de filtros */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-[#9ca3af]">Busca Geral (E-mail, ID, Plano)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9ca3af]" />
                <Input
                  placeholder="Pesquisar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 bg-[#0b0f0e] border-[#1f2d29] text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-[#9ca3af]">Status do Checkout</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-[#0b0f0e] border-[#1f2d29] text-xs h-9 text-[#f4f4f5]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111816] border-[#1f2d29] text-[#f4f4f5]">
                  <SelectItem value="abandoned_error">Abandonado / Erro (Padrão)</SelectItem>
                  <SelectItem value="abandoned">Somente Abandonados</SelectItem>
                  <SelectItem value="checkout_failed">Somente Erro de Faturamento</SelectItem>
                  <SelectItem value="recent">Somente Recentes (&lt; 1h)</SelectItem>
                  <SelectItem value="converted">Somente Convertidos</SelectItem>
                  <SelectItem value="all">Todos os Status</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-[#9ca3af]">Plano Selecionado</label>
              <Select value={planFilter} onValueChange={planFilter => setPlanFilter(planFilter)}>
                <SelectTrigger className="bg-[#0b0f0e] border-[#1f2d29] text-xs h-9 text-[#f4f4f5]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111816] border-[#1f2d29] text-[#f4f4f5]">
                  <SelectItem value="all">Todos os planos</SelectItem>
                  <SelectItem value="Starter">Starter (R$ 47)</SelectItem>
                  <SelectItem value="Pro">Pro (R$ 97)</SelectItem>
                  <SelectItem value="Agency">Agency (R$ 247)</SelectItem>
                  <SelectItem value="não_informado">Não informado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-[#9ca3af]">Origem do Tráfego</label>
              <Select value={sourceFilter} onValueChange={sourceFilter => setSourceFilter(sourceFilter)}>
                <SelectTrigger className="bg-[#0b0f0e] border-[#1f2d29] text-xs h-9 text-[#f4f4f5]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111816] border-[#1f2d29] text-[#f4f4f5]">
                  <SelectItem value="all">Todas as origens</SelectItem>
                  <SelectItem value="paid">paid (Tráfego Pago)</SelectItem>
                  <SelectItem value="organic">organic (Tráfego Orgânico)</SelectItem>
                  <SelectItem value="direct">direct (Direto)</SelectItem>
                  <SelectItem value="referral">referral (Indicações)</SelectItem>
                  <SelectItem value="internal_test">internal_test (Interno)</SelectItem>
                  <SelectItem value="unknown">unknown (Desconhecido)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Linha 2 de filtros */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-[#9ca3af]">UTM Campaign</label>
              <Input
                placeholder="Filtro de campanha..."
                value={utmCampaignTerm}
                onChange={(e) => setUtmCampaignTerm(e.target.value)}
                className="bg-[#0b0f0e] border-[#1f2d29] text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-[#9ca3af]">UTM Content / Criativo</label>
              <Input
                placeholder="Ex: quem_abordar..."
                value={utmContentTerm}
                onChange={(e) => setUtmContentTerm(e.target.value)}
                className="bg-[#0b0f0e] border-[#1f2d29] text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-[#9ca3af]">Prioridade de Ação</label>
              <Select value={priorityFilter} onValueChange={priorityFilter => setPriorityFilter(priorityFilter)}>
                <SelectTrigger className="bg-[#0b0f0e] border-[#1f2d29] text-xs h-9 text-[#f4f4f5]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111816] border-[#1f2d29] text-[#f4f4f5]">
                  <SelectItem value="all">Todas as prioridades</SelectItem>
                  <SelectItem value="crítica">Crítica</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="técnica">Técnica</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-[#9ca3af]">Falhas de IA antes</label>
              <Select value={aiFailedFilter} onValueChange={aiFailedFilter => setAiFailedFilter(aiFailedFilter)}>
                <SelectTrigger className="bg-[#0b0f0e] border-[#1f2d29] text-xs h-9 text-[#f4f4f5]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111816] border-[#1f2d29] text-[#f4f4f5]">
                  <SelectItem value="all">Qualquer comportamento</SelectItem>
                  <SelectItem value="com_falhas">Teve alguma falha (IA falha &gt; 0)</SelectItem>
                  <SelectItem value="falhas_criticas">Teve falhas críticas (IA falha &gt; 3)</SelectItem>
                  <SelectItem value="sem_falhas">Zero falhas de IA antes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-1 md:col-span-4 flex items-center justify-between border-t border-[#1f2d29] pt-4 mt-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="realUsersFilter"
                  checked={realUsersFilter}
                  onChange={(e) => setRealUsersFilter(e.target.checked)}
                  className="rounded bg-[#0b0f0e] border-[#1f2d29] text-[#10d98a] focus:ring-[#10d98a] h-4 w-4"
                />
                <label htmlFor="realUsersFilter" className="text-xs text-[#9ca3af] cursor-pointer">
                  Excluir eventos de testes internos / admins (`is_internal_event = true`)
                </label>
              </div>

              <div className="text-xs text-[#9ca3af]">
                Filtrados: <strong className="text-[#10d98a]">{filteredCheckoutRows.length}</strong> de <strong className="text-slate-200">{checkoutRows.length}</strong> checkouts totais
              </div>
            </div>

          </CardContent>
        </Card>

        {/* 3. Tabela Principal de Resultados */}
        <Card className="bg-[#111816] border-[#1f2d29] overflow-hidden">
          <CardHeader className="pb-2 border-b border-[#1f2d29]">
            <CardTitle className="text-base text-slate-100">Registros de Abandono</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#0b0f0e]/50 border-b border-[#1f2d29]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[#9ca3af] text-xs">Prioridade</TableHead>
                  <TableHead className="text-[#9ca3af] text-xs">Email / ID</TableHead>
                  <TableHead className="text-[#9ca3af] text-xs">Plano</TableHead>
                  <TableHead className="text-[#9ca3af] text-xs">Valor</TableHead>
                  <TableHead className="text-[#9ca3af] text-xs">Origem</TableHead>
                  <TableHead className="text-[#9ca3af] text-xs">Criativo</TableHead>
                  <TableHead className="text-[#9ca3af] text-xs text-center">Buscas / Upgrades</TableHead>
                  <TableHead className="text-[#9ca3af] text-xs text-center">IA (Sucesso/Falha)</TableHead>
                  <TableHead className="text-[#9ca3af] text-xs">Data do Checkout</TableHead>
                  <TableHead className="text-[#9ca3af] text-xs">Status</TableHead>
                  <TableHead className="text-[#9ca3af] text-xs">Diagnóstico Comportamental</TableHead>
                  <TableHead className="text-[#9ca3af] text-xs text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12 text-[#9ca3af]">
                      <RefreshCw className="h-6 w-6 animate-spin text-[#10d98a] mx-auto mb-2" />
                      Buscando e processando logs analíticos no Supabase...
                    </TableCell>
                  </TableRow>
                ) : filteredCheckoutRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12 text-[#9ca3af]">
                      Nenhum checkout abandonado corresponde aos filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCheckoutRows.map((row) => (
                    <TableRow key={row.key} className="border-b border-[#1f2d29]/50 hover:bg-[#1f2d29]/20 transition-colors">
                      {/* Prioridade */}
                      <TableCell className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {row.priorities.map((prio) => (
                            <Badge key={prio} className={`capitalize border text-[9px] px-1.5 py-0 ${getPriorityColor(prio)}`}>
                              {prio}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>

                      {/* Email */}
                      <TableCell className="py-3 font-medium max-w-[180px] truncate text-slate-100" title={row.email}>
                        {row.email}
                      </TableCell>

                      {/* Plano Escolhido */}
                      <TableCell className="py-3 text-xs capitalize text-slate-200">
                        {row.planName === "não informado" ? (
                          <span className="text-[#9ca3af]">Não informado</span>
                        ) : (
                          row.planName
                        )}
                      </TableCell>

                      {/* Valor */}
                      <TableCell className="py-3 text-xs font-semibold text-slate-200">
                        {row.planId === "não informado" ? (
                          <span className="text-[#9ca3af] font-normal">Não inf.</span>
                        ) : (
                          `R$ ${row.value}/mês`
                        )}
                      </TableCell>

                      {/* Origem */}
                      <TableCell className="py-3 text-xs">
                        <Badge variant="outline" className={`text-[10px] border-[#1f2d29] ${
                          row.eventSource === "paid" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "text-[#9ca3af]"
                        }`}>
                          {row.eventSource}
                        </Badge>
                      </TableCell>

                      {/* Criativo */}
                      <TableCell className="py-3 text-xs max-w-[120px] truncate text-[#9ca3af]" title={`Campanha: ${row.utmCampaign} | Criativo: ${row.utmContent}`}>
                        {row.creativeName === "sem_utm_content" ? (
                          <span className="text-slate-600 italic">Sem criativo</span>
                        ) : (
                          <span className="text-slate-300 font-medium">{row.creativeName}</span>
                        )}
                      </TableCell>

                      {/* Buscas / Upgrades */}
                      <TableCell className="py-3 text-xs text-center text-slate-300">
                        <span>{row.searchesCount}</span>
                        <span className="text-slate-600 mx-1">/</span>
                        <span className={row.upgradeClicksCount >= 3 ? "text-amber-400 font-bold" : ""}>
                          {row.upgradeClicksCount}
                        </span>
                      </TableCell>

                      {/* IA Sucessos / Falhas */}
                      <TableCell className="py-3 text-xs text-center">
                        <span className="text-emerald-400 font-medium">{row.aiSuccessCount}</span>
                        <span className="text-slate-600 mx-1">/</span>
                        <span className={row.aiFailedCount > 3 ? "text-red-400 font-bold animate-pulse" : row.aiFailedCount > 0 ? "text-red-300" : "text-slate-500"}>
                          {row.aiFailedCount}
                        </span>
                      </TableCell>

                      {/* Data do checkout */}
                      <TableCell className="py-3 text-xs text-[#9ca3af]">
                        {formatDate(row.checkoutDate)}
                      </TableCell>

                      {/* Status do checkout */}
                      <TableCell className="py-3">
                        <Badge variant="outline" className={`text-[10px] capitalize font-medium ${getStatusColor(row.status)}`}>
                          {row.status === "checkout_failed" ? "Erro faturamento" : row.status}
                        </Badge>
                      </TableCell>

                      {/* Diagnóstico Comportamental */}
                      <TableCell className="py-3">
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {row.diagnostics.slice(0, 3).map((diag, index) => {
                            const isTechnical = diag.includes("falha") || diag.includes("erro") || diag.includes("Stripe");
                            const isHighIntent = diag.includes("intenção") || diag.includes("Usou");
                            return (
                              <Badge
                                key={index}
                                variant="outline"
                                className={`text-[9px] px-1 py-0.2 border border-slate-700 ${
                                  isTechnical ? "bg-red-500/5 text-red-300 border-red-500/10" :
                                  isHighIntent ? "bg-violet-500/5 text-violet-300 border-violet-500/10" : 
                                  "bg-slate-800 text-slate-400"
                                }`}
                              >
                                {diag}
                              </Badge>
                            );
                          })}
                          {row.diagnostics.length > 3 && (
                            <span className="text-[10px] text-slate-500 font-bold">+{row.diagnostics.length - 3}</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Botão Ver Jornada */}
                      <TableCell className="py-3 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleVerJornada(row)}
                          className="bg-[#1f2d29] text-[#10d98a] border border-[#10d98a]/20 hover:bg-[#10d98a] hover:text-[#0b0f0e] text-[11px] h-7 gap-1 font-bold rounded"
                        >
                          Ver Jornada
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* 4. Paineis Comparativos de Apoio (Fase 4: Estilo) */}
        <div className="grid gap-6 md:grid-cols-3">
          
          {/* A. Abandono por Plano */}
          <Card className="bg-[#111816] border-[#1f2d29]">
            <CardHeader className="pb-3 border-b border-[#1f2d29]">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-[#10d98a]" />
                Abandono por Plano
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-0">
              <Table>
                <TableHeader className="bg-[#0b0f0e]/30 border-b border-[#1f2d29]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[11px] text-[#9ca3af] py-2">Plano</TableHead>
                    <TableHead className="text-[11px] text-[#9ca3af] py-2 text-center">Checkouts</TableHead>
                    <TableHead className="text-[11px] text-[#9ca3af] py-2 text-center">Abandonos</TableHead>
                    <TableHead className="text-[11px] text-[#9ca3af] py-2 text-center">Taxa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planosComparison.map((row) => (
                    <TableRow key={row.plano} className="border-b border-[#1f2d29]/40 hover:bg-[#1f2d29]/10">
                      <TableCell className="text-xs font-medium py-2.5 px-4 text-slate-300">{row.plano}</TableCell>
                      <TableCell className="text-xs text-center py-2.5 text-slate-300">{row.checkouts}</TableCell>
                      <TableCell className="text-xs text-center py-2.5 text-slate-300">
                        {row.abandonados + row.falhas}
                      </TableCell>
                      <TableCell className="text-xs text-center py-2.5 font-bold text-amber-500">{row.taxaAbandono}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* B. Abandono por Criativo */}
          <Card className="bg-[#111816] border-[#1f2d29] md:col-span-2">
            <CardHeader className="pb-3 border-b border-[#1f2d29]">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 text-[#10d98a]" />
                Abandono por Criativo (Top 5 Volumetria)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-0">
              <Table>
                <TableHeader className="bg-[#0b0f0e]/30 border-b border-[#1f2d29]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[11px] text-[#9ca3af] py-2">Criativo / Conteúdo</TableHead>
                    <TableHead className="text-[11px] text-[#9ca3af] py-2 text-center">Checkouts</TableHead>
                    <TableHead className="text-[11px] text-[#9ca3af] py-2 text-center">Abandonos</TableHead>
                    <TableHead className="text-[11px] text-[#9ca3af] py-2 text-center">Compras</TableHead>
                    <TableHead className="text-[11px] text-[#9ca3af] py-2 text-center">IA Média (Sucesso/Falha)</TableHead>
                    <TableHead className="text-[11px] text-[#9ca3af] py-2 text-center">Taxa Desistência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creativesComparison.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-xs text-[#9ca3af]">
                        Sem campanhas/criativos registrados no período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    creativesComparison.map((row, index) => (
                      <TableRow key={index} className="border-b border-[#1f2d29]/40 hover:bg-[#1f2d29]/10">
                        <TableCell className="text-xs font-semibold py-2.5 px-4 text-slate-300 max-w-[200px] truncate" title={row.creative}>
                          {row.creative}
                        </TableCell>
                        <TableCell className="text-xs text-center py-2.5 text-slate-300">{row.checkouts}</TableCell>
                        <TableCell className="text-xs text-center py-2.5 text-slate-300">{row.abandonados}</TableCell>
                        <TableCell className="text-xs text-center py-2.5 text-emerald-400 font-medium">{row.compras}</TableCell>
                        <TableCell className="text-xs text-center py-2.5 text-slate-400">
                          {row.iaSucessoMedia} <span className="text-slate-600">/</span> <span className={Number(row.iaFalhasMedia) > 1 ? "text-red-400" : ""}>{row.iaFalhasMedia}</span>
                        </TableCell>
                        <TableCell className="text-xs text-center py-2.5 font-bold text-amber-500">{row.taxaAbandono}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

        </div>

        {/* 5. Comparativo Técnico de Falhas de IA */}
        <Card className="bg-[#111816] border-[#1f2d29]">
          <CardHeader className="pb-3 border-b border-[#1f2d29]">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <Brain className="h-4 w-4 text-cyan-400" />
              Auditoria de Impacto de IA antes do Checkout
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 grid gap-6 md:grid-cols-4">
            
            <div className="bg-[#0b0f0e]/50 border border-[#1f2d29] rounded p-4 text-center">
              <p className="text-xs text-[#9ca3af]">Checkouts com Falhas de IA</p>
              <h4 className="text-2xl font-black text-slate-200 mt-1">{checkoutsWithAiFailures.totalComFalha}</h4>
              <p className="text-[10px] text-[#9ca3af] mt-1">Usuários com erro de IA antes de faturar</p>
            </div>

            <div className="bg-[#0b0f0e]/50 border border-[#1f2d29] rounded p-4 text-center">
              <p className="text-xs text-[#9ca3af]">Média de Falhas por Usuário</p>
              <h4 className="text-2xl font-black text-rose-400 mt-1">{checkoutsWithAiFailures.meanFailures}</h4>
              <p className="text-[10px] text-[#9ca3af] mt-1">Erros de IA por usuário afetado</p>
            </div>

            <div className="bg-[#0b0f0e]/50 border border-[#1f2d29] rounded p-4 text-center">
              <p className="text-xs text-[#9ca3af]">Usuários com &gt; 3 Falhas Críticas</p>
              <h4 className="text-2xl font-black text-red-500 mt-1">{checkoutsWithAiFailures.critFailures}</h4>
              <p className="text-[10px] text-[#9ca3af] mt-1">Bloqueios técnicos sucessivos</p>
            </div>

            <div className="bg-[#0b0f0e]/50 border border-[#1f2d29] rounded p-4 text-center">
              <p className="text-xs text-[#9ca3af]">Erros de IA &gt; Sucessos de IA</p>
              <h4 className="text-2xl font-black text-amber-500 mt-1">{checkoutsWithAiFailures.failuresMoreThanSuccess}</h4>
              <p className="text-[10px] text-[#9ca3af] mt-1">Abalou confiança antes do pagamento</p>
            </div>

            <div className="col-span-1 md:col-span-4 rounded border border-cyan-500/10 bg-cyan-500/5 p-4 text-xs text-[#9ca3af] leading-relaxed flex gap-2">
              <HelpCircle className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-200">Como esse painel ajuda a decidir?</strong>
                <p className="mt-1">
                  Se a quantidade de <span className="text-red-400">"Usuários com falhas críticas"</span> ou <span className="text-amber-400">"Erros de IA &gt; Sucessos"</span> for elevada (acima de 25% dos checkouts totais), há um forte indício de que o abandono de faturamento está sendo gerado por instabilidades técnicas da IA do Zuno (Edge Functions, Gemini API, timeouts). Caso o índice de falha seja baixo e o usuário possua alta intenção (cliques em upgrade e AHA moment), a causa raiz do abandono reside em <span className="text-[#10d98a]">objeção comercial / preço do plano</span> ou fricção no próprio fluxo Stripe.
                </p>
              </div>
            </div>

          </CardContent>
        </Card>
          </>
        )}
      </main>
    </div>
  );
}
