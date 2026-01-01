import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, CheckCircle2, XCircle, Settings } from "lucide-react";

interface TestResult {
  success: boolean;
  error?: string;
  config?: Record<string, string>;
  message?: string;
}

export const EmailTestCard = () => {
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const handleTest = async () => {
    if (!testEmail) {
      toast({
        variant: "destructive",
        title: "Email obrigatório",
        description: "Digite um email para teste.",
      });
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("test-email-config", {
        body: { toEmail: testEmail },
      });

      if (error) throw error;

      setResult(data);
      
      if (data?.success) {
        toast({
          title: "Email enviado!",
          description: `Verifique a caixa de entrada de ${testEmail}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Falha no envio",
          description: data?.error || "Erro desconhecido",
        });
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message });
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Diagnóstico de Email
        </CardTitle>
        <CardDescription>
          Teste se as configurações de email estão corretas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="seu@email.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleTest} disabled={testing}>
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Testar
              </>
            )}
          </Button>
        </div>

        {result && (
          <div className={`p-4 rounded-lg border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <span className={`font-medium ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                {result.success ? "Configuração OK" : "Falha na configuração"}
              </span>
            </div>
            
            {result.error && (
              <p className="text-sm text-red-600 mb-2">{result.error}</p>
            )}
            
            {result.config && (
              <div className="text-xs space-y-1 mt-3 pt-3 border-t border-current/10">
                <p><strong>API Key:</strong> {result.config.resend_api_key}</p>
                <p><strong>From:</strong> {result.config.resend_from_email}</p>
                <p><strong>Reply-To:</strong> {result.config.resend_reply_to_email}</p>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Se o teste falhar, verifique as variáveis RESEND_API_KEY e RESEND_FROM_EMAIL nas configurações do backend.
        </p>
      </CardContent>
    </Card>
  );
};
