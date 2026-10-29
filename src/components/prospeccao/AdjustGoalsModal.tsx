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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_TIMEZONES } from "@/utils/timezoneDateUtils";
import { calculateSuggestedGoals } from "@/utils/commercialGoalsManager";
import { Sparkles, Clock, Target, Info } from "lucide-react";
import type { CommercialGoalVersion } from "@/types/commercialPerformance";

interface AdjustGoalsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeGoal: CommercialGoalVersion;
  timezone: string;
  onSaveGoals: (goals: { daily: number; weekly: number; monthly: number; workdays_per_week?: number }) => Promise<boolean>;
  onSaveTimezone: (tz: string) => Promise<boolean>;
}

export function AdjustGoalsModal({
  open,
  onOpenChange,
  activeGoal,
  timezone,
  onSaveGoals,
  onSaveTimezone,
}: AdjustGoalsModalProps) {
  const [daily, setDaily] = useState<number>(activeGoal.daily || 5);
  const [weekly, setWeekly] = useState<number>(activeGoal.weekly || 25);
  const [monthly, setMonthly] = useState<number>(activeGoal.monthly || 110);
  const [workdays, setWorkdays] = useState<number>(activeGoal.workdays_per_week || 5);
  const [selectedTz, setSelectedTz] = useState<string>(timezone);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDaily(activeGoal.daily || 5);
      setWeekly(activeGoal.weekly || 25);
      setMonthly(activeGoal.monthly || 110);
      setWorkdays(activeGoal.workdays_per_week || 5);
      setSelectedTz(timezone);
    }
  }, [open, activeGoal, timezone]);

  const handleApplySuggestions = () => {
    const suggested = calculateSuggestedGoals(daily, workdays, 22);
    setWeekly(suggested.weekly);
    setMonthly(suggested.monthly);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (selectedTz !== timezone) {
        await onSaveTimezone(selectedTz);
      }
      const success = await onSaveGoals({
        daily: Number(daily),
        weekly: Number(weekly),
        monthly: Number(monthly),
        workdays_per_week: Number(workdays),
      });
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
            <Target className="h-5 w-5 text-emerald-400" />
            Personalizar Metas Comerciais
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-400">
            Defina sua cadência comercial diária, semanal e mensal de acordo com sua rotina.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Fuso Horário */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-zinc-400" />
              Fuso Horário de Trabalho
            </Label>
            <Select value={selectedTz} onValueChange={setSelectedTz}>
              <SelectTrigger className="w-full bg-zinc-900 border-zinc-800 text-zinc-200">
                <SelectValue placeholder="Selecione o fuso" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                {SUPPORTED_TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value} className="text-xs">
                    {tz.label} ({tz.offsetLabel})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-zinc-500">
              Garante que suas metas virem exatamente à meia-noite do seu fuso local.
            </p>
          </div>

          {/* Meta Diária */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="goal-daily" className="text-xs font-medium text-zinc-300">
                Meta Diária de Contatos
              </Label>
              <span className="text-xs font-semibold text-emerald-400">{daily} contatos/dia</span>
            </div>
            <Input
              id="goal-daily"
              type="number"
              min={1}
              max={100}
              value={daily}
              onChange={(e) => setDaily(Math.max(1, parseInt(e.target.value) || 1))}
              className="bg-zinc-900 border-zinc-800 text-zinc-200"
            />
          </div>

          {/* Dias úteis e sugestão */}
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="goal-workdays" className="text-xs text-zinc-300">
                Dias de prospecção por semana:
              </Label>
              <Select value={String(workdays)} onValueChange={(val) => setWorkdays(Number(val))}>
                <SelectTrigger className="w-24 h-8 bg-zinc-950 border-zinc-800 text-xs text-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                  <SelectItem value="4">4 dias</SelectItem>
                  <SelectItem value="5">5 dias (Seg-Sex)</SelectItem>
                  <SelectItem value="6">6 dias (Seg-Sáb)</SelectItem>
                  <SelectItem value="7">7 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplySuggestions}
              className="w-full text-xs h-8 border-dashed border-zinc-700 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-zinc-300 gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              Sugerir metas para semana ({daily * workdays}) e mês ({daily * 22})
            </Button>
          </div>

          {/* Meta Semanal */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="goal-weekly" className="text-xs font-medium text-zinc-300">
                Meta Semanal (Segunda a Domingo)
              </Label>
              <span className="text-xs font-semibold text-emerald-400">{weekly} contatos/semana</span>
            </div>
            <Input
              id="goal-weekly"
              type="number"
              min={1}
              max={500}
              value={weekly}
              onChange={(e) => setWeekly(Math.max(1, parseInt(e.target.value) || 1))}
              className="bg-zinc-900 border-zinc-800 text-zinc-200"
            />
          </div>

          {/* Meta Mensal */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="goal-monthly" className="text-xs font-medium text-zinc-300">
                Meta Mensal
              </Label>
              <span className="text-xs font-semibold text-emerald-400">{monthly} contatos/mês</span>
            </div>
            <Input
              id="goal-monthly"
              type="number"
              min={1}
              max={2000}
              value={monthly}
              onChange={(e) => setMonthly(Math.max(1, parseInt(e.target.value) || 1))}
              className="bg-zinc-900 border-zinc-800 text-zinc-200"
            />
          </div>

          {/* Aviso de Imutabilidade Histórica */}
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-zinc-900/40 border border-zinc-800/60 text-[11px] text-zinc-400">
            <Info className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
            <span>
              Alterações de metas passam a valer a partir de hoje. Suas metas e percentuais de dias, semanas e meses anteriores permanecem preservados no histórico.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold"
          >
            {saving ? "Salvando..." : "Salvar Metas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
