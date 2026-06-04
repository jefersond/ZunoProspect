import { useEffect, useMemo, useState } from "react";
import { Copy, Check, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/utils/templateUtils";
import {
  applyLocalCopyAdjustment,
  generateSmartProspectingCopy,
  type ProspectingChannel,
} from "@/utils/smartProspectingCopy";
import type { LeadProspeccao } from "@/types/lead";

type Adjustment = "shorter" | "consultative" | "direct" | "swap_cta" | "remove_generic";

const adjustmentLabels: Array<{ key: Adjustment; label: string }> = [
  { key: "shorter", label: "Mais curto" },
  { key: "consultative", label: "Mais consultivo" },
  { key: "direct", label: "Mais direto" },
  { key: "swap_cta", label: "Trocar CTA" },
  { key: "remove_generic", label: "Remover generico" },
];

const angleLabels: Record<string, string> = {
  dor_operacional: "Dor operacional",
  previsibilidade: "Previsibilidade",
  velocidade: "Velocidade",
  organizacao: "Organizacao",
  teste_pratico: "Teste pratico",
  qualificacao: "Qualificacao",
  presenca_local: "Presenca local",
};

export function SmartCopyCard({
  lead,
  channel = "whatsapp",
  onRefineWithAI,
  isRefining,
  canAnalyzeAI = true,
}: {
  lead: LeadProspeccao;
  channel?: ProspectingChannel;
  onRefineWithAI?: () => void;
  isRefining?: boolean;
  canAnalyzeAI?: boolean;
}) {
  const { toast } = useToast();
  const baseCopy = useMemo(
    () => generateSmartProspectingCopy({ lead, channel, focus: lead.foco, niche: lead.nicho, city: lead.cidade }),
    [channel, lead],
  );
  const [message, setMessage] = useState(baseCopy.message);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMessage(baseCopy.message);
  }, [baseCopy.message]);

  const handleCopy = async () => {
    const success = await copyToClipboard(message);
    if (!success) return;

    setCopied(true);
    toast({ title: "Copy copiada", description: "Mensagem base copiada sem consumir IA." });
    setTimeout(() => setCopied(false), 1800);
  };

  const applyAdjustment = (adjustment: Adjustment) => {
    setMessage((current) => applyLocalCopyAdjustment(current, adjustment));
  };

  return (
    <Card className="mt-4 border-emerald-500/20 bg-emerald-500/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4 text-emerald-600" />
              Copy base inteligente
            </CardTitle>
            <CardDescription>
              Gerada por template local com contexto do nicho. Nao consome credito de IA.
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit border-emerald-500/30 text-emerald-700">
            {angleLabels[baseCopy.approach_angle] || baseCopy.approach_angle}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-background/70 p-3 text-sm whitespace-pre-wrap">
          {message}
        </div>

        <div className="flex flex-wrap gap-2">
          {adjustmentLabels.map((item) => (
            <Button key={item.key} type="button" variant="outline" size="sm" onClick={() => applyAdjustment(item.key)}>
              {item.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="gap-2">
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            Copiar copy
          </Button>
          {onRefineWithAI && (
            <Button type="button" size="sm" onClick={onRefineWithAI} disabled={isRefining} className="gap-2">
              {isRefining ? "Refinando com IA..." : canAnalyzeAI ? "Refinar com IA" : "Liberar analises IA"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
