import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, X, ArrowRight } from "lucide-react";
import { UpgradePlanDialog } from "@/components/profile/UpgradePlanDialog";

interface UpgradeIncentiveProps {
  additionalLeads: number;
  totalAvailable: number;
  currentPlanName?: string;
}

export const UpgradeIncentive = ({
  additionalLeads,
  totalAvailable,
  currentPlanName = "starter",
}: UpgradeIncentiveProps) => {
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || additionalLeads <= 0) {
    return null;
  }

  const leadsEntregues = totalAvailable - additionalLeads;
  const suggestedPlan = currentPlanName === "starter" ? "pro" : "agencia";
  const planLabel = suggestedPlan === "pro" ? "Pro" : "Agência";

  return (
    <>
      <div className="relative p-4 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-emerald-500/10 border border-emerald-500/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-500">
        {/* Dismiss button */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted/50 transition-colors"
          aria-label="Dispensar"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 p-3 bg-emerald-500/20 rounded-full">
            <Sparkles className="h-6 w-6 text-emerald-500" />
          </div>

          {/* Content */}
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="font-semibold text-foreground">
                Encontramos {totalAvailable} empresas nesta busca!
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Seu plano permite apenas <span className="font-medium text-foreground">{leadsEntregues} leads</span>. 
              Faça upgrade para desbloquear <span className="font-medium text-emerald-500">+{additionalLeads} leads adicionais</span>!
            </p>
          </div>

          {/* CTA Button - Emerald style with arrow */}
          <Button
            onClick={() => setShowUpgradeDialog(true)}
            className="flex-shrink-0 gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
          >
            Upgrade para {planLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <UpgradePlanDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        currentPlanName={currentPlanName}
        source="after_search"
      />
    </>
  );
};
