import { useState } from "react";
import { AlertCircle, Clipboard, RotateCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  type RefineErrorPayload,
  buildInternalProblemReport,
  buildSafeProblemReport,
  dispatchInternalProblemReport,
  getRefineDisplayMessage,
} from "@/lib/refineObservability";

interface RefineErrorPanelProps {
  error: RefineErrorPayload;
  onRetry?: () => void;
  retrying?: boolean;
}

export function RefineErrorPanel({ error, onRetry, retrying = false }: RefineErrorPanelProps) {
  const { toast } = useToast();
  const [reportOpen, setReportOpen] = useState(false);
  const [description, setDescription] = useState("");
  const occurredAt = useState(() => new Date())[0];

  const openProblemReport = () => {
    dispatchInternalProblemReport(buildInternalProblemReport(error, description, occurredAt));
    setReportOpen(true);
  };

  const copy = async (text: string, label: string) => {
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(text);
      toast({ title: label });
    } catch {
      toast({ title: "Não foi possível copiar", description: "Selecione o código e copie manualmente.", variant: "destructive" });
    }
  };

  return (
    <>
      <Alert variant="destructive" className="mt-3">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Não foi possível refinar com IA</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{getRefineDisplayMessage(error)}</p>
          <div className="flex flex-wrap items-center gap-2">
            {error.retryable && onRetry && (
              <Button type="button" size="sm" variant="outline" disabled={retrying} onClick={onRetry}>
                <RotateCcw className={`mr-1 h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
                Tentar novamente
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={openProblemReport}>
              Reportar problema
            </Button>
          </div>
        </AlertDescription>
      </Alert>
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar problema</DialogTitle>
            <DialogDescription>
              O resumo não é enviado automaticamente e não contém detalhes técnicos sensíveis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p><strong>Horário:</strong> {occurredAt.toLocaleString("pt-BR")}</p>
            <p><strong>Funcionalidade:</strong> Refinar com IA</p>
            <Textarea
              value={description}
              maxLength={300}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Descreva brevemente o que aconteceu (opcional)"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => copy(buildSafeProblemReport(error, description, occurredAt), "Resumo copiado")}
            >
              <Clipboard className="mr-2 h-4 w-4" /> Copiar resumo seguro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
