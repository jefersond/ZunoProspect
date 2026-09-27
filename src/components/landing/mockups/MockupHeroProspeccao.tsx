import { Bot, CheckCircle, Mail, MapPin, MessageCircle, Search, Send, Sparkles, Target, TrendingUp, Star } from "lucide-react";
import { useBillingOfferConfig } from "@/hooks/useBillingOfferConfig";

export function MockupHeroProspeccao() {
  const { trialDurationDays } = useBillingOfferConfig();
  const leads = [
    { nome: "Clínica Bella Saúde", nicho: "Clínica Estética", score: 94, badges: ["Sem pixel", "SEO ruim"] },
    { nome: "Studio Forma Fit", nicho: "Academia", score: 87, badges: ["Instagram fraco"] },
    { nome: "Odonto Prime", nicho: "Clínica Odontológica", score: 79, badges: ["Sem Google Ads"] },
  ];

  return (
    <div className="relative p-6 lg:p-8">
      {/* Elementos decorativos circulares de fundo para profundidade */}
      <div className="absolute right-0 top-0 -z-10 h-72 w-72 rounded-full bg-[#12D98B]/5 blur-[80px]" />
      <div className="absolute left-0 bottom-0 -z-10 h-64 w-64 rounded-full bg-[#0B8F60]/10 blur-[80px]" />

      {/* Main Container / Dashboard Window */}
      <div className="relative overflow-hidden rounded-xl border border-[#20312A] bg-[#111D18] shadow-2xl transition-all duration-500 hover:border-[#21E6A0]/40">
        {/* Header da Janela estilo Mac/OS */}
        <div className="flex items-center justify-between border-b border-[#20312A]/60 bg-[#07100D]/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#20312A]" />
              <span className="h-3 w-3 rounded-full bg-[#20312A]" />
              <span className="h-3 w-3 rounded-full bg-[#20312A]" />
            </div>
            <span className="ml-2 text-xs font-semibold text-[#A9B8B1] font-mono tracking-wider">PROSPECT_OS_V2</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-[#12D98B]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#12D98B]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#12D98B] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#12D98B]"></span>
            </span>
            IA ATIVA
          </div>
        </div>

        {/* Workspace do Mockup */}
        <div className="space-y-4 p-4 lg:p-5">
          {/* Barra de Filtros / Inputs */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex items-center gap-2 rounded-lg border border-[#20312A] bg-[#07100D] px-3 py-2">
              <MapPin className="h-3.5 w-3.5 text-[#12D98B]" />
              <span className="text-xs font-medium text-[#F3F7F5]">São Paulo, SP</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#20312A] bg-[#07100D] px-3 py-2">
              <Search className="h-3.5 w-3.5 text-[#12D98B]" />
              <span className="text-xs font-medium text-[#F3F7F5]">Clínicas Estéticas</span>
            </div>
          </div>

          {/* Seção Central de Leads Encontrados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#A9B8B1] tracking-wider font-mono">
              <span>EMPRESAS ENCONTRADAS</span>
              <span className="text-[#12D98B]">3 OPORTUNIDADES</span>
            </div>

            <div className="space-y-2">
              {leads.map((lead) => (
                <div 
                  key={lead.nome} 
                  className="rounded-lg border border-[#20312A] bg-[#07100D]/50 p-3 transition-all duration-300 hover:bg-[#07100D] hover:border-[#12D98B]/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3.5 w-3.5 text-[#12D98B] shrink-0" />
                        <span className="text-xs font-semibold text-[#F3F7F5]">{lead.nome}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="text-[10px] text-[#A9B8B1] font-medium mr-1.5">{lead.nicho}</span>
                        {lead.badges.map((b) => (
                          <span key={b} className="rounded bg-[#20312A]/40 px-1 py-0.5 text-[9px] text-[#A9B8B1] font-mono border border-[#20312A]/50">
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-[#12D98B] font-mono">{lead.score}%</span>
                      <p className="text-[9px] text-[#A9B8B1]/70 font-mono uppercase">Score</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card Flutuante de Abordagem IA */}
          <div className="rounded-lg border border-[#20312A] bg-[#07100D]/70 p-3.5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 h-16 w-16 bg-[#12D98B]/5 blur-[20px] rounded-full" />
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bot className="h-4 w-4 text-[#12D98B]" />
                <span className="text-xs font-bold text-[#F3F7F5] tracking-wide">Abordagem Gerada com IA</span>
              </div>
              <span className="text-[10px] font-mono text-[#A9B8B1]">Qualificação Máxima</span>
            </div>
            
            <p className="text-xs leading-relaxed text-[#A9B8B1] italic bg-[#0D1713]/60 p-2.5 rounded border border-[#20312A]/40">
              "Vi que a sua clínica aparece bem no Google Maps em Campinas, mas identifiquei que o seu site está sem o pixel de anúncios do Meta e com tempo de resposta lento. Quer ver um diagnóstico rápido de como isso afeta seus agendamentos?"
            </p>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-1.5">
                <span className="inline-flex items-center gap-1 rounded bg-[#12D98B]/10 px-2 py-0.5 text-[10px] font-medium text-[#12D98B]">
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-[#111D18] px-2 py-0.5 text-[10px] font-medium text-[#A9B8B1]">
                  <Send className="h-3 w-3" /> Instagram
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-[#111D18] px-2 py-0.5 text-[10px] font-medium text-[#A9B8B1]">
                  <Mail className="h-3 w-3" /> E-mail
                </span>
              </div>
              <button className="text-[11px] font-bold text-[#12D98B] hover:underline flex items-center gap-0.5">
                Copiar
              </button>
            </div>
          </div>

          {/* Barra de Status Inferior */}
          <div className="flex items-center justify-between rounded-lg border border-[#12D98B]/20 bg-[#12D98B]/5 px-3 py-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-[#12D98B] animate-pulse" />
              <span className="text-[11px] font-semibold text-[#12D98B]">{trialDurationDays ? `Sequência comercial de ${trialDurationDays} dias disponível` : "Sequência comercial disponível durante o teste"}</span>
            </div>
            <TrendingUp className="h-3.5 w-3.5 text-[#12D98B]" />
          </div>
        </div>
      </div>
    </div>
  );
}
