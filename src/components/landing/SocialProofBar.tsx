import { CheckCircle2 } from "lucide-react";

export function SocialProofBar() {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4" />
      </div>
      <span className="text-sm text-muted-foreground">
        Para profissionais que vendem serviços B2B e precisam abordar melhor.
      </span>
    </div>
  );
}
