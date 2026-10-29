import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Target,
  Flame,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  PlusCircle,
  SlidersHorizontal,
  Briefcase,
  Users,
  ShieldCheck,
} from "lucide-react";
import type {
  DailyPerformance,
  WeeklyPerformance,
  MonthlyPerformance,
  CommercialGoalVersion,
} from "@/types/commercialPerformance";
import { AdjustGoalsModal } from "./AdjustGoalsModal";
import { ConfirmContactModal } from "./ConfirmContactModal";
import type { LeadProspeccao } from "@/types/lead";
import { SUPPORTED_TIMEZONES } from "@/utils/timezoneDateUtils";

interface CommercialPerformanceDashboardProps {
  daily: DailyPerformance;
  weekly: WeeklyPerformance;
  monthly: MonthlyPerformance;
  activeGoal: CommercialGoalVersion;
  timezone: string;
  defaultTab?: "diario" | "semanal" | "mensal";
  leads?: LeadProspeccao[];
  loading?: boolean;
  onSaveGoals: (goals: { daily: number; weekly: number; monthly: number; workdays_per_week?: number }) => Promise<boolean>;
  onSaveTimezone: (tz: string) => Promise<boolean>;
  onRegisterContact: (data: { leadId: string; leadNome: string; tipo: string; conteudo: string }) => Promise<boolean>;
}

