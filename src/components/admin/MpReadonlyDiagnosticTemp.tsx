import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type DiagnosticReport = {
  readonly: boolean;
  secret_exposed: boolean;
  plan_get?: {
    ok: boolean;
    http_status: number;
    data?: {
      id?: string | null;
      status?: string | null;
      collector_id?: string | number | null;
      application_id?: string | number | null;
    } | null;
    error?: unknown;
  };
  preapproval_search?: {
    ok: boolean;
    http_status: number;
    count: number;
    data: Array<{
      id?: string | null;
      status?: string | null;
      payer_id?: string | number | null;
      preapproval_plan_id?: string | null;
      date_created?: string | null;
    }>;
    error?: unknown;
  };
  payments_search?: {
    ok: boolean;
    http_status: number;
    count: number;
    data: Array<{
      id?: string | number | null;
      status?: string | null;
      status_detail?: string | null;
      payer_id?: string | number | null;
      transaction_amount?: number | null;
      payment_method_id?: string | null;
      payment_type_id?: string | null;
      date_created?: string | null;
    }>;
    error?: unknown;
  };
};

export function MpReadonlyDiagnosticTemp() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const execute = async () => {
    setRunning(true);
    setError(null);
    setReport(null);

    try {
      const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;
      if (aalData?.currentLevel !== "aal2") {
        throw new Error("Sua sessão Owner precisa estar em AAL2/MFA para executar este diagnóstico.");
      }

      const { data, error: invokeError } = await supabase.functions.invoke("mp-readonly-diagnostic-temp", {
        method: "GET",
      });

      if (invokeError) throw invokeError;
      if (!data?.readonly || data?.secret_exposed) {
        throw new Error("A função recusou o modo seguro de diagnóstico.");
      }

      setReport(data as DiagnosticReport);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível executar o diagnóstico.");
    } finally {
      setRunning(false);
    }
  };

  const plan = report?.plan_get?.data;
  const preapproval = report?.preapproval_search?.data?.[0];
  const payment = report?.payments_search?.data?.[0];

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4 text-amber-500" />
              Diagnóstico Mercado Pago
            </CardTitle>
            <CardDescription className="mt-1">
              Temporário, somente leitura e exclusivo para Owner com MFA.
            </CardDescription>
          </div>
          <Badge variant="outline">TEMP</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" onClick={execute} disabled={running} className="w-full sm:w-auto">
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Executar diagnóstico Mercado Pago
        </Button>

        {error && (
          <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {report && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Relatório sanitizado recebido.
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plano</p>
                <p className="mt-2">Status: <strong>{plan?.status ?? "—"}</strong></p>
                <p>Collector: <strong>{plan?.collector_id ?? "—"}</strong></p>
                <p>Application: <strong>{plan?.application_id ?? "—"}</strong></p>
              </div>

              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preapprovals</p>
                <p className="mt-2">Encontrados: <strong>{report.preapproval_search?.count ?? 0}</strong></p>
                <p>ID: <strong>{preapproval?.id ?? "—"}</strong></p>
                <p>Status: <strong>{preapproval?.status ?? "—"}</strong></p>
                <p>Payer: <strong>{preapproval?.payer_id ?? "—"}</strong></p>
              </div>

              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payments</p>
                <p className="mt-2">Encontrados: <strong>{report.payments_search?.count ?? 0}</strong></p>
                <p>ID: <strong>{payment?.id ?? "—"}</strong></p>
                <p>Status: <strong>{payment?.status ?? "—"}</strong></p>
                <p>Status detail: <strong>{payment?.status_detail ?? "—"}</strong></p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
