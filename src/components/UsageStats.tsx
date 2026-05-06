import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Search, Zap } from "lucide-react";

type UsageStatsProps = {
  leadsUsed: number;
  leadsLimit: number;
  aiUsed: number;
  aiLimit: number;
  isAdmin?: boolean;
  loading?: boolean;
  leadsBonusBalance?: number;
  leadsAvailableTotal?: number;
};

function safeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function getPercentage(used: number, limit: number) {
  const safeLimit = safeNumber(limit);
  if (!safeLimit || safeLimit <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((safeNumber(used) / safeLimit) * 100)));
}

function isUnlimited(limit: number, isAdmin?: boolean) {
  return Boolean(isAdmin || safeNumber(limit) >= 999999);
}

export function UsageStats({
  leadsUsed,
  leadsLimit,
  aiUsed,
  aiLimit,
  isAdmin = false,
  loading = false,
  leadsBonusBalance = 0,
  leadsAvailableTotal,
}: UsageStatsProps) {
  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Uso do plano</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 animate-pulse rounded-lg bg-muted/40" />
        </CardContent>
      </Card>
    );
  }

  const safeLeadsUsed = Math.max(0, safeNumber(leadsUsed));
  const safeLeadsLimit = Math.max(0, safeNumber(leadsLimit));
  const safeAiUsed = Math.max(0, safeNumber(aiUsed));
  const safeAiLimit = Math.max(0, safeNumber(aiLimit));
  const safeBonus = Math.max(0, safeNumber(leadsBonusBalance));
  const totalAvailable = Math.max(
    0,
    safeNumber(leadsAvailableTotal ?? Math.max(0, safeLeadsLimit - safeLeadsUsed) + safeBonus),
  );

  const leadsUnlimited = isUnlimited(safeLeadsLimit, isAdmin);
  const aiUnlimited = isUnlimited(safeAiLimit, isAdmin);
  const leadsPercent = leadsUnlimited ? 0 : getPercentage(safeLeadsUsed, safeLeadsLimit);
  const aiPercent = aiUnlimited ? 0 : getPercentage(safeAiUsed, safeAiLimit);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base">Uso do plano</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Leads</span>
            </div>

            <span className="text-xs text-muted-foreground">
              {leadsUnlimited ? "Ilimitado" : `${safeLeadsUsed} de ${safeLeadsLimit} leads`}
            </span>
          </div>

          {!leadsUnlimited && <Progress value={leadsPercent} />}

          <p className="text-xs text-muted-foreground">
            {leadsUnlimited
              ? "Você tem buscas ilimitadas neste plano."
              : `Você já buscou ${safeLeadsUsed} de ${safeLeadsLimit} leads.`}
          </p>

          {!leadsUnlimited && safeBonus > 0 && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              Bônus de indicação: <span className="font-medium text-foreground">{safeBonus}</span> leads.
              Disponível total: <span className="font-medium text-foreground">{totalAvailable}</span> leads.
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Análises com IA</span>
            </div>

            <span className="text-xs text-muted-foreground">
              {aiUnlimited ? "Ilimitado" : `${safeAiUsed} de ${safeAiLimit} análises`}
            </span>
          </div>

          {!aiUnlimited && <Progress value={aiPercent} />}

          <p className="text-xs text-muted-foreground">
            {aiUnlimited
              ? "Você tem análises ilimitadas neste plano."
              : `Você já usou ${safeAiUsed} de ${safeAiLimit} análises profundas.`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
