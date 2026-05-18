import { Bot, CheckCircle, Mail, MapPin, MessageCircle, Search, Send, Sparkles, Target, TrendingUp } from "lucide-react";

export function MockupHeroProspeccao() {
  const leads = [
    { nome: "Clínica Bella Saúde", nicho: "Clínica estética", score: 86 },
    { nome: "Studio Forma Fit", nicho: "Academia", score: 78 },
    { nome: "Odonto Prime", nicho: "Clínica odontológica", score: 71 },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl">
      <div className="border-b border-border/50 bg-muted/40 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">Busca de oportunidades</span>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">IA ativa</span>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">Belo Horizonte</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">Saúde e estética</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Empresas encontradas</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">3 leads</span>
        </div>

        <div className="space-y-2">
          {leads.map((lead) => (
            <div key={lead.nome} className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-medium text-foreground">{lead.nome}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{lead.nicho}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-400">{lead.score}</p>
                  <p className="text-[11px] text-muted-foreground">score</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${lead.score}%` }} />
                </div>
                <button className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                  Analisar com IA
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/25 dark:bg-emerald-950/20">
          <div className="mb-2 flex items-center gap-2">
            <Bot className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
            <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Abordagem pronta com IA</span>
          </div>
          <p className="text-sm leading-6 text-slate-700 dark:text-muted-foreground">
            Vi que a clínica aparece bem no Google, mas ainda pode captar mais avaliações e campanhas locais. Posso te mostrar um diagnóstico rápido?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs text-slate-600 dark:bg-background/60 dark:text-muted-foreground">
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs text-slate-600 dark:bg-background/60 dark:text-muted-foreground">
              <Send className="h-3 w-3" /> Instagram
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs text-slate-600 dark:bg-background/60 dark:text-muted-foreground">
              <Mail className="h-3 w-3" /> E-mail
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">Plano de prospecção de 7 dias disponível</span>
          <TrendingUp className="ml-auto h-4 w-4 text-primary" />
        </div>
      </div>
    </div>
  );
}
