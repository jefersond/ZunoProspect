import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getAuthRedirectBaseUrl, isOnCanonicalDomain } from '@/lib/authRedirect';

/**
 * Hook to handle OAuth callback tokens in URL hash.
 * Cleans the URL and redirects authenticated users to /prospeccao.
 * Also handles redirect to canonical domain if needed.
 */
export const useOAuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const hash = window.location.hash;
      
      // If we have tokens and we're NOT on the canonical domain, redirect there with tokens
      if (hash && hash.includes('access_token') && !isOnCanonicalDomain()) {
        const canonicalBase = getAuthRedirectBaseUrl();
        // Redirect to canonical domain, preserving the hash with tokens
        window.location.href = `${canonicalBase}${window.location.pathname}${window.location.search}${hash}`;
        return;
      }
      
      // Check if URL has OAuth tokens in hash
      if (hash && (hash.includes('access_token') || hash.includes('error'))) {
        setIsProcessing(true);
        
        // Check for errors in the hash
        const hashParams = new URLSearchParams(hash.substring(1));
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');
        
        if (error) {
          // Clean the URL immediately
          window.history.replaceState({}, '', window.location.pathname);
          
          let errorMessage = "Ocorreu um erro durante a autenticação.";
          if (error === "access_denied") {
            errorMessage = "Acesso negado. Você cancelou o login ou não autorizou o acesso.";
          } else if (errorDescription) {
            errorMessage = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
          }
          
          toast({
            variant: "destructive",
            title: "Erro no login",
            description: errorMessage
          });
          
          navigate('/auth', { replace: true });
          setIsProcessing(false);
          return;
        }
        
        // If we have tokens, explicitly create the session from the hash.
        // Relying only on getSession() may not consume implicit-flow tokens reliably.
        try {
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (!accessToken || !refreshToken) {
            window.history.replaceState({}, '', window.location.pathname + window.location.search);
            toast({
              variant: "destructive",
              title: "Erro na autenticação",
              description: "Não foi possível finalizar o login (tokens ausentes)."
            });
            navigate('/auth', { replace: true });
            setIsProcessing(false);
            return;
          }

          const { data, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          // Clean the URL hash immediately after processing (keep pathname + querystring)
          window.history.replaceState({}, '', window.location.pathname + window.location.search);

          if (setSessionError) {
            toast({
              variant: "destructive",
              title: "Erro na autenticação",
              description: setSessionError.message
            });
            navigate('/auth', { replace: true });
          } else if (data.session) {
            navigate('/prospeccao', { replace: true });
          } else {
            toast({
              variant: "destructive",
              title: "Erro na autenticação",
              description: "Não foi possível criar a sessão. Tente novamente."
            });
            navigate('/auth', { replace: true });
          }
        } catch (err) {
          window.history.replaceState({}, '', window.location.pathname + window.location.search);
          toast({
            variant: "destructive",
            title: "Erro inesperado",
            description: "Não foi possível processar a autenticação."
          });
          navigate('/auth', { replace: true });
        }
        
        setIsProcessing(false);
      }
    };

    handleOAuthCallback();
  }, [navigate, toast]);

  return { isProcessing };
};
