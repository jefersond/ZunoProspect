import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getAuthRedirectBaseUrl, isOnCanonicalDomain } from '@/lib/authRedirect';

/**
 * Hook to handle OAuth callback tokens in URL hash.
 * Cleans the URL and redirects authenticated users appropriately.
 */
export const useOAuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const processOAuthCallback = async () => {
      const hash = window.location.hash;
      const searchParams = new URLSearchParams(window.location.search);

      const hasOAuthHash = 
        hash.includes("access_token") || 
        hash.includes("refresh_token") || 
        hash.includes("error");

      const hasOAuthCode = searchParams.has("code");
      const isRecoveryByQuery = searchParams.get("type") === "recovery";

      if (!hasOAuthHash && !hasOAuthCode) {
        setIsProcessing(false);
        return;
      }

      setIsProcessing(true);

      try {
        if (hasOAuthCode) {
          const code = searchParams.get("code") as string;
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          window.history.replaceState({}, "", window.location.pathname);

          if (error) {
             console.error("Erro exchangeCodeForSession:", error.message);
          }
        }

        // Se temos tokens de OAuth na URL e não estamos no domínio principal (caso exista redirecionamento cross-domain)
        if (hash && hash.includes("access_token") && !isOnCanonicalDomain()) {
          const canonicalBase = getAuthRedirectBaseUrl();
          window.location.href = `${canonicalBase}${window.location.pathname}${window.location.search}${hash}`;
          return;
        }

        const hashParams = new URLSearchParams(hash.replace("#", ""));
        const hashError = hashParams.get("error");
        const hashErrorDescription = hashParams.get("error_description");
        const tokenType = hashParams.get("type");
        const isPasswordRecovery = tokenType === "recovery" || isRecoveryByQuery;

        if (hashError) {
          console.error("OAuth error:", hashError, hashErrorDescription);
          window.history.replaceState({}, document.title, "/auth");
          toast({
            variant: "destructive",
            title: "Erro no login",
            description: hashError === "access_denied" ? "Acesso negado." : "Ocorreu um erro na autenticação."
          });
          navigate("/auth", { replace: true });
          return;
        }

        // Dá tempo para o Supabase processar o token da URL
        await new Promise((resolve) => setTimeout(resolve, 300));

        const { data, error } = await supabase.auth.getSession();

        if (import.meta.env.DEV) {
          console.log("OAuth hash detectado:", hash.includes("access_token"));
          console.log("OAuth code detectado:", searchParams.has("code"));
          console.log("Sessão encontrada:", !!data.session);
        }

        if (error) {
          console.error("Erro ao obter sessão OAuth:", error.message);
          window.history.replaceState({}, document.title, "/auth");
          navigate("/auth", { replace: true });
          return;
        }

        if (data.session) {
          // Limpa o hash de forma segura
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);

          if (isPasswordRecovery) {
            navigate("/reset-password", { replace: true });
            return;
          }

          // Checkout redirections
          const isCheckoutFlow =
            searchParams.get("google_auth") === "true" ||
            location.pathname === "/checkout" ||
            localStorage.getItem("checkout_pending");

          if (isCheckoutFlow && location.pathname === "/checkout") {
            // Already on checkout page
            return;
          } else if (localStorage.getItem("checkout_pending")) {
            const pendingData = JSON.parse(localStorage.getItem("checkout_pending") || "{}");
            const plano = pendingData.plano?.toLowerCase() || "pro";
            const isAnual = pendingData.isAnual || false;
            navigate(`/checkout?plano=${plano}&anual=${isAnual}&google_auth=true`, { replace: true });
            return;
          }

          window.history.replaceState({}, document.title, "/prospeccao");
          navigate("/prospeccao", { replace: true });
          return;
        }

        console.warn("OAuth retornou, mas nenhuma sessão foi encontrada.");
        window.history.replaceState({}, document.title, "/auth");
        navigate("/auth", { replace: true });
      } catch (error) {
        console.error("Erro inesperado no callback OAuth:", error);
        window.history.replaceState({}, document.title, "/auth");
        navigate("/auth", { replace: true });
      } finally {
        setIsProcessing(false);
      }
    };

    processOAuthCallback();
  }, [navigate, location, toast]);

  return { isProcessing };
};
