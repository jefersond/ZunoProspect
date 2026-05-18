import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Clock, CreditCard, Filter, MousePointerClick, Search, ShoppingCart, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/config/admin";
import { AppHeader } from "@/components/AppHeader";
import { normalizeCreativeName, CREATIVE_NAME_MAP } from "@/lib/creativeMap";
import { Badge } from "@/components/ui/badge";
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
  created_at: string;
};

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
  return event.email || event.anonymous_id || event.user_id || "anonimo";
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
  const [range, setRange] = useState<keyof typeof rangeHours>("24h");
  const [eventType, setEventType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [utmSource, setUtmSource] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmContent, setUtmContent] = useState("");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const sinceIso = useMemo(() => {
    const date = new Date();
    date.setHours(date.getHours() - rangeHours[range]);
    return date.toISOString();
  }, [range]);

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

    const loadEvents = async () => {
      setLoading(true);
      let query = (supabase as any)
        .from("app_events")
        .select("*")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(1000);

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
        setEvents((data || []) as AppEvent[]);
      }
      setLoading(false);
    };

    loadEvents();

    const channel = supabase
      .channel("admin-app-events")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "app_events" }, (payload) => {
        const event = payload.new as AppEvent;
        if (new Date(event.created_at).toISOString() < sinceIso) return;
        setEvents((current) => [event, ...current].slice(0, 1000));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventType, isAdmin, sinceIso, toast, utmCampaign, utmContent, utmSource]);

  const filteredEvents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return events;
    return events.filter((event) => {
      return [
        event.email,
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
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [events, searchTerm]);

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

  const selectedJourney = useMemo(() => {
    if (!selectedSession) return [];
    return events
      .filter((event) => event.session_id === selectedSession || event.anonymous_id === selectedSession)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [events, selectedSession]);

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
            <Input placeholder="Email, usuario, sessao ou evento" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
            <Input placeholder="UTM source" value={utmSource} onChange={(event) => setUtmSource(event.target.value)} />
            <Input placeholder="Campanha UTM" value={utmCampaign} onChange={(event) => setUtmCampaign(event.target.value)} />
            <Input placeholder="Criativo / utm_content" value={utmContent} onChange={(event) => setUtmContent(event.target.value)} />
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
                    <TableCell><Badge variant="secondary">{eventKey(event)}</Badge></TableCell>
                    <TableCell>
                      <button
                        className="max-w-[240px] truncate text-left text-primary underline-offset-4 hover:underline"
                        onClick={() => setSelectedSession(event.session_id || event.anonymous_id)}
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
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Jornada do visitante</SheetTitle>
            <SheetDescription>{selectedSession}</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {selectedJourney.map((event) => (
              <div key={event.id} className="rounded-lg border border-border/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <Badge>{eventKey(event)}</Badge>
                  <span className="text-xs text-muted-foreground">{formatTime(event.created_at)}</span>
                </div>
                <p className="mt-2 text-sm">{event.pathname || event.path || event.page_url || "-"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[event.utm_source, event.utm_campaign, normalizeCreativeName(event.utm_content)].filter(Boolean).join(" / ") || "sem UTM"}
                  {event.utm_content && event.utm_content !== normalizeCreativeName(event.utm_content) && (
                    <span className="block text-[10px] text-muted-foreground/70">Original: {event.utm_content}</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{eventDetails(event)}</p>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
