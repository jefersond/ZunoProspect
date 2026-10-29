import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, MessageSquare, Phone, Mail, Instagram, UserCheck, ShieldCheck } from "lucide-react";

interface ConfirmContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadNome: string;
  defaultType?: string;
  onConfirm: (data: { leadId: string; leadNome: string; tipo: string; conteudo: string }) => Promise<boolean>;
}

export function ConfirmContactModal({
  open,
  onOpenChange,
  leadId,
  leadNome,
  defaultType = "primeira_abordagem",
  onConfirm,
}: ConfirmContactModalProps) {
  const [tipo, setTipo] = useState<string>(defaultType);
  const [conteudo, setConteudo] = useState<string>("");
  const [confirming, setConfirming] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setTipo(defaultType);
      setConteudo("");
    }
  }, [open, defaultType]);

  const handleSubmit = async () => {
    setConfirming(true);
    try {
      const summaryText = conteudo.trim() || `Contato realizado via ${tipo.replace("_", " ")}`;
      const success = await onConfirm({
        leadId,
        leadNome,
        tipo,
        conteudo: summaryText,
      });
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-zinc-100">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            Confirmar Contato Realizado
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Confirme que você realmente realizou esta abordagem ou follow-up com{" "}
            <span className="font-semibold text-zinc-200">"{leadNome}"</span> para avançar sua meta comercial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          {/* Tipo de Interação */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-300">
              Tipo de Ação Realizada
            </Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="w-full bg-zinc-900 border-zinc-800 text-xs text-zinc-200">
                <SelectValue placeholder="Selecione o tipo de contato" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                <SelectItem value="primeira_abordagem" className="text-xs">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Primeira Abordagem</span>
                  </div>
                </SelectItem>
                <SelectItem value="follow_up" className="text-xs">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
                    <span>Follow-up / Acompanhamento</span>
                  </div>
                </SelectItem>
                <SelectItem value="whatsapp" className="text-xs">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5 text-green-500" />
                    <span>WhatsApp</span>
                  </div>
                </SelectItem>
                <SelectItem value="ligacao" className="text-xs">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-amber-400" />
                    <span>Ligação Telefônica</span>
                  </div>
                </SelectItem>
                <SelectItem value="email" className="text-xs">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-indigo-400" />
                    <span>E-mail</span>
                  </div>
                </SelectItem>
                <SelectItem value="instagram" className="text-xs">
                  <div className="flex items-center gap-2">
                    <Instagram className="h-3.5 w-3.5 text-pink-400" />
                    <span>Instagram Direct</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Observação rápida */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-300">
              Resumo ou Observação do Contato (Opcional)
            </Label>
            <Textarea
              placeholder="Ex: Respondeu que vai avaliar com a sócia na quinta-feira."
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              className="bg-zinc-900 border-zinc-800 text-xs text-zinc-200 min-h-[75px]"
            />
          </div>

          {/* Selo de Garantia Anti-Auto-Count */}
          <div className="flex items-center gap-2 p-2 rounded bg-zinc-900/50 border border-zinc-800/80 text-[11px] text-zinc-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              Este registro é salvo no seu histórico e contabilizado de forma única na meta de hoje.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
            className="text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={confirming}
            className="text-xs bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold gap-1.5"
          >
            {confirming ? "Registrando..." : "Confirmar e Contabilizar Contato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
