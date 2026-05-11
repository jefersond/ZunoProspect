import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  if (!user) {
    const authParams = new URLSearchParams();
    authParams.set("tab", "signup");
    authParams.set("returnTo", `${location.pathname}${location.search}`);

    if (location.pathname === "/checkout") {
      const currentParams = new URLSearchParams(location.search);
      const plano = currentParams.get("plano") || currentParams.get("plan");
      const anual = currentParams.get("anual") || currentParams.get("isAnual");
      const leadsQty = currentParams.get("leadsQty") || currentParams.get("leads");
      const ref = currentParams.get("ref");

      if (plano) authParams.set("plan", plano);
      if (anual) authParams.set("anual", anual);
      if (leadsQty) authParams.set("leadsQty", leadsQty);
      if (ref) authParams.set("ref", ref);
    }

    return <Navigate to={`/auth?${authParams.toString()}`} replace />;
  }

  return <>{children}</>;
}
