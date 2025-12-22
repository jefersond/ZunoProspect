import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook to handle OAuth callback tokens in URL hash.
 * Cleans the URL and redirects authenticated users to /prospeccao.
 */
export const useOAuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const hash = window.location.hash;
      
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
        
        // If we have tokens, let Supabase SDK handle them
        // The SDK automatically detects and processes tokens from the URL hash
        try {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          // Clean the URL hash immediately after processing
          window.history.replaceState({}, '', window.location.pathname);
          
          if (sessionError) {
            toast({
              variant: "destructive",
              title: "Erro na autenticação",
              description: sessionError.message
            });
            navigate('/auth', { replace: true });
          } else if (session) {
            // Successfully authenticated - redirect to prospeccao
            navigate('/prospeccao', { replace: true });
          }
        } catch (err) {
          window.history.replaceState({}, '', window.location.pathname);
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
