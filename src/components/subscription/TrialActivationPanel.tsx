import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Search, Target, CalendarDays, Building2, BookmarkCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { SubscriptionInfo } from "@/hooks/useSubscription";
import { trackEvent } from "@/lib/analytics";
import { formatTrialDate, trialDaysRemaining, trialDurationDays, trialPriceSummary } from "@/lib/trialActivation";

type TrialProgress = {
  completedSearches: number;
  returnedResults: number;
  savedLeads: number;
  exploredSegments: number;
};

const EMPTY_PROGRESS: TrialProgress = {
  completedSearches: 0,
  returnedResults: 0,
  savedLeads: 0,
  exploredSegments: 0,
};

export function TrialActivationPanel({ subscription }: { subscription: SubscriptionInfo | null }) {
  const { user } = useAuth();
  const [progress, setProgress] = useState<TrialProgress>(EMPTY_PROGRESS);
  const isTrialing = subscription?.subscription_status === "trialing";
  const price = useMemo(
    () => trialPriceSummary(subscription?.plan_name, subscription?.billing_cycle),
    [subscription?.plan_name, subscription?.billing_cycle],
  );
  const daysRemaining = trialDaysRemaining(subscription?.trial_end);
  const actualTrialDuration = trialDurationDays(subscription?.trial_start, subscription?.trial_end);
  const chargeDate = subscription?.trial_end ? formatTrialDate(subscription.trial_end) : "—";

  useEffect(() => {
    if (!user?.id || !isTrialing) return;

    void trackEvent("onboarding_started", { source: "trial_activation_panel" });
    void trackEvent("returned_during_trial", { source: "trial_activation_panel" });

    let cancelled = false;

    const loadProgress = async () => {
      const trialStart = subscription.trial_start || new Date(0).toISOString();
      const [searchesResponse, savedResponse] = await Promise.all([
        supabase
          .from("search_logs")
          .select("returned_quantity,niche")
          .eq("user_id", user.id)
          .eq("status", "success")
          .gte("created_at", trialStart),
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("salvo", true)
          .gte("created_at", trialStart),
      ]);

      if (cancelled) return;

      const searches = searchesResponse.data ?? [];
      const niches = new Set(
        searches
          .map((item) => String(item.niche || "").trim().toLowerCase())
          .filter(Boolean),
      );

      setProgress({
        completedSearches: searches.length,
        returnedResults: searches.reduce((total, item) => total + Number(item.returned_quantity || 0), 0),
        savedLeads: savedResponse.count ?? 0,
        exploredSegments: niches.size,
      });
    };

    void loadProgress();
    const refresh = () => void loadProgress();
    window.addEventListener("searchFinished", refresh);
    window.addEventListener("zuno:first-value-reached", refresh);

    return () => {
      cancelled = true;
      window.removeEventListener("searchFinished", refresh);
      window.removeEventListener("zuno:first-value-reached", refresh);
    };
  }, [isTrialing, subscription.trial_start, user?.id]);

  if (!isTrialing || !subscription) return null;

  const hasResults = progress.returnedResults > 0;
  const nearTrialEnd = daysRemaining !== null && daysRemaining <= 2;

  return (
    <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-background to-background">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-500">
              Teste grátis ativo
            </Badge>
            <CardTitle className="mt-3 text-xl">
              {hasResults ? "Você já começou a gerar oportunidades reais" : "Chegue ao primeiro valor em uma busca"}
            </CardTitle>
          </div>
          {daysRemaining !== null ? (
            <span className="text-sm font-medium text-muted-foreground">
              {daysRemaining} {daysRemaining === 1 ? "dia restante" : "dias restantes"}
            </span>
          ) : null}
        </div>

        <div className="rounded-lg border border-border/60 bg-background/70 p-3 text-sm leading-6 text-muted-foreground">
          <strong className="text-foreground">Transparência do trial:</strong>{" "}
          seu trial atual tem <strong className="text-foreground">{actualTrialDuration ?? "—"} dias</strong> com cartão cadastrado. A primeira cobrança está prevista para{" "}
          <strong className="text-foreground">{chargeDate}</strong>
          {price ? (
            <>
              {" "}no valor de <strong className="text-foreground">R$ {price.price}{price.periodLabel}</strong>
            </>
          ) : null}
          . Você pode cancelar antes dessa data em{" "}
          <Link to="/profile" className="font-medium text-emerald-500 hover:underline">
            Perfil → Plano e assinatura
          </Link>.
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-5">
          {[
            ["1", "Seu foco", "Escolha o serviço/foco comercial que você vende."],
            ["2", "Empresa ideal", "Informe o nicho que você quer encontrar."],
            ["3", "Região", "Defina cidade e estado."],
            ["4", "Buscar", "Execute uma prospecção real."],
            ["5", "Ver oportunidade", "Abra “Ver Plano” em um resultado real."],
          ].map(([number, title, description]) => (
            <div key={number} className="rounded-lg border border-border/60 bg-background/60 p-3">
              <span className="text-xs font-semibold text-emerald-500">{number}</span>
              <p className="mt-1 text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border/60 p-3">
            <Search className="h-4 w-4 text-emerald-500" />
            <p className="mt-2 text-xl font-semibold">{progress.completedSearches}</p>
            <p className="text-xs text-muted-foreground">buscas concluídas</p>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <Building2 className="h-4 w-4 text-emerald-500" />
            <p className="mt-2 text-xl font-semibold">{progress.returnedResults}</p>
            <p className="text-xs text-muted-foreground">resultados reais no trial</p>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <BookmarkCheck className="h-4 w-4 text-emerald-500" />
            <p className="mt-2 text-xl font-semibold">{progress.savedLeads}</p>
            <p className="text-xs text-muted-foreground">oportunidades salvas</p>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <Target className="h-4 w-4 text-emerald-500" />
            <p className="mt-2 text-xl font-semibold">{progress.exploredSegments}</p>
            <p className="text-xs text-muted-foreground">segmentos explorados</p>
          </div>
        </div>

        {hasResults ? (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <p className="text-sm leading-6 text-muted-foreground">
              Esses números vêm das suas buscas reais desde o início do trial. Abra <strong className="text-foreground">Ver Plano</strong> em uma empresa para avaliar a oportunidade com seus próprios olhos — esse é o marco de primeiro valor do Zuno.
            </p>
          </div>
        ) : (
          <Button
            type="button"
            className="gap-2"
            onClick={() => document.getElementById("primeira-busca")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <Search className="h-4 w-4" />
            Fazer minha primeira busca
          </Button>
        )}

        {nearTrialEnd ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <p className="text-sm leading-6 text-muted-foreground">
              Seu teste está perto do fim. Até aqui o Zuno retornou <strong className="text-foreground">{progress.returnedResults}</strong> resultados em <strong className="text-foreground">{progress.completedSearches}</strong> buscas. A cobrança continua prevista para <strong className="text-foreground">{chargeDate}</strong>; o cancelamento segue disponível no perfil.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
