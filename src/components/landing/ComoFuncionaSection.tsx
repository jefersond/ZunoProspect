import { useBillingOfferConfig } from "@/hooks/useBillingOfferConfig";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  MapPin, 
  Search, 
  Sparkles, 
  ArrowRight, 
  Bot, 
  Building2,
  MessageSquare,
  Instagram,
  Mail,
  Zap
} from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export function ComoFuncionaSection() {
  const { trialDurationDays } = useBillingOfferConfig();

  const [passoAtivo, setPassoAtivo] = useState(0);

  const passos = [
    {
      titulo: "1. Escolha cidade e nicho",
      subtitulo: "Defina onde e quem quer prospectar",
      descricao: "Defina a região e o nicho de mercado. A Zuno organiza a busca para encontrar empresas dentro desse recorte.",
      icone: MapPin,
    },
    {
      titulo: "2. Encontre empresas",
      subtitulo: "Lista organizada com dados disponíveis",
      descricao: "Veja canais de contato e presença digital quando estiverem disponíveis nas fontes públicas consultadas.",
      icone: Building2,
    },
    {
      titulo: "3. Analise oportunidades com IA",
      subtitulo: "Contexto para priorizar oportunidades",
      descricao: "A Zuno organiza sinais de presença digital e contexto do lead para ajudar você a decidir quais oportunidades analisar primeiro.",
      icone: Bot,
    },
    {
      titulo: "4. Gere abordagens qualificadas",
      subtitulo: "Sugestões para WhatsApp, Instagram e e-mail",
      descricao: "A IA sugere mensagens com base no contexto disponível para você revisar e adaptar ao seu serviço.",
      icone: Sparkles,
    },
    {
      titulo: "5. Copie e comece a conversa",
      subtitulo: "Revise e comece a conversa",
      descricao: "Revise a mensagem sugerida, copie o texto e use o canal público disponível para iniciar a conversa.",
      icone: Zap,
    },
  ];

  const etapasFluxo = [
    { label: "Cidade + Nicho", icone: MapPin, index: 0 },
    { label: "Empresas Encontradas", icone: Building2, index: 1 },
    { label: "Score / Oportunidade", icone: Bot, index: 2 },
    { label: "Mensagem Gerada", icone: Sparkles, index: 3 },
    { label: "Canal de Envio", icone: Zap, index: 4 }
  ];

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="como-funciona" className="relative overflow-hidden bg-[#07100D] py-20 border-b border-[#20312A]/40">
      {/* Brilhos de fundo */}
      <div className="absolute right-1/4 bottom-10 h-80 w-80 rounded-full bg-[#12D98B]/5 blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <Badge variant="outline" className="mb-4 border-[#20312A] text-[#A9B8B1] bg-[#0D1713]/50">
            Como funciona
          </Badge>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-[#F3F7F5] md:text-5xl">
            Da busca à abordagem em um fluxo simples
          </h2>
          <p className="text-base text-[#A9B8B1] md:text-lg">
            Você escolhe cidade e nicho. O Zuno encontra as empresas, a IA analisa as oportunidades e gera a mensagem certa para cada lead.{" "}
            <span className="text-[#12D98B] font-medium">A disponibilidade dos dados depende das fontes públicas consultadas em cada busca.</span>
          </p>
        </div>

        {/* Sequência Visual Horizontal (Esteira de Prospecção) - O Coração do Produto */}
        <div className="mx-auto mb-10 max-w-6xl rounded-xl border border-[#20312A] bg-[#0D1713]/40 p-4 md:p-5 backdrop-blur shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-1.5 lg:gap-2">
            {etapasFluxo.map((etapa, idx) => {
              const ativo = passoAtivo === etapa.index;
              const concluido = passoAtivo > etapa.index;
              return (
                <div key={idx} className="flex-1 flex items-center">
                  <button
                    onClick={() => setPassoAtivo(etapa.index)}
                    className={`flex flex-col md:flex-row items-center gap-2 md:gap-1.5 lg:gap-2.5 px-3 py-2.5 md:px-1.5 md:py-2 lg:px-3 lg:py-2.5 rounded-lg border text-left transition-all duration-300 w-full ${
                      ativo
                        ? "bg-[#0D1713] border-[#12D98B] text-[#12D98B] shadow-[0_0_15px_rgba(18,217,139,0.1)] scale-[1.02]"
                        : concluido
                        ? "bg-[#0D1713]/20 border-[#12D98B]/20 text-[#12D98B]/80"
                        : "bg-transparent border-transparent text-[#A9B8B1] hover:text-[#F3F7F5]"
                    }`}
                  >
                    <div className={`flex h-8 w-8 md:h-7 md:w-7 lg:h-8 lg:w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                      ativo
                        ? "border-[#12D98B] bg-[#12D98B]/10 text-[#12D98B]"
                        : concluido
                        ? "border-[#12D98B]/30 bg-[#12D98B]/5 text-[#12D98B]"
                        : "border-[#20312A] text-[#A9B8B1]"
                    }`}>
                      <etapa.icone className="h-4 w-4 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] md:text-[8px] lg:text-[9px] uppercase font-mono tracking-wider text-[#A9B8B1]">Etapa {idx + 1}</p>
                      <p className="text-xs md:text-[10px] lg:text-xs font-bold whitespace-nowrap">{etapa.label}</p>
                    </div>
                  </button>
                  {idx < etapasFluxo.length - 1 && (
                    <div className="hidden md:block mx-1.5 lg:mx-2 xl:mx-3 text-[#20312A] font-bold text-base lg:text-lg">➔</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] items-center max-w-6xl mx-auto">
          {/* Lado Esquerdo: Lista de Passos */}
          <div className="space-y-3">
            {passos.map((passo, index) => {
              const ativo = passoAtivo === index;
              return (
                <button
                  key={index}
                  onClick={() => setPassoAtivo(index)}
                  className={`w-full text-left p-5 rounded-xl border transition-all duration-300 relative overflow-hidden flex items-start gap-4 ${
                    ativo 
                      ? "bg-[#0D1713] border-[#12D98B]/30 shadow-[0_0_30px_rgba(18,217,139,0.02)]" 
                      : "bg-[#0D1713]/30 border-[#20312A]/60 opacity-60 hover:opacity-95"
                  }`}
                >
                  {ativo && (
                    <div className="absolute top-0 left-0 w-[4px] h-full bg-[#12D98B]" />
                  )}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                    ativo ? "border-[#12D98B]/30 bg-[#12D98B]/10 text-[#12D98B]" : "border-[#20312A] text-[#A9B8B1]"
                  }`}>
                    <passo.icone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className={`text-base font-bold transition-colors ${ativo ? "text-[#F3F7F5]" : "text-[#A9B8B1]"}`}>
                      {passo.titulo}
                    </h3>
                    <p className="text-xs text-[#12D98B]/80 mt-0.5 font-medium">{passo.subtitulo}</p>
                    {ativo && (
                      <p className="text-xs text-[#A9B8B1] mt-2 leading-relaxed animate-fadeIn">
                        {passo.descricao}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Lado Direito: Simulador de Interface (Muda conforme o passo) */}
          <div className="relative overflow-hidden rounded-xl border border-[#20312A] bg-[#0D1713] shadow-2xl p-4 lg:p-6 min-h-[400px] flex flex-col justify-between">
            {/* Abas superiores da janela */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-[#12D98B]" />
            <div className="flex items-center gap-1.5 border-b border-[#20312A]/60 pb-3 mb-4 text-xs font-mono text-[#A9B8B1] uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-[#12D98B]" />
              <span>Exemplo demonstrativo. Zuno Software • {etapasFluxo[passoAtivo].label}</span>
            </div>

            <div className="flex-1 flex flex-col justify-center">
              {/* PASSO 1: Busca */}
              {passoAtivo === 0 && (
                <div className="space-y-4 py-4 animate-fadeIn">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[#A9B8B1] uppercase tracking-wider font-mono">
                      Nicho de Prospecção
                    </label>
                    <div className="flex items-center gap-2 rounded-lg border border-[#20312A] bg-[#07100D] p-3 text-sm text-[#F3F7F5]">
                      <Search className="h-4 w-4 text-[#12D98B]" />
                      <span>Clínica Odontológica</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[#A9B8B1] uppercase tracking-wider font-mono">
                      Cidade e Região
                    </label>
                    <div className="flex items-center gap-2 rounded-lg border border-[#20312A] bg-[#07100D] p-3 text-sm text-[#F3F7F5]">
                      <MapPin className="h-4 w-4 text-[#12D98B]" />
                      <span>Ribeirão Preto, SP</span>
                    </div>
                  </div>

                  <div className="w-full h-12 rounded-lg bg-[#12D98B] text-[#07100D] font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(18,217,139,0.2)]">
                    <Zap className="h-4 w-4 fill-current" />
                    Buscar Empresas com IA
                  </div>
                </div>
              )}

              {/* PASSO 2: Leads Encontrados */}
              {passoAtivo === 1 && (
                <div className="space-y-3 py-2 animate-fadeIn">
                  <p className="text-xs text-[#A9B8B1] mb-1 font-mono">
                    Resultados encontrados na região:
                  </p>
                  
                  <div className="rounded-lg border border-[#12D98B]/20 bg-[#07100D]/60 p-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-[#F3F7F5]">Empresa demonstrativa A</h4>
                      <p className="text-[11px] text-[#A9B8B1]">Ribeirão Preto • (16) 99281-XXXX</p>
                      <div className="mt-1.5 flex gap-1.5">
                        <span className="rounded bg-red-950/30 px-1.5 py-0.5 text-[9px] font-mono text-red-400 border border-red-900/30">Sem Pixel</span>
                        <span className="rounded bg-[#20312A]/40 px-1.5 py-0.5 text-[9px] font-mono text-[#A9B8B1] border border-[#20312A]">Site Lento</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-[#12D98B] bg-[#12D98B]/10 px-2 py-0.5 rounded-full font-mono border border-[#12D98B]/20">Prioridade sugerida</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#20312A] bg-[#07100D]/20 p-3 opacity-60 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-[#F3F7F5]">Empresa demonstrativa B</h4>
                      <p className="text-[11px] text-[#A9B8B1]">Ribeirão Preto • (16) 98177-XXXX</p>
                    </div>
                    <span className="text-xs font-bold text-zinc-400 bg-zinc-800/30 px-2 py-0.5 rounded-full font-mono">Outra oportunidade</span>
                  </div>
                </div>
              )}

              {/* PASSO 3: Diagnóstico IA */}
              {passoAtivo === 2 && (
                <div className="space-y-3 py-2 animate-fadeIn">
                  <div className="rounded-lg border border-[#20312A] bg-[#07100D] p-3 text-xs text-[#A9B8B1]">
                    <div className="flex items-center gap-1.5 text-[#12D98B] font-bold mb-2 font-mono">
                      <Bot className="h-3.5 w-3.5" />
                      <span>Diagnóstico de Oportunidades:</span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] list-disc list-inside">
                      <li>Sem Tag de Anúncios (Pixel ausente no site oficial)</li>
                      <li>Velocidade mobile insatisfatória (carregamento &gt; 4.2s)</li>
                      <li>Perfil de Instagram ativo com alto engajamento orgânico</li>
                    </ul>
                  </div>

                  <div className="rounded-lg border border-[#20312A] bg-[#07100D]/50 p-3 text-xs text-[#F3F7F5] border-l-2 border-l-[#12D98B] flex items-center justify-between">
                    <div>
                      <p className="font-bold">Pontuação de Vendas (Score)</p>
                      <p className="text-[10px] text-[#A9B8B1]">Potencial de conversão em serviços</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-extrabold text-[#12D98B] font-mono">92/100</p>
                      <p className="text-[8px] uppercase tracking-wider text-[#12D98B] font-bold">Excelente</p>
                    </div>
                  </div>
                </div>
              )}

              {/* PASSO 4: Copies de Abordagem */}
              {passoAtivo === 3 && (
                <div className="space-y-3 py-1 animate-fadeIn">
                  <div className="flex border-b border-[#20312A] pb-1.5 gap-2">
                    <span className="text-xs font-bold text-[#12D98B] border-b-2 border-[#12D98B] pb-1.5 px-1 cursor-default">WhatsApp</span>
                    <span className="text-xs text-[#A9B8B1] pb-1.5 px-1 cursor-default opacity-60">Instagram Direct</span>
                    <span className="text-xs text-[#A9B8B1] pb-1.5 px-1 cursor-default opacity-60">E-mail</span>
                  </div>
                  
                  <div className="rounded-lg border border-[#20312A] bg-[#07100D]/80 p-3 text-xs text-[#F3F7F5] italic border-l-2 border-[#12D98B] leading-relaxed max-h-[140px] overflow-y-auto">
                    "Olá, notei que sua clínica em Ribeirão Preto possui excelentes avaliações orgânicas, mas analisando o site oficial vi que o Pixel do Meta Ads está inativo. Isso significa que vocês estão perdendo potenciais clientes que entram no site e saem sem agendar. Tenho uma estratégia local rápida para capturar esse público..."
                  </div>
                </div>
              )}

              {/* PASSO 5: Início da Conversa */}
              {passoAtivo === 4 && (
                <div className="space-y-4 py-3 animate-fadeIn text-center">
                  <div className="rounded-lg border border-[#12D98B]/10 bg-[#12D98B]/5 p-3 text-xs text-[#12D98B] font-medium leading-relaxed max-w-sm mx-auto">
                    Copy copiada para a área de transferência!
                  </div>

                  <div className="flex justify-center gap-3">
                    <div className="rounded-lg border border-[#20312A] bg-[#07100D] p-3 text-center w-32">
                      <Instagram className="h-5 w-5 mx-auto text-pink-400 mb-1" />
                      <span className="text-xs font-bold text-[#F3F7F5]">Direct</span>
                    </div>
                    <div className="rounded-lg border border-[#12D98B]/30 bg-[#12D98B]/10 p-3 text-center w-32 border-2 shadow-[0_0_15px_rgba(18,217,139,0.05)]">
                      <MessageSquare className="h-5 w-5 mx-auto text-[#12D98B] mb-1" />
                      <span className="text-xs font-bold text-[#F3F7F5]">WhatsApp</span>
                    </div>
                    <div className="rounded-lg border border-[#20312A] bg-[#07100D] p-3 text-center w-32">
                      <Mail className="h-5 w-5 mx-auto text-blue-400 mb-1" />
                      <span className="text-xs font-bold text-[#F3F7F5]">E-mail</span>
                    </div>
                  </div>

                  <div className="w-full h-11 rounded-lg bg-transparent border border-[#12D98B] text-[#12D98B] font-bold flex items-center justify-center gap-2 hover:bg-[#12D98B]/10 transition-colors">
                    <Zap className="h-4 w-4" />
                    Iniciar Conversa no WhatsApp
                  </div>
                </div>
              )}
            </div>

            {/* Footer do Simulador */}
            <div className="mt-4 border-t border-[#20312A]/40 pt-3 flex items-center justify-between text-[11px] text-[#A9B8B1]">
              <span>Esteira Comercial Inteligente</span>
              <span className="text-[#12D98B]">Simulação da Plataforma</span>
            </div>
          </div>
        </div>

        {/* CTA final da seção */}
        <div className="mt-14 text-center">
          <Button
            size="lg"
            className="h-14 rounded-lg bg-[#12D98B] text-[#07100D] font-bold shadow-[0_0_30px_rgba(18,217,139,0.2)] hover:bg-[#21E6A0] transition-all px-8 text-base md:text-lg"
            onClick={() => {
              trackEvent("cta_clicked", { cta: "comecar_gratis", location: "como_funciona" });
              scrollToSection("precos");
            }}
          >
            {trialDurationDays ? `Começar teste grátis de ${trialDurationDays} dias` : "Começar teste grátis"}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="text-xs font-semibold text-[#A9B8B1] mt-3 tracking-wide">
            Hoje R$0. Cartão necessário. Cancele antes da cobrança
          </p>
        </div>
      </div>
    </section>
  );
}
