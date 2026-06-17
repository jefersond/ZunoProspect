import { Bot, CheckCircle, Mail, MapPin, MessageCircle, Search, Send, Sparkles, Target, TrendingUp, Star } from "lucide-react";

export function MockupHeroProspeccao() {
  const leads = [
    { nome: "Clínica Bella Saúde", nicho: "Clínica Estética", score: 94, badges: ["Sem pixel", "SEO ruim"] },
    { nome: "Studio Forma Fit", nicho: "Academia", score: 87, badges: ["Instagram fraco"] },
    { nome: "Odonto Prime", nicho: "Clínica Odontológica", score: 79, badges: ["Sem Google Ads"] },
  ];

  return (
    <div className="relative p-6 lg:p-8">
      {/* Elementos decorativos circulares de fundo para profundidade */}
      <div className="absolute right-0 top-0 -z-10 h-72 w-72 rounded-full bg-[#10d98a]/5 blur-[80px]" />
      <div className="absolute left-0 bottom-0 -z-10 h-64 w-64 rounded-full bg-emerald-950/20 blur-[80px]" />

      {/* Main Container / Dashboard Window */}
      <div className="relative overflow-hidden rounded-xl border border-[#1f2d29] bg-[#111816] shadow-2xl transition-all duration-500 hover:border-[#10d98a]/30">
        {/* Header da Janela estilo Mac/OS */}
        <div className="flex items-center justify-between border-b border-[#1f2d29]/60 bg-[#0b0f0e]/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#1f2d29]" />
              <span className="h-3 w-3 rounded-full bg-[#1f2d29]" />
              <span className="h-3 w-3 rounded-full bg-[#1f2d29]" />
            </div>
            <span className="ml-2 text-xs font-semibold text-[#9ca3af] font-mono tracking-wider">PROSPECT_OS_V2</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-[#10d98a]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#10d98a]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10d98a] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#10d98a]"></span>
            </span>
            IA ATIVA
          </div>
        </div>

        {/* Workspace do Mockup */}
        <div className="space-y-4 p-4 lg:p-5">
          {/* Barra de Filtros / Inputs */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex items-center gap-2 rounded-lg border border-[#1f2d29] bg-[#0b0f0e] px-3 py-2">
              <MapPin className="h-3.5 w-3.5 text-[#10d98a]" />
              <span className="text-xs font-medium text-[#f4f4f5]">São Paulo - SP</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#1f2d29] bg-[#0b0f0e] px-3 py-2">
              <Search className="h-3.5 w-3.5 text-[#10d98a]" />
              <span className="text-xs font-medium text-[#f4f4f5]">Clínicas Estéticas</span>
            </div>
          </div>

          {/* Seção Central de Leads Encontrados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#9ca3af] tracking-wider font-mono">
              <span>EMPRESAS ENCONTRADAS</span>
              <span className="text-[#10d98a]">3 OPORTUNIDADES</span>
            </div>

            <div className="space-y-2">
              {leads.map((lead) => (
                <div 
                  key={lead.nome} 
                  className="rounded-lg border border-[#1f2d29] bg-[#0b0f0e]/50 p-3 transition-all duration-300 hover:bg-[#0b0f0e] hover:border-[#10d98a]/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3.5 w-3.5 text-[#10d98a] shrink-0" />
                        <span className="text-xs font-semibold text-[#f4f4f5]">{lead.nome}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="text-[10px] text-[#9ca3af] font-medium mr-1.5">{lead.nicho}</span>
                        {lead.badges.map((b) => (
                          <span key={b} className="rounded bg-[#1f2d29]/40 px-1 py-0.5 text-[9px] text-[#9ca3af] font-mono border border-[#1f2d29]/50">
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-[#10d98a] font-mono">{lead.score}%</span>
                      <p className="text-[9px] text-[#9ca3af]/70 font-mono uppercase">Score</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card Flutuante de Abordagem IA */}
          <div className="rounded-lg border border-[#1f2d29] bg-[#0b0f0e]/70 p-3.5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 h-16 w-16 bg-[#10d98a]/5 blur-[20px] rounded-full" />
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bot className="h-4 w-4 text-[#10d98a]" />
                <span className="text-xs font-bold text-[#f4f4f5] tracking-wide">Abordagem Gerada com IA</span>
              </div>
              <span className="text-[10px] font-mono text-[#9ca3af]">Qualificação Máxima</span>
            </div>
            
            <p className="text-xs leading-relaxed text-[#9ca3af] italic bg-[#111816]/60 p-2.5 rounded border border-[#1f2d29]/40">
              "Vi que a sua clínica aparece bem no Google Maps em Campinas, mas identifiquei que o seu site está sem o pixel de anúncios do Meta e com tempo de resposta lento. Quer ver um diagnóstico rápido de como isso afeta seus agendamentos?"
            </p>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-1.5">
                <span className="inline-flex items-center gap-1 rounded bg-[#10d98a]/10 px-2 py-0.5 text-[10px] font-medium text-[#10d98a]">
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                  <Send className="h-3 w-3" /> Instagram
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                  <Mail className="h-3 w-3" /> E-mail
                </span>
              </div>
              <button className="text-[11px] font-bold text-[#10d98a] hover:underline flex items-center gap-0.5">
                Copiar
              </button>
            </div>
          </div>

          {/* Barra de Status Inferior */}
          <div className="flex items-center justify-between rounded-lg border border-[#10d98a]/20 bg-[#10d98a]/5 px-3 py-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-[#10d98a] animate-pulse" />
              <span className="text-[11px] font-semibold text-[#10d98a]">Sequência comercial de 7 dias disponível</span>
            </div>
            <TrendingUp className="h-3.5 w-3.5 text-[#10d98a]" />
          </div>
        </div>
      </div>
    </div>
  );
}
