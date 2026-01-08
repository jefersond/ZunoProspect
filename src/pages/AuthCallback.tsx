import { useEffect } from "react";
import { useOAuthCallback } from "@/hooks/useOAuthCallback";

const AuthCallback = () => {
  const { isProcessing } = useOAuthCallback();

  // Fallback: if there is no callback to process, let the router render normally.
  // (This page is only meant to be a landing point for auth/recovery links.)
  useEffect(() => {
    // no-op; hook does the work
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">
        {isProcessing ? "Processando autenticação..." : "Redirecionando..."}
      </div>
    </div>
  );
};

export default AuthCallback;
