import { Link, Navigate, useLocation } from "react-router-dom";
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, authLoading, profileLoading, isAdmin, refreshPermissions, profileError } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Verificando sessao...</span>
      </div>
    );
  }

  if (!user) {
    const authParams = new URLSearchParams();
    authParams.set("tab", "login");
    authParams.set("returnTo", `${location.pathname}${location.search}`);
    return <Navigate to={`/auth?${authParams.toString()}`} replace />;
  }

  if (isAdmin) {
    return <>{children}</>;
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Verificando permissoes...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
        <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-destructive" />
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta area e exclusiva para administradores.
        </p>
        {profileError && (
          <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Perfil indisponivel no momento. Administradores por e-mail continuam liberados automaticamente.
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={refreshPermissions} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Recarregar permissoes
          </Button>
          <Button asChild>
            <Link to="/prospeccao">Voltar</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
