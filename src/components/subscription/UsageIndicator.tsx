import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/hooks/useSubscription";
import { Zap, Infinity, AlertTriangle, Shield } from "lucide-react";

interface UsageIndicatorProps {
  compact?: boolean;
}

export const UsageIndicator = ({ compact = false }: UsageIndicatorProps) => {
  const { subscription, loading, isAdmin, getPlanDisplayName, getUsagePercentage } = useSubscription();

  if (loading || !subscription) {
    return null;
  }

  const isUnlimited = subscription.leads_limit === -1 || isAdmin;
  const percentage = getUsagePercentage();
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        {isAdmin ? (
          <Badge variant="default" className="gap-1 bg-amber-500 hover:bg-amber-600">
            <Shield className="h-3 w-3" />
            Admin
          </Badge>
        ) : isUnlimited ? (
          <Badge variant="secondary" className="gap-1">
            <Infinity className="h-3 w-3" />
            Ilimitado
          </Badge>
        ) : (
          <Badge 
            variant={isAtLimit ? "destructive" : isNearLimit ? "outline" : "secondary"}
            className="gap-1"
          >
            <Zap className="h-3 w-3" />
            {subscription.leads_used}/{subscription.leads_limit}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Leads usados este mês</span>
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
        <Progress 
          value={percentage} 
          className={`h-2 ${isAtLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-yellow-500' : ''}`}
        />
      )}

      {isAtLimit && !isUnlimited && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>Limite de leads atingido. Faça upgrade para continuar.</span>
        </div>
      )}

      {isNearLimit && !isAtLimit && !isUnlimited && (
        <p className="text-xs text-muted-foreground">
          Você usou {percentage}% do seu limite mensal
        </p>
      )}

      {isAdmin && (
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <Shield className="h-3 w-3" />
          Acesso administrativo com leads ilimitados
        </p>
      )}

      {isUnlimited && !isAdmin && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          Você tem leads ilimitados no plano Agência
        </p>
      )}
    </div>
  );
};
