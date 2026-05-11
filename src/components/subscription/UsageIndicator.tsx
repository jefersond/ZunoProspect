import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useSubscription } from "@/hooks/useSubscription";
import { AlertTriangle, Brain, Infinity, Search, Shield } from "lucide-react";

interface UsageIndicatorProps {
  compact?: boolean;
}

function formatAvailable(count: number, singular: string, plural: string) {
  if (count <= 0) return `Nenhum ${singular} disponivel`;
  return `${count} ${count === 1 ? singular : plural} disponiveis`;
}

export const UsageIndicator = ({ compact = false }: UsageIndicatorProps) => {
  const { subscription, loading, isAdmin, getUsagePercentage } = useSubscription();

  if (loading || !subscription) {
    return null;
  }

  const isUnlimited = subscription.leads_limit === -1 || isAdmin;
  const percentage = getUsagePercentage();
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;
  const bonusSaldo = Math.max(0, subscription.leads_bonus_balance ?? 0);
  const remainingLeads = Math.max(0, subscription.leads_available_total ?? subscription.leads_remaining ?? 0);
  const aiLimit = Math.max(0, subscription.ai_limit ?? 3);
  const aiUsed = Math.max(0, subscription.ai_used ?? 0);
  const aiRemaining = Math.max(
    0,
    subscription.ai_available_total ?? subscription.ai_remaining ?? aiLimit - aiUsed,
  );

  if (compact) {
    if (isAdmin) {
      return (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="default" className="gap-1 bg-amber-500 hover:bg-amber-600">
            <Shield className="h-3 w-3" />
            Leads e IA ilimitados
          </Badge>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge
          variant={isAtLimit ? "destructive" : isNearLimit ? "outline" : "secondary"}
          className="gap-1"
        >
          {isUnlimited ? <Infinity className="h-3 w-3" /> : <Search className="h-3 w-3" />}
          {isUnlimited ? "Leads ilimitados" : formatAvailable(remainingLeads, "lead", "leads")}
        </Badge>

        <Badge variant={aiRemaining <= 0 ? "destructive" : "secondary"} className="gap-1">
          <Brain className="h-3 w-3" />
          {formatAvailable(aiRemaining, "analise IA", "analises IA")}
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Leads usados este mes</span>
          <span className="font-medium">
            {isUnlimited ? (
              <span className="flex items-center gap-1">
                {subscription.leads_used} <Infinity className="h-4 w-4" />
              </span>
            ) : (
              `${subscription.leads_used} / ${subscription.leads_limit}`
            )}
          </span>
        </div>

        {!isUnlimited && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Leads disponiveis</span>
            <span className="font-medium">{remainingLeads}</span>
          </div>
        )}

        {!isUnlimited && bonusSaldo > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Extras por indicacao convertida</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">{bonusSaldo}</span>
          </div>
        )}

        {!isUnlimited && (
          <Progress
            value={percentage}
            className={`h-2 ${isAtLimit ? "[&>div]:bg-destructive" : isNearLimit ? "[&>div]:bg-yellow-500" : ""}`}
          />
        )}
      </div>

      {!isAdmin && (
        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Analises IA usadas este mes</span>
            <span className="font-medium">
              {aiUsed} / {aiLimit}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Analises IA disponiveis</span>
            <span className="font-medium">{aiRemaining}</span>
          </div>

          <Progress value={aiLimit > 0 ? Math.min(100, Math.round((aiUsed / aiLimit) * 100)) : 0} className="h-2" />
        </div>
      )}

      {isAtLimit && !isUnlimited && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>Limite de leads atingido. Faca upgrade para continuar.</span>
        </div>
      )}

      {isNearLimit && !isAtLimit && !isUnlimited && (
        <p className="text-xs text-muted-foreground">Voce usou {percentage}% do seu limite mensal de leads.</p>
      )}

      {isAdmin && (
        <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <Shield className="h-3 w-3" />
          Acesso administrativo com leads e IA ilimitados
        </p>
      )}
    </div>
  );
};
