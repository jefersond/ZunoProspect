import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, ShieldCheck, HelpCircle } from "lucide-react";
import {
  getOfferClarificationQuestion,
  buildExploratoryOfferDescription,
  type OfferClarificationQuestion,
} from "@/lib/offerClarification";
import type { SellerProfile } from "@/lib/sellerProfile";

interface OfferClarificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: SellerProfile | null | undefined;
  leadNicho?: string | null;
  onSaveOffer: (clarifiedDescription: string) => Promise<void> | void;
  onContinueExploratory: () => Promise<void> | void;
  isSaving?: boolean;
}

export const OfferClarificationDialog: React.FC<OfferClarificationDialogProps> = ({
  open,
  onOpenChange,
  profile,
  leadNicho,
  onSaveOffer,
  onContinueExploratory,
  isSaving = false,
}) => {
  const [answer, setAnswer] = useState("");
  const [clarification, setClarification] = useState<OfferClarificationQuestion>(() =>
    getOfferClarificationQuestion(profile, leadNicho)
  );

  useEffect(() => {
    if (open) {
      const q = getOfferClarificationQuestion(profile, leadNicho);
      setClarification(q);
      // Se já houver um rascunho anterior no perfil, inicializa nele se for curto
      setAnswer(profile?.offer_description || "");
    }
  }, [open, profile, leadNicho]);

  const handleSave = async () => {
    const trimmed = answer.trim();
    if (trimmed.length < 15) {
      // Se a resposta for muito curta, contextualiza com o serviço para garantir robustez
      const enriched = `${clarification.contextService}: ${trimmed}. Abordagem comercial focada em resolver essa necessidade.`;
      await onSaveOffer(enriched);
    } else {
      await onSaveOffer(trimmed);
    }
  };

  const handleExploratory = async () => {
    await onContinueExploratory();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg border-zinc-800 bg-[#111816] text-zinc-100 shadow-2xl p-6 sm:rounded-xl"
        data-testid="offer-clarification-dialog"
      >
        <DialogHeader className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="h-4 w-4" />
              </span>
              <DialogTitle className="text-base font-bold text-zinc-100">
                Refinamento Rápido da Oferta
              </DialogTitle>
            </div>
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-950/40 text-[11px] font-medium text-emerald-300 px-2.5 py-0.5"
            >
              1 Pergunta Única
            </Badge>
          </div>

          <DialogDescription className="text-xs text-zinc-400 leading-relaxed">
            Para gerar abordagens precisas e sem clichês, a Zuno precisa compreender o problema que sua oferta resolve.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 space-y-3.5">
          {/* Badge contextual do serviço informado */}
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300">
            <span className="text-zinc-500 font-medium">Serviço informado:</span>
            <span className="font-semibold text-emerald-400">{clarification.contextService}</span>
          </div>

          {/* Pergunta única e direta */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3.5 space-y-1.5">
            <div className="flex items-start gap-2">
              <HelpCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <label htmlFor="clarification-input" className="text-sm font-semibold text-zinc-100 leading-snug">
                {clarification.question}
              </label>
            </div>
            <p className="text-[11px] text-zinc-400 pl-6">
              Uma resposta curta é suficiente para personalizar o plano sem inventar informações.
            </p>
          </div>

          {/* Campo de resposta curta */}
          <div className="space-y-1.5">
            <Textarea
              id="clarification-input"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={clarification.placeholder}
              rows={3}
              className="resize-none border-zinc-800 bg-zinc-950/80 text-xs text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500"
              data-testid="offer-clarification-input"
            />
            <div className="flex items-center justify-between text-[11px] text-zinc-500 px-0.5">
              <span>{answer.trim().length} caracteres</span>
              <span>Editável depois no Perfil Comercial</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-2 border-t border-zinc-800/80">
          <Button
            type="button"
            variant="ghost"
            onClick={handleExploratory}
            disabled={isSaving}
            className="text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 h-9 px-3 w-full sm:w-auto"
            data-testid="btn-skip-clarification"
          >
            Continuar sem responder
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || answer.trim().length === 0}
            className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs h-9 px-4 gap-1.5 w-full sm:w-auto shadow-sm"
            data-testid="btn-save-clarification"
          >
            {isSaving ? "Salvando..." : "Salvar e Gerar Plano"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