export function CommercialPerformanceDashboard({
  daily,
  weekly,
  monthly,
  activeGoal,
  timezone,
  defaultTab = "diario",
  leads = [],
  loading = false,
  onSaveGoals,
  onSaveTimezone,
  onRegisterContact,
}: CommercialPerformanceDashboardProps) {
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [quickContactOpen, setQuickContactOpen] = useState(false);
  const [selectedLeadForContact, setSelectedLeadForContact] = useState<LeadProspeccao | null>(null);

  const tzInfo = SUPPORTED_TIMEZONES.find((t) => t.value === timezone) || {
    label: "Horário de Brasília",
    offsetLabel: "GMT-3",
  };

  const handleOpenQuickContact = () => {
    // Se houver leads salvos, seleciona o primeiro por padrão
    if (leads.length > 0) {
      setSelectedLeadForContact(leads[0]);
    } else {
      setSelectedLeadForContact(null);
    }
    setQuickContactOpen(true);
  };

  return (
    <>
      <Card id="tour-painel-metas" className="mb-6 border-zinc-800 bg-zinc-950/80 shadow-md backdrop-blur-sm">
        <CardHeader className="pb-3 pt-4 px-4 sm:px-6 border-b border-zinc-800/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                  <span>Desempenho Comercial</span>
                  {daily.isMet && (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[10px] gap-1 px-1.5 py-0.5">
                      <Flame className="h-3 w-3 fill-emerald-400" />
                      Meta Batida!
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                  <Clock className="h-3 w-3 text-zinc-500" />
                  <span>{tzInfo.label} ({tzInfo.offsetLabel})</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-500 text-[11px]">Auto-registro transparente</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdjustModalOpen(true)}
                className="h-8 text-xs border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 gap-1.5"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Ajustar Metas</span>
              </Button>
              {leads.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleOpenQuickContact}
                  className="h-8 text-xs bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-medium gap-1.5"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Registrar Contato</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid grid-cols-3 max-w-xs mb-4 bg-zinc-900 border border-zinc-800 text-xs">
              <TabsTrigger value="diario" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-emerald-400">
                Diário
              </TabsTrigger>
              <TabsTrigger value="semanal" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-emerald-400">
                Semanal
              </TabsTrigger>
              <TabsTrigger value="mensal" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-emerald-400">
                Mensal
              </TabsTrigger>
            </TabsList>

            {/* ABA DIÁRIA */}
            <TabsContent value="diario" className="space-y-4 m-0 focus-visible:outline-none">
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-bold text-zinc-100">
                      {daily.completed}
                    </span>
                    <span className="text-sm font-medium text-zinc-400">
                      de {daily.target} contatos realizados hoje
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs px-2.5 py-1 ${
                      daily.isMet
                        ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                        : "border-zinc-700 text-zinc-300 bg-zinc-800/50"
                    }`}
                  >
                    {daily.percent}% concluído
                  </Badge>
                </div>

                <Progress
                  value={Math.min(100, daily.percent)}
                  className="h-2.5 bg-zinc-800 [&>div]:bg-emerald-500"
                />

                <div className="flex items-center justify-between text-xs text-zinc-400 mt-2">
                  <span>
                    {daily.isMet
                      ? "Parabéns! Sua meta de hoje foi alcançada."
                      : `Restam ${daily.remaining} contatos para atingir sua meta.`}
                  </span>
                  <span className="text-zinc-500 text-[11px]">Deduplicação por lead/dia ativa</span>
                </div>
              </div>

              {/* Cards Secundários de Apoio */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Follow-ups Hoje */}
                <div className="p-3.5 rounded-lg bg-zinc-900/40 border border-zinc-800/60 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-400">Follow-ups para hoje</p>
                    <p className="text-lg font-bold text-zinc-200 mt-0.5">{daily.pendingFollowUps}</p>
                  </div>
                  <Calendar className="h-5 w-5 text-blue-400/80 shrink-0" />
                </div>

                {/* Follow-ups Atrasados */}
                <div className="p-3.5 rounded-lg bg-zinc-900/40 border border-zinc-800/60 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-400">Follow-ups atrasados</p>
                    <p className={`text-lg font-bold mt-0.5 ${daily.overdueFollowUps > 0 ? "text-amber-400" : "text-zinc-200"}`}>
                      {daily.overdueFollowUps}
                    </p>
                  </div>
                  <AlertCircle className={`h-5 w-5 shrink-0 ${daily.overdueFollowUps > 0 ? "text-amber-400" : "text-zinc-500"}`} />
                </div>

                {/* Oportunidades Novas */}
                <div className="p-3.5 rounded-lg bg-zinc-900/40 border border-zinc-800/60 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-400">Leads novos na base</p>
                    <p className="text-lg font-bold text-zinc-200 mt-0.5">{daily.newLeadsAvailable}</p>
                  </div>
                  <Users className="h-5 w-5 text-emerald-400/80 shrink-0" />
                </div>
              </div>
            </TabsContent>

            {/* ABA SEMANAL */}
            <TabsContent value="semanal" className="space-y-4 m-0 focus-visible:outline-none">
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-bold text-zinc-100">
                      {weekly.completed}
                    </span>
                    <span className="text-sm font-medium text-zinc-400">
                      de {weekly.target} contatos nesta semana
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs px-2.5 py-1 ${
                      weekly.isMet
                        ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                        : "border-zinc-700 text-zinc-300 bg-zinc-800/50"
                    }`}
                  >
                    {weekly.percent}% da meta semanal
                  </Badge>
                </div>

                <Progress
                  value={Math.min(100, weekly.percent)}
                  className="h-2.5 bg-zinc-800 [&>div]:bg-emerald-500"
                />

                <p className="text-xs text-zinc-400 mt-2">
                  {weekly.activeDaysCount} de 7 dias com prospecção ativa nesta semana.
                </p>
              </div>

              {/* Histograma Diário de Atividade (Seg a Dom) */}
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
                  Atividade Diária da Semana (Segunda a Domingo)
                </h4>

                <div className="grid grid-cols-7 gap-1.5 sm:gap-3 text-center">
                  {weekly.dailyHistogram.map((day) => {
                    const fillPercent = Math.min(100, Math.round((day.contactsCount / Math.max(1, day.target)) * 100));

                    return (
                      <div
                        key={day.date}
                        className={`p-2 rounded-lg border transition-all flex flex-col items-center justify-between min-h-[95px] ${
                          day.isToday
                            ? "bg-zinc-800/90 border-emerald-500/50 ring-1 ring-emerald-500/20"
                            : day.isFuture
                            ? "bg-zinc-950/40 border-zinc-800/30 opacity-50"
                            : "bg-zinc-900/60 border-zinc-800/60"
                        }`}
                      >
                        <div className="space-y-0.5">
                          <p className={`text-[11px] font-semibold ${day.isToday ? "text-emerald-400" : "text-zinc-400"}`}>
                            {day.dayLabel}
                          </p>
                          <p className="text-[10px] text-zinc-500">{day.dayNumber}</p>
                        </div>

                        {/* Barra Vertical de Progresso */}
                        <div className="w-3 sm:w-4 h-10 bg-zinc-800 rounded-full overflow-hidden flex flex-col justify-end my-1">
                          <div
                            style={{ height: `${fillPercent}%` }}
                            className={`w-full transition-all rounded-full ${
                              day.isMet ? "bg-emerald-400" : day.contactsCount > 0 ? "bg-emerald-500/70" : "bg-transparent"
                            }`}
                          />
                        </div>

                        <div className="flex items-center justify-center">
                          <span className={`text-[11px] font-bold ${day.contactsCount > 0 ? "text-zinc-200" : "text-zinc-600"}`}>
                            {day.contactsCount}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* ABA MENSAL */}
            <TabsContent value="mensal" className="space-y-4 m-0 focus-visible:outline-none">
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-bold text-zinc-100">
                      {monthly.completed}
                    </span>
                    <span className="text-sm font-medium text-zinc-400">
                      de {monthly.target} contatos realizados no mês
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs px-2.5 py-1 ${
                      monthly.isMet
                        ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                        : "border-zinc-700 text-zinc-300 bg-zinc-800/50"
                    }`}
                  >
                    {monthly.percent}% da meta mensal
                  </Badge>
                </div>

                <Progress
                  value={Math.min(100, monthly.percent)}
                  className="h-2.5 bg-zinc-800 [&>div]:bg-emerald-500"
                />

                <div className="flex items-center justify-between text-xs text-zinc-400 mt-2">
                  <span>{monthly.activeDaysCount} dias com prospecção ativa neste mês.</span>
                  <span className="text-zinc-500 text-[11px]">{monthly.totalInteractions} ações registradas</span>
                </div>
              </div>

              {/* SEGREGAÇÃO CLARA: RESULTADOS DE FUNIL (VENDAS vs PRODUTIVIDADE) */}
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-emerald-400" />
                    Resultados de Funil (Status Atual dos Leads)
                  </h4>
                  <span className="text-[11px] text-zinc-500">Métricas de conversão segregadas de atividades</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Negociação */}
                  <div className="p-3 rounded-lg bg-zinc-900/70 border border-blue-500/20">
                    <p className="text-xs text-zinc-400">Em Negociação</p>
                    <p className="text-xl font-bold text-blue-400 mt-0.5">
                      {monthly.funnelOutcomes.negociacao}
                    </p>
                    <span className="text-[10px] text-zinc-500">Oportunidades quentes</span>
                  </div>

                  {/* Convertidos / Vendas */}
                  <div className="p-3 rounded-lg bg-zinc-900/70 border border-emerald-500/20">
                    <p className="text-xs text-zinc-400">Clientes Convertidos</p>
                    <p className="text-xl font-bold text-emerald-400 mt-0.5">
                      {monthly.funnelOutcomes.convertido}
                    </p>
                    <span className="text-[10px] text-zinc-500">Vendas confirmadas</span>
                  </div>

                  {/* Em Qualificação */}
                  <div className="p-3 rounded-lg bg-zinc-900/70 border border-purple-500/20">
                    <p className="text-xs text-zinc-400">Qualificação</p>
                    <p className="text-xl font-bold text-purple-400 mt-0.5">
                      {monthly.funnelOutcomes.qualificacao}
                    </p>
                    <span className="text-[10px] text-zinc-500">Avaliando perfil</span>
                  </div>

                  {/* Em Contato */}
                  <div className="p-3 rounded-lg bg-zinc-900/70 border border-amber-500/20">
                    <p className="text-xs text-zinc-400">Em Contato</p>
                    <p className="text-xl font-bold text-amber-400 mt-0.5">
                      {monthly.funnelOutcomes.em_contato}
                    </p>
                    <span className="text-[10px] text-zinc-500">Aguardando retorno</span>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modais de Ajuste e Confirmação */}
      <AdjustGoalsModal
        open={adjustModalOpen}
        onOpenChange={setAdjustModalOpen}
        activeGoal={activeGoal}
        timezone={timezone}
        onSaveGoals={onSaveGoals}
        onSaveTimezone={onSaveTimezone}
      />

      {selectedLeadForContact && (
        <ConfirmContactModal
          open={quickContactOpen}
          onOpenChange={setQuickContactOpen}
          leadId={selectedLeadForContact.id}
          leadNome={selectedLeadForContact.nome}
          onConfirm={onRegisterContact}
        />
      )}
    </>
  );
}
