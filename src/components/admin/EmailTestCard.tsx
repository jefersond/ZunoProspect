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
  details?: string;
  config?: Record<string, string>;
  message?: string;
}

export const EmailTestCard = () => {
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState("falecom@klsalescompany.com");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const resultTone = result?.success
    ? {
        container: "border-emerald-500/30 bg-emerald-500/10",
        icon: "text-emerald-300",
        title: "text-emerald-200",
        divider: "border-emerald-500/20",
        label: "text-emerald-100",
        value: "text-foreground",
      }
    : {
        container: "border-destructive/35 bg-destructive/10",
        icon: "text-destructive",
        title: "text-destructive",
        divider: "border-destructive/20",
        label: "text-red-100",
        value: "text-foreground",
      };

  const handleTest = async () => {
    if (!testEmail) {
      toast({
        variant: "destructive",
        title: "Email obrigatorio",
        description: "Digite um email para teste.",
      });
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      const functionName = "test-email-config";
      const recipientEmail = testEmail.trim();
      const { data, error } = await supabase.functions.invoke("test-email-config", {
        body: { email: recipientEmail },
      });

      if (error) {
        let details: string | undefined;
        const contextResponse = (error as any)?.context;
        if (contextResponse instanceof Response) {
          try {
            const text = await contextResponse.clone().text();
            const payload = text ? JSON.parse(text) : null;
            details = payload?.details || payload?.error || payload?.message;
            setResult({
              success: false,
              error: payload?.error || error.message,
              details,
              config: payload?.config,
            });
          } catch {
            details = error.message;
          }
        }

        console.error("Erro ao testar email:", {
          functionName,
          recipientEmail,
          error,
          data,
          details,
        });

        throw new Error(details || error.message);
      }

      console.log("Resultado do teste de email:", {
        functionName,
        recipientEmail,
        data,
      });

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
      setResult((current) => current || { success: false, error: error.message });
      toast({
        variant: "destructive",
        title: "Erro ao enviar teste",
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
          Diagnostico de Email
        </CardTitle>
        <CardDescription>Teste se as configuracoes de email estao corretas</CardDescription>
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
                <Send className="mr-2 h-4 w-4" />
                Testar
              </>
            )}
          </Button>
        </div>

        {result && (
          <div className={`rounded-lg border p-4 shadow-sm ${resultTone.container}`}>
            <div className="mb-3 flex items-center gap-2">
              {result.success ? (
                <CheckCircle2 className={`h-5 w-5 ${resultTone.icon}`} />
              ) : (
                <XCircle className={`h-5 w-5 ${resultTone.icon}`} />
              )}
              <span className={`text-sm font-semibold ${resultTone.title}`}>
                {result.success ? "Configuracao OK" : "Falha na configuracao"}
              </span>
            </div>

            {result.error && (
              <p className="mb-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-foreground">
                {result.error}
                {result.details ? `: ${result.details}` : ""}
              </p>
            )}

            {result.config && (
              <dl className={`mt-3 space-y-2 border-t pt-3 text-sm ${resultTone.divider}`}>
                <div className="grid gap-1 sm:grid-cols-[96px_minmax(0,1fr)]">
                  <dt className={`font-medium ${resultTone.label}`}>API Key</dt>
                  <dd className={`break-words font-medium ${resultTone.value}`}>
                    {result.config.resend_api_key}
                  </dd>
                </div>
                <div className="grid gap-1 sm:grid-cols-[96px_minmax(0,1fr)]">
                  <dt className={`font-medium ${resultTone.label}`}>From</dt>
                  <dd className={`break-words font-medium ${resultTone.value}`}>
                    {result.config.resend_from_email}
                  </dd>
                </div>
                <div className="grid gap-1 sm:grid-cols-[96px_minmax(0,1fr)]">
                  <dt className={`font-medium ${resultTone.label}`}>Reply-To</dt>
                  <dd className={`break-words font-medium ${resultTone.value}`}>
                    {result.config.resend_reply_to_email}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Se o teste falhar, verifique as variaveis RESEND_API_KEY e RESEND_FROM_EMAIL nas configuracoes do backend.
        </p>
      </CardContent>
    </Card>
  );
};
