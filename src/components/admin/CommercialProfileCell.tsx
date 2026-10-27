import { Badge } from "@/components/ui/badge";
import { COMMERCIAL_STATE_LABELS, type CommercialState } from "../../../supabase/functions/_shared/commercial-state";

type Profile = {
  filled: boolean;
  complete: boolean;
  display_name: string;
  company_name: string;
  service_category_label: string;
  service_offered: string;
  offer_description: string;
  target_audience: string;
};

const NOT_INFORMED = "Não informado";

export function CommercialStateBadge({ state }: { state?: string }) {
  if (!state) return null;
  const label = COMMERCIAL_STATE_LABELS[state as CommercialState] ?? state;
  const tone =
    state === "paid_active" ? "bg-emerald-600 text-white hover:bg-emerald-600"
    : state === "past_due" || state === "indefinido" ? "border-amber-500/50 text-amber-500"
    : state === "canceled" ? "border-destructive/50 text-destructive"
    : "";
  return <Badge variant={state === "paid_active" ? "default" : "outline"} className={tone} data-testid="commercial-state-badge">{label}</Badge>;
}

/** Perfil comercial como o assinante o informou; campos vazios aparecem como "Não informado" (nada é deduzido). */
export function CommercialProfileCell({ profile }: { profile?: Profile }) {
  if (!profile?.filled) return <span className="text-xs text-muted-foreground" data-testid="commercial-profile-empty">{NOT_INFORMED}</span>;
  const row = (label: string, value: string) => (
    <div className="text-xs"><span className="text-muted-foreground">{label}: </span><span>{value || NOT_INFORMED}</span></div>
  );
  return (
    <div className="space-y-0.5" data-testid="commercial-profile">
      {row("Categoria", profile.service_category_label)}
      {row("Serviço", profile.service_offered)}
      {row("Oferta", profile.offer_description)}
      {row("Público", profile.target_audience)}
      {!profile.complete && <Badge variant="outline" className="mt-1 border-amber-500/50 text-amber-500">Perfil incompleto</Badge>}
    </div>
  );
}
