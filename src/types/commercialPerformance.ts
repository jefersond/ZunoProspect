export interface CommercialGoalVersion {
  id: string;
  effective_from: string; // Formato YYYY-MM-DD
  daily: number;          // Ex: 5
  weekly: number;         // Ex: 25
  monthly: number;        // Ex: 110
  workdays_per_week?: number; // Ex: 5 (segunda a sexta)
  created_at: string;     // ISO timestamp
}

export type ContactInteractionType =
  | 'primeira_abordagem'
  | 'follow_up'
  | 'ligacao'
  | 'whatsapp'
  | 'email'
  | 'instagram'
  | 'reuniao'
  | 'outro';

export interface UserInteractionRecord {
  id: string;
  user_id: string;
  lead_id: string;
  tipo: ContactInteractionType | string;
  conteudo: string;
  data_interacao: string; // ISO timestamp
  created_at?: string;
  lead_nome?: string;
}

export interface DayActivity {
  date: string; // YYYY-MM-DD no fuso horário do usuário
  dayLabel: string; // 'Seg', 'Ter', 'Qua', etc.
  dayNumber: number; // Dia do mês (1..31)
  contactsCount: number; // Quantidade de leads distintos contatados neste dia
  followUpsCount: number; // Quantidade de follow-ups registrados neste dia
  target: number; // Meta vigente para este dia
  isToday: boolean;
  isFuture: boolean;
  isMet: boolean; // se contactsCount >= target
}

export interface PeriodPerformance {
  target: number;
  completed: number; // Quantidade de leads únicos contatados no período
  percent: number; // 0..100%
  remaining: number; // Contatos restantes para bater a meta
  isMet: boolean;
}

export interface DailyPerformance extends PeriodPerformance {
  date: string; // YYYY-MM-DD
  pendingFollowUps: number;
  overdueFollowUps: number;
  newLeadsAvailable: number;
}

export interface WeeklyPerformance extends PeriodPerformance {
  weekStart: string; // YYYY-MM-DD (segunda-feira)
  weekEnd: string; // YYYY-MM-DD (domingo)
  dailyHistogram: DayActivity[]; // 7 dias da semana
  activeDaysCount: number; // Dias da semana com pelo menos 1 contato realizado
}

export interface MonthlyPerformance extends PeriodPerformance {
  month: string; // YYYY-MM
  activeDaysCount: number; // Dias do mês com pelo menos 1 contato realizado
  totalInteractions: number; // Total de ações registradas
  // Segregação clara entre atividades e resultados de funil
  funnelOutcomes: {
    novo: number;
    em_contato: number;
    qualificacao: number;
    negociacao: number;
    convertido: number;
    perdido: number;
  };
}

export interface PerformanceDashboardData {
  timezone: string;
  goals: CommercialGoalVersion;
  goalsHistory: CommercialGoalVersion[];
  daily: DailyPerformance;
  weekly: WeeklyPerformance;
  monthly: MonthlyPerformance;
  loading: boolean;
  error: string | null;
}
